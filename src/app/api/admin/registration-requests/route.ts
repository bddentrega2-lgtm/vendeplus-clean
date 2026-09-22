import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { findUserByEmail } from "@/lib/admin/store-access";
import { normalizeAdminStorePayload, slugifyStore } from "@/lib/admin/stores";
import { isWeeklyOrderVolume } from "@/lib/commerce-registration";
import { TRIAL_DAYS } from "@/lib/plans";
import { buildPublicSiteUrl } from "@/lib/server/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";

const REGISTRATION_BUCKET = "commerce-registration-assets";
const PUBLIC_LOGO_BUCKET = "product-images";
const validStatuses = new Set(["all", "pending", "approved", "rejected", "activation_error"]);

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
    const { data, error } = await supabase.from("stores").select("id").eq("slug", candidate).maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

async function sendAccessEmail(request: NextRequest, email: string) {
  const publicAuth = createSupabasePublicClient();
  if (!publicAuth) throw new Error("Faltan variables publicas de Supabase.");
  const { error } = await publicAuth.auth.resetPasswordForEmail(email, {
    redirectTo: buildPublicSiteUrl(request, "/panel/update-password"),
  });
  if (error) throw error;
}

async function statusCounts(supabase: any) {
  const statuses = ["pending", "approved", "rejected", "activation_error"];
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabase
        .from("commerce_registration_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) throw error;
      return [status, count || 0] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const requestedStatus = cleanText(searchParams.get("status"));
    const status = validStatuses.has(requestedStatus) ? requestedStatus : "pending";
    const volume = cleanText(searchParams.get("volume"));
    const search = cleanText(searchParams.get("search")).slice(0, 100);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = 30;
    const from = (page - 1) * pageSize;

    let query = supabase
      .from("commerce_registration_requests")
      .select(
        "id, request_code, store_name, representative_name, representative_id_number, email, whatsapp, business_type, weekly_order_volume, status, activation_error, access_email_sent_at, reviewed_at, created_at, store_id, logo_path, service_cities(name, state_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (status !== "all") query = query.eq("status", status);
    if (isWeeklyOrderVolume(volume)) query = query.eq("weekly_order_volume", volume);
    if (search) {
      const escaped = search.replace(/[%_,]/g, "");
      query = query.or(`store_name.ilike.%${escaped}%,email.ilike.%${escaped}%,whatsapp.ilike.%${escaped}%,request_code.ilike.%${escaped}%`);
    }

    const [rowsResult, counts] = await Promise.all([query, statusCounts(supabase)]);
    if (rowsResult.error) throw rowsResult.error;

    const rows = rowsResult.data || [];
    const logoPaths = rows.map((entry: any) => entry.logo_path).filter(Boolean);
    const { data: signedLogos, error: signedLogoError } = logoPaths.length
      ? await supabase.storage.from(REGISTRATION_BUCKET).createSignedUrls(logoPaths, 60 * 60)
      : { data: [], error: null };
    if (signedLogoError) throw signedLogoError;
    const logoUrls = new Map(
      (signedLogos || []).map((entry: any, index: number) => [logoPaths[index], entry.signedUrl || null])
    );

    return NextResponse.json({
      requests: rows.map((entry: any) => ({
        ...entry,
        logo_url: logoUrls.get(entry.logo_path) || null,
        logo_path: undefined,
      })),
      summary: counts,
      pagination: {
        page,
        pageSize,
        total: rowsResult.count || 0,
        totalPages: Math.max(1, Math.ceil((rowsResult.count || 0) / pageSize)),
      },
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando solicitudes de comercios.");
  }
}

export async function PATCH(request: NextRequest) {
  let createdUserId = "";
  let createdStoreId = "";
  let publicLogoPath = "";
  let registrationId = "";

  try {
    const auth = await requireAdminAuth(request);
    const body = await request.json();
    registrationId = cleanText(body.id);
    const action = cleanText(body.action);
    if (!registrationId) return badRequest("Falta la solicitud.");
    if (!["approve", "reject", "resend_access"].includes(action)) {
      return badRequest("Accion no soportada.");
    }

    const supabase = createSupabaseAdminClient();

    if (action === "reject") {
      const { data, error } = await supabase
        .from("commerce_registration_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.userId || null,
          activation_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registrationId)
        .in("status", ["pending", "activation_error"])
        .select("id, request_code, status")
        .maybeSingle();
      if (error) throw error;
      if (!data) return conflict("La solicitud ya fue procesada.");
      return NextResponse.json({ request: data, message: "Solicitud rechazada." });
    }

    const { data: current, error: currentError } = await supabase
      .from("commerce_registration_requests")
      .select("*")
      .eq("id", registrationId)
      .single();
    if (currentError) throw currentError;

    if (action === "resend_access") {
      if (current.status !== "approved" || !current.auth_user_id || !current.store_id) {
        return conflict("La solicitud aun no tiene una cuenta aprobada.");
      }
      await sendAccessEmail(request, current.email);
      const sentAt = new Date().toISOString();
      await supabase
        .from("commerce_registration_requests")
        .update({ access_email_sent_at: sentAt, activation_error: null, updated_at: sentAt })
        .eq("id", registrationId);
      return NextResponse.json({ message: "Correo de acceso reenviado." });
    }

    const { data: locked, error: lockError } = await supabase
      .from("commerce_registration_requests")
      .update({ status: "activating", activation_error: null, updated_at: new Date().toISOString() })
      .eq("id", registrationId)
      .in("status", ["pending", "activation_error"])
      .select("*")
      .maybeSingle();
    if (lockError) throw lockError;
    if (!locked) {
      if (current.status === "approved") {
        return NextResponse.json({ request: current, message: "La solicitud ya estaba aprobada." });
      }
      return conflict("La solicitud esta siendo procesada o ya fue rechazada.");
    }

    let authUser = await findUserByEmail(supabase, locked.email);
    if (!authUser) {
      const temporaryPassword = randomBytes(32).toString("base64url");
      const { data, error } = await supabase.auth.admin.createUser({
        email: locked.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name: locked.store_name,
          source: "somos_registration_approved",
          account_type: "commerce",
        },
      });
      if (error) throw error;
      authUser = data.user;
      createdUserId = authUser?.id || "";
    }
    if (!authUser?.id) throw new Error("No se pudo crear el usuario de acceso.");

    const slug = await buildUniqueSlug(supabase, locked.store_name);
    const { data: privateLogo, error: downloadError } = await supabase.storage
      .from(REGISTRATION_BUCKET)
      .download(locked.logo_path);
    if (downloadError || !privateLogo) throw downloadError || new Error("No se pudo leer el logo.");

    const extension = locked.logo_mime_type === "image/png"
      ? "png"
      : locked.logo_mime_type === "image/webp"
        ? "webp"
        : "jpg";
    publicLogoPath = `store-signup/${slug}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(PUBLIC_LOGO_BUCKET)
      .upload(publicLogoPath, await privateLogo.arrayBuffer(), {
        cacheControl: "31536000",
        contentType: locked.logo_mime_type,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const { data: logoData } = supabase.storage.from(PUBLIC_LOGO_BUCKET).getPublicUrl(publicLogoPath);

    const now = new Date();
    const trialEndsAt = addDays(now, TRIAL_DAYS);
    const storePayload = normalizeAdminStorePayload({
      slug,
      name: locked.store_name,
      description: "Catalogo creado en Somos",
      business_type: locked.business_type,
      whatsapp: locked.whatsapp,
      city_id: locked.city_id,
      logo_url: logoData.publicUrl,
      payment_methods: ["Pago movil", "Transferencia", "Efectivo"],
      usd_to_bs: 600,
      accepts_delivery: false,
      accepts_pickup: true,
      is_active: true,
      plan_type: "trial",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_status: "trial",
      monthly_price_usd: 0,
      product_limit: 30,
    });

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .insert(storePayload)
      .select("id, slug, name")
      .single();
    if (storeError) throw storeError;
    createdStoreId = store.id;

    const { error: profileError } = await supabase.from("store_registration_profiles").insert({
      store_id: store.id,
      representative_name: locked.representative_name,
      representative_id_number: locked.representative_id_number,
    });
    if (profileError) throw profileError;

    const { error: assignmentError } = await supabase.from("store_users").insert({
      store_id: store.id,
      user_id: authUser.id,
      role: "owner",
    });
    if (assignmentError) throw assignmentError;

    if (locked.referral_store_id) {
      const { error: referralError } = await supabase.from("store_referrals").insert({
        referrer_store_id: locked.referral_store_id,
        referred_store_id: store.id,
        status: "registered",
      });
      if (referralError) throw referralError;
    }

    const approvedAt = new Date().toISOString();
    const { error: approvalError } = await supabase
      .from("commerce_registration_requests")
      .update({
        status: "approved",
        auth_user_id: authUser.id,
        store_id: store.id,
        reviewed_at: approvedAt,
        reviewed_by: auth.userId || null,
        activation_error: null,
        updated_at: approvedAt,
      })
      .eq("id", registrationId);
    if (approvalError) throw approvalError;

    let emailSent = true;
    try {
      await sendAccessEmail(request, locked.email);
      await supabase
        .from("commerce_registration_requests")
        .update({ access_email_sent_at: new Date().toISOString() })
        .eq("id", registrationId);
    } catch {
      emailSent = false;
      await supabase
        .from("commerce_registration_requests")
        .update({ activation_error: "Cuenta creada, pero falta reenviar el correo de acceso." })
        .eq("id", registrationId);
    }

    return NextResponse.json({
      request: { id: registrationId, status: "approved", store_id: store.id },
      emailSent,
      message: emailSent
        ? `Solicitud aprobada. Enviamos el acceso a ${locked.email}.`
        : "Solicitud aprobada. La cuenta esta lista, pero debes reenviar el correo de acceso.",
    });
  } catch (error: any) {
    try {
      const supabase = createSupabaseAdminClient();
      const cleanupTasks: Array<PromiseLike<unknown>> = [];
      if (createdStoreId) cleanupTasks.push(supabase.from("stores").delete().eq("id", createdStoreId));
      if (publicLogoPath) cleanupTasks.push(supabase.storage.from(PUBLIC_LOGO_BUCKET).remove([publicLogoPath]));
      if (createdUserId) cleanupTasks.push(supabase.auth.admin.deleteUser(createdUserId));
      await Promise.allSettled(cleanupTasks);
      if (registrationId) {
        await supabase
          .from("commerce_registration_requests")
          .update({
            status: "activation_error",
            activation_error: cleanText(error?.message).slice(0, 300) || "No se pudo activar la solicitud.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", registrationId)
          .eq("status", "activating");
      }
    } catch {
      // Best-effort cleanup only. The original error remains the response source.
    }
    return adminErrorResponse(error, "No se pudo procesar la solicitud.");
  }
}
