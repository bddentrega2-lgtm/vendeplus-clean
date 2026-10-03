import { after, NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStoreAccess, badRequest, panelErrorResponse, requirePanelAuth } from "@/lib/panel/access";
import { safeSendPrintWakePush } from "@/lib/printing/firebase-push";

function publicPrintError(value: unknown) {
  const message = String(value || "").toLowerCase();
  if (!message) return null;
  if (message.includes("read failed") || message.includes("socket") || message.includes("bluetooth")) {
    return "La impresora no respondio. Revisa que este encendida y cerca del telefono.";
  }
  if (message.includes("permission") || message.includes("permiso")) {
    return "La app no tiene permiso para conectarse a la impresora.";
  }
  if (message.includes("printer") || message.includes("impresora")) {
    return "No se pudo conectar con la impresora seleccionada.";
  }
  return "No se pudo imprimir. Revisa la conexion e intenta nuevamente.";
}

async function panelContext(request: NextRequest) {
  const auth = await requirePanelAuth(request);
  const storeId = String(request.headers.get("x-panel-store-id") || "").trim();
  if (!storeId) throw new Error("STORE_REQUIRED");
  assertStoreAccess(auth, storeId);
  return { storeId };
}

export async function GET(request: NextRequest) {
  try {
    const { storeId } = await panelContext(request);
    const supabase = createSupabaseAdminClient();
    const recoveryCutoffMs = Date.now() - 24 * 60 * 60_000;
    const recoveryCutoff = new Date(recoveryCutoffMs).toISOString();
    const [devicesResult, jobsResult, pendingResult, failedResult] = await Promise.all([
      supabase
        .from("print_agent_devices")
        .select("id, name, platform, app_version, last_seen_at, created_at, fcm_token")
        .eq("store_id", storeId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_print_jobs")
        .select("id, order_id, event_type, status, attempts, last_error, printed_at, created_at, updated_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("order_print_jobs")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .in("status", ["pending", "processing"]),
      supabase
        .from("order_print_jobs")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "failed")
        .gte("created_at", recoveryCutoff),
    ]);

    for (const result of [devicesResult, jobsResult, pendingResult, failedResult]) {
      if (result.error) throw result.error;
    }

    const jobs = jobsResult.data || [];
    const orderIds = [...new Set(jobs.map((job) => job.order_id).filter(Boolean))];
    const orderCodes = new Map<string, string>();
    if (orderIds.length) {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, public_code")
        .eq("store_id", storeId)
        .in("id", orderIds);
      if (error) throw error;
      for (const order of orders || []) orderCodes.set(order.id, order.public_code);
    }

    const devices = (devicesResult.data || []).map(({ fcm_token, ...device }) => ({
      ...device,
      push_ready: Boolean(fcm_token),
    }));
    const recentJobs = jobs.map(({ last_error, ...job }) => ({
      ...job,
      order_code: orderCodes.get(job.order_id) || "Pedido",
      error_message: publicPrintError(last_error),
      can_retry: job.status === "failed" && new Date(job.created_at).getTime() >= recoveryCutoffMs,
    }));

    return NextResponse.json({
      devices,
      jobs: recentJobs,
      summary: {
        pending: pendingResult.count || 0,
        failed: failedResult.count || 0,
        last_printed_at: recentJobs.find((job) => job.status === "printed")?.printed_at || null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_REQUIRED") return badRequest("Selecciona un comercio.");
    return panelErrorResponse(error, "No se pudo cargar el estado de impresion.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { storeId } = await panelContext(request);
    const jobId = String((await request.json()).jobId || "").trim();
    if (!jobId) return badRequest("Falta identificar la comanda.");

    const supabase = createSupabaseAdminClient();
    const recoveryCutoffMs = Date.now() - 24 * 60 * 60_000;
    const { data: job, error: jobError } = await supabase
      .from("order_print_jobs")
      .select("id, order_id, status, created_at")
      .eq("id", jobId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ error: "Comanda no encontrada." }, { status: 404 });
    if (job.status !== "failed") return badRequest("Solo se pueden reintentar comandas con error.");
    if (new Date(job.created_at).getTime() < recoveryCutoffMs) return badRequest("Esta comanda es antigua. Reimprimela desde el detalle del pedido.");

    const { data: updated, error: updateError } = await supabase
      .from("order_print_jobs")
      .update({
        status: "pending",
        attempts: 0,
        claimed_by: null,
        locked_until: null,
        last_error: null,
        printed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("store_id", storeId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return badRequest("La comanda cambio de estado. Actualiza e intenta nuevamente.");

    after(() => safeSendPrintWakePush({ supabase, storeId, orderId: job.order_id, eventType: "manual" }));
    return NextResponse.json({ queued: true });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_REQUIRED") return badRequest("Selecciona un comercio.");
    return panelErrorResponse(error, "No se pudo reintentar la impresion.");
  }
}
