import { NextResponse } from "next/server";
import { getVerifiedBuyer } from "@/lib/buyer/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, getClientIp } from "@/lib/server/rate-limit";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export async function GET(request: Request) {
  const limit = await checkDistributedRateLimit({ key: `buyer-history:${getClientIp(request)}`, limit: 90, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Espera un momento y vuelve a intentar." }, { status: 429, headers });
  const buyer = await getVerifiedBuyer(request);
  if (!buyer) return NextResponse.json({ error: "Ingresa con Google para ver tus pedidos." }, { status: 401, headers });
  const raw = new URL(request.url).searchParams.get("page") || "0";
  if (!/^\d{1,5}$/.test(raw)) return NextResponse.json({ error: "Pagina invalida." }, { status: 400, headers });
  const page = Number(raw);
  const db = createSupabaseAdminClient();
  const { data: owned, error } = await db.from("buyer_order_accounts")
    .select("order_id,store_id,created_at").eq("buyer_user_id", buyer.id)
    .order("created_at", { ascending: false }).order("order_id", { ascending: false }).range(page * 20, page * 20 + 20);
  if (error) return NextResponse.json({ error: "Tu historial aun no esta disponible. Intenta mas tarde." }, { status: 503, headers });
  const rows = (owned || []).slice(0, 20);
  if (!rows.length) return NextResponse.json({ orders: [], hasMore: false }, { headers });
  const ids = rows.map(row => row.order_id);
  const [orders, reviews] = await Promise.all([
    db.from("orders").select("id,store_id,public_code,status,created_at,total_usd,delivery_type,stores(name,slug,logo_url),order_items(product_name,quantity,unit_price_usd,total_usd,variant_name,order_item_options(option_name,quantity,price_delta_usd))").in("id", ids).in("store_id", rows.map(row => row.store_id)),
    db.from("buyer_store_reviews").select("order_id,rating,observation").eq("buyer_user_id", buyer.id).in("order_id", ids),
  ]);
  if (orders.error || reviews.error) return NextResponse.json({ error: "No pudimos consultar tus pedidos." }, { status: 503, headers });
  const result = rows.flatMap(row => {
    const order = orders.data?.find(order => order.id === row.order_id && order.store_id === row.store_id);
    if (!order) return [];
    const review = reviews.data?.find(review => review.order_id === order.id);
    return [{ ...order, rating: review?.rating || null, observation: review?.observation || null }];
  });
  return NextResponse.json({ orders: result, hasMore: (owned?.length || 0) > 20 }, { headers });
}
