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

function colorHex(value: unknown, fallback: string) {
  const color = cleanTransportText(value, 7).toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
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

    let savedProfileAgency: any = null;

    if (body.action === "profile") {
      const coverageCityIds = Array.from(new Set(
        (Array.isArray(body.coverageCityIds) ? body.coverageCityIds : []).map((value: unknown) => cleanTransportText(value, 80)).filter(Boolean)
      ));
      const baseCityId = cleanTransportText(body.baseCityId, 80);
      if (!coverageCityIds.length || !baseCityId || !coverageCityIds.includes(baseCityId)) {
        return badRequest("Selecciona una ciudad base y al menos una ciudad de cobertura.");
      }
      const { data: validCities, error: citiesError } = await supabase
        .from("service_cities").select("id, name, state_name").in("id", coverageCityIds).eq("is_active", true);
      if (citiesError) throw citiesError;
      if ((validCities || []).length !== coverageCityIds.length) return badRequest("La cobertura contiene una ciudad no disponible.");
      const baseCity = (validCities || []).find((city: any) => city.id === baseCityId);
      const payload: Record<string, any> = {
        name: cleanTransportText(body.name, 140),
        legal_name: cleanTransportText(body.legalName, 160) || null,
        rif: cleanTransportText(body.rif, 40) || null,
        contact_name: cleanTransportText(body.contactName, 120),
        contact_email: cleanTransportText(body.contactEmail, 180).toLowerCase(),
        contact_phone: cleanTransportText(body.contactPhone, 40),
        whatsapp_phone: cleanTransportText(body.whatsappPhone, 40) || null,
        city: baseCity?.name || null,
        state: baseCity?.state_name || null,
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
        driver_whatsapp_dispatch_enabled: Boolean(body.driverWhatsappDispatchEnabled),
        modality: normalizeAgencyModality(body.modality),
        rates_visibility: normalizeRatesVisibility(body.ratesVisibility),
        marketplace_primary_color: colorHex(body.marketplacePrimaryColor, "#143D42"),
        marketplace_accent_color: colorHex(body.marketplaceAccentColor, "#FF7133"),
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

      const { data: updatedAgency, error } = await supabase
        .from("transport_agencies")
        .update(payload)
        .eq("id", agencyId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!updatedAgency) return badRequest("No se pudo confirmar el guardado de la empresa delivery.");
      savedProfileAgency = updatedAgency;
      const deactivateCoverage = await supabase.from("transport_agency_city_coverage").update({ is_active: false, is_base_city: false, updated_at: new Date().toISOString() }).eq("agency_id", agencyId);
      if (deactivateCoverage.error) throw deactivateCoverage.error;
      const coverageRows = coverageCityIds.map((cityId) => ({ agency_id: agencyId, city_id: cityId, is_base_city: cityId === baseCityId, is_active: true, updated_at: new Date().toISOString() }));
      const coverageSave = await supabase.from("transport_agency_city_coverage").upsert(coverageRows, { onConflict: "agency_id,city_id" });
      if (coverageSave.error) throw coverageSave.error;
    } else if (body.action === "rates") {
      const pricingType = ["flat", "zones", "distance_ranges", "manual"].includes(
        cleanTransportText(body.pricingType)
      )
        ? cleanTransportText(body.pricingType)
        : "manual";
      const maxDistanceKm = optionalTransportNumber(body.maxDistanceKm);
      const distanceFactorUsd = optionalTransportNumber(body.distanceFactorUsd);

      if (!maxDistanceKm || maxDistanceKm <= 0) {
        return badRequest("Indica el KM maximo de cobertura.");
      }
      if (distanceFactorUsd !== null && distanceFactorUsd < 0) {
        return badRequest("El monto por km adicional no puede ser negativo.");
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
          distance_factor_usd:
            pricingType === "distance_ranges" ? distanceFactorUsd : null,
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

    const configIssues = getTransportAgencyConfigIssues({
        agency: agencyResult.data,
        rate: rateResult.data,
        zones: zonesResult.data || [],
        distanceRates: distanceRatesResult.data || [],
      });
    const shouldPublish =
      agencyResult.data?.status === "active" && configIssues.length === 0;

    if (Boolean(agencyResult.data?.is_active) !== shouldPublish) {
      const { error: publishError } = await supabase
        .from("transport_agencies")
        .update({
          is_active: shouldPublish,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agencyId);

      if (publishError) throw publishError;
    }

    return NextResponse.json({
      ok: true,
      agency: savedProfileAgency
        ? { ...savedProfileAgency, is_active: shouldPublish }
        : agencyResult.data
          ? { ...agencyResult.data, is_active: shouldPublish }
          : null,
      isActive: shouldPublish,
      configIssues,
    });
  } catch (error) {
    return transportErrorResponse(error, "Error guardando empresa delivery.");
  }
}
