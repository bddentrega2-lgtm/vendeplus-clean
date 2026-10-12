import { NextRequest, NextResponse } from "next/server";
import { getPanelAuthContext, normalizeAuthEmail } from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertAgencyManager, requireTransportAgencyAuth, TransportAccessError, transportErrorResponse } from "@/lib/transport/access";

type Db = ReturnType<typeof createSupabaseAdminClient>;
type Owner = { beneficiary_email: string; transport_agency_id?: never } | { beneficiary_email?: never; transport_agency_id: string };

async function resolveOwner(request: NextRequest, db: Db): Promise<Owner> {
  const agencyId = new URL(request.url).searchParams.get("agencyId");
  let userId: string;
  let email: string;
  if (agencyId) {
    if (!/^[0-9a-f-]{36}$/i.test(agencyId)) throw new TransportAccessError("Empresa delivery invalida.", 400);
    const auth = await requireTransportAgencyAuth(request);
    assertAgencyManager(auth, agencyId, "Solo el propietario o administrador puede editar los pagos.");
    userId = auth.userId;
    email = normalizeAuthEmail(auth.email);
  } else {
    const auth = await getPanelAuthContext(request);
    if (!auth.isAuthorized || !auth.userId || !auth.email) throw new TransportAccessError("Inicia sesion.", 401);
    userId = auth.userId;
    email = auth.email;
  }
  const { data: identity, error: identityError } = await db.auth.admin.getUserById(userId);
  if (identityError) throw identityError;
  if (!identity.user?.email_confirmed_at || normalizeAuthEmail(identity.user.email) !== email) {
    throw new TransportAccessError("Verifica tu correo para registrar datos de pago.", 403);
  }
  const query = db.from("affiliate_codes").select("id").limit(1);
  const { data: codes, error } = agencyId
    ? await query.eq("partner_type", "delivery").eq("transport_agency_id", agencyId)
    : await query.eq("beneficiary_email", email).neq("partner_type", "delivery");
  if (error) throw error;
  if (!codes?.length) throw new TransportAccessError("No tienes un codigo de referido asignado.", 403);
  return agencyId ? { transport_agency_id: agencyId } : { beneficiary_email: email };
}

function payoutResponse(row: Record<string, unknown> | null) {
  return row ? {
    holderName: row.holder_name, bankName: row.bank_name,
    documentNumber: row.document_number, phone: row.phone,
  } : null;
}

export async function GET(request: NextRequest) {
  try {
    const db = createSupabaseAdminClient();
    const owner = await resolveOwner(request, db);
    const query = db.from("affiliate_payout_accounts").select("holder_name, bank_name, document_number, phone");
    const { data, error } = owner.transport_agency_id
      ? await query.eq("transport_agency_id", owner.transport_agency_id).maybeSingle()
      : await query.eq("beneficiary_email", owner.beneficiary_email).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ payout: payoutResponse(data) });
  } catch (error) { return transportErrorResponse(error, "No se pudieron cargar tus datos de pago."); }
}

export async function PUT(request: NextRequest) {
  try {
    const db = createSupabaseAdminClient();
    const owner = await resolveOwner(request, db);
    const body = await request.json();
    const holderName = String(body.holderName || "").trim();
    const bankName = String(body.bankName || "").trim();
    const documentNumber = String(body.documentNumber || "").trim().toUpperCase();
    const phone = String(body.phone || "").replace(/[\s()-]/g, "");
    if (holderName.length < 2 || holderName.length > 120 || bankName.length < 2 || bankName.length > 80 ||
        !/^[A-Z0-9-]{5,20}$/.test(documentNumber) || !/^04\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "Revisa el titular, banco, cedula o RIF y telefono de Pago Movil." }, { status: 400 });
    }
    const { data, error } = await db.from("affiliate_payout_accounts").upsert({
      ...owner, holder_name: holderName, bank_name: bankName,
      document_number: documentNumber, phone, updated_at: new Date().toISOString(),
    }, { onConflict: owner.transport_agency_id ? "transport_agency_id" : "beneficiary_email" })
      .select("holder_name, bank_name, document_number, phone").single();
    if (error) throw error;
    return NextResponse.json({ payout: payoutResponse(data) });
  } catch (error) { return transportErrorResponse(error, "No se pudieron guardar tus datos de pago."); }
}
