import { NextResponse } from "next/server";
import { getVerifiedBuyer } from "@/lib/buyer/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, getClientIp } from "@/lib/server/rate-limit";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

export async function DELETE(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 1024) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "Solicitud invalida." }, { status: 415, headers });
  const buyer = await getVerifiedBuyer(request);
  if (!buyer) return NextResponse.json({ error: "Ingresa nuevamente para eliminar tu cuenta." }, { status: 401, headers });
  const limit = await checkDistributedRateLimit({ key: `buyer-account-delete:${buyer.id}:${getClientIp(request)}`, limit: 5, windowMs: 60 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Espera un momento antes de volver a intentarlo." }, { status: 429, headers });
  let body: unknown;
  try { body = JSON.parse(await request.text()); } catch { return NextResponse.json({ error: "Solicitud invalida." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "ELIMINAR") {
    return NextResponse.json({ error: "Escribe ELIMINAR para confirmar." }, { status: 400, headers });
  }

  const db = createSupabaseAdminClient();
  const [storeAccess, transportAccess, registration] = await Promise.all([
    db.from("store_users").select("id", { count: "exact", head: true }).eq("user_id", buyer.id),
    db.from("transport_agency_users").select("id", { count: "exact", head: true }).eq("user_id", buyer.id),
    db.from("commerce_registration_requests").select("id", { count: "exact", head: true }).eq("auth_user_id", buyer.id).in("status", ["pending", "activating", "approved", "activation_error"]),
  ]);
  if (storeAccess.error || transportAccess.error || registration.error) {
    return NextResponse.json({ error: "No pudimos verificar tu cuenta. Intenta mas tarde." }, { status: 503, headers });
  }
  if ((storeAccess.count || 0) > 0 || (transportAccess.count || 0) > 0 || (registration.count || 0) > 0) {
    return NextResponse.json({ error: "Esta cuenta tambien administra operaciones. Solicita ayuda desde el panel antes de eliminarla." }, { status: 409, headers });
  }

  const { error } = await db.auth.admin.deleteUser(buyer.id, false);
  if (error) return NextResponse.json({ error: "No pudimos eliminar tu cuenta. Intenta mas tarde." }, { status: 503, headers });
  return NextResponse.json({ ok: true }, { headers });
}
