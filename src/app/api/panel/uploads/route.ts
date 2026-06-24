import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

function safePathSegment(value: string, fallback: string) {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return sanitized || fallback;
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_SIZE + 120_000) {
      return NextResponse.json(
        { error: "La imagen es demasiado pesada para subirla." },
        { status: 413 }
      );
    }

    const auth = await requirePanelAuth(request);
    const formData = await request.formData();

    const file = formData.get("file");
    const storeId = String(formData.get("store_id") || "");
    const productId = String(formData.get("product_id") || "");

    if (!storeId) {
      return badRequest("Falta el comercio para subir la imagen.");
    }

    assertStoreAccess(
      auth,
      storeId,
      "No tienes permiso para subir imágenes a este comercio."
    );

    if (!(file instanceof File)) {
      return badRequest("Selecciona una imagen válida.");
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return badRequest("Solo se permiten imágenes JPG, PNG o WebP.");
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest("La imagen no debe pesar más de 2 MB. Intenta con una imagen más liviana.");
    }

    const supabase = createSupabaseAdminClient();

    const extension = getExtension(file);
    const safeStoreId = safePathSegment(storeId, "store");
    const safeProductId = safePathSegment(productId, "new-product");
    const filePath = `${safeStoreId}/${safeProductId}/${Date.now()}-${randomUUID()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return NextResponse.json({
      path: filePath,
      publicUrl: data.publicUrl,
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error subiendo imagen.");
  }
}
