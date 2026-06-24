import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { extractCoordinatesFromUrl } from "@/lib/location-link";

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

function normalizeStorePayload(body: any) {
  const locationLink = body.location_link ? String(body.location_link).trim() : null;
  const coordinates = locationLink ? extractCoordinatesFromUrl(locationLink) : null;
  const baseCurrency =
    String(body.base_currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD";

  return {
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    business_type: String(body.business_type || "general").trim(),
    whatsapp: body.whatsapp ? String(body.whatsapp).replace(/[^0-9]/g, "") : null,
    address: body.address ? String(body.address).trim() : null,
    latitude: coordinates?.latitude ?? optionalNumber(body.latitude),
    longitude: coordinates?.longitude ?? optionalNumber(body.longitude),
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
    primary_color: body.primary_color ? String(body.primary_color).trim() : "#2E3A79",
    accent_color: body.accent_color ? String(body.accent_color).trim() : "#FFB547",
    button_text_color: body.button_text_color ? String(body.button_text_color).trim() : "#25262B",
    accepts_delivery: Boolean(body.accepts_delivery),
    accepts_pickup: Boolean(body.accepts_pickup),
    is_active: Boolean(body.is_active),
  };
}

const storeSelect = `
  id,
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
  is_active
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
  is_active
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

    const buildQuery = (selectFields: string) => {
      let query = supabase
        .from("stores")
        .select(selectFields)
        .order("name", { ascending: true });

      if (auth.storeIds !== null) {
        query = query.in("id", auth.storeIds);
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
      "business_hours",
      "manual_open_status",
      "manual_open_note",
      "exchange_rate_source",
        "exchange_rate_updated_at",
      ])
    ) {
      paymentDetailsAvailable = false;
      const fallbackResult = await buildQuery(baseStoreSelect);
      data = fallbackResult.data?.map(addPaymentDetailsFallback) || [];
      error = fallbackResult.error;
    }

    if (error) throw error;

    return NextResponse.json({
      stores: data || [],
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

    assertStoreAccess(
      auth,
      body.id,
      "No tienes permiso para editar este comercio."
    );

    const payload = normalizeStorePayload(body);

    if (!payload.name) {
      return badRequest("El nombre del comercio es obligatorio.");
    }

    const supabase = createSupabaseAdminClient();

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
        "exchange_rate_source",
        "exchange_rate_updated_at",
      ])
    ) {
      paymentDetailsSaved = false;
      const {
        payment_details: _paymentDetails,
        location_link: _locationLink,
        base_currency: _baseCurrency,
        exchange_rate_source: _exchangeRateSource,
        exchange_rate_updated_at: _exchangeRateUpdatedAt,
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



