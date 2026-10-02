import { NextRequest, NextResponse } from "next/server";
import { getPanelAuthContext } from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, getClientIp } from "@/lib/server/rate-limit";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" };
const activeRegistrationStatuses = ["pending", "activating", "approved", "activation_error"];

type AccountIdentity = { id: string; email: string; isFounder: boolean };

async function getAccountIdentity(request: NextRequest): Promise<AccountIdentity | null> {
  const auth = await getPanelAuthContext(request);
  if (auth.mode !== "user" || !auth.userId || !auth.email) return null;
  return { id: auth.userId, email: auth.email, isFounder: auth.isFounderMode };
}

async function getAccountState(db: ReturnType<typeof createSupabaseAdminClient>, identity: AccountIdentity) {
  const [stores, agenciesByUser, agenciesByEmail, registrations, pending] = await Promise.all([
    db.from("store_users").select("store_id, role").eq("user_id", identity.id),
    db.from("transport_agency_users").select("agency_id, role").eq("user_id", identity.id),
    db.from("transport_agency_users").select("agency_id, role").eq("email", identity.email),
    db.from("commerce_registration_requests").select("id").eq("auth_user_id", identity.id).in("status", activeRegistrationStatuses),
    db.from("account_deletion_requests").select("id, status, requested_at").eq("user_id", identity.id).eq("status", "pending").maybeSingle(),
  ]);
  const failed = [stores, agenciesByUser, agenciesByEmail, registrations, pending].find((result) => result.error);
  if (failed?.error) throw failed.error;

  const storeIds = Array.from(new Set((stores.data || []).map((row) => row.store_id).filter(Boolean)));
  const agencyIds = Array.from(new Set([...(agenciesByUser.data || []), ...(agenciesByEmail.data || [])].map((row) => row.agency_id).filter(Boolean)));
  return {
    storeIds,
    agencyIds,
    hasRegistration: Boolean(registrations.data?.length),
    pending: pending.data || null,
  };
}

function accountType(state: Awaited<ReturnType<typeof getAccountState>>) {
  const commerce = state.storeIds.length > 0 || state.hasRegistration;
  const delivery = state.agencyIds.length > 0;
  if (commerce && delivery) return "mixed";
  if (commerce) return "commerce";
  if (delivery) return "delivery";
  return "buyer";
}

export async function GET(request: NextRequest) {
  const identity = await getAccountIdentity(request);
  if (!identity) return NextResponse.json({ error: "Ingresa nuevamente para revisar tu cuenta." }, { status: 401, headers });
  try {
    const state = await getAccountState(createSupabaseAdminClient(), identity);
    const type = accountType(state);
    return NextResponse.json({
      account: {
        email: identity.email,
        type,
        operational: type !== "buyer" || identity.isFounder,
        pending: Boolean(state.pending),
        requestedAt: state.pending?.requested_at || null,
      },
    }, { headers });
  } catch {
    return NextResponse.json({ error: "No pudimos verificar tu cuenta. Intenta mas tarde." }, { status: 503, headers });
  }
}

export async function DELETE(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 1024) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "Solicitud invalida." }, { status: 415, headers });
  const identity = await getAccountIdentity(request);
  if (!identity) return NextResponse.json({ error: "Ingresa nuevamente para eliminar tu cuenta." }, { status: 401, headers });
  const limit = await checkDistributedRateLimit({ key: `account-delete:${identity.id}:${getClientIp(request)}`, limit: 5, windowMs: 60 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Espera un momento antes de volver a intentarlo." }, { status: 429, headers });
  let body: unknown;
  try { body = JSON.parse(await request.text()); } catch { return NextResponse.json({ error: "Solicitud invalida." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "ELIMINAR") {
    return NextResponse.json({ error: "Escribe ELIMINAR para confirmar." }, { status: 400, headers });
  }

  const db = createSupabaseAdminClient();
  try {
    const state = await getAccountState(db, identity);
    const type = accountType(state);
    if (identity.isFounder) {
      return NextResponse.json({ error: "La cuenta principal de SOMOS requiere una transferencia administrativa antes de eliminarse." }, { status: 409, headers });
    }
    if (type !== "buyer") {
      if (!state.pending) {
        const { error } = await db.from("account_deletion_requests").insert({
          user_id: identity.id,
          email: identity.email,
          account_type: type,
          store_ids: state.storeIds,
          agency_ids: state.agencyIds,
        });
        if (error && error.code !== "23505") throw error;
      }
      return NextResponse.json({
        ok: true,
        pending: true,
        message: "Recibimos tu solicitud. Revisaremos los accesos operativos antes de eliminar la cuenta.",
      }, { status: 202, headers });
    }

    const { error } = await db.auth.admin.deleteUser(identity.id, false);
    if (error) throw error;
    if (state.pending?.id) {
      const now = new Date().toISOString();
      await db.from("account_deletion_requests").update({ status: "completed", resolved_at: now, updated_at: now }).eq("id", state.pending.id);
    }
    return NextResponse.json({ ok: true, pending: false }, { headers });
  } catch {
    return NextResponse.json({ error: "No pudimos procesar la eliminacion. Intenta mas tarde." }, { status: 503, headers });
  }
}
