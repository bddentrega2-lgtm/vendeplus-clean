import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, normalizeAccessEmail } from "@/lib/admin/store-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
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
import {
  cleanTransportText,
  normalizeAgencyModality,
  optionalTransportNumber,
  slugifyTransportAgency,
  transportMoney,
} from "@/lib/transport";
import { buildPublicSiteUrl } from "@/lib/server/site-url";

const MAX_TRANSPORT_APPLY_BODY_BYTES = 25_000;
const TRANSPORT_APPLY_IP_LIMIT = 4;
const TRANSPORT_APPLY_EMAIL_LIMIT = 2;
const TRANSPORT_APPLY_RATE_WINDOW_MS = 60 * 60 * 1000;

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
    return conflict("Ese correo ya tiene una cuenta. Usa otro correo o pide recuperar la clave.");
  }

  if (normalizedMessage.includes("password")) {
    return badRequest("La clave debe tener al menos 8 caracteres.");
  }

  return badRequest("No se pudo crear el acceso. Revisa los datos e intenta de nuevo.");
}

async function canRecoverOrphanTransportUser(supabase: any, user: any) {
  const accountType = String(user?.user_metadata?.account_type || "");
  if (accountType && accountType !== "transport_agency") return false;

  const [agencyUserResult, storeUserResult] = await Promise.all([
    supabase
      .from("transport_agency_users")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
    supabase
      .from("store_users")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
  ]);

  if (agencyUserResult.error) throw agencyUserResult.error;
  if (storeUserResult.error) throw storeUserResult.error;

  return (
    (agencyUserResult.data || []).length === 0 &&
    (storeUserResult.data || []).length === 0
  );
}

