import { NextRequest, NextResponse } from "next/server";
import { adminErrorResponse, requireAdminAuth } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const validStatuses = new Set(["pending", "completed", "rejected", "all"]);

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const db = createSupabaseAdminClient();
    const requestedStatus = new URL(request.url).searchParams.get("status") || "pending";
    const status = validStatuses.has(requestedStatus) ? requestedStatus : "pending";
    let query = db
      .from("account_deletion_requests")
      .select("id, email, account_type, store_ids, agency_ids, status, requested_at, resolved_at", { count: "exact" })
      .order("requested_at", { ascending: false })
      .limit(50);
    if (status !== "all") query = query.eq("status", status);
    const { data, error, count } = await query;
    if (error) throw error;

    const storeIds = Array.from(new Set((data || []).flatMap((row) => row.store_ids || [])));
    const agencyIds = Array.from(new Set((data || []).flatMap((row) => row.agency_ids || [])));
    const [stores, agencies] = await Promise.all([
      storeIds.length ? db.from("stores").select("id, name").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
      agencyIds.length ? db.from("transport_agencies").select("id, name").in("id", agencyIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (stores.error || agencies.error) throw stores.error || agencies.error;
    const storeNames = new Map((stores.data || []).map((row) => [row.id, row.name]));
    const agencyNames = new Map((agencies.data || []).map((row) => [row.id, row.name]));

    return NextResponse.json({
      requests: (data || []).map((row) => ({
        ...row,
        stores: (row.store_ids || []).map((id: string) => storeNames.get(id) || "Comercio"),
        agencies: (row.agency_ids || []).map((id: string) => agencyNames.get(id) || "Empresa delivery"),
        store_ids: undefined,
        agency_ids: undefined,
      })),
      total: count || 0,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminErrorResponse(error, "No se pudieron cargar las solicitudes de eliminacion.");
  }
}
