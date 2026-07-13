import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertAgencyManager,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    assertAgencyManager(auth, agencyId, "Tu rol no permite cambiar el logo.");

    const formData = await request.formData();
    const file = formData.get("logo");

    if (!(file instanceof File)) return badRequest("Selecciona una imagen.");
    if (!allowedTypes[file.type]) return badRequest("Usa PNG, JPG o WebP.");
    if (file.size > MAX_LOGO_BYTES) return badRequest("El logo debe pesar menos de 2 MB.");

    const supabase = createSupabaseAdminClient();
    const extension = allowedTypes[file.type];
    const path = `${agencyId}/logo-${Date.now()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("transport-agency-logos")
      .upload(path, bytes, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("transport-agency-logos")
      .getPublicUrl(path);

    const logoUrl = publicUrlData.publicUrl;
    const { error: updateError } = await supabase
      .from("transport_agencies")
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq("id", agencyId);

    if (updateError) throw updateError;

    return NextResponse.json({ logoUrl });
  } catch (error) {
    return transportErrorResponse(error, "Error subiendo logo.");
  }
}
