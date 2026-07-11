import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreManager,
  canUseStoreRole,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCustomerBadges, shouldContactCustomer } from "@/lib/customers/customer-segments";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";

const MAX_EXPORT_ROWS = 5000;
const CUSTOMER_EXPORT_LIMIT = 12;
const CUSTOMER_EXPORT_RATE_WINDOW_MS = 10 * 60 * 1000;

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanSearch(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[%,()]/g, " ")
    .slice(0, 80);
}

function matchesSegment(customer: any, segment: string, pendingPaymentsCount: number) {
  if (!segment || segment === "all") return true;

  const ordersCount = toNumber(customer.orders_count);
  const totalSpent = toNumber(customer.total_spent_usd);

  if (segment === "new") return ordersCount <= 1;
  if (segment === "frequent") return ordersCount >= 3;
  if (segment === "vip") return ordersCount >= 5 || totalSpent >= 100;
  if (segment === "contact") return shouldContactCustomer(customer);
  if (segment === "pending_payment") return pendingPaymentsCount > 0;
  if (segment === "delivery") return customer.preferred_fulfillment === "delivery";
  if (segment === "pickup") return customer.preferred_fulfillment === "pickup";

  return true;
}

function csvCell(value: unknown) {
  let text = String(value ?? "").replace(/\r?\n/g, " ").trim();

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value: unknown) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(String(value)));
  } catch {
    return String(value);
  }
}

function buildCsv(customers: any[], pendingByCustomer: Map<string, number>) {
  const headers = [
    "Comercio",
    "Nombre",
    "Telefono",
    "Pedidos",
    "Total USD",
    "Ticket promedio USD",
    "Ultima compra",
    "Metodo de pago preferido",
    "Modalidad preferida",
    "Direccion frecuente",
    "Pagos pendientes",
    "Etiquetas",
    "Notas",
  ];

  const rows = customers.map((customer) => {
    const pending = pendingByCustomer.get(String(customer.id)) || 0;
    const badges = getCustomerBadges({
      ...customer,
      pending_payments_count: pending,
    })
      .map((badge) => badge.label)
      .join(", ");
    const tags = Array.isArray(customer.tags) ? customer.tags.join(", ") : "";

    return [
      customer.stores?.name || "",
      customer.name || "",
      customer.phone || "",
      toNumber(customer.orders_count),
      toNumber(customer.total_spent_usd).toFixed(2),
      toNumber(customer.average_ticket_usd).toFixed(2),
      formatDate(customer.last_order_at),
      customer.preferred_payment_method || "",
      customer.preferred_fulfillment || "",
      customer.frequent_address || "",
      pending,
      [badges, tags].filter(Boolean).join(" | "),
      customer.notes || "",
    ];
  });

  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const clientIp = getClientIp(request);
    const limit = await checkDistributedRateLimit({
      key: `customers-export:${auth.email || auth.userId || clientIp}:${clientIp}`,
      limit: CUSTOMER_EXPORT_LIMIT,
      windowMs: CUSTOMER_EXPORT_RATE_WINDOW_MS,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Demasiadas descargas. Espera unos minutos e intenta de nuevo." },
        {
          status: 429,
          headers: rateLimitHeaders(limit, CUSTOMER_EXPORT_LIMIT),
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const storeId = String(searchParams.get("storeId") || "").trim();
    const search = cleanSearch(searchParams.get("search"));
    const segment = String(searchParams.get("segment") || "all");
    const supabase = createSupabaseAdminClient();

    const managerStoreIds =
      auth.storeIds === null
        ? null
        : auth.storeIds.filter((id) => canUseStoreRole(auth, id, ["owner", "admin"]));

    if (storeId) {
      assertStoreManager(auth, storeId, "No tienes permiso para exportar clientes de este comercio.");
    }

    let customersQuery = supabase
      .from("customers")
      .select(
        `
        id,
        store_id,
        name,
        phone,
        phone_normalized,
        notes,
        tags,
        orders_count,
        total_spent_usd,
        average_ticket_usd,
        last_order_at,
        frequent_address,
        preferred_payment_method,
        preferred_fulfillment,
        stores (
          name,
          slug
        )
      `
      )
      .order("last_order_at", { ascending: false, nullsFirst: false })
      .limit(MAX_EXPORT_ROWS);

    if (storeId) {
      customersQuery = customersQuery.eq("store_id", storeId);
    } else if (managerStoreIds !== null) {
      customersQuery = managerStoreIds.length
        ? customersQuery.in("store_id", managerStoreIds)
        : customersQuery.eq("store_id", "__no_authorized_store__");
    } else if (auth.storeIds !== null) {
      customersQuery = customersQuery.in("store_id", auth.storeIds);
    }

    if (search) {
      customersQuery = customersQuery.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,phone_normalized.ilike.%${search}%`
      );
    }

    const { data, error } = await customersQuery;
    if (error) throw error;

    const customers = data || [];
    const customerIds = customers.map((customer: any) => customer.id).filter(Boolean);
    const pendingByCustomer = new Map<string, number>();

    if (customerIds.length) {
      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("customer_id, payment_status")
        .in("customer_id", customerIds)
        .in("payment_status", ["pending", "review", "incomplete"]);

      for (const order of pendingOrders || []) {
        const customerId = String((order as any).customer_id || "");
        pendingByCustomer.set(customerId, (pendingByCustomer.get(customerId) || 0) + 1);
      }
    }

    const filtered = customers.filter((customer: any) =>
      matchesSegment(customer, segment, pendingByCustomer.get(String(customer.id)) || 0)
    );
    const csv = buildCsv(filtered, pendingByCustomer);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clientes-vendemas-${date}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo exportar la base de clientes.");
  }
}
