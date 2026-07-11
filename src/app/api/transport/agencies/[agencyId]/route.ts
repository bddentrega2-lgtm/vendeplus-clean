import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertAgencyManager,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import {
  cleanTransportText,
  getTransportAgencyConfigIssues,
  normalizeAgencyModality,
  normalizeRatesVisibility,
  optionalTransportNumber,
  transportMoney,
} from "@/lib/transport";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    assertAgencyManager(auth, agencyId, "Tu rol no permite editar la empresa delivery.");

    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === "profile") {
      const payload = {
        name: cleanTransportText(body.name, 140),
        legal_name: cleanTransportText(body.legalName, 160) || null,
        rif: cleanTransportText(body.rif, 40) || null,
        contact_name: cleanTransportText(body.contactName, 120),
        contact_email: cleanTransportText(body.contactEmail, 180).toLowerCase(),
        contact_phone: cleanTransportText(body.contactPhone, 40),
        whatsapp_phone: cleanTransportText(body.whatsappPhone, 40) || null,
        city: cleanTransportText(body.city, 80) || null,
        state: cleanTransportText(body.state, 80) || null,
        coverage_notes: cleanTransportText(body.coverageNotes, 600) || null,
        logo_url: cleanTransportText(body.logoUrl, 1000) || null,
        capacity_dimensions_cm: cleanTransportText(body.capacityDimensionsCm, 80) || null,
        capacity_weight_kg: optionalTransportNumber(body.capacityWeightKg),
        max_wait_time_minutes: optionalTransportNumber(body.maxWaitTimeMinutes),
        charges_cash_return: Boolean(body.chargesCashReturn),
        cash_return_fee_usd: transportMoney(body.cashReturnFeeUsd),
        billing_currency: ["USD", "EUR"].includes(
          cleanTransportText(body.billingCurrency).toUpperCase()
        )
          ? cleanTransportText(body.billingCurrency).toUpperCase()
          : "USD",
        billing_rate_bs: optionalTransportNumber(body.billingRateBs),
        payment_terms: cleanTransportText(body.paymentTerms, 1000) || null,
        credit_terms: cleanTransportText(body.creditTerms, 1000) || null,
        additional_conditions: cleanTransportText(body.additionalConditions, 1000) || null,
        modality: normalizeAgencyModality(body.modality),
        rates_visibility: normalizeRatesVisibility(body.ratesVisibility),
        pricing_type: ["flat", "zones", "distance_ranges", "manual"].includes(
          cleanTransportText(body.pricingType)
        )
          ? cleanTransportText(body.pricingType)
          : "flat",
        updated_at: new Date().toISOString(),
      };

      if (!payload.name || !payload.contact_name || !payload.contact_email || !payload.contact_phone) {
        return badRequest("Completa nombre, responsable, correo y telefono.");
      }

      const { error } = await supabase
        .from("transport_agencies")
        .update(payload)
        .eq("id", agencyId);
      if (error) throw error;
    } else if (body.action === "rates") {
      const pricingType = ["flat", "zones", "distance_ranges", "manual"].includes(
        cleanTransportText(body.pricingType)
      )
        ? cleanTransportText(body.pricingType)
        : "manual";
      const maxDistanceKm = optionalTransportNumber(body.maxDistanceKm);

      if (!maxDistanceKm || maxDistanceKm <= 0) {
        return badRequest("Indica el KM maximo de cobertura.");
      }

      const agencyUpdate = await supabase
        .from("transport_agencies")
        .update({
          pricing_type: pricingType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agencyId);
      if (agencyUpdate.error) throw agencyUpdate.error;

      const { error } = await supabase.from("transport_agency_rates").upsert(
        {
          agency_id: agencyId,
          flat_fee_usd: transportMoney(body.flatFeeUsd),
          max_distance_km: maxDistanceKm,
          distance_factor_usd: null,
          minimum_order_usd: null,
          manual_quote_message: cleanTransportText(body.manualQuoteMessage, 260) || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agency_id" }
      );
      if (error) throw error;
    } else {
      return badRequest("Accion invalida.");
    }

    const [agencyResult, rateResult, zonesResult, distanceRatesResult] = await Promise.all([
      supabase.from("transport_agencies").select("*").eq("id", agencyId).maybeSingle(),
      supabase
        .from("transport_agency_rates")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("transport_agency_zones")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("is_active", true),
      supabase
        .from("transport_agency_distance_rates")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("is_active", true),
    ]);

    if (agencyResult.error) throw agencyResult.error;
    if (rateResult.error) throw rateResult.error;
    if (zonesResult.error) throw zonesResult.error;
    if (distanceRatesResult.error) throw distanceRatesResult.error;

    return NextResponse.json({
      ok: true,
      configIssues: getTransportAgencyConfigIssues({
        agency: agencyResult.data,
        rate: rateResult.data,
        zones: zonesResult.data || [],
        distanceRates: distanceRatesResult.data || [],
      }),
    });
  } catch (error) {
    return transportErrorResponse(error, "Error guardando empresa delivery.");
  }
}
