import { NextResponse } from "next/server";
import { getPublicStores } from "@/lib/supabase/catalog";
import { getStoreRatingSummaries } from "@/lib/buyer/ratings-server";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("store");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Comercio invalido." }, { status: 400 });
  const stores = await getPublicStores();
  if (!stores.some(store => store.id === id)) return NextResponse.json({ error: "Comercio no disponible." }, { status: 404 });
  const ratings = await getStoreRatingSummaries([id]);
  if (!ratings) return NextResponse.json({ error: "Calificaciones no disponibles." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ rating: ratings[id] || null }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
