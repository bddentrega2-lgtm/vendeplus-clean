import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  assertStoreManager,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { loadTransportAgencyDeliverySettings } from "@/lib/transport";
import { assertAchievementFeature, loadStoreAchievements } from "@/lib/achievements";

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePaymentMethods(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizePaymentDetails(value: unknown) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};

  return {
    pagoMovil: {
      bank: cleanText(source.pagoMovil?.bank),
      phone: cleanText(source.pagoMovil?.phone),
      idNumber: cleanText(source.pagoMovil?.idNumber),
      holder: cleanText(source.pagoMovil?.holder),
    },
    transferencia: {
      bank: cleanText(source.transferencia?.bank),
      accountNumber: cleanText(source.transferencia?.accountNumber),
      idNumber: cleanText(source.transferencia?.idNumber),
      holder: cleanText(source.transferencia?.holder),
    },
    zelle: {
      contact: cleanText(source.zelle?.contact),
      holder: cleanText(source.zelle?.holder),
    },
    binance: {
      contact: cleanText(source.binance?.contact),
      holder: cleanText(source.binance?.holder),
    },
    efectivo: {
      note: cleanText(source.efectivo?.note),
    },
  };
}

async function syncDeliverySettings(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeId: string,
  payload: {
    accepts_delivery: boolean;
    accepts_pickup: boolean;
    accepts_national_shipping: boolean;
  }
) {
  const { data: current, error: currentError } = await supabase
    .from("store_delivery_settings")
    .select("id, delivery_provider")
    .eq("store_id", storeId)
    .maybeSingle();
  if (currentError) throw currentError;

  const base = {
    delivery_enabled: payload.accepts_delivery,
    pickup_enabled: payload.accepts_pickup,
    national_shipping_enabled: payload.accepts_national_shipping,
    updated_at: new Date().toISOString(),
  };
  let settingsPayload: Record<string, unknown> = base;

  if (!payload.accepts_delivery) {
    // Keep the selected provider and its relation while delivery is paused.
    // mapStoreDeliverySettings exposes it as disabled until delivery_enabled is true again.
    settingsPayload = base;
  } else if (current?.delivery_provider === "transport_agency") {
    const transport = await loadTransportAgencyDeliverySettings(
      supabase,
      storeId,
      payload.accepts_pickup
    );
    if (!transport) {
      throw new Error(
        "La empresa delivery seleccionada no está disponible o no tiene tarifas activas."
      );
    }
    settingsPayload = {
      ...base,
      delivery_provider: "transport_agency",
      pricing_type: transport.settings.pricingType,
      fixed_fee_usd: transport.settings.fixedFeeUsd,
      max_distance_km: transport.settings.maxDistanceKm,
      distance_factor: null,
      manual_quote_message: transport.settings.manualQuoteMessage,
      transport_agency_connection_id: transport.connection.id,
      transport_agency_id: transport.connection.agency_id,
    };
  } else if (!current || current.delivery_provider === "disabled") {
    const transport = await loadTransportAgencyDeliverySettings(
      supabase,
      storeId,
      payload.accepts_pickup
    );
    settingsPayload = transport
      ? {
          ...base,
          delivery_provider: "transport_agency",
          pricing_type: transport.settings.pricingType,
          fixed_fee_usd: transport.settings.fixedFeeUsd,
          max_distance_km: transport.settings.maxDistanceKm,
          distance_factor: null,
          manual_quote_message: transport.settings.manualQuoteMessage,
          transport_agency_connection_id: transport.connection.id,
          transport_agency_id: transport.connection.agency_id,
        }
      : {
          ...base,
          delivery_provider: "own_delivery",
          transport_agency_connection_id: null,
          transport_agency_id: null,
        };
  }

  const result = current?.id
    ? await supabase
        .from("store_delivery_settings")
        .update(settingsPayload)
        .eq("store_id", storeId)
    : await supabase.from("store_delivery_settings").insert({
        store_id: storeId,
        delivery_provider: payload.accepts_delivery ? "own_delivery" : "disabled",
        pricing_type: "manual",
        fixed_fee_usd: 0,
        ...settingsPayload,
      });
  if (result.error) throw result.error;
}

