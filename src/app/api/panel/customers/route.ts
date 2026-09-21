import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStoreAccess, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { getCustomerBadges, shouldContactCustomer } from "@/lib/customers/customer-segments";
import { buildContactAgainMessage, buildRepeatLastOrderMessage, buildWhatsappUrl } from "@/lib/customers/customer-messages";

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

  if (segment === "new") return ordersCount === 1;
  if (segment === "frequent") return ordersCount >= 3;
  if (segment === "vip") return ordersCount >= 5 || totalSpent >= 100;
  if (segment === "contact") return shouldContactCustomer(customer);
  if (segment === "delivery") return customer.preferred_fulfillment === "delivery";
  if (segment === "pickup") return customer.preferred_fulfillment === "pickup";

  return true;
}

function applyCustomerScope(query: any, storeIds: string[] | null) {
  return storeIds === null ? query : query.in("store_id", storeIds);
}

function applyCustomerSearch(query: any, search: string) {
  if (!search) return query;
  return query.or(
    `name.ilike.%${search}%,phone.ilike.%${search}%,phone_normalized.ilike.%${search}%`
  );
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const requestedStoreId = String(request.headers.get("x-panel-store-id") || "").trim();

    if (requestedStoreId) {
      assertStoreAccess(auth, requestedStoreId, "No tienes permiso para consultar esta sede.");
    }

    const scopedStoreIds = requestedStoreId ? [requestedStoreId] : auth.storeIds;
    const customerDetailsPromise = scopedStoreIds === null
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("store_achievement_unlocks")
          .select("store_id")
          .in("store_id", scopedStoreIds)
          .eq("achievement_key", "promos_3_three_months_customer_details");
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get("search") || "").trim();
    const safeSearch = search.replace(/[,.%()]/g, " ").trim();
    const segment = String(searchParams.get("segment") || "all");
    const limit = Math.min(
      200,
      Math.max(25, Number(searchParams.get("limit") || 80))
    );
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const to = offset + limit;

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
      .order("last_order_at", { ascending: false, nullsFirst: false });

    let storesQuery = supabase
      .from("stores")
      .select("id, name, slug")
      .order("name", { ascending: true });

    customersQuery = applyCustomerScope(customersQuery, scopedStoreIds);
    if (scopedStoreIds !== null) storesQuery = storesQuery.in("id", scopedStoreIds);

    customersQuery = applyCustomerSearch(customersQuery, safeSearch);

    if (segment === "new") {
      customersQuery = customersQuery.eq("orders_count", 1);
    } else if (segment === "frequent") {
      customersQuery = customersQuery.gte("orders_count", 3);
    } else if (segment === "vip") {
      customersQuery = customersQuery.or("orders_count.gte.5,total_spent_usd.gte.100");
    } else if (segment === "contact") {
      const contactBefore = new Date(Date.now() - 21 * 86400000).toISOString();
      customersQuery = customersQuery
        .gte("orders_count", 2)
        .lte("last_order_at", contactBefore);
    } else if (segment === "delivery") {
      customersQuery = customersQuery.eq("preferred_fulfillment", "delivery");
    } else if (segment === "pickup") {
      customersQuery = customersQuery.eq("preferred_fulfillment", "pickup");
    }

    customersQuery = customersQuery.range(offset, to);

    const summaryPromises = [
      { key: "total", query: supabase.from("customers").select("id", { count: "exact", head: true }) },
      { key: "newCustomers", query: supabase.from("customers").select("id", { count: "exact", head: true }).eq("orders_count", 1) },
      { key: "frequent", query: supabase.from("customers").select("id", { count: "exact", head: true }).gte("orders_count", 3) },
      { key: "vip", query: supabase.from("customers").select("id", { count: "exact", head: true }).or("orders_count.gte.5,total_spent_usd.gte.100") },
      { key: "contact", query: supabase.from("customers").select("id", { count: "exact", head: true }).gte("orders_count", 2).lte("last_order_at", new Date(Date.now() - 21 * 86400000).toISOString()) },
    ].map(({ key, query }) =>
      applyCustomerSearch(applyCustomerScope(query, scopedStoreIds), safeSearch).then((result: any) => ({
        key,
        count: result.error ? 0 : result.count || 0,
      }))
    );

    const [customersResult, storesResult, customerDetailsResult, summaryResults] = await Promise.all([
      customersQuery,
      storesQuery,
      customerDetailsPromise,
      Promise.all(summaryPromises),
    ]);

    if (customerDetailsResult.error) throw customerDetailsResult.error;
    const unlockedStoreIds = new Set(
      (customerDetailsResult.data || []).map((row: any) => String(row.store_id))
    );
    const customerDetailsUnlocked =
      scopedStoreIds === null || scopedStoreIds.every((storeId) => unlockedStoreIds.has(storeId));

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
        },
        needsMigration: true,
        error: "Aplica la migración de clientes para activar este módulo.",
      });
    }
    if (storesResult.error) throw storesResult.error;

    const pageRows = customersResult.data || [];
    const hasMore = pageRows.length > limit;
    let customers = hasMore ? pageRows.slice(0, limit) : pageRows;

    const lastOrderIds = customers.map((customer: any) => customer.last_order_id).filter(Boolean);

    let lastOrdersById = new Map<string, any>();

    if (lastOrderIds.length) {
      const lastOrdersResult = await supabase
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
          .in("id", lastOrderIds);

      if (!lastOrdersResult.error) {
        lastOrdersById = new Map(
          (lastOrdersResult.data || []).map((order: any) => [String(order.id), order])
        );
      }
    }

    const enriched = customers.map((customer: any) => {
      const lastOrder = lastOrdersById.get(String(customer.last_order_id));
      const badges = getCustomerBadges(customer);
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

    const globalSummary = Object.fromEntries(
      summaryResults.map((result: { key: string; count: number }) => [result.key, result.count])
    );
    const summary = {
      total: globalSummary.total || 0,
      newCustomers: globalSummary.newCustomers || 0,
      frequent: globalSummary.frequent || 0,
      vip: globalSummary.vip || 0,
      contact: globalSummary.contact || 0,
    };

    return NextResponse.json({
      customers: filtered,
      stores: storesResult.data || [],
      summary,
      customerDetailsUnlocked,
      page: {
        limit,
        offset,
        nextOffset: offset + customers.length,
        hasMore,
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
