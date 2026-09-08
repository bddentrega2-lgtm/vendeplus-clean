import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertAgencyAccess, requireTransportAgencyAuth, transportErrorResponse } from "@/lib/transport/access";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const agencyId = new URL(request.url).searchParams.get("agencyId")?.trim() || "";
    assertAgencyAccess(auth, agencyId);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("transport_particular_requests")
      .select("id,public_code,status,requester_name,requester_phone,requester_role,pickup_name,pickup_phone,pickup_address,pickup_reference,delivery_name,delivery_phone,delivery_address,delivery_reference,package_description,payment_method,payment_reference,distance_km,delivery_fee_usd,created_at")
      .eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(40);
    if (error) throw error;
    return NextResponse.json({ requests: data || [] });
  } catch (error) {
    return transportErrorResponse(error, "No pudimos cargar las solicitudes particulares.");
  }
}
