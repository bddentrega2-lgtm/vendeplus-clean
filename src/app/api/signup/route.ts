import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { findUserByEmail, normalizeAccessEmail } from "@/lib/admin/store-access";
import { slugifyStore } from "@/lib/admin/stores";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";
import {
  attachApiResponseHeaders,
  createApiRequestContext,
  logApiError,
  logApiEvent,
} from "@/lib/server/observability";
import { buildPublicSiteUrl } from "@/lib/server/site-url";
import { TRIAL_DAYS } from "@/lib/plans";

const MAX_SIGNUP_BODY_BYTES = 20_000;
const SIGNUP_IP_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000;

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function authSignupError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("captcha")) {
    return badRequest("Completa la verificacion de seguridad e intenta de nuevo.");
  }

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("registered") ||
    normalizedMessage.includes("exists")
  ) {
    return conflict("Ya existe una cuenta con ese email. Inicia sesion o usa otro correo.");
  }

  if (normalizedMessage.includes("password")) {
    return badRequest("La contrasena debe tener al menos 8 caracteres.");
  }

  return badRequest("No se pudo crear el acceso. Revisa los datos e intenta de nuevo.");
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

async function canRecoverOrphanCommerceUser(supabase: any, user: any) {
  const source = String(user?.user_metadata?.source || "");
  const accountType = String(user?.user_metadata?.account_type || "");
  if (accountType && accountType !== "commerce") return false;
  if (source && source !== "vendeplus_signup") return false;

  const [storeUserResult, agencyUserResult] = await Promise.all([
    supabase
      .from("store_users")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
    supabase
      .from("transport_agency_users")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
  ]);

  if (storeUserResult.error) throw storeUserResult.error;
  if (agencyUserResult.error) throw agencyUserResult.error;

  return (
    (storeUserResult.data || []).length === 0 &&
    (agencyUserResult.data || []).length === 0
  );
}

export async function POST(request: NextRequest) {
  const apiContext = createApiRequestContext(request, "signup");
  const observed = (response: NextResponse) =>
    attachApiResponseHeaders(response, apiContext, "signup");

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_SIGNUP_BODY_BYTES) {
    return observed(
      NextResponse.json(
        { error: "La solicitud es demasiado grande." },
        { status: 413 }
      )
    );
  }

  const ip = getClientIp(request);
  const rateLimit = await checkDistributedRateLimit({
    key: `signup:${ip}`,
    limit: SIGNUP_IP_LIMIT,
    windowMs: SIGNUP_RATE_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return observed(
      NextResponse.json(
        { error: "Demasiados intentos. Prueba de nuevo mas tarde." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimit, SIGNUP_IP_LIMIT),
        }
      )
    );
  }

  let createdUserId = "";
  let createdStoreId = "";
  let shouldDeleteAuthUserOnFailure = false;

  try {
    const body = await request.json();
    const storeName = cleanText(body.storeName);
    const email = normalizeAccessEmail(body.email);
    const password = cleanText(body.password);
    const confirmPassword = cleanText(body.confirmPassword);
    const whatsapp = cleanText(body.whatsapp).replace(/[^0-9]/g, "");
    const businessType = cleanText(body.businessType) || "general";
    const captchaToken = cleanText(body.captchaToken);

    if (!storeName) return observed(badRequest("El nombre del comercio es obligatorio."));
    if (!email || !email.includes("@")) return observed(badRequest("Ingresa un email valido."));
    if (password.length < 8) {
      return observed(badRequest("La contrasena debe tener al menos 8 caracteres."));
    }
    if (confirmPassword && password !== confirmPassword) {
      return observed(badRequest("Las contrasenas no coinciden."));
    }
    if (!whatsapp || whatsapp.length < 10) {
      return observed(badRequest("Ingresa un WhatsApp valido."));
    }

    const supabase = createSupabaseAdminClient();
    const existingUser = await findUserByEmail(supabase, email);

    if (existingUser) {
      const canRecover = await canRecoverOrphanCommerceUser(supabase, existingUser);

      if (!canRecover) {
        return observed(conflict("Ya existe una cuenta con ese email. Inicia sesion o usa otro correo."));
      }

      createdUserId = existingUser.id;
    }

    const now = new Date();
    const trialEndsAt = addDays(now, TRIAL_DAYS);
    const slug = await buildUniqueSlug(supabase, storeName);
    const publicAuth = createSupabasePublicClient();

    if (!publicAuth) {
      throw new Error("Faltan variables publicas de Supabase.");
    }

    let requiresEmailConfirmation = true;

    if (!createdUserId) {
      const userResult = await publicAuth.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildPublicSiteUrl(request, "/panel/login"),
          captchaToken: captchaToken || undefined,
          data: {
            name: storeName,
            source: "vendeplus_signup",
            selected_plan: "trial",
          },
        },
      });

      if (userResult.error) {
        return observed(authSignupError(userResult.error.message || ""));
      }

      createdUserId = userResult.data.user?.id || "";
      shouldDeleteAuthUserOnFailure = Boolean(createdUserId);
      requiresEmailConfirmation = !userResult.data.session;
    }

    if (!createdUserId) {
      throw new Error("No se pudo crear el usuario.");
    }

    const storePayload = {
      slug,
      name: storeName,
      description: "Catalogo creado en Somos",
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
      payment_methods: ["Pago movil", "Transferencia", "Efectivo"],
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
      subscription_status: "trial",
      monthly_price_usd: 0,
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

    logApiEvent(apiContext, "signup_created", {
      storeId: createdStoreId,
      recoveredOrphanUser: Boolean(existingUser),
      requiresEmailConfirmation,
    });

    return observed(
      NextResponse.json(
        {
          store: storeResult.data,
          trialEndsAt: trialEndsAt.toISOString(),
          selectedPlan: "trial",
          requiresEmailConfirmation,
          message: !requiresEmailConfirmation
            ? "Cuenta creada. Ya puedes entrar al panel."
            : "Cuenta creada. Revisa tu correo para confirmar el acceso antes de entrar al panel.",
        },
        { status: 201 }
      )
    );
  } catch (error) {
    logApiError(apiContext, "signup_failed", error, {
      cleanupStore: Boolean(createdStoreId),
      cleanupUser: Boolean(createdUserId),
    });

    try {
      const supabase = createSupabaseAdminClient();
      if (createdStoreId) await supabase.from("stores").delete().eq("id", createdStoreId);
      if (shouldDeleteAuthUserOnFailure && createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
    } catch {
      // Best-effort cleanup only.
    }

    return observed(
      NextResponse.json(
        { error: "No se pudo crear la cuenta. Revisa los datos e intenta de nuevo." },
        { status: 500 }
      )
    );
  }
}