export async function POST(request: NextRequest) {
  const apiContext = createApiRequestContext(request, "transport-agency-apply");
  const observed = (response: NextResponse) =>
    attachApiResponseHeaders(response, apiContext, "transport-agency-apply");
  let createdUserId = "";
  let createdAgencyId = "";
  let shouldDeleteAuthUserOnFailure = false;

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_TRANSPORT_APPLY_BODY_BYTES) {
      return observed(
        NextResponse.json(
          { error: "La solicitud es demasiado grande." },
          { status: 413 }
        )
      );
    }

    const clientIp = getClientIp(request);
    const ipLimit = await checkDistributedRateLimit({
      key: `transport-apply:ip:${clientIp}`,
      limit: TRANSPORT_APPLY_IP_LIMIT,
      windowMs: TRANSPORT_APPLY_RATE_WINDOW_MS,
    });

    if (!ipLimit.allowed) {
      return observed(
        NextResponse.json(
          { error: "Demasiados intentos. Prueba de nuevo mas tarde." },
          {
            status: 429,
            headers: rateLimitHeaders(ipLimit, TRANSPORT_APPLY_IP_LIMIT),
          }
        )
      );
    }

    const body = await request.json();
    const name = cleanTransportText(body.name, 140);
    const contactName = cleanTransportText(body.contactName, 120);
    const contactEmail = normalizeAccessEmail(body.contactEmail);
    const contactPhone = cleanTransportText(body.contactPhone, 40);
    const password = cleanTransportText(body.password, 120);
    const confirmPassword = cleanTransportText(body.confirmPassword, 120);
    const captchaToken = cleanTransportText(body.captchaToken, 2000);
    const pricingType = "manual";

    if (!name) return observed(badRequest("Escribe el nombre de la empresa delivery."));
    if (!contactName) return observed(badRequest("Escribe el nombre del responsable."));
    if (!contactEmail || !contactEmail.includes("@")) {
      return observed(badRequest("Correo invalido."));
    }
    if (!contactPhone) return observed(badRequest("Escribe un telefono de contacto."));
    if (password.length < 8) {
      return observed(badRequest("La clave debe tener al menos 8 caracteres."));
    }
    if (confirmPassword && password !== confirmPassword) {
      return observed(badRequest("Las claves no coinciden."));
    }

    const supabase = createSupabaseAdminClient();
    const existingUser = await findUserByEmail(supabase, contactEmail);

    if (existingUser) {
      const canRecover = await canRecoverOrphanTransportUser(supabase, existingUser);

      if (!canRecover) {
        return observed(
          conflict("Ese correo ya tiene una cuenta. Usa otro correo o pide recuperar la clave.")
        );
      }

      createdUserId = existingUser.id;
    }

    if (!createdUserId) {
      const emailLimit = await checkDistributedRateLimit({
        key: `transport-apply:email:${contactEmail}`,
        limit: TRANSPORT_APPLY_EMAIL_LIMIT,
        windowMs: TRANSPORT_APPLY_RATE_WINDOW_MS,
      });

      if (!emailLimit.allowed) {
        return observed(
          NextResponse.json(
            { error: "Demasiados intentos con este correo. Prueba de nuevo mas tarde." },
            {
              status: 429,
              headers: rateLimitHeaders(emailLimit, TRANSPORT_APPLY_EMAIL_LIMIT),
            }
          )
        );
      }
    }

    const baseSlug = slugifyTransportAgency(name);
    let slug = baseSlug;

    for (let index = 0; index < 5; index += 1) {
      const { data } = await supabase
        .from("transport_agencies")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) break;
      slug = `${baseSlug}-${index + 2}`;
    }

    const agencyPayload = {
      name,
      slug,
      legal_name: null,
      rif: cleanTransportText(body.rif, 40) || null,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      whatsapp_phone: contactPhone,
      city: null,
      state: null,
      coverage_notes: null,
      logo_url: null,
      modality: normalizeAgencyModality("open"),
      rates_visibility: "public",
      pricing_type: pricingType,
      status: "pending",
      is_active: false,
    };

    let requiresEmailConfirmation = false;

    if (!createdUserId) {
      const publicAuth = createSupabasePublicClient();

      if (!publicAuth) {
        throw new Error("Faltan variables publicas de Supabase.");
      }

      const authResult = await publicAuth.auth.signUp({
        email: contactEmail,
        password,
        options: {
          emailRedirectTo: buildPublicSiteUrl(request, "/transporte/panel"),
          captchaToken: captchaToken || undefined,
          data: {
            display_name: contactName,
            account_type: "transport_agency",
          },
        },
      });

      if (authResult.error) {
        return observed(authSignupError(authResult.error.message || ""));
      }

      createdUserId = authResult.data.user?.id || "";
      shouldDeleteAuthUserOnFailure = Boolean(createdUserId);
      requiresEmailConfirmation = !authResult.data.session;
    } else {
      requiresEmailConfirmation = !existingUser?.email_confirmed_at;
    }

    if (!createdUserId) {
      throw new Error("No se pudo crear el usuario.");
    }

    const { data: agency, error: agencyError } = await supabase
      .from("transport_agencies")
      .insert(agencyPayload)
      .select("id, name, slug, status")
      .single();

    if (agencyError) {
      if (shouldDeleteAuthUserOnFailure && createdUserId) {
        await supabase.auth.admin.deleteUser(createdUserId);
      }
      throw agencyError;
    }

    createdAgencyId = agency.id;

    const { error: rateError } = await supabase.from("transport_agency_rates").insert({
      agency_id: agency.id,
      flat_fee_usd: transportMoney(0),
      max_distance_km: optionalTransportNumber(null),
      distance_factor_usd: optionalTransportNumber(null),
      manual_quote_message:
        "La empresa delivery confirma la tarifa final por WhatsApp.",
    });

    if (rateError) {
      await supabase.from("transport_agencies").delete().eq("id", agency.id);
      if (shouldDeleteAuthUserOnFailure && createdUserId) {
        await supabase.auth.admin.deleteUser(createdUserId);
      }
      throw rateError;
    }

    const { error: userError } = await supabase.from("transport_agency_users").insert({
      agency_id: agency.id,
      user_id: createdUserId,
      email: contactEmail,
      role: "owner",
    });

    if (userError) {
      await supabase.from("transport_agencies").delete().eq("id", agency.id);
      if (shouldDeleteAuthUserOnFailure && createdUserId) {
        await supabase.auth.admin.deleteUser(createdUserId);
      }
      throw userError;
    }

    logApiEvent(apiContext, "transport_agency_application_created", {
      agencyId: agency.id,
      recoveredOrphanUser: Boolean(existingUser),
      requiresEmailConfirmation,
    });

    return observed(
      NextResponse.json({
        agency,
        requiresEmailConfirmation,
        message: !requiresEmailConfirmation
          ? "Solicitud recibida. El equipo Somos revisara la empresa delivery antes de publicarla."
          : "Solicitud recibida. Revisa tu correo para confirmar el acceso; el equipo Somos revisara la empresa delivery antes de publicarla.",
      })
    );
  } catch (error) {
    logApiError(apiContext, "transport_agency_application_failed", error, {
      cleanupAgency: Boolean(createdAgencyId),
      cleanupUser: Boolean(createdUserId),
    });

    try {
      const supabase = createSupabaseAdminClient();
      if (createdAgencyId) await supabase.from("transport_agencies").delete().eq("id", createdAgencyId);
      if (shouldDeleteAuthUserOnFailure && createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
    } catch {
      // Best-effort cleanup only.
    }

    return observed(
      NextResponse.json(
        { error: "No se pudo registrar la empresa delivery. Revisa los datos e intenta de nuevo." },
        { status: 500 }
      )
    );
  }
}
