import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, getClientIp } from "@/lib/server/rate-limit";

const BUCKET = "commerce-registration-assets";
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const MIME = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

function hasImageSignature(bytes: Buffer, type: string) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  return false;
}

export async function POST(request: NextRequest) {
  const limit = await checkDistributedRateLimit({ key: `signup-payment:${getClientIp(request)}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiados intentos. Prueba mas tarde." }, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > MAX_PROOF_BYTES + 100_000) {
    return NextResponse.json({ error: "La imagen supera 5 MB." }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Envia el formulario de pago." }, { status: 400 });
  }
  let uploadedPath = "";
  try {
    const body = await request.formData();
    const code = String(body.get("requestCode") || "").trim().toUpperCase();
    const email = String(body.get("email") || "").trim().toLowerCase();
    const phone = String(body.get("whatsapp") || "").replace(/\D/g, "");
    const reference = String(body.get("reference") || "").trim();
    const proof = body.get("proof");
    if (!/^SOL-[A-Z0-9]{6}$/.test(code) || !email.includes("@") || phone.length < 10 || reference.length < 3 || reference.length > 120 ||
      !(proof instanceof File) || !MIME.has(proof.type) || proof.size < 1 || proof.size > MAX_PROOF_BYTES) {
      return NextResponse.json({ error: "Revisa los datos y adjunta una imagen JPG, PNG o WebP de hasta 5 MB." }, { status: 400 });
    }
    const db = createSupabaseAdminClient();
    const { data: registration, error: lookupError } = await db.from("commerce_registration_requests")
      .select("id, email, whatsapp, setup_due_usd, setup_payment_status, status")
      .eq("request_code", code).maybeSingle();
    if (lookupError) throw lookupError;
    if (!registration || registration.email.toLowerCase() !== email || registration.whatsapp !== phone) {
      return NextResponse.json({ error: "No encontramos la solicitud con esos datos." }, { status: 404 });
    }
    if (registration.status !== "pending" || registration.setup_payment_status !== "pending" || Number(registration.setup_due_usd) <= 0) {
      return NextResponse.json({ error: "La solicitud ya fue reportada o revisada. Contacta a SOMOS." }, { status: 409 });
    }
    const proofBytes = Buffer.from(await proof.arrayBuffer());
    if (!hasImageSignature(proofBytes, proof.type)) {
      return NextResponse.json({ error: "La imagen no tiene un formato valido." }, { status: 400 });
    }
    uploadedPath = `setup-payments/${registration.id}/${randomUUID()}.${MIME.get(proof.type)}`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(uploadedPath, proofBytes, {
      contentType: proof.type, cacheControl: "3600", upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data: updated, error: updateError } = await db.from("commerce_registration_requests")
      .update({ setup_payment_status: "reported", setup_payment_reference: reference,
        setup_payment_proof_path: uploadedPath, setup_payment_reported_at: new Date().toISOString() })
      .eq("id", registration.id).eq("status", "pending").eq("setup_payment_status", "pending")
      .select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      await db.storage.from(BUCKET).remove([uploadedPath]);
      return NextResponse.json({ error: "La solicitud cambio de estado. Contacta a SOMOS." }, { status: 409 });
    }
    return NextResponse.json({ message: "Pago reportado. SOMOS revisara la referencia y el comprobante antes de habilitar el acceso." });
  } catch {
    if (uploadedPath) await createSupabaseAdminClient().storage.from(BUCKET).remove([uploadedPath]).catch(() => {});
    return NextResponse.json({ error: "No se pudo reportar el pago. Intenta de nuevo." }, { status: 500 });
  }
}
