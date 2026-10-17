import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { getStoreProductLimit } from "@/lib/plans";

const editableFields = ["is_available", "is_featured", "is_cart_suggestion", "price_usd"] as const;
type EditableField = (typeof editableFields)[number];

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const id = String(body.id || "");
    const field = String(body.field || "") as EditableField;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return badRequest("Producto no válido.");
    }
    if (!editableFields.includes(field)) return badRequest("Acción no válida.");

    const isPrice = field === "price_usd";
    if (isPrice) {
      if (!/^\d+(?:\.\d{1,2})?$/.test(String(body.value)) || Number(body.value) > 999999.99 ||
          !Number.isFinite(Number(body.expected))) {
        return badRequest("Escribe un precio válido de hasta dos decimales.");
      }
    } else if (typeof body.value !== "boolean" || typeof body.expected !== "boolean") {
      return badRequest("Estado no válido.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id, price_usd, is_available, is_featured, is_cart_suggestion")
      .eq("id", id)
      .single();
    if (productError) throw productError;

    assertStoreManager(auth, product.store_id, "No tienes permiso para editar este producto.");

    const expected = isPrice ? Number(body.expected) : body.expected;
    const value = isPrice ? Number(body.value) : body.value;
    if (product[field] !== expected) {
      return NextResponse.json({ error: "El producto cambió. Actualiza la lista antes de intentar de nuevo." }, { status: 409 });
    }

    if (field === "is_available" && value === true && !product.is_available) {
      const [{ data: store, error: storeError }, { count, error: countError }] = await Promise.all([
        supabase.from("stores").select("id, plan_type, product_limit").eq("id", product.store_id).single(),
        supabase.from("products").select("id", { count: "exact", head: true })
          .eq("store_id", product.store_id).eq("is_available", true),
      ]);
      if (storeError) throw storeError;
      if (countError) throw countError;
      const limit = getStoreProductLimit(store as any);
      if ((count || 0) >= limit) {
        return badRequest(`Puedes publicar hasta ${limit} productos. Oculta otro o consulta con Somos para ampliar el límite.`);
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({ [field]: value })
      .eq("id", id)
      .eq("store_id", product.store_id)
      .eq(field, expected)
      .select("id, price_usd, is_available, is_featured, is_cart_suggestion")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ error: "El producto cambió. Actualiza la lista antes de intentar de nuevo." }, { status: 409 });
    }

    return NextResponse.json({ product: updated });
  } catch (error) {
    return panelErrorResponse(error, "No se pudo guardar el cambio.");
  }
}
