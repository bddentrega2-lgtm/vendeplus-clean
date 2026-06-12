import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import {
  adminStoreSelect,
  normalizeAdminStorePayload,
} from "@/lib/admin/stores";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;

    if (!storeId) return badRequest("Falta el ID del comercio.");

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .select(adminStoreSelect)
      .eq("id", storeId)
      .single();

    if (error) throw error;

    const { data: assignments, error: assignmentsError } = await supabase
      .from("store_users")
      .select("id, user_id, store_id, role")
      .eq("store_id", storeId);

    if (assignmentsError) throw assignmentsError;

    return NextResponse.json({
      store: data,
      assignments: assignments || [],
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando comercio.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    await requireAdminAuth(request);
    const { storeId } = await context.params;
    const body = await request.json();
    const payload = normalizeAdminStorePayload(body);

    if (!storeId) return badRequest("Falta el ID del comercio.");
    if (!payload.name) return badRequest("El nombre del comercio es obligatorio.");
    if (!payload.slug) return badRequest("El slug del comercio es obligatorio.");

    const supabase = createSupabaseAdminClient();
    const { data: existingSlug, error: slugError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", payload.slug)
      .neq("id", storeId)
      .maybeSingle();

    if (slugError) throw slugError;
    if (existingSlug) return conflict("Ya existe otro comercio con ese slug.");

    const { data, error } = await supabase
      .from("stores")
      .update(payload)
      .eq("id", storeId)
      .select(adminStoreSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data });
  } catch (error) {
    return adminErrorResponse(error, "Error actualizando comercio.");
  }
}
