import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, getClientIp, rateLimitHeaders } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_STORED_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_INPUT_BYTES) {
    return NextResponse.json({ error: "La imagen supera el tamaño permitido." }, { status: 413 });
  }

  const ip = getClientIp(request);
  const limit = await checkDistributedRateLimit({
    key: `payment-receipt:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Has subido muchas imágenes. Espera unos minutos." },
      { status: 429, headers: rateLimitHeaders(limit, 12) }
    );
  }

  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "La solicitud de imagen no es válida." }, { status: 400 });
    }
    const file = form.get("file");
    const storeId = String(form.get("storeId") || "").trim();
    if (!(file instanceof File) || !storeId) {
      return NextResponse.json({ error: "Selecciona una imagen válida." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
      return NextResponse.json({ error: "La imagen supera el tamaño permitido." }, { status: 413 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, payment_proof_mode")
      .eq("id", storeId)
      .eq("is_active", true)
      .maybeSingle();
    if (storeError || !store || store.payment_proof_mode !== "image") {
      return NextResponse.json({ error: "Este comercio no solicita captura o foto." }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input).metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
      return NextResponse.json({ error: "Usa una imagen JPG, PNG o WebP." }, { status: 400 });
    }
    const output = await sharp(input)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    if (output.length > MAX_STORED_BYTES) {
      return NextResponse.json({ error: "La imagen sigue siendo muy pesada. Usa otra más pequeña." }, { status: 413 });
    }

    const receiptId = crypto.randomUUID();
    const month = new Date().toISOString().slice(0, 7);
    const storagePath = `${storeId}/${month}/${receiptId}.webp`;
    const upload = await supabase.storage.from("payment-receipts").upload(storagePath, output, {
      contentType: "image/webp",
      upsert: false,
    });
    if (upload.error) throw upload.error;

    const { error: insertError } = await supabase.from("order_payment_receipts").insert({
      id: receiptId,
      store_id: storeId,
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
