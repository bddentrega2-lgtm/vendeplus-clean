import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";

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

function normalizeStorePayload(body: any) {
  return {
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    business_type: String(body.business_type || "general").trim(),
    whatsapp: body.whatsapp ? String(body.whatsapp).replace(/[^0-9]/g, "") : null,
    address: body.address ? String(body.address).trim() : null,
    latitude: optionalNumber(body.latitude),
    longitude: optionalNumber(body.longitude),
    cover_image_url: body.cover_image_url ? String(body.cover_image_url).trim() : null,
    logo_url: body.logo_url ? String(body.logo_url).trim() : null,
    opening_hours: body.opening_hours ? String(body.opening_hours).trim() : "Disponible hoy",
    delivery_estimate: body.delivery_estimate ? String(body.delivery_estimate).trim() : "25-40 min",
    pickup_estimate: body.pickup_estimate ? String(body.pickup_estimate).trim() : "15-25 min",
    payment_methods: normalizePaymentMethods(body.payment_methods),
    usd_to_bs: Number(body.usd_to_bs || 600),
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("stores")
      .select(storeSelect)
      .order("name", { ascending: true });

    if (auth.storeIds !== null) {
      query = query.in("id", auth.storeIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      stores: data || [],
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

    const { data, error } = await supabase
      .from("stores")
      .update(payload)
      .eq("id", body.id)
      .select(storeSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando configuración.");
  }
}



