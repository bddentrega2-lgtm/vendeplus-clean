import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { normalizeAccessEmail } from "@/lib/admin/store-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidAffiliateCode, normalizeAffiliateCode } from "@/lib/affiliates";
import { slugifyStore } from "@/lib/admin/stores";
import { affiliatePreviewAdminBalances } from "@/lib/server/affiliate-preview-demo";

function numeric(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const db = createSupabaseAdminClient();
    const [codes, referrals, commissions, settlements, adjustments, agencies, balances] = await Promise.all([
      db.from("affiliate_codes").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("affiliate_referrals").select("*, commerce_registration_requests(request_code, store_name, status, setup_payment_status), stores(name, slug)").order("created_at", { ascending: false }).limit(200),
      db.from("affiliate_commissions").select("id, referral_id, store_id, kind, fee_usd, setup_paid_usd, commission_percent, amount_usd, eligible_at, status").order("created_at", { ascending: false }).limit(500),
      db.from("affiliate_settlements").select("id, affiliate_code_id, amount_usd, paid_at, method, reference").order("created_at", { ascending: false }).limit(200),
      db.from("affiliate_commission_adjustments").select("id, commission_id, amount_usd, reason, created_at").order("created_at", { ascending: false }).limit(500),
      db.from("transport_agencies").select("id, name, slug, contact_email").order("name").limit(200),
      db.rpc("affiliate_admin_list"),
    ]);
    if (codes.error) throw codes.error;
    if (referrals.error) throw referrals.error;
    if (commissions.error) throw commissions.error;
    if (settlements.error) throw settlements.error;
    if (adjustments.error) throw adjustments.error;
    if (agencies.error) throw agencies.error;
    if (balances.error) throw balances.error;
    const emails = [...new Set((codes.data || []).map((code) => code.beneficiary_email).filter((value): value is string => Boolean(value)))];
    const agencyIds = [...new Set((codes.data || []).map((code) => code.transport_agency_id).filter((value): value is string => Boolean(value)))];
    const [individualPayouts, agencyPayouts] = await Promise.all([
      emails.length ? db.from("affiliate_payout_accounts").select("beneficiary_email, transport_agency_id, holder_name, bank_name, document_number, phone")
        .in("beneficiary_email", emails) : Promise.resolve({ data: [], error: null }),
      agencyIds.length ? db.from("affiliate_payout_accounts").select("beneficiary_email, transport_agency_id, holder_name, bank_name, document_number, phone")
        .in("transport_agency_id", agencyIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (individualPayouts.error || agencyPayouts.error) throw individualPayouts.error || agencyPayouts.error;
    const demoByKey = new Map(affiliatePreviewAdminBalances(codes.data || []).map((item) => [item.allyKey, item]));
    const allyBalances = ((balances.data || []) as Array<{ allyKey: string; setupPendingUsd: number; feePendingUsd: number; setupPaidUsd: number; feePaidUsd: number }>).map((item) => {
      const demo = demoByKey.get(item.allyKey);
      return demo && [item.setupPendingUsd, item.feePendingUsd, item.setupPaidUsd, item.feePaidUsd]
        .every((amount) => Number(amount) === 0) ? { ...item, ...demo } : item;
    });
    return NextResponse.json({ codes: codes.data, referrals: referrals.data, commissions: commissions.data, settlements: settlements.data, adjustments: adjustments.data, agencies: agencies.data, balances: allyBalances, payoutAccounts: [...(individualPayouts.data || []), ...(agencyPayouts.data || [])] });
  } catch (error) { return adminErrorResponse(error, "No se pudieron cargar los aliados."); }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const code = normalizeAffiliateCode(body.code);
    const name = String(body.name || "").trim();
    const email = normalizeAccessEmail(body.beneficiaryEmail);
    const partnerType = String(body.partnerType || "seller");
    const agencyId = String(body.transportAgencyId || "").trim();
    const discount = numeric(body.discountPercent ?? 50, 0, 100);
    const setupCommission = numeric(body.setupCommissionPercent ?? 0, 0, 100);
    const commission = numeric(body.commissionPercent ?? 0, 0, 100);
    const months = numeric(body.durationMonths ?? 3, 1, 3);
    const maxUses = body.maxUses ? numeric(body.maxUses, 1, 1000000) : null;
    if (!isValidAffiliateCode(code) || !name || name.length > 120 ||
        !["seller", "creator", "delivery"].includes(partnerType) || discount === null ||
        setupCommission === null || commission === null || months === null ||
        !Number.isInteger(months) || (maxUses !== null && !Number.isInteger(maxUses))) {
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
    if (partnerType === "delivery") {
      if (!/^[0-9a-f-]{36}$/i.test(agencyId)) return NextResponse.json({ error: "Elige la empresa delivery." }, { status: 400 });
      const { data: agency, error: agencyError } = await db.from("transport_agencies")
        .select("id").eq("id", agencyId).maybeSingle();
      if (agencyError) throw agencyError;
      if (!agency) return NextResponse.json({ error: "Empresa delivery no encontrada." }, { status: 404 });
    } else if ((setupCommission > 0 || commission > 0) && !email) {
      return NextResponse.json({ error: "Indica el correo Google del aliado para recibir comisiones." }, { status: 400 });
    } else if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Correo del aliado invalido." }, { status: 400 });
    }
    const { data: existingCode, error: lookupError } = await db.from("affiliate_codes").select("id").eq("code", code).maybeSingle();
    if (lookupError) throw lookupError;
    if (existingCode) return NextResponse.json({ error: "Ese codigo ya existe." }, { status: 409 });
    const { data: storeCode, error: storeLookupError } = await db.from("stores").select("id").eq("slug", slugifyStore(code)).maybeSingle();
    if (storeLookupError) throw storeLookupError;
    if (storeCode) return NextResponse.json({ error: "Ese codigo ya pertenece a un comercio." }, { status: 409 });
    const { data, error } = await db.from("affiliate_codes").insert({
      code, name, contact: String(body.contact || "").trim() || null,
      beneficiary_email: partnerType === "delivery" ? null : email || null,
      transport_agency_id: partnerType === "delivery" ? agencyId : null,
      partner_type: partnerType, beneficiary_user_id: null, discount_percent: discount,
      setup_commission_percent: setupCommission, commission_percent: commission,
      duration_months: months, starts_at: startsAt,
      expires_at: expiresAt, max_uses: maxUses,
    }).select("*").single();
    if (error?.code === "23505") throw new Error("Ese codigo ya existe.");
    if (error) throw error;
    return NextResponse.json({ code: data }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error, "No se pudo crear el codigo.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Codigo invalido." }, { status: 400 });
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!["active", "paused", "disabled"].includes(body.status)) return NextResponse.json({ error: "Estado invalido." }, { status: 400 });
      update.status = body.status;
    }
    if (body.discountPercent !== undefined) update.discount_percent = numeric(body.discountPercent, 0, 100);
    if (body.setupCommissionPercent !== undefined) update.setup_commission_percent = numeric(body.setupCommissionPercent, 0, 100);
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
