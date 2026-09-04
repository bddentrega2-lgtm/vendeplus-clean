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
import { normalizeBusinessType } from "@/lib/business-types";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_SIGNUP_BODY_BYTES = MAX_LOGO_BYTES + 120_000;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SIGNUP_IP_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000;

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeRepresentativeId(value: unknown) {
  const normalized = cleanText(value).toUpperCase().replace(/\s+/g, "");
  if (/^[0-9]{5,12}$/.test(normalized)) return `V-${normalized}`;
  return normalized.replace(/^([VEJGP])(?=[0-9])/, "$1-");
}

function logoExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
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

  if (
    normalizedMessage.includes("password") &&
    (normalizedMessage.includes("at least") || normalizedMessage.includes("too short") || normalizedMessage.includes("characters"))
  ) {
    return badRequest("La contrasena debe tener al menos 8 caracteres.");
  }

  if (
    normalizedMessage.includes("password") &&
    (normalizedMessage.includes("weak") || normalizedMessage.includes("common") || normalizedMessage.includes("pwned") || normalizedMessage.includes("leaked"))
  ) {
    return badRequest("Por seguridad, no podemos aceptar esa combinacion. Agrega otra palabra o algunos numeros e intenta de nuevo.");
  }

  if (normalizedMessage.includes("password")) {
    return badRequest("Supabase rechazo esa contrasena. Prueba una combinacion diferente.");
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

async function findUserAfterSignup(supabase: any, email: string) {
  const retryDelaysMs = [0, 200, 500, 900];

  for (const delayMs of retryDelaysMs) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const user = await findUserByEmail(supabase, email);
    if (user?.id) return user;
  }

  return null;
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

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return observed(badRequest("Envía los datos del registro mediante el formulario."));
  }

  let createdUserId = "";
  let createdStoreId = "";
  let uploadedLogoPath = "";
  let shouldDeleteAuthUserOnFailure = false;

  try {
    const body = await request.formData();
    const storeName = cleanText(body.get("storeName"));
    const representativeName = cleanText(body.get("representativeName"));
    const representativeIdNumber = normalizeRepresentativeId(body.get("representativeIdNumber"));
    const logo = body.get("logo");
    const email = normalizeAccessEmail(body.get("email"));
    const password = String(body.get("password") || "");
    const confirmPassword = String(body.get("confirmPassword") || "");
    const whatsapp = cleanText(body.get("whatsapp")).replace(/[^0-9]/g, "");
    const businessType = normalizeBusinessType(body.get("businessType"));
    const cityId = cleanText(body.get("cityId"));
    const captchaToken = cleanText(body.get("captchaToken"));
    const referralCode = slugifyStore(cleanText(body.get("referralCode")));

    if (!storeName) return observed(badRequest("El nombre del comercio es obligatorio."));
    if (representativeName.length < 3 || representativeName.length > 120) {
      return observed(badRequest("Ingresa el nombre completo del representante."));
    }
    if (!/^[VEJGP]-[0-9]{5,12}$/.test(representativeIdNumber)) {
      return observed(badRequest("Ingresa una cedula valida, por ejemplo V-12345678."));
    }
    if (!(logo instanceof File)) return observed(badRequest("El logo del comercio es obligatorio."));
    if (!ALLOWED_LOGO_TYPES.has(logo.type)) {
      return observed(badRequest("El logo debe ser una imagen JPG, PNG o WebP."));
    }
    if (logo.size <= 0 || logo.size > MAX_LOGO_BYTES) {
      return observed(badRequest("El logo no debe pesar mas de 2 MB."));
    }
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
    if (!cityId) return observed(badRequest("Selecciona la ciudad donde opera el comercio."));
    const { data: city, error: cityError } = await supabase
      .from("service_cities").select("id").eq("id", cityId).eq("is_active", true).maybeSingle();
    if (cityError) throw cityError;
    if (!city) return observed(badRequest("La ciudad seleccionada no est? disponible."));
    const { data: referrerStore, error: referrerError } = referralCode
      ? await supabase.from("stores").select("id, slug").eq("slug", referralCode).maybeSingle()
      : { data: null, error: null };
    if (referrerError) throw referrerError;
    if (referralCode && !referrerStore) return observed(badRequest("El código de referido no es válido."));
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

      if (!createdUserId) {
        const recoveredUser = await findUserAfterSignup(supabase, email);

        if (recoveredUser) {
          const canRecover = await canRecoverOrphanCommerceUser(supabase, recoveredUser);
          if (!canRecover) {
            return observed(conflict("Ya existe una cuenta con ese email. Inicia sesion o usa otro correo."));
          }

          createdUserId = recoveredUser.id;
          const createdAtMs = Date.parse(String(recoveredUser.created_at || ""));
          shouldDeleteAuthUserOnFailure = Number.isFinite(createdAtMs)
            && Date.now() - createdAtMs < 60_000;

          logApiEvent(apiContext, "signup_user_recovered_same_request", {
            userId: createdUserId,
          });
        }
      }
    }

    if (!createdUserId) {
      throw new Error("No se pudo crear el usuario.");
    }

    const logoPath = `store-signup/${slug}/${Date.now()}.${logoExtension(logo.type)}`;
    const logoBuffer = Buffer.from(await logo.arrayBuffer());
    const { error: logoError } = await supabase.storage
      .from("product-images")
      .upload(logoPath, logoBuffer, {
        cacheControl: "31536000",
        contentType: logo.type,
        upsert: false,
      });
    if (logoError) throw logoError;
    uploadedLogoPath = logoPath;
    const { data: logoData } = supabase.storage.from("product-images").getPublicUrl(logoPath);

    const storePayload = {
      slug,
      name: storeName,
      description: "Catalogo creado en Somos",
      business_type: businessType,
      whatsapp,
      address: null,
      city_id: city.id,
      latitude: null,
      longitude: null,
      cover_image_url: null,
      logo_url: logoData.publicUrl,
      opening_hours: "Disponible hoy",
      delivery_estimate: "25-40 min",
      pickup_estimate: "15-25 min",
      payment_methods: ["Pago movil", "Transferencia", "Efectivo"],
      usd_to_bs: 600,
      base_currency: "USD",
      whatsapp_message_note: null,
      primary_color: "#1F464C",
      accent_color: "#F27533",
      button_text_color: "#042332",
      accepts_delivery: false,
      accepts_pickup: true,
      is_active: true,
      plan_type: "trial",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_status: "trial",
      monthly_price_usd: 0,
      product_limit: 30,
    };

    const storeResult = await insertStore(supabase, storePayload);
    if (storeResult.error) throw storeResult.error;

    createdStoreId = storeResult.data.id;

    const { error: profileError } = await supabase.from("store_registration_profiles").insert({
      store_id: createdStoreId,
      representative_name: representativeName,
      representative_id_number: representativeIdNumber,
    });
    if (profileError) throw profileError;

    if (referrerStore) {
      const { error: referralError } = await supabase.from("store_referrals").insert({
        referrer_store_id: referrerStore.id,
        referred_store_id: createdStoreId,
        status: "registered",
      });
      if (referralError) throw referralError;
    }

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
      if (uploadedLogoPath) {
        await supabase.storage.from("product-images").remove([uploadedLogoPath]);
      }
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
