import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPanelAuthContext } from "@/lib/panel/auth";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function unauthorized(message = "No autorizado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function canAccessStore(storeIds: string[] | null, storeId?: string | null) {
  if (storeIds === null) return true;
  return Boolean(storeId && storeIds.includes(storeId));
}

function getExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";

  return "jpg";
}

function safePathSegment(value: string, fallback: string) {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return sanitized || fallback;
}

export async function POST(request: NextRequest) {
  const auth = await getPanelAuthContext(request);
  if (!auth.isAuthorized) return unauthorized(auth.error);

  try {
    const formData = await request.formData();

    const file = formData.get("file");
    const storeId = String(formData.get("store_id") || "");
    const productId = String(formData.get("product_id") || "");

    if (!storeId) {
      return NextResponse.json(
        { error: "Falta el comercio para subir la imagen." },
        { status: 400 }
      );
    }

    if (!canAccessStore(auth.storeIds, storeId)) {
      return NextResponse.json(
        { error: "No tienes permiso para subir imágenes a este comercio." },
        { status: 403 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecciona una imagen válida." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos de imagen." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "La imagen no debe pesar más de 5 MB." },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: error.message || "Error subiendo imagen." },
      { status: 500 }
    );
  }
}
