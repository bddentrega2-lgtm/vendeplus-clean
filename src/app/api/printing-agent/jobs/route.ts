import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePrintAgent } from "@/lib/printing/agent-auth-server";

const orderSelect = `id, public_code, store_id, customer_name, customer_phone, delivery_type, table_name_snapshot, table_zone_snapshot, table_fulfillment_snapshot, payment_method, payment_reference, subtotal_usd, delivery_usd, delivery_provider, delivery_zone_name, delivery_address, transport_agency_name, total_usd, total_bs, delivery_reference, order_details, notes, created_at, stores(name), order_items(product_name, variant_name, quantity, unit_price_usd, total_usd, notes, order_item_options(option_group_name, option_name, price_delta_usd, quantity))`;

export async function POST(request: NextRequest) {
  const device = await requirePrintAgent(request);
  if (!device) return NextResponse.json({ error: "Equipo no autorizado." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data: settings, error: settingsError } = await supabase
    .from("store_print_settings")
    .select("is_enabled, paper_width_mm, copies, include_prices")
    .eq("store_id", device.store_id)
    .maybeSingle();
  if (settingsError) return NextResponse.json({ error: "No se pudo consultar la configuracion." }, { status: 500 });
  if (!settings) return NextResponse.json({ jobs: [], settings: null });

  const { data: claimed, error: claimError } = await supabase.rpc("claim_store_print_jobs", {
    p_store_id: device.store_id,
    p_device_id: device.id,
    p_limit: 3,
    p_manual_only: !settings.is_enabled,
  });
  if (claimError) return NextResponse.json({ error: "No se pudieron reclamar comandas." }, { status: 500 });
  const orderIds = (claimed || []).map((job: { order_id: string }) => job.order_id);
  if (!orderIds.length) return NextResponse.json({ jobs: [], settings });

  const { data: orders, error } = await supabase
    .from("orders")
    .select(orderSelect)
    .eq("store_id", device.store_id)
    .in("id", orderIds);
  if (error) return NextResponse.json({ error: "No se pudieron cargar las comandas." }, { status: 500 });
  const byId = new Map((orders || []).map((order) => [order.id, order]));
  return NextResponse.json({ settings, jobs: (claimed || []).map((job: { order_id: string }) => ({ ...job, order: byId.get(job.order_id) })).filter((job: { order: unknown }) => job.order) });
}

export async function PATCH(request: NextRequest) {
  const device = await requirePrintAgent(request);
  if (!device) return NextResponse.json({ error: "Equipo no autorizado." }, { status: 401 });
  const body = await request.json();
  const jobId = String(body.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "Falta la comanda." }, { status: 400 });
  const printed = body.status === "printed";
  const { error } = await createSupabaseAdminClient()
    .from("order_print_jobs")
    .update({
      status: printed ? "printed" : "failed",
      printed_at: printed ? new Date().toISOString() : null,
      locked_until: null,
      last_error: printed ? null : String(body.error || "No se pudo imprimir.").slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("store_id", device.store_id)
    .eq("claimed_by", device.id)
    .eq("status", "processing");
  if (error) return NextResponse.json({ error: "No se pudo actualizar la comanda." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
