import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  findOverlappingDistanceRange,
  formatDistanceRange,
  normalizeDistanceRangeInput,
} from "@/lib/distance-ranges";
import {
  assertAgencyManager,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import { cleanTransportText, optionalTransportNumber, transportMoney } from "@/lib/transport";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function tableFor(type: unknown) {
  if (type === "zone") return "transport_agency_zones";
  if (type === "distance_rate") return "transport_agency_distance_rates";
  return "";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    assertAgencyManager(auth, agencyId, "Tu rol no permite crear reglas de tarifa.");
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.type === "zone") {
      const { error } = await supabase.from("transport_agency_zones").insert({
        agency_id: agencyId,
        name: cleanTransportText(body.name, 120) || "Zona",
        description: cleanTransportText(body.description, 220) || null,
        fee_usd: transportMoney(body.feeUsd),
        sort_order: Math.floor(optionalTransportNumber(body.sortOrder) || 0),
        is_active: true,
      });
      if (error) throw error;
    } else if (body.type === "distance_rate") {
      const normalized = normalizeDistanceRangeInput({
        minKm: body.minKm,
        maxKm: body.maxKm,
      });
      if (normalized.error || !normalized.range) return badRequest(normalized.error || "Rango invalido.");

      const { data: existingRates, error: existingError } = await supabase
        .from("transport_agency_distance_rates")
        .select("id, min_km, max_km, is_active")
        .eq("agency_id", agencyId);
      if (existingError) throw existingError;

      const conflict = findOverlappingDistanceRange({
        candidate: normalized.range,
        ranges: existingRates || [],
      });
      if (conflict) {
        return badRequest(
          `Ese rango se cruza con ${formatDistanceRange(conflict)}. Ajusta los kilometros para que no se solapen.`
        );
      }

      const { error } = await supabase.from("transport_agency_distance_rates").insert({
        agency_id: agencyId,
        min_km: normalized.range.minKm,
        max_km: normalized.range.maxKm,
        fee_usd: transportMoney(body.feeUsd),
        sort_order: Math.floor(optionalTransportNumber(body.sortOrder) || 0),
        is_active: true,
      });
      if (error) throw error;
    } else {
      return badRequest("Tipo de regla invalido.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return transportErrorResponse(error, "Error creando regla.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    assertAgencyManager(auth, agencyId, "Tu rol no permite actualizar reglas de tarifa.");
    const body = await request.json();
    const table = tableFor(body.type);
    const id = cleanTransportText(body.id);

    if (!table || !id) return badRequest("Faltan datos.");

    const supabase = createSupabaseAdminClient();
    let payload;

    if (body.type === "zone") {
      payload = {
        name: cleanTransportText(body.name, 120) || "Zona",
        description: cleanTransportText(body.description, 220) || null,
        fee_usd: transportMoney(body.feeUsd),
        is_active: body.isActive !== false,
        sort_order: Math.floor(optionalTransportNumber(body.sortOrder) || 0),
        updated_at: new Date().toISOString(),
      };
    } else {
      const normalized = normalizeDistanceRangeInput({
        id,
        minKm: body.minKm,
        maxKm: body.maxKm,
      });
      if (normalized.error || !normalized.range) return badRequest(normalized.error || "Rango invalido.");

      if (body.isActive !== false) {
        const { data: existingRates, error: existingError } = await supabase
          .from("transport_agency_distance_rates")
          .select("id, min_km, max_km, is_active")
          .eq("agency_id", agencyId);
        if (existingError) throw existingError;

        const conflict = findOverlappingDistanceRange({
          candidate: normalized.range,
          ranges: existingRates || [],
          excludeId: id,
        });
        if (conflict) {
          return badRequest(
            `Ese rango se cruza con ${formatDistanceRange(conflict)}. Ajusta los kilometros para que no se solapen.`
          );
        }
      }

      payload = {
        min_km: normalized.range.minKm,
        max_km: normalized.range.maxKm,
        fee_usd: transportMoney(body.feeUsd),
        is_active: body.isActive !== false,
        sort_order: Math.floor(optionalTransportNumber(body.sortOrder) || 0),
        updated_at: new Date().toISOString(),
      };
    }

    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", id)
      .eq("agency_id", agencyId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return transportErrorResponse(error, "Error actualizando regla.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    assertAgencyManager(auth, agencyId, "Tu rol no permite eliminar reglas de tarifa.");
    const body = await request.json();
    const table = tableFor(body.type);
    const id = cleanTransportText(body.id);

    if (!table || !id) return badRequest("Faltan datos.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("agency_id", agencyId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return transportErrorResponse(error, "Error eliminando regla.");
  }
}
