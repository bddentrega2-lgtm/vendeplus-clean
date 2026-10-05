import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { findUserByEmail, normalizeAccessEmail } from "@/lib/admin/store-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidAffiliateCode, normalizeAffiliateCode } from "@/lib/affiliates";
import { randomBytes } from "node:crypto";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { buildPublicSiteUrl } from "@/lib/server/site-url";
import { slugifyStore } from "@/lib/admin/stores";

function numeric(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const db = createSupabaseAdminClient();
    const [codes, referrals, commissions, settlements, adjustments] = await Promise.all([
      db.from("affiliate_codes").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("affiliate_referrals").select("*, commerce_registration_requests(request_code, store_name, status, setup_payment_status), stores(name, slug)").order("created_at", { ascending: false }).limit(200),
      db.from("affiliate_commissions").select("id, referral_id, store_id, fee_usd, commission_percent, amount_usd, eligible_at, status").order("created_at", { ascending: false }).limit(500),
      db.from("affiliate_settlements").select("id, beneficiary_user_id, amount_usd, paid_at, method, reference").order("created_at", { ascending: false }).limit(200),
      db.from("affiliate_commission_adjustments").select("id, commission_id, amount_usd, reason, created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    if (codes.error) throw codes.error;
    if (referrals.error) throw referrals.error;
    if (commissions.error) throw commissions.error;
    if (settlements.error) throw settlements.error;
    if (adjustments.error) throw adjustments.error;
    return NextResponse.json({ codes: codes.data, referrals: referrals.data, commissions: commissions.data, settlements: settlements.data, adjustments: adjustments.data });
  } catch (error) { return adminErrorResponse(error, "No se pudieron cargar los aliados."); }
}

export async function POST(request: NextRequest) {
  let createdUserId = "";
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const code = normalizeAffiliateCode(body.code);
    const name = String(body.name || "").trim();
    const email = normalizeAccessEmail(body.beneficiaryEmail);
    const discount = numeric(body.discountPercent ?? 50, 0, 100);
    const commission = numeric(body.commissionPercent ?? 50, 0, 100);
    const months = numeric(body.durationMonths ?? 3, 1, 3);
    const maxUses = body.maxUses ? numeric(body.maxUses, 1, 1000000) : null;
    if (!isValidAffiliateCode(code) || !name || name.length > 120 || discount === null || commission === null || months === null || !Number.isInteger(months) || (maxUses !== null && !Number.isInteger(maxUses))) {
      return NextResponse.json({ error: "Revisa el codigo y las condiciones." }, { status: 400 });
    }
    const parsedStart = body.startsAt ? new Date(body.startsAt) : null;
    const parsedEnd = body.expiresAt ? new Date(body.expiresAt) : null;
    if ((parsedStart && !Number.isFinite(parsedStart.valueOf())) || (parsedEnd && !Number.isFinite(parsedEnd.valueOf()))) {
      return NextResponse.json({ error: "Las fechas de vigencia no son validas." }, { status: 400 });
    }
    const startsAt = parsedStart?.toISOString() || null;
    const expiresAt = parsedEnd?.toISOString() || null;
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) return NextResponse.json({ error: "La vigencia no es valida." }, { status: 400 });
    const db = createSupabaseAdminClient();
    if (commission > 0 && !email) return NextResponse.json({ error: "Indica el correo del beneficiario o fija 0% de comision." }, { status: 400 });
    const { data: existingCode, error: lookupError } = await db.from("affiliate_codes").select("id").eq("code", code).maybeSingle();
    if (lookupError) throw lookupError;
    if (existingCode) return NextResponse.json({ error: "Ese codigo ya existe." }, { status: 409 });
    const { data: storeCode, error: storeLookupError } = await db.from("stores").select("id").eq("slug", slugifyStore(code)).maybeSingle();
    if (storeLookupError) throw storeLookupError;
    if (storeCode) return NextResponse.json({ error: "Ese codigo ya pertenece a un comercio." }, { status: 409 });
    let user = email ? await findUserByEmail(db, email) : null;
    if (email && !user) {
      const { data: created, error: createError } = await db.auth.admin.createUser({
        email, password: randomBytes(32).toString("base64url"), email_confirm: true,
        user_metadata: { name, source: "somos_affiliate" },
      });
      if (createError) throw createError;
      user = created.user;
      createdUserId = user?.id || "";
    }
    const { data, error } = await db.from("affiliate_codes").insert({
      code, name, contact: String(body.contact || "").trim() || null,
      beneficiary_user_id: user?.id || null, discount_percent: discount,
      commission_percent: commission, duration_months: months, starts_at: startsAt,
      expires_at: expiresAt, max_uses: maxUses,
    }).select("*").single();
    if (error?.code === "23505") throw new Error("Ese codigo ya existe.");
    if (error) throw error;
    const shouldSendAccess = Boolean(createdUserId);
    createdUserId = "";
    let accessEmailSent = false;
    if (email && shouldSendAccess) {
      const publicAuth = createSupabasePublicClient();
      if (publicAuth) {
        const { error: mailError } = await publicAuth.auth.resetPasswordForEmail(email, {
          redirectTo: buildPublicSiteUrl(request, "/panel/update-password"),
        });
        accessEmailSent = !mailError;
      }
    }
    return NextResponse.json({ code: data, accessEmailRequired: shouldSendAccess, accessEmailSent }, { status: 201 });
  } catch (error) {
    if (createdUserId) await createSupabaseAdminClient().auth.admin.deleteUser(createdUserId).catch(() => {});
    return adminErrorResponse(error, "No se pudo crear el codigo.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Codigo invalido." }, { status: 400 });
    if (body.action === "resend_access") {
      const db = createSupabaseAdminClient();
      const { data: code, error: codeError } = await db.from("affiliate_codes").select("beneficiary_user_id").eq("id", id).maybeSingle();
      if (codeError) throw codeError;
      if (!code?.beneficiary_user_id) return NextResponse.json({ error: "Este codigo no tiene beneficiario." }, { status: 400 });
      const { data: userResult, error: userError } = await db.auth.admin.getUserById(code.beneficiary_user_id);
      if (userError || !userResult?.user?.email) throw userError || new Error("Beneficiario no encontrado");
      const publicAuth = createSupabasePublicClient();
      if (!publicAuth) throw new Error("Auth no disponible");
      const { error: mailError } = await publicAuth.auth.resetPasswordForEmail(userResult.user.email, {
        redirectTo: buildPublicSiteUrl(request, "/panel/update-password"),
      });
      if (mailError) throw mailError;
      return NextResponse.json({ message: "Acceso reenviado al beneficiario." });
    }
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!["active", "paused", "disabled"].includes(body.status)) return NextResponse.json({ error: "Estado invalido." }, { status: 400 });
      update.status = body.status;
    }
    if (body.discountPercent !== undefined) update.discount_percent = numeric(body.discountPercent, 0, 100);
    if (body.commissionPercent !== undefined) update.commission_percent = numeric(body.commissionPercent, 0, 100);
    if (body.durationMonths !== undefined) update.duration_months = numeric(body.durationMonths, 1, 3);
    if (Object.values(update).some((value) => value === null) || (update.duration_months !== undefined && !Number.isInteger(update.duration_months))) return NextResponse.json({ error: "Condiciones invalidas." }, { status: 400 });
    if (!Object.keys(update).length) return NextResponse.json({ error: "Sin cambios." }, { status: 400 });
    const { data, error } = await createSupabaseAdminClient().from("affiliate_codes").update(update).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Codigo no encontrado." }, { status: 404 });
    return NextResponse.json({ code: data });
  } catch (error) { return adminErrorResponse(error, "No se pudo actualizar el codigo."); }
}
