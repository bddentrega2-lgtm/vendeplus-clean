import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { getCustomerBadges, shouldContactCustomer } from "@/lib/customers/customer-segments";
import { buildContactAgainMessage, buildRepeatLastOrderMessage, buildWhatsappUrl } from "@/lib/customers/customer-messages";
import { safeUpsertCustomerFromOrder } from "@/lib/customers/upsert-customer-from-order";

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function includesSearch(customer: any, search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [customer.name, customer.phone, customer.phone_normalized]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function matchesSegment(customer: any, segment: string) {
  if (!segment || segment === "all") return true;

  const ordersCount = toNumber(customer.orders_count);
  const totalSpent = toNumber(customer.total_spent_usd);

  if (segment === "new") return ordersCount <= 1;
  if (segment === "frequent") return ordersCount >= 3;
  if (segment === "vip") return ordersCount >= 5 || totalSpent >= 100;
  if (segment === "contact") return shouldContactCustomer(customer);
  if (segment === "pending_payment") return toNumber(customer.pending_payments_count) > 0;
  if (segment === "delivery") return customer.preferred_fulfillment === "delivery";
  if (segment === "pickup") return customer.preferred_fulfillment === "pickup";

  return true;
}

function getLastOrderSummary(order: any) {
  if (!order) return null;

  return {
    id: order.id,
    public_code: order.public_code,
    total_usd: order.total_usd,
    created_at: order.created_at,
    items: order.order_items || [],
  };
}

async function hydrateCustomersFromExistingOrders(supabase: any, storeIds: string[] | null) {
  let ordersQuery = supabase
    .from("orders")
    .select(
      `
      id,
      store_id,
      customer_name,
      customer_phone,
      delivery_type,
      payment_method,
      delivery_reference,
      total_usd,
      created_at
    `
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (storeIds !== null) {
    ordersQuery = ordersQuery.in("store_id", storeIds);
  }

  const { data, error } = await ordersQuery;
  if (error) return 0;

  let processed = 0;
  for (const order of data || []) {
    const customerId = await safeUpsertCustomerFromOrder(supabase, order as any);
    if (customerId) processed += 1;
  }

  return processed;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get("search") || "").trim();
    const safeSearch = search.replace(/[%,()]/g, " ").trim();
    const segment = String(searchParams.get("segment") || "all");
    const limit = Math.min(
      200,
      Math.max(25, Number(searchParams.get("limit") || 80))
    );
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

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
        last_order_id,
        last_order_at,
        favorite_products,
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
      .range(offset, offset + limit - 1);

    let storesQuery = supabase
      .from("stores")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (auth.storeIds !== null) {
      customersQuery = customersQuery.in("store_id", auth.storeIds);
      storesQuery = storesQuery.in("id", auth.storeIds);
    }

    if (safeSearch) {
      customersQuery = customersQuery.or(
        `name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,phone_normalized.ilike.%${safeSearch}%`
      );
    }

    let [customersResult, storesResult] = await Promise.all([
      customersQuery,
      storesQuery,
    ]);

    if (customersResult.error) {
      return NextResponse.json({
        customers: [],
        stores: storesResult.data || [],
        summary: {
          total: 0,
          newCustomers: 0,
          frequent: 0,
          vip: 0,
          contact: 0,
          pendingPayment: 0,
        },
        needsMigration: true,
        error: "Aplica la migración de clientes para activar este módulo.",
      });
    }
    if (storesResult.error) throw storesResult.error;

    let customers = customersResult.data || [];

    if (!customers.length && offset === 0 && !safeSearch && segment === "all") {
      const processed = await hydrateCustomersFromExistingOrders(supabase, auth.storeIds);

      if (processed > 0) {
        let hydratedCustomersQuery = supabase
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
            last_order_id,
            last_order_at,
            favorite_products,
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
          .range(offset, offset + limit - 1);

        if (auth.storeIds !== null) {
          hydratedCustomersQuery = hydratedCustomersQuery.in("store_id", auth.storeIds);
        }

        const hydratedResult = await hydratedCustomersQuery;
        if (!hydratedResult.error) {
          customers = hydratedResult.data || [];
        }
      }
    }

    const customerIds = customers.map((customer: any) => customer.id).filter(Boolean);

    let pendingByCustomer = new Map<string, number>();
    let lastOrdersById = new Map<string, any>();

    if (customerIds.length) {
      const [pendingResult, lastOrdersResult] = await Promise.all([
        supabase
          .from("orders")
          .select("customer_id, payment_status")
          .in("customer_id", customerIds)
          .in("payment_status", ["pending", "review", "incomplete"]),
        supabase
          .from("orders")
          .select(
            `
            id,
            public_code,
            customer_id,
            total_usd,
            created_at,
            order_items (
              product_name,
              variant_name,
              quantity
            )
          `
          )
          .in("id", customers.map((customer: any) => customer.last_order_id).filter(Boolean)),
      ]);

      if (!pendingResult.error) {
        for (const order of pendingResult.data || []) {
          const customerId = String((order as any).customer_id || "");
          pendingByCustomer.set(customerId, (pendingByCustomer.get(customerId) || 0) + 1);
        }
      }

      if (!lastOrdersResult.error) {
        lastOrdersById = new Map(
          (lastOrdersResult.data || []).map((order: any) => [String(order.id), order])
        );
      }
    }

    const enriched = customers.map((customer: any) => {
      const pendingPaymentsCount = pendingByCustomer.get(String(customer.id)) || 0;
      const lastOrder = lastOrdersById.get(String(customer.last_order_id));
      const badges = getCustomerBadges({
        ...customer,
        pending_payments_count: pendingPaymentsCount,
      });
      const storeName = customer.stores?.name || "tu comercio";
      const repeatMessage = buildRepeatLastOrderMessage({
        customerName: customer.name,
        storeName,
        items: lastOrder?.order_items || [],
      });
      const contactMessage = buildContactAgainMessage({
        customerName: customer.name,
        storeName,
      });

      return {
        ...customer,
        pending_payments_count: pendingPaymentsCount,
        badges,
        last_order: getLastOrderSummary(lastOrder),
        repeat_message: repeatMessage,
        repeat_whatsapp_url: buildWhatsappUrl(customer.phone, repeatMessage),
        contact_message: contactMessage,
        contact_whatsapp_url: buildWhatsappUrl(customer.phone, contactMessage),
      };
    });

    const filtered = enriched
      .filter((customer) => includesSearch(customer, search))
      .filter((customer) => matchesSegment(customer, segment));

    const summary = {
      total: enriched.length,
      newCustomers: enriched.filter((customer) => toNumber(customer.orders_count) <= 1).length,
      frequent: enriched.filter((customer) => toNumber(customer.orders_count) >= 3).length,
      vip: enriched.filter(
        (customer) =>
          toNumber(customer.orders_count) >= 5 || toNumber(customer.total_spent_usd) >= 100
      ).length,
      contact: enriched.filter(shouldContactCustomer).length,
      pendingPayment: enriched.filter(
        (customer) => toNumber(customer.pending_payments_count) > 0
      ).length,
    };

    return NextResponse.json({
      customers: filtered,
      stores: storesResult.data || [],
      summary,
      page: {
        limit,
        offset,
        hasMore: customers.length === limit,
      },
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando clientes.");
  }
}
