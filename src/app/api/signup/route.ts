import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findUserByEmail, normalizeAccessEmail } from "@/lib/admin/store-access";
import { slugifyStore } from "@/lib/admin/stores";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { TRIAL_DAYS, getPlan } from "@/lib/plans";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function buildUniqueSlug(supabase: any, storeName: string) {
  const baseSlug = slugifyStore(storeName) || `comercio-${Date.now().toString(36)}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data) return candidate;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}

async function insertStore(supabase: any, payload: Record<string, any>) {
  const { data, error } = await supabase
    .from("stores")
    .insert(payload)
    .select("id, slug, name")
    .single();

  if (
    error &&
    isMissingColumnError(error, [
      "plan_type",
      "trial_started_at",
      "trial_ends_at",
      "base_currency",
    ])
  ) {
    const {
      plan_type: _planType,
      trial_started_at: _trialStartedAt,
      trial_ends_at: _trialEndsAt,
      base_currency: _baseCurrency,
      ...fallbackPayload
    } = payload;

    return supabase
      .from("stores")
      .insert(fallbackPayload)
      .select("id, slug, name")
      .single();
  }

  return { data, error };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit({
    key: `signup:${ip}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Prueba de nuevo más tarde." },
      { status: 429 }
    );
  }

  let createdUserId = "";
  let createdStoreId = "";

  try {
    const body = await request.json();
    const storeName = cleanText(body.storeName);
    const email = normalizeAccessEmail(body.email);
    const password = cleanText(body.password);
    const whatsapp = cleanText(body.whatsapp).replace(/[^0-9]/g, "");
    const businessType = cleanText(body.businessType) || "general";
    const selectedPlan = getPlan(cleanText(body.planId));

    if (!storeName) return badRequest("El nombre del comercio es obligatorio.");
    if (!email || !email.includes("@")) return badRequest("Ingresa un email válido.");
    if (password.length < 8) return badRequest("La contraseña debe tener al menos 8 caracteres.");
    if (!whatsapp || whatsapp.length < 10) return badRequest("Ingresa un WhatsApp válido.");

    const supabase = createSupabaseAdminClient();
    const existingUser = await findUserByEmail(supabase, email);

    if (existingUser) {
      return conflict("Ya existe una cuenta con ese email. Inicia sesión o usa otro correo.");
    }

    const now = new Date();
    const trialEndsAt = addDays(now, TRIAL_DAYS);
    const slug = await buildUniqueSlug(supabase, storeName);

    const userResult = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: storeName,
        source: "vendeplus_signup",
        selected_plan: selectedPlan.id,
      },
    });

    if (userResult.error) throw userResult.error;
    createdUserId = userResult.data.user?.id || "";

    if (!createdUserId) {
      throw new Error("No se pudo crear el usuario.");
    }

    const storePayload = {
      slug,
      name: storeName,
      description: "Catálogo creado en Vende+.",
      business_type: businessType,
      whatsapp,
      address: null,
      latitude: null,
      longitude: null,
      cover_image_url: null,
      logo_url: null,
      opening_hours: "Disponible hoy",
      delivery_estimate: "25-40 min",
      pickup_estimate: "15-25 min",
      payment_methods: ["Pago móvil", "Transferencia", "Efectivo"],
      usd_to_bs: 600,
      base_currency: "USD",
      whatsapp_message_note: null,
      primary_color: "#2E3A79",
      accent_color: "#FFB547",
      button_text_color: "#25262B",
      accepts_delivery: false,
      accepts_pickup: true,
      is_active: true,
      plan_type: "trial",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    };

    const storeResult = await insertStore(supabase, storePayload);
    if (storeResult.error) throw storeResult.error;

    createdStoreId = storeResult.data.id;

    const { error: assignmentError } = await supabase.from("store_users").insert({
      store_id: createdStoreId,
      user_id: createdUserId,
      role: "owner",
    });

    if (assignmentError) throw assignmentError;

    return NextResponse.json(
      {
        store: storeResult.data,
        trialEndsAt: trialEndsAt.toISOString(),
        selectedPlan: selectedPlan.id,
        message: "Cuenta creada. Ya puedes entrar al panel.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    try {
      const supabase = createSupabaseAdminClient();
      if (createdStoreId) await supabase.from("stores").delete().eq("id", createdStoreId);
      if (createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
    } catch {
      // Best-effort cleanup only.
    }

    return NextResponse.json(
      { error: error.message || "No se pudo crear la cuenta." },
      { status: 500 }
    );
  }
}
