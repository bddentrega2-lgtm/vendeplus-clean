import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPanelAuthContext } from "@/lib/panel/auth";

const allowedStatuses = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "delivering",
  "completed",
  "cancelled",
];

function unauthorized(message = "No autorizado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function canAccessStore(storeIds: string[] | null, storeId?: string) {
  if (storeIds === null) return true;
  return Boolean(storeId && storeIds.includes(storeId));
}

export async function GET(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const orderId = searchParams.get("orderId");

    let query = supabase
      .from("orders")
      .select(
        `
        id,
        public_code,
        store_id,
        customer_name,
        customer_phone,
        delivery_type,
        payment_method,
        subtotal_usd,
        delivery_usd,
        total_usd,
        total_bs,
        distance_km,
        delivery_lat,
        delivery_lng,
        delivery_reference,
        order_details,
        notes,
        status,
        whatsapp_message,
        created_at,
        stores (
          name,
          latitude,
          longitude
        ),
        order_items (
          id,
          product_name,
          variant_name,
          quantity,
          unit_price_usd,
          total_usd,
          notes
        )
      `
      )
      .order("created_at", { ascending: false });

    if (auth.storeIds !== null) {
      query = query.in("store_id", auth.storeIds);
    }

    if (orderId) {
      const { data, error } = await query.eq("id", orderId).maybeSingle();

      if (error) throw error;

      return NextResponse.json({ order: data });
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query.limit(80);

    if (error) throw error;

    return NextResponse.json({
      orders: data || [],
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error cargando pedidos." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const body = await request.json();
    const id = body.id;
    const status = body.status;

    if (!id) {
      return NextResponse.json(
        { error: "Falta el ID del pedido." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Estado inválido." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select("id, store_id")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;

    if (!canAccessStore(auth.storeIds, existingOrder.store_id)) {
      return NextResponse.json(
        { error: "No tienes permiso para operar este pedido." },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error actualizando pedido." },
      { status: 500 }
    );
  }
}
