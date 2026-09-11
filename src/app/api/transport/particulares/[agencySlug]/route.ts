import { NextRequest, NextResponse } from "next/server";
import { calculateDeliveryQuoteFromSettings, calculateRouteDistanceKm } from "@/lib/delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadTransportAgencyDeliverySettingsBySlug } from "@/lib/transport";
import { checkDistributedRateLimit, getClientIp, rateLimitHeaders } from "@/lib/server/rate-limit";
import {
  isEntrega2AgencySlug,
  quoteEntrega2ThroughSomos,
} from "@/lib/server/entrega2-bridge";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 8 * 1024;

function text(value: unknown, max = 240) { return String(value || "").trim().slice(0, max); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : Number.NaN; }
function validPoint(lat: number, lng: number) { return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180; }
function validPhone(value: string) { const digits = value.replace(/\D/g, ""); return digits.length >= 10 && digits.length <= 15; }
function phoneDigits(value: string) { return value.replace(/\D/g, ""); }
function badRequest(error: string) { return NextResponse.json({ error }, { status: 400 }); }
function publicCode() { return `PAR-${new Date().toISOString().slice(5, 10).replace("-", "")}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`; }

async function context(agencySlug: string) {
  const supabase = createSupabaseAdminClient();
  const configuration = await loadTransportAgencyDeliverySettingsBySlug(supabase, agencySlug, { pickupEnabled: false });
  return configuration?.agency?.premium_dispatch_enabled === true
    ? { supabase, configuration }
    : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ agencySlug: string }> }) {
  const { agencySlug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agencySlug) || agencySlug.length > 100) {
    return badRequest("El enlace de la empresa delivery no es valido.");
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 });
  }
  const ip = getClientIp(request);
  const limit = await checkDistributedRateLimit({ key: `particular:${agencySlug}:${ip}`, limit: 20, windowMs: WINDOW_MS });
  if (!limit.allowed) return NextResponse.json({ error: "Has realizado muchas solicitudes. Espera unos minutos." }, { status: 429, headers: rateLimitHeaders(limit, 20) });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest("La solicitud no es valida.");
  const pickupLat = number(body?.pickup?.latitude), pickupLng = number(body?.pickup?.longitude);
  const deliveryLat = number(body?.delivery?.latitude), deliveryLng = number(body?.delivery?.longitude);
  if (!validPoint(pickupLat, pickupLng) || !validPoint(deliveryLat, deliveryLng)) return badRequest("Confirma las ubicaciones de retiro y entrega.");

  const loaded = await context(agencySlug);
  if (!loaded) return NextResponse.json({ error: "Esta empresa delivery no esta disponible para particulares." }, { status: 404 });
  const bridgeResult = isEntrega2AgencySlug(loaded.configuration.agency.slug)
    ? await quoteEntrega2ThroughSomos({
        pickupLat,
        pickupLng,
        deliveryLat,
        deliveryLng,
        subtotalUsd: 0,
        fallbackSettings: loaded.configuration.settings,
        provider: "transport_agency",
        agency: {
          id: String(loaded.configuration.agency.id),
          name: String(loaded.configuration.agency.name || "Entrega2"),
          logoUrl: loaded.configuration.agency.logo_url || null,
        },
      })
    : await (async () => {
        const distance = await calculateRouteDistanceKm({ originLat: pickupLat, originLng: pickupLng, destinationLat: deliveryLat, destinationLng: deliveryLng });
        const routeDistanceKm = Number(distance.distanceKm.toFixed(2));
        return {
        quote: calculateDeliveryQuoteFromSettings({
          settings: loaded.configuration.settings,
          deliveryType: "delivery",
          subtotalUsd: 0,
          distanceKm: routeDistanceKm,
          source: distance.source,
        }),
        fallbackError: null,
        fallback: null,
        };
      })();
  const quote = bridgeResult.quote;
  const quotePayload = { distanceKm: quote.distanceKm, feeUsd: quote.available && Number.isFinite(quote.feeUsd) ? quote.feeUsd : null, pricingType: quote.pricingType, source: quote.source, label: quote.available ? quote.label : "Tarifa por confirmar" };
  if (body?.action === "quote") return NextResponse.json({ ok: true, quote: quotePayload, ...(bridgeResult.fallback ? { fallback: bridgeResult.fallback } : {}) });

  const requesterName = text(body?.requesterName, 100), requesterPhone = text(body?.requesterPhone, 24);
  const requesterRole = body?.requesterRole === "receiver" ? "receiver" : body?.requesterRole === "sender" ? "sender" : "";
  const pickupName = text(body?.pickup?.name, 100), pickupPhone = text(body?.pickup?.phone, 24);
  const deliveryName = text(body?.delivery?.name, 100), deliveryPhone = text(body?.delivery?.phone, 24);
  const pickupAddress = text(body?.pickup?.address), deliveryAddress = text(body?.delivery?.address);
  const serviceType = body?.serviceType === "person" ? "person" : "delivery";
  const travelerName = text(body?.travelerName, 100);
  const travelerPhone = text(body?.travelerPhone, 24);
  const rawPackageDescription = text(body?.packageDescription, 300), paymentMethod = text(body?.paymentMethod, 40);
  const serviceLabel = serviceType === "person" ? "Traslado de persona" : "Delivery";
  const serviceDetail = serviceType === "person"
    ? [`Pasajero: ${travelerName || requesterName}`, travelerPhone ? `Telefono pasajero: ${travelerPhone}` : null].filter(Boolean).join(" | ")
    : rawPackageDescription;
  const packageDescription = text(`${serviceLabel}: ${serviceDetail || serviceLabel}`, 300);
  const paymentReference = text(body?.paymentReference, 40);
  const requestKey = text(body?.requestKey, 36);
  if (!requesterName || !requesterPhone || !requesterRole || !pickupName || !pickupPhone || !deliveryName || !deliveryPhone || !packageDescription) return badRequest("Completa todos los datos obligatorios.");
  if (serviceType === "person" && (!travelerName || !travelerPhone)) return badRequest("Completa los datos de la persona que viaja.");
  if (!validPhone(requesterPhone) || !validPhone(pickupPhone) || !validPhone(deliveryPhone) || (serviceType === "person" && !validPhone(travelerPhone))) return badRequest("Revisa los numeros de telefono.");
  const availablePaymentMethods = Array.isArray(loaded.configuration.agency.particular_payment_methods)
    ? loaded.configuration.agency.particular_payment_methods.map((method: unknown) => text(method, 40)).filter(Boolean)
    : [];
  if (!["Pago móvil", "Efectivo"].includes(paymentMethod) || !availablePaymentMethods.includes(paymentMethod)) return badRequest("Selecciona un metodo de pago disponible.");
  if (paymentMethod === "Pago móvil" && paymentReference.replace(/\D/g, "").length < 4) return badRequest("La referencia debe tener al menos 4 digitos.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) return badRequest("Actualiza la pagina e intenta nuevamente.");

  let code = publicCode();
  const { data: created, error } = await loaded.supabase.from("transport_particular_requests").insert({
    public_code: code, agency_id: loaded.configuration.agency.id,
    idempotency_key: requestKey,
    requester_name: requesterName, requester_phone: requesterPhone, requester_role: requesterRole,
    pickup_name: pickupName, pickup_phone: pickupPhone, pickup_address: pickupAddress, pickup_reference: text(body?.pickup?.reference) || null, pickup_lat: pickupLat, pickup_lng: pickupLng,
    delivery_name: deliveryName, delivery_phone: deliveryPhone, delivery_address: deliveryAddress, delivery_reference: text(body?.delivery?.reference) || null, delivery_lat: deliveryLat, delivery_lng: deliveryLng,
    package_description: packageDescription, payment_method: paymentMethod, payment_reference: paymentReference || null,
    distance_km: quotePayload.distanceKm, delivery_fee_usd: quotePayload.feeUsd, pricing_type: quotePayload.pricingType, quote_source: quotePayload.source,
  }).select("public_code").single();
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await loaded.supabase
      .from("transport_particular_requests")
      .select("public_code")
      .eq("agency_id", loaded.configuration.agency.id)
      .eq("idempotency_key", requestKey)
      .maybeSingle();
    if (existingError || !existing) return NextResponse.json({ error: "No pudimos confirmar la solicitud." }, { status: 500 });
    code = existing.public_code;
  } else if (error) {
    return NextResponse.json({ error: "No pudimos registrar la solicitud." }, { status: 500 });
  } else if (created?.public_code) {
    code = created.public_code;
  }

  const phone = String(loaded.configuration.agency.whatsapp_phone || loaded.configuration.agency.contact_phone || "").replace(/\D/g, "");
  const amount = quotePayload.feeUsd === null ? "Por confirmar" : `$${Number(quotePayload.feeUsd).toFixed(2)}`;
  const requesterLine = serviceType === "delivery"
    ? `Solicitante: ${requesterName} (${requesterRole === "sender" ? "Usted envia" : "Usted recibe"})`
    : `Solicitante: ${requesterName}`;
  const travelerIsRequester =
    serviceType === "person" &&
    travelerName.toLowerCase() === requesterName.toLowerCase() &&
    phoneDigits(travelerPhone) === phoneDigits(requesterPhone);
  const travelerLines =
    serviceType === "person" && !travelerIsRequester
      ? [`Pasajero: ${travelerName}`, `Telefono pasajero: ${travelerPhone}`]
      : [];
  const pickupTitle = serviceType === "person" ? "*ORIGEN*" : "*RETIRO*";
  const deliveryTitle = serviceType === "person" ? "*DESTINO*" : "*ENTREGA*";
  const message = [
    `*SOLICITUD PARTICULAR ${code}*`,
    `Servicio: ${serviceLabel}`,
    requesterLine,
    `Telefono solicitante: ${requesterPhone}`,
    ...travelerLines,
    "",
    pickupTitle,
    serviceType === "delivery" ? `Nombre: ${pickupName}` : null,
    pickupAddress || "Referencia escrita no indicada",
    serviceType === "delivery" ? `Telefono: ${pickupPhone}` : null,
    `Mapa: https://www.google.com/maps?q=${pickupLat},${pickupLng}`,
    "",
    deliveryTitle,
    serviceType === "delivery" ? `Nombre: ${deliveryName}` : null,
    deliveryAddress || "Referencia escrita no indicada",
    serviceType === "delivery" ? `Telefono: ${deliveryPhone}` : null,
    `Mapa: https://www.google.com/maps?q=${deliveryLat},${deliveryLng}`,
    "",
    serviceType === "delivery" ? `Paquete: ${rawPackageDescription}` : null,
    `Distancia: ${quotePayload.distanceKm?.toFixed(2) || "Por confirmar"} km`,
    `Tarifa: ${amount}`,
    bridgeResult.fallback ? "Cotizacion: respaldo de Entrega2 Somos" : null,
    `Pago: ${paymentMethod}`,
    paymentReference ? `Referencia de pago: ${paymentReference}` : null,
  ].filter((line) => line !== null).join("\n");
  return NextResponse.json({ ok: true, code, quote: quotePayload, whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null, ...(bridgeResult.fallback ? { fallback: bridgeResult.fallback } : {}) });
}
