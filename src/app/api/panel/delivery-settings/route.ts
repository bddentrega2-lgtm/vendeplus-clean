import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapStoreDeliverySettings } from "@/lib/delivery";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown) {
  return Math.max(0, optionalNumber(value) || 0);
}

function normalizeSettingsPayload(body: any, storeId: string) {
  const deliveryProvider = ["own_delivery", "entrega2", "manual_quote", "disabled"].includes(
    cleanText(body.deliveryProvider)
  )
    ? cleanText(body.deliveryProvider)
    : "own_delivery";
  const requestedPricingType = cleanText(body.pricingType) === "fixed"
    ? "fixed_distance"
    : cleanText(body.pricingType);
  const pricingType = ["fixed_distance", "distance_ranges", "zones"].includes(requestedPricingType)
    ? requestedPricingType
    : "fixed_distance";
  const deliveryEnabled = deliveryProvider !== "disabled" && Boolean(body.deliveryEnabled);
  const promoDiscountType = ["free", "amount", "percent"].includes(
    cleanText(body.deliveryPromoDiscountType)
  )
    ? cleanText(body.deliveryPromoDiscountType)
    : "free";
  const promoMin = optionalNumber(body.deliveryPromoMinSubtotalUsd ?? body.freeDeliveryMinUsd);

  return {
    store_id: storeId,
    delivery_enabled: deliveryEnabled,
    pickup_enabled: Boolean(body.pickupEnabled),
    delivery_provider: deliveryProvider,
    pricing_type:
      deliveryProvider === "entrega2"
        ? "distance_ranges"
        : deliveryProvider === "manual_quote"
          ? "manual"
          : deliveryProvider === "disabled"
            ? "manual"
          : pricingType,
    fixed_fee_usd: money(body.fixedFeeUsd),
    free_delivery_min_usd: promoMin,
    delivery_promo_enabled: Boolean(body.deliveryPromoEnabled) && promoMin !== null && promoMin > 0,
    delivery_promo_min_subtotal_usd: promoMin,
    delivery_promo_discount_type: promoDiscountType,
    delivery_promo_discount_value: money(body.deliveryPromoDiscountValue),
    max_distance_km: optionalNumber(body.maxDistanceKm),
    distance_factor: optionalNumber(body.distanceFactor),
    manual_quote_message:
      cleanText(body.manualQuoteMessage) ||
      "Confirma el precio de tu delivery por WhatsApp con el comercio.",
    updated_at: new Date().toISOString(),
  };
}

