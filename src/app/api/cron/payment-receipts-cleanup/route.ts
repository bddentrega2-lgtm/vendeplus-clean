import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const supabase = createSupabaseAdminClient();
  const abandonedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("order_payment_receipts")
    .select("id, storage_path, order_id, created_at, expires_at")
    .is("deleted_at", null)
    .not("storage_path", "is", null)
    .or(`expires_at.lte.${now},and(order_id.is.null,created_at.lte.${abandonedBefore})`)
    .order("expires_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: "No se pudo consultar la limpieza." }, { status: 500 });

  const rows = data || [];
  const paths = rows.map((entry) => entry.storage_path).filter(Boolean) as string[];
  if (paths.length) {
    const removed = await supabase.storage.from("payment-receipts").remove(paths);
    if (removed.error) return NextResponse.json({ error: "No se pudieron eliminar los archivos." }, { status: 500 });
    const updated = await supabase
      .from("order_payment_receipts")
      .update({ storage_path: null, deleted_at: now })
      .in("id", rows.map((entry) => entry.id));
    if (updated.error) return NextResponse.json({ error: "Los archivos se eliminaron, pero no se actualizó el registro." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: paths.length, hasMore: rows.length === 200 });
}
