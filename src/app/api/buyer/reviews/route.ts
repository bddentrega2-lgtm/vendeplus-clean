import { NextResponse } from "next/server";
import { getVerifiedBuyer } from "@/lib/buyer/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, getClientIp } from "@/lib/server/rate-limit";

const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 8192) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "Solicitud invalida." }, { status: 415, headers });
  const buyer = await getVerifiedBuyer(request);
  if (!buyer) return NextResponse.json({ error: "Ingresa con Google para calificar." }, { status: 401, headers });
  const limit = await checkDistributedRateLimit({ key: `buyer-review:${buyer.id}:${getClientIp(request)}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Espera un momento antes de volver a calificar." }, { status: 429, headers });
  const text = await request.text();
  if (text.length > 8192) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413, headers });
  let body;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Solicitud invalida." }, { status: 400, headers }); }
  if (!body || typeof body.orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.orderId) || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) return NextResponse.json({ error: "Elige una calificacion de 1 a 5." }, { status: 400, headers });
  if (body.observation != null && (typeof body.observation !== "string" || Array.from(body.observation).length > 500 || body.observation.includes("\u0000"))) return NextResponse.json({ error: "La observacion debe ser un texto de hasta 500 caracteres." }, { status: 400, headers });
  const observation = body.observation?.trim() || null;
  const { error } = await createSupabaseAdminClient().rpc("save_buyer_store_review_with_observation", { p_order_id: body.orderId, p_buyer_id: buyer.id, p_rating: body.rating, p_observation: observation });
  if (error) return NextResponse.json({ error: "Solo puedes calificar tus pedidos completados. Intenta mas tarde si el pedido ya fue completado." }, { status: error.code === "P0001" ? 403 : 503, headers });
  return NextResponse.json({ ok: true }, { headers });
}