async function loadRows(supabase: any, storeIds: string[] | null) {
  let storesQuery = supabase
    .from("stores")
    .select("id, name, accepts_delivery, accepts_pickup")
    .order("name", { ascending: true });

  if (storeIds !== null) storesQuery = storesQuery.in("id", storeIds);

  const { data: stores, error: storesError } = await storesQuery;
  if (storesError) throw storesError;

  const ids = (stores || []).map((store: any) => store.id);
  if (!ids.length) return [];

  const [settingsResult, zonesResult, ratesResult] = await Promise.all([
    supabase
      .from("store_delivery_settings")
      .select("*")
      .in("store_id", ids),
    supabase
      .from("store_delivery_zones")
      .select("*")
      .in("store_id", ids)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_delivery_distance_rates")
      .select("*")
      .in("store_id", ids)
      .order("sort_order", { ascending: true }),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (zonesResult.error) throw zonesResult.error;
  if (ratesResult.error) throw ratesResult.error;

  return (stores || []).map((store: any) => {
    const row = {
      ...store,
      store_delivery_settings: (settingsResult.data || []).filter(
        (entry: any) => entry.store_id === store.id
      ),
      store_delivery_zones: (zonesResult.data || []).filter(
        (entry: any) => entry.store_id === store.id
      ),
      store_delivery_distance_rates: (ratesResult.data || []).filter(
        (entry: any) => entry.store_id === store.id
      ),
    };

    const settings = mapStoreDeliverySettings(row);

    return {
      store: {
        id: store.id,
        name: store.name,
      },
      settings,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const rows = await loadRows(supabase, auth.storeIds);

    return NextResponse.json({ stores: rows });
  } catch (error: any) {
    return panelErrorResponse(
      error,
      "Error cargando configuración de entrega. Aplica la migración de delivery si todavía no existe."
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const storeId = cleanText(body.storeId);

    if (!storeId) return badRequest("Falta el comercio.");
    assertStoreAccess(auth, storeId, "No tienes permiso para editar este comercio.");

    if (body.action === "zone") {
      const id = cleanText(body.id);
      if (!id) return badRequest("Falta la zona.");

      const payload = {
        name: cleanText(body.name) || "Zona",
        description: cleanText(body.description) || null,
        fee_usd: money(body.feeUsd),
        is_active: body.isActive !== false,
        sort_order: Math.floor(optionalNumber(body.sortOrder) || 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("store_delivery_zones")
        .update(payload)
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw error;
    } else if (body.action === "rate") {
      const id = cleanText(body.id);
      if (!id) return badRequest("Falta el rango.");

      const payload = {
        min_km: money(body.minKm),
        max_km: optionalNumber(body.maxKm),
        fee_usd: money(body.feeUsd),
        is_active: body.isActive !== false,
        sort_order: Math.floor(optionalNumber(body.sortOrder) || 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("store_delivery_distance_rates")
        .update(payload)
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw error;
    } else {
      const payload = normalizeSettingsPayload(body, storeId);
      let { error } = await supabase
        .from("store_delivery_settings")
        .upsert(payload, { onConflict: "store_id" });

      if (
        error &&
        isMissingColumnError(error, [
          "delivery_promo_enabled",
          "delivery_promo_min_subtotal_usd",
          "delivery_promo_discount_type",
          "delivery_promo_discount_value",
        ])
      ) {
        const {
          delivery_promo_enabled: _enabled,
          delivery_promo_min_subtotal_usd: _min,
          delivery_promo_discount_type: _type,
          delivery_promo_discount_value: _value,
          ...legacyPayload
        } = payload;
        const fallback = await supabase
          .from("store_delivery_settings")
          .upsert(legacyPayload, { onConflict: "store_id" });
        error = fallback.error;
      }

      if (error) throw error;

      const storeUpdate = await supabase
        .from("stores")
        .update({
          accepts_delivery: payload.delivery_enabled,
          accepts_pickup: payload.pickup_enabled,
        })
        .eq("id", storeId);
      if (storeUpdate.error) throw storeUpdate.error;
    }

    const rows = await loadRows(supabase, auth.storeIds);
    return NextResponse.json({ stores: rows });
  } catch (error: any) {
    return panelErrorResponse(error, "Error guardando configuración de entrega.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const storeId = cleanText(body.storeId);

    if (!storeId) return badRequest("Falta el comercio.");
    assertStoreAccess(auth, storeId, "No tienes permiso para editar este comercio.");

    if (body.action === "zone") {
      const { error } = await supabase.from("store_delivery_zones").insert({
        store_id: storeId,
        name: cleanText(body.name) || "Nueva zona",
        description: cleanText(body.description) || null,
        fee_usd: money(body.feeUsd),
        is_active: true,
        sort_order: Math.floor(optionalNumber(body.sortOrder) || 0),
      });
      if (error) throw error;
    } else if (body.action === "rate") {
      const { error } = await supabase.from("store_delivery_distance_rates").insert({
        store_id: storeId,
        min_km: money(body.minKm),
        max_km: optionalNumber(body.maxKm),
        fee_usd: money(body.feeUsd),
        is_active: true,
        sort_order: Math.floor(optionalNumber(body.sortOrder) || 0),
      });
      if (error) throw error;
    } else {
      return badRequest("Acción inválida.");
    }

    const rows = await loadRows(supabase, auth.storeIds);
    return NextResponse.json({ stores: rows });
  } catch (error: any) {
    return panelErrorResponse(error, "Error creando regla de entrega.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const storeId = cleanText(body.storeId);
    const id = cleanText(body.id);

    if (!storeId || !id) return badRequest("Faltan datos.");
    assertStoreAccess(auth, storeId, "No tienes permiso para editar este comercio.");

    const table =
      body.action === "zone"
        ? "store_delivery_zones"
        : body.action === "rate"
          ? "store_delivery_distance_rates"
          : "";

    if (!table) return badRequest("Acción inválida.");

    const { error } = await supabase.from(table).delete().eq("id", id).eq("store_id", storeId);
    if (error) throw error;

    const rows = await loadRows(supabase, auth.storeIds);
    return NextResponse.json({ stores: rows });
  } catch (error: any) {
    return panelErrorResponse(error, "Error eliminando regla de entrega.");
  }
}
