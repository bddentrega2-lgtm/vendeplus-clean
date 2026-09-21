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

function matchesSegment(customer: any, segment: string) {
  if (!segment || segment === "all") return true;

  const ordersCount = toNumber(customer.orders_count);
  const totalSpent = toNumber(customer.total_spent_usd);

  if (segment === "new") return ordersCount === 1;
  if (segment === "frequent") return ordersCount >= 3;
  if (segment === "vip") return ordersCount >= 5 || totalSpent >= 100;
  if (segment === "contact") return shouldContactCustomer(customer);
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

function buildCsv(customers: any[]) {
  const headers = [
    "Comercio",
    "Nombre",
    "Telefono",
    "Pedidos",
    "Valor de productos USD",
    "Ultima compra",
    "Metodo de pago preferido",
    "Modalidad preferida",
    "Direccion frecuente",
    "Etiquetas",
    "Notas",
  ];

  const rows = customers.map((customer) => {
    const badges = getCustomerBadges(customer)
      .map((badge) => badge.label)
      .join(", ");
    const tags = Array.isArray(customer.tags) ? customer.tags.join(", ") : "";

    return [
      customer.stores?.name || "",
      customer.name || "",
      customer.phone || "",
      toNumber(customer.orders_count),
      toNumber(customer.total_spent_usd).toFixed(2),
      formatDate(customer.last_order_at),
      customer.preferred_payment_method || "",
      customer.preferred_fulfillment || "",
      customer.frequent_address || "",
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
    const storeId = String(
      searchParams.get("storeId") || request.headers.get("x-panel-store-id") || ""
    ).trim();
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

    const buildCustomersQuery = () => {
      let query = supabase.from("customers").select(
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
      ).order("last_order_at", { ascending: false, nullsFirst: false }).order("id", { ascending: true });

      if (storeId) {
        query = query.eq("store_id", storeId);
      } else if (managerStoreIds !== null) {
        query = managerStoreIds.length
          ? query.in("store_id", managerStoreIds)
          : query.eq("store_id", "__no_authorized_store__");
      } else if (auth.storeIds !== null) {
        query = query.in("store_id", auth.storeIds);
      }

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,phone.ilike.%${search}%,phone_normalized.ilike.%${search}%`
        );
      }
      return query;
    };

    const customers: any[] = [];
    for (let offset = 0; offset < MAX_EXPORT_ROWS; offset += 500) {
      const { data, error } = await buildCustomersQuery().range(offset, Math.min(offset + 499, MAX_EXPORT_ROWS - 1));
      if (error) throw error;
      customers.push(...(data || []));
      if ((data || []).length < 500) break;
    }

    const filtered = customers.filter((customer: any) =>
      matchesSegment(customer, segment)
    );
    const csv = buildCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clientes-somos-${date}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo exportar la base de clientes.");
  }
}
