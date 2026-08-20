import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  assertStoreManager,
  badRequest,
  PanelAccessError,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import {
  isPrepaidTablePaymentMethod,
} from "@/lib/table-orders";
import { getTableOrderTokenForStore } from "@/lib/server/table-order-tokens";

const TABLE_SELECT = "id, name, zone, is_enabled, created_at, updated_at";

async function loadTableOrderStore(storeId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, payment_methods, table_orders_access_enabled, table_orders_enabled, table_payment_methods, table_order_fulfillment_mode")
    .eq("id", storeId)
    .single();

  if (error) throw error;
  if (!data?.table_orders_access_enabled) {
    throw new PanelAccessError(
      "Pedidos en Mesa no está habilitado para este comercio.",
      403
    );
  }

  return { supabase, store: data };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const storeId = request.nextUrl.searchParams.get("storeId") || "";
    assertStoreAccess(auth, storeId);
    const { supabase, store } = await loadTableOrderStore(storeId);
    const [qrToken, { data: tables, error: tablesError }, { data: activeOrders, error: ordersError }] =
      await Promise.all([
        getTableOrderTokenForStore(supabase, storeId),
        supabase
          .from("store_tables")
          .select(TABLE_SELECT)
          .eq("store_id", storeId)
          .order("zone", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
        supabase
          .from("orders")
          .select("id, public_code, store_table_id, table_name_snapshot, table_fulfillment_snapshot, customer_name, payment_method, payment_status, total_usd, status, created_at")
          .eq("store_id", storeId)
          .eq("delivery_type", "table")
          .not("status", "in", "(completed,cancelled)")
          .order("created_at", { ascending: false }),
      ]);

    if (tablesError) throw tablesError;
    if (ordersError) throw ordersError;

    const configuredMethods = Array.isArray(store.table_payment_methods)
      ? store.table_payment_methods
      : [];
    const availableMethods = (Array.isArray(store.payment_methods) ? store.payment_methods : [])
      .filter(isPrepaidTablePaymentMethod);

    return NextResponse.json({
      enabled: store.table_orders_enabled === true,
      qrToken,
      paymentMethods: availableMethods,
      selectedPaymentMethods: configuredMethods.filter((method: string) =>
        availableMethods.includes(method)
      ),
      fulfillmentMode: store.table_order_fulfillment_mode === "counter_pickup" ? "counter_pickup" : "table_service",
      tables: tables || [],
      activeOrders: activeOrders || [],
    });
  } catch (error) {
    return panelErrorResponse(
      error,
      error instanceof Error ? error.message : "No se pudieron cargar las mesas."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const storeId = String(body.storeId || "");
    const name = String(body.name || "").trim().slice(0, 40);
    const zone = String(body.zone || "").trim().slice(0, 40) || null;
    if (!name) return badRequest("Escribe el nombre o número de la mesa.");

    assertStoreManager(auth, storeId);
    const { supabase } = await loadTableOrderStore(storeId);
    const { data, error } = await supabase
      .from("store_tables")
      .insert({ store_id: storeId, name, zone })
      .select(TABLE_SELECT)
      .single();
    if (error) throw error;

    return NextResponse.json({ table: data }, { status: 201 });
  } catch (error) {
    return panelErrorResponse(
      error,
      error instanceof Error ? error.message : "No se pudo crear la mesa."
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const storeId = String(body.storeId || "");
    assertStoreManager(auth, storeId);
    const { supabase, store } = await loadTableOrderStore(storeId);

    if (body.action === "settings") {
      const requestedMethods = Array.isArray(body.paymentMethods)
        ? body.paymentMethods.map((value: unknown) => String(value)).slice(0, 12)
        : [];
      const storeMethods = Array.isArray(store.payment_methods) ? store.payment_methods : [];
      const paymentMethods = requestedMethods.filter(
        (method: string) => storeMethods.includes(method) && isPrepaidTablePaymentMethod(method)
      );
      const enabled = body.enabled === true;
      const fulfillmentMode = body.fulfillmentMode === "counter_pickup"
        ? "counter_pickup"
        : "table_service";
      if (enabled && paymentMethods.length === 0) {
        return badRequest("Selecciona al menos un método de pago previo.");
      }

      const { error } = await supabase
        .from("stores")
        .update({
          table_orders_enabled: enabled,
          table_payment_methods: paymentMethods,
          table_order_fulfillment_mode: fulfillmentMode,
        })
        .eq("id", storeId);
      if (error) throw error;
      return NextResponse.json({ enabled, paymentMethods, fulfillmentMode });
    }

    const tableId = String(body.tableId || "");
    if (!tableId) return badRequest("No se pudo identificar la mesa.");
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === "string") {
      const name = body.name.trim().slice(0, 40);
      if (!name) return badRequest("Escribe el nombre o número de la mesa.");
      updates.name = name;
    }
    if (typeof body.zone === "string") {
      updates.zone = body.zone.trim().slice(0, 40) || null;
    }
    if (typeof body.isEnabled === "boolean") updates.is_enabled = body.isEnabled;

    const { data, error } = await supabase
      .from("store_tables")
      .update(updates)
      .eq("id", tableId)
      .eq("store_id", storeId)
      .select(TABLE_SELECT)
      .single();
    if (error) throw error;

    return NextResponse.json({ table: data });
  } catch (error) {
    return panelErrorResponse(
      error,
      error instanceof Error ? error.message : "No se pudo actualizar la mesa."
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const storeId = String(body.storeId || "");
    const tableId = String(body.tableId || "");
    if (!tableId) return badRequest("No se pudo identificar la mesa.");

    assertStoreManager(auth, storeId);
    const { supabase } = await loadTableOrderStore(storeId);
    const { count, error: activeOrdersError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("store_table_id", tableId)
      .not("status", "in", "(completed,cancelled)");
    if (activeOrdersError) throw activeOrdersError;
    if ((count || 0) > 0) {
      return badRequest("Esta mesa tiene pedidos activos. Complétalos o cancélalos antes de eliminarla.");
    }

    const { data, error } = await supabase
      .from("store_tables")
      .delete()
      .eq("id", tableId)
      .eq("store_id", storeId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return badRequest("La mesa ya no existe o no pertenece a este comercio.");

    return NextResponse.json({ deleted: true, tableId });
  } catch (error) {
    return panelErrorResponse(
      error,
      error instanceof Error ? error.message : "No se pudo eliminar la mesa."
    );
  }
}
