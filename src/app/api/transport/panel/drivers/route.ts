import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertAgencyAccess,
  assertAgencyManager,
  canUseAgencyRole,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import {
  cleanDriverText,
  isPremiumDispatchSchemaMissing,
  normalizeCommissionPercent,
} from "@/lib/transport/driver-dispatch";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function resolveAgencyId(supabase: any, auth: any, requestedAgencyId?: string | null) {
  if (requestedAgencyId) {
    assertAgencyAccess(auth, requestedAgencyId);
    return requestedAgencyId;
  }

  if (auth.agencyIds?.length) return auth.agencyIds[0];

  if (auth.isFounderMode) {
    const { data, error } = await supabase
      .from("transport_agencies")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id || "";
  }

  return "";
}

async function loadPremiumFlag(supabase: any, agencyId: string) {
  const { data, error } = await supabase
    .from("transport_agencies")
    .select("premium_dispatch_enabled")
    .eq("id", agencyId)
    .maybeSingle();

  if (error) {
    if (isPremiumDispatchSchemaMissing(error)) return { schemaReady: false, enabled: false };
    throw error;
  }

  return { schemaReady: true, enabled: data?.premium_dispatch_enabled === true };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();
    const agencyId = await resolveAgencyId(
      supabase,
      auth,
      request.nextUrl.searchParams.get("agencyId")
    );

    if (!agencyId) return NextResponse.json({ drivers: [], premiumDispatchEnabled: false });
    if (!canUseAgencyRole(auth, agencyId, ["owner", "admin", "operator", "billing"])) {
      return NextResponse.json({ error: "Tu rol no permite ver repartidores." }, { status: 403 });
    }

    const premium = await loadPremiumFlag(supabase, agencyId);
    if (!premium.schemaReady) {
      return NextResponse.json({
        agencyId,
        drivers: [],
        premiumDispatchEnabled: false,
        schemaReady: false,
      });
    }

    const { data, error } = await supabase
      .from("transport_drivers")
      .select("id, agency_id, name, phone, document_number, commission_percent, is_active, notes, created_at, updated_at")
      .eq("agency_id", agencyId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      if (isPremiumDispatchSchemaMissing(error)) {
        return NextResponse.json({
          agencyId,
          drivers: [],
          premiumDispatchEnabled: premium.enabled,
          schemaReady: false,
        });
      }
      throw error;
    }

    return NextResponse.json({
      agencyId,
      drivers: data || [],
      premiumDispatchEnabled: premium.enabled,
      schemaReady: true,
    });
  } catch (error) {
    return transportErrorResponse(error, "Error cargando repartidores.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const agencyId = await resolveAgencyId(supabase, auth, cleanDriverText(body.agencyId, 80));
    const name = cleanDriverText(body.name, 120);
    const phone = cleanDriverText(body.phone, 40);
    const documentNumber = cleanDriverText(body.documentNumber, 40);
    const notes = cleanDriverText(body.notes, 300);
    const commissionPercent = normalizeCommissionPercent(body.commissionPercent);

    if (!agencyId) return badRequest("Empresa delivery no encontrada.");
    assertAgencyManager(auth, agencyId, "Solo owner o admin pueden crear repartidores.");
    if (!name) return badRequest("Escribe el nombre del repartidor.");

    const premium = await loadPremiumFlag(supabase, agencyId);
    if (!premium.schemaReady) return badRequest("Falta aplicar la migracion premium de repartidores.");
    if (!premium.enabled) {
      return badRequest("El paquete premium de repartidores no esta activo para esta empresa.");
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("transport_drivers")
      .select("id")
      .eq("agency_id", agencyId)
      .ilike("name", name)
      .limit(1);
    if (duplicateError) throw duplicateError;
    if (duplicate?.length) return badRequest("Ya existe un repartidor con ese nombre.");

    const { data, error } = await supabase
      .from("transport_drivers")
      .insert({
        agency_id: agencyId,
        name,
        phone: phone || null,
        document_number: documentNumber || null,
        commission_percent: commissionPercent,
        notes: notes || null,
      })
      .select("id, agency_id, name, phone, document_number, commission_percent, is_active, notes, created_at, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, driver: data });
  } catch (error) {
    return transportErrorResponse(error, "Error guardando repartidor.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const supabase = createSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const driverId = cleanDriverText(body.id, 80);
    if (!driverId) return badRequest("Repartidor no encontrado.");

    const { data: current, error: currentError } = await supabase
      .from("transport_drivers")
      .select("id, agency_id")
      .eq("id", driverId)
      .maybeSingle();

    if (currentError) {
      if (isPremiumDispatchSchemaMissing(currentError)) {
        return badRequest("Falta aplicar la migracion premium de repartidores.");
      }
      throw currentError;
    }
    if (!current) return badRequest("Repartidor no encontrado.");

    assertAgencyManager(auth, current.agency_id, "Solo owner o admin pueden editar repartidores.");

    const name = cleanDriverText(body.name, 120);
    if (!name) return badRequest("Escribe el nombre del repartidor.");

    const payload = {
      name,
      phone: cleanDriverText(body.phone, 40) || null,
      document_number: cleanDriverText(body.documentNumber, 40) || null,
      commission_percent: normalizeCommissionPercent(body.commissionPercent),
      is_active: body.isActive !== false,
      notes: cleanDriverText(body.notes, 300) || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("transport_drivers")
      .update(payload)
      .eq("id", driverId)
      .select("id, agency_id, name, phone, document_number, commission_percent, is_active, notes, created_at, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, driver: data });
  } catch (error) {
    return transportErrorResponse(error, "Error actualizando repartidor.");
  }
}
