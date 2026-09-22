import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findUserByEmail, normalizeAccessEmail } from "@/lib/admin/store-access";
import { slugifyStore } from "@/lib/admin/stores";
import { isWeeklyOrderVolume } from "@/lib/commerce-registration";
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
import { normalizeBusinessType } from "@/lib/business-types";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_SIGNUP_BODY_BYTES = MAX_LOGO_BYTES + 120_000;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SIGNUP_IP_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000;
const REGISTRATION_BUCKET = "commerce-registration-assets";

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

async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY || "";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  if (!siteKey && !secret) return true;
  if (!token || !secret) return false;

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

async function createRequestCode(supabase: any) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    const requestCode = `SOL-${suffix}`;
    const { data, error } = await supabase
      .from("commerce_registration_requests")
      .select("id")
      .eq("request_code", requestCode)
      .maybeSingle();
    if (error) throw error;
    if (!data) return requestCode;
  }
  throw new Error("No se pudo generar el codigo de solicitud.");
}

export async function POST(request: NextRequest) {
  const apiContext = createApiRequestContext(request, "signup");
  const observed = (response: NextResponse) =>
    attachApiResponseHeaders(response, apiContext, "signup");

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_SIGNUP_BODY_BYTES) {
    return observed(NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 }));
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
        { status: 429, headers: rateLimitHeaders(rateLimit, SIGNUP_IP_LIMIT) }
      )
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return observed(badRequest("Envía los datos del registro mediante el formulario."));
  }

  let uploadedLogoPath = "";

  try {
    const body = await request.formData();
    const storeName = cleanText(body.get("storeName"));
    const representativeName = cleanText(body.get("representativeName"));
    const representativeIdNumber = normalizeRepresentativeId(body.get("representativeIdNumber"));
    const logo = body.get("logo");
    const email = normalizeAccessEmail(body.get("email"));
    const whatsapp = cleanText(body.get("whatsapp")).replace(/[^0-9]/g, "");
    const businessType = normalizeBusinessType(body.get("businessType"));
    const cityId = cleanText(body.get("cityId"));
    const captchaToken = cleanText(body.get("captchaToken"));
    const referralCode = slugifyStore(cleanText(body.get("referralCode")));
    const weeklyOrderVolume = cleanText(body.get("weeklyOrderVolume"));

    if (storeName.length < 2 || storeName.length > 120) {
      return observed(badRequest("Ingresa el nombre del comercio."));
    }
    if (representativeName.length < 3 || representativeName.length > 120) {
      return observed(badRequest("Ingresa el nombre completo del representante."));
    }
    if (!/^[VEJGP]-[0-9]{5,12}$/.test(representativeIdNumber)) {
      return observed(badRequest("Ingresa una cedula valida, por ejemplo V-12345678."));
    }
    if (!(logo instanceof File)) {
      return observed(badRequest("El logo del comercio es obligatorio."));
    }
    if (!ALLOWED_LOGO_TYPES.has(logo.type)) {
      return observed(badRequest("El logo debe ser una imagen JPG, PNG o WebP."));
    }
    if (logo.size <= 0 || logo.size > MAX_LOGO_BYTES) {
      return observed(badRequest("El logo no debe pesar mas de 2 MB."));
    }
    if (!email || !email.includes("@")) {
      return observed(badRequest("Ingresa un email valido."));
    }
    if (!whatsapp || whatsapp.length < 10) {
      return observed(badRequest("Ingresa un WhatsApp valido."));
    }
    if (!cityId) return observed(badRequest("Selecciona la ciudad donde opera el comercio."));
    if (!isWeeklyOrderVolume(weeklyOrderVolume)) {
      return observed(badRequest("Indica cuantos pedidos recibes por WhatsApp en una semana."));
    }
    if (!(await verifyTurnstile(captchaToken, ip))) {
      return observed(badRequest("Completa la verificacion de seguridad e intenta de nuevo."));
    }

    const supabase = createSupabaseAdminClient();
    const [cityResult, existingRequestResult, existingUser] = await Promise.all([
      supabase.from("service_cities").select("id").eq("id", cityId).eq("is_active", true).maybeSingle(),
      supabase
        .from("commerce_registration_requests")
        .select("id, request_code")
        .ilike("email", email)
        .in("status", ["pending", "activating", "activation_error"])
        .maybeSingle(),
      findUserByEmail(supabase, email),
    ]);

    if (cityResult.error) throw cityResult.error;
    if (existingRequestResult.error) throw existingRequestResult.error;
    if (!cityResult.data) return observed(badRequest("La ciudad seleccionada no esta disponible."));
    if (existingUser) {
      return observed(conflict("Ya existe una cuenta con ese email. Inicia sesion para continuar."));
    }
    if (existingRequestResult.data) {
      return observed(
        conflict(`Ya existe una solicitud pendiente con el codigo ${existingRequestResult.data.request_code}.`)
      );
    }

    const { data: referrerStore, error: referrerError } = referralCode
      ? await supabase.from("stores").select("id").eq("slug", referralCode).maybeSingle()
      : { data: null, error: null };
    if (referrerError) throw referrerError;
    if (referralCode && !referrerStore) {
      return observed(badRequest("El codigo de referido no es valido."));
    }

    const requestId = randomUUID();
    const requestCode = await createRequestCode(supabase);
    uploadedLogoPath = `pending/${requestId}.${logoExtension(logo.type)}`;
    const logoBuffer = Buffer.from(await logo.arrayBuffer());
    const { error: logoError } = await supabase.storage
      .from(REGISTRATION_BUCKET)
      .upload(uploadedLogoPath, logoBuffer, {
        cacheControl: "3600",
        contentType: logo.type,
        upsert: false,
      });
    if (logoError) throw logoError;

    const { data: registration, error: registrationError } = await supabase
      .from("commerce_registration_requests")
      .insert({
        id: requestId,
        request_code: requestCode,
        store_name: storeName,
        representative_name: representativeName,
        representative_id_number: representativeIdNumber,
        email,
        whatsapp,
        business_type: businessType,
        city_id: cityId,
        referral_store_id: referrerStore?.id || null,
        weekly_order_volume: weeklyOrderVolume,
        logo_path: uploadedLogoPath,
        logo_mime_type: logo.type,
        status: "pending",
      })
      .select("id, request_code, status, created_at")
      .single();
    if (registrationError) throw registrationError;

    logApiEvent(apiContext, "signup_request_created", {
      registrationId: registration.id,
      requestCode,
      weeklyOrderVolume,
    });

    return observed(
      NextResponse.json(
        {
          request: registration,
          message: "Solicitud guardada. Envíala a Somos por WhatsApp para iniciar la revisión.",
        },
        { status: 201 }
      )
    );
  } catch (error) {
    logApiError(apiContext, "signup_request_failed", error, {
      cleanupLogo: Boolean(uploadedLogoPath),
    });

    if (uploadedLogoPath) {
      try {
        await createSupabaseAdminClient().storage.from(REGISTRATION_BUCKET).remove([uploadedLogoPath]);
      } catch {
        // Best-effort cleanup only.
      }
    }

    return observed(
      NextResponse.json(
        { error: "No se pudo guardar la solicitud. Revisa los datos e intenta de nuevo." },
        { status: 500 }
      )
    );
  }
}