function normalizeStorePayload(body: any) {
  const locationLink = body.location_link ? String(body.location_link).trim() : null;
  const baseCurrency =
    String(body.base_currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD";

  return {
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    business_type: String(body.business_type || "general").trim(),
    whatsapp: body.whatsapp ? String(body.whatsapp).replace(/[^0-9]/g, "") : null,
    address: body.address ? String(body.address).trim() : null,
    latitude: optionalNumber(body.latitude),
    longitude: optionalNumber(body.longitude),
    location_link: locationLink,
    cover_image_url: body.cover_image_url ? String(body.cover_image_url).trim() : null,
    logo_url: body.logo_url ? String(body.logo_url).trim() : null,
    opening_hours: body.opening_hours ? String(body.opening_hours).trim() : "Disponible hoy",
    delivery_estimate: body.delivery_estimate ? String(body.delivery_estimate).trim() : "25-40 min",
    pickup_estimate: body.pickup_estimate ? String(body.pickup_estimate).trim() : "15-25 min",
    payment_methods: normalizePaymentMethods(body.payment_methods),
    payment_details: normalizePaymentDetails(body.payment_details),
    usd_to_bs: Number(body.usd_to_bs || 600),
    base_currency: baseCurrency,
    show_prices_in_bs: body.show_prices_in_bs !== false,
    auto_update_exchange_rate: body.auto_update_exchange_rate !== false,
    business_hours:
      body.business_hours && typeof body.business_hours === "object" && !Array.isArray(body.business_hours)
        ? body.business_hours
        : {},
    manual_open_status: ["auto", "open", "closed"].includes(cleanText(body.manual_open_status))
      ? cleanText(body.manual_open_status)
      : "auto",
    manual_open_note: cleanText(body.manual_open_note) || null,
    exchange_rate_source: body.exchange_rate_source
      ? String(body.exchange_rate_source).trim()
      : null,
    exchange_rate_updated_at: body.exchange_rate_updated_at
      ? String(body.exchange_rate_updated_at)
      : null,
    whatsapp_message_note: body.whatsapp_message_note ? String(body.whatsapp_message_note).trim() : null,
    primary_color: body.primary_color ? String(body.primary_color).trim() : "#1F464C",
    accent_color: body.accent_color ? String(body.accent_color).trim() : "#F27533",
    button_text_color: body.button_text_color ? String(body.button_text_color).trim() : "#042332",
    accepts_delivery: Boolean(body.accepts_delivery),
    accepts_pickup: Boolean(body.accepts_pickup),
    accepts_national_shipping: Boolean(body.accepts_national_shipping),
    request_customer_id_number: Boolean(body.request_customer_id_number),
    is_active: Boolean(body.is_active),
    service_fee_payer: body.service_fee_payer === "customer" ? "customer" : "merchant",
    service_fee_billing_cycle: "monthly",
  };
}

const storeSelect = `
  id,
  plan_type,
  slug,
  name,
  description,
  business_type,
  whatsapp,
  address,
  latitude,
  longitude,
  location_link,
  cover_image_url,
  logo_url,
  opening_hours,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  payment_details,
  usd_to_bs,
  base_currency,
  show_prices_in_bs,
  auto_update_exchange_rate,
  business_hours,
  manual_open_status,
  manual_open_note,
  exchange_rate_source,
  exchange_rate_updated_at,
  whatsapp_message_note,
  primary_color,
  accent_color,
  button_text_color,
  accepts_delivery,
  accepts_pickup,
  accepts_national_shipping,
  request_customer_id_number,
  is_active
  ,service_fee_payer
  ,service_fee_billing_cycle
`;

const baseStoreSelect = `
  id,
  slug,
  name,
  description,
  business_type,
  whatsapp,
  address,
  latitude,
  longitude,
  cover_image_url,
  logo_url,
  opening_hours,
  delivery_estimate,
  pickup_estimate,
  payment_methods,
  usd_to_bs,
  whatsapp_message_note,
  primary_color,
  accent_color,
  button_text_color,
  accepts_delivery,
  accepts_pickup,
  is_active,
  subscription_status,
  trial_ends_at,
  subscription_ends_at,
  next_payment_due_at,
  monthly_price_usd,
  plan_type
`;

function addPaymentDetailsFallback(store: any) {
  return {
    ...store,
    payment_details: store?.payment_details || {},
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();
    const requestedStoreId = String(request.headers.get("x-panel-store-id") || "").trim();

    if (requestedStoreId) {
      assertStoreAccess(auth, requestedStoreId, "No tienes permiso para consultar esta sede.");
    }

    const buildQuery = (selectFields: string) => {
      let query = supabase
        .from("stores")
        .select(selectFields)
        .order("name", { ascending: true });

      if (auth.storeIds !== null) {
        query = query.in("id", auth.storeIds);
      }

      if (requestedStoreId) {
        query = query.eq("id", requestedStoreId);
      }

      return query;
    };

    let paymentDetailsAvailable = true;
    let { data, error } = await buildQuery(storeSelect);

    if (
      error &&
      isMissingColumnError(error, [
      "payment_details",
      "location_link",
      "base_currency",
      "show_prices_in_bs",
      "auto_update_exchange_rate",
      "business_hours",
      "manual_open_status",
      "manual_open_note",
      "exchange_rate_source",
        "exchange_rate_updated_at",
        "request_customer_id_number",
        "accepts_national_shipping",
      ])
    ) {
      paymentDetailsAvailable = false;
      const fallbackResult = await buildQuery(baseStoreSelect);
      data = fallbackResult.data?.map(addPaymentDetailsFallback) || [];
      error = fallbackResult.error;
    }

    if (error) throw error;

    const storesWithFees = await Promise.all((data || []).map(async (store: any) => {
      const [achievementState, balanceResult] = await Promise.all([
        loadStoreAchievements(supabase, store.id),
        store.plan_type === "per_service"
          ? supabase.rpc("store_service_fee_balance", { p_store_id: store.id }).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { ...store, service_fee_balance: balanceResult.data || null, achievement_features: achievementState.features };
    }));

    return NextResponse.json({
      stores: storesWithFees,
      paymentDetailsAvailable,
      auth: {
        mode: auth.mode,
        email: auth.email || null,
        role: auth.role || null,
      },
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error cargando configuración.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const body = await request.json();

    if (!body.id) {
      return badRequest("Falta el ID del comercio.");
    }

    assertStoreManager(
      auth,
      body.id,
      "No tienes permiso para editar este comercio."
    );

    const payload = normalizeStorePayload(body);

    if (!payload.name) {
      return badRequest("El nombre del comercio es obligatorio.");
    }

    const supabase = createSupabaseAdminClient();

    const { data: currentBrand, error: currentBrandError } = await supabase
      .from("stores")
      .select("primary_color, accent_color, button_text_color")
      .eq("id", body.id)
      .single();
    if (currentBrandError) throw currentBrandError;
    const changesBrandColors =
      payload.primary_color !== currentBrand.primary_color ||
      payload.accent_color !== currentBrand.accent_color ||
      payload.button_text_color !== currentBrand.button_text_color;
    if (changesBrandColors) {
      await assertAchievementFeature(supabase, body.id, "brand_colors");
    }

    let paymentDetailsSaved = true;
    let { data, error } = await supabase
      .from("stores")
      .update(payload)
      .eq("id", body.id)
      .select(storeSelect)
      .single();

    if (
      error &&
      isMissingColumnError(error, [
        "payment_details",
        "location_link",
        "base_currency",
        "show_prices_in_bs",
        "auto_update_exchange_rate",
        "exchange_rate_source",
        "exchange_rate_updated_at",
      ])
    ) {
      paymentDetailsSaved = false;
      const {
        payment_details: _paymentDetails,
        location_link: _locationLink,
        base_currency: _baseCurrency,
        show_prices_in_bs: _showPricesInBs,
        auto_update_exchange_rate: _autoUpdateExchangeRate,
        exchange_rate_source: _exchangeRateSource,
        exchange_rate_updated_at: _exchangeRateUpdatedAt,
        accepts_national_shipping: _acceptsNationalShipping,
        request_customer_id_number: _requestCustomerIdNumber,
        ...basePayload
      } = payload;
      const fallbackResult = await supabase
        .from("stores")
        .update(basePayload)
        .eq("id", body.id)
        .select(baseStoreSelect)
        .single();

      data = fallbackResult.data
        ? addPaymentDetailsFallback(fallbackResult.data)
        : null;
      error = fallbackResult.error;
    }

    if (error) throw error;

    await syncDeliverySettings(supabase, body.id, {
      accepts_delivery: payload.accepts_delivery,
      accepts_pickup: payload.accepts_pickup,
      accepts_national_shipping: payload.accepts_national_shipping,
    });

    return NextResponse.json({
      store: data,
      paymentDetailsSaved,
      warning: paymentDetailsSaved
        ? null
        : "La configuración general se guardó, pero los datos de pago NO quedaron guardados porque falta aplicar la migración de pagos en Supabase.",
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando configuración.");
  }
}



