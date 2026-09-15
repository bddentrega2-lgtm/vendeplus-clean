import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, getClientIp, rateLimitHeaders } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_STORED_BYTES = 2 * 1024 * 1024;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agencySlug: string }> }
) {
  const { agencySlug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agencySlug) || agencySlug.length > 100) {
    return badRequest("El enlace de la empresa delivery no es valido.");
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_INPUT_BYTES) {
    return NextResponse.json({ error: "La imagen supera el tamano permitido." }, { status: 413 });
  }

  const ip = getClientIp(request);
  const limit = await checkDistributedRateLimit({
    key: `particular-payment-receipt:${agencySlug}:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Has subido muchas imagenes. Espera unos minutos." },
      { status: 429, headers: rateLimitHeaders(limit, 12) }
    );
  }

  try {
    const form = await request.formData().catch(() => null);
    if (!form) return badRequest("La solicitud de imagen no es valida.");
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Selecciona una imagen valida.");
    if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
      return NextResponse.json({ error: "La imagen supera el tamano permitido." }, { status: 413 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: agency, error: agencyError } = await supabase
      .from("transport_agencies")
      .select("id, premium_dispatch_enabled, status, is_active, particular_payment_proof_mode")
      .eq("slug", agencySlug)
      .maybeSingle();

    if (
      agencyError ||
      !agency ||
      agency.premium_dispatch_enabled !== true ||
      agency.is_active === false ||
      agency.status === "paused"
    ) {
      return NextResponse.json({ error: "Esta empresa delivery no esta disponible para particulares." }, { status: 404 });
    }
    if (agency.particular_payment_proof_mode !== "image") {
      return badRequest("Esta empresa delivery no solicita captura de pago.");
    }

    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input).metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
      return badRequest("Usa una imagen JPG, PNG o WebP.");
    }

    const output = await sharp(input)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    if (output.length > MAX_STORED_BYTES) {
      return NextResponse.json({ error: "La imagen sigue siendo muy pesada. Usa otra mas pequena." }, { status: 413 });
    }

    const receiptId = crypto.randomUUID();
    const month = new Date().toISOString().slice(0, 7);
    const storagePath = `transport/${agency.id}/${month}/${receiptId}.webp`;
    const upload = await supabase.storage.from("payment-receipts").upload(storagePath, output, {
      contentType: "image/webp",
      upsert: false,
    });
    if (upload.error) throw upload.error;

    const { error: insertError } = await supabase.from("transport_particular_payment_receipts").insert({
      id: receiptId,
      agency_id: agency.id,
      storage_path: storagePath,
      mime_type: "image/webp",
      size_bytes: output.length,
    });
    if (insertError) {
      await supabase.storage.from("payment-receipts").remove([storagePath]);
      throw insertError;
    }

    return NextResponse.json({ receiptToken: receiptId });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la imagen. Intenta de nuevo." }, { status: 500 });
  }
}
