import { NextResponse } from "next/server";
import { getPublicStores } from "@/lib/supabase/catalog";
import { getStoreRatingSummaries } from "@/lib/buyer/ratings-server";

export const revalidate = 60;
export async function GET() {
  const stores = await getPublicStores();
  const ids = stores.map(store => store.id);
  const ratings = await getStoreRatingSummaries(ids);
  return NextResponse.json({ ratings }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
