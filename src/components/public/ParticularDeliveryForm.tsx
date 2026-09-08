"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bike, Check, Copy, MapPin, Package, Send, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { LocationPicker } from "@/components/public/LocationPicker";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import {
  clearCustomerBrowserProfile,
  getCustomerBrowserProfile,
  saveCustomerBrowserProfile,
} from "@/lib/customer-browser-profile";
import { getPaymentDetailsKey } from "@/lib/payments";
import type { DeliveryLocation } from "@/types";

type PaymentDetails = Record<string, Record<string, string>>;
type Agency = {
  name: string;
  slug: string;
  logoUrl?: string | null;
  location: string;
  primaryColor: string;
  accentColor: string;
  paymentMethods: string[];
  paymentDetails: PaymentDetails;
};
type Point = { name: string; phone: string; address: string; location: DeliveryLocation | null };
type ServiceType = "delivery" | "person" | "";
type DeliveryRole = "sender" | "receiver" | "";
type TravelerMode = "self" | "other" | "";

const inputClass =
  "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-[var(--agency-accent)]";

function emptyPoint(): Point {
  return { name: "", phone: "", address: "", location: null };
}

function serviceTitle(serviceType: ServiceType) {
  if (serviceType === "person") return "Traslado de persona";
  if (serviceType === "delivery") return "Delivery";
  return "Servicio particular";
}

function PointFields({
  agencyName,
  allowCurrentLocation,
  mode,
  name,
  nameLabel,
  noteLabel,
  phoneLabel,
  referenceMarkerLabel,
  referencePopupLabel,
  setValue,
  value,
}: {
  agencyName: string;
  allowCurrentLocation: boolean;
  mode: "store" | "delivery";
  name: string;
  nameLabel?: string;
  noteLabel: string;
  phoneLabel?: string;
  referenceMarkerLabel?: string;
  referencePopupLabel?: string;
  setValue: React.Dispatch<React.SetStateAction<Point>>;
  value: Point;
}) {
  return (
    <div className="space-y-4">
      {nameLabel ? (
        <label className="block text-sm font-black">
          {nameLabel}
          <input
            className={inputClass}
            value={value.name}
            onChange={(event) => setValue((point) => ({ ...point, name: event.target.value }))}
          />
        </label>
      ) : null}
      {phoneLabel ? (
        <label className="block text-sm font-black">
          {phoneLabel}
          <input
            className={inputClass}
            type="tel"
            value={value.phone}
            onChange={(event) => setValue((point) => ({ ...point, phone: event.target.value }))}
          />
        </label>
      ) : null}
      <label className="block text-sm font-black">
        {noteLabel} <span className="font-semibold text-slate-400">(opcional)</span>
        <textarea
          className={inputClass}
          rows={2}
          value={value.address}
          onChange={(event) => setValue((point) => ({ ...point, address: event.target.value }))}
          placeholder="Ej: Av. Bolivar, casa verde con porton negro"
        />
      </label>
      <LocationPicker
        key={`${mode}-${name}-${allowCurrentLocation ? "current" : "map"}`}
        storeLatitude={10.2468}
        storeLongitude={-67.5958}
        storeName={agencyName}
        mode={mode}
        pointName={name}
        referenceMarkerLabel={referenceMarkerLabel}
        referencePopupLabel={referencePopupLabel}
        allowCurrentLocation={allowCurrentLocation}
        value={value.location}
        onChange={(location) => setValue((point) => ({ ...point, location }))}
      />
    </div>
  );
}

function paymentLines(method: string, details: PaymentDetails): Array<[string, string]> {
  const key = getPaymentDetailsKey(method);
  const data = key ? details[key] || {} : {};
  if (key === "pagoMovil") {
    return [["Banco", data.bank], ["Telefono", data.phone], ["Cedula/RIF", data.idNumber]];
  }
  if (key === "efectivo") return [["Informacion", data.note]];
  return [];
}

export function ParticularDeliveryForm({ agency }: { agency: Agency }) {
  const [step, setStep] = useState(1);
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [rememberCustomer, setRememberCustomer] = useState(true);
  const [hasSavedCustomer, setHasSavedCustomer] = useState(false);
  const [customerProfileLoaded, setCustomerProfileLoaded] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>("");
  const [deliveryRole, setDeliveryRole] = useState<DeliveryRole>("");
  const [travelerMode, setTravelerMode] = useState<TravelerMode>("");
  const [travelerName, setTravelerName] = useState("");
  const [travelerPhone, setTravelerPhone] = useState("");
  const [pickup, setPickup] = useState<Point>(emptyPoint);
  const [delivery, setDelivery] = useState<Point>(emptyPoint);
  const [packageDescription, setPackageDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(agency.paymentMethods[0] || "");
  const [paymentReference, setPaymentReference] = useState("");
  const [quote, setQuote] = useState<{ distanceKm: number | null; feeUsd: number | null; label: string } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const requestKeyRef = useRef("");
  const theme = useMemo(
    () => ({ "--agency-primary": agency.primaryColor, "--agency-accent": agency.accentColor }) as React.CSSProperties,
    [agency]
  );

  const requesterRole = serviceType === "delivery" ? deliveryRole : travelerMode === "self" ? "sender" : "receiver";
  const currentTravelerName = travelerMode === "self" ? requesterName : travelerName;
  const currentTravelerPhone = travelerMode === "self" ? requesterPhone : travelerPhone;
  const pickupName = serviceType === "delivery"
    ? deliveryRole === "sender"
      ? requesterName
      : pickup.name
    : currentTravelerName;
  const deliveryName = serviceType === "delivery"
    ? deliveryRole === "receiver"
      ? requesterName
      : delivery.name
    : currentTravelerName;
  const pickupPhone = serviceType === "delivery"
    ? deliveryRole === "sender"
      ? requesterPhone
      : pickup.phone
    : currentTravelerPhone;
  const deliveryPhone = serviceType === "delivery"
    ? deliveryRole === "receiver"
      ? requesterPhone
      : delivery.phone
    : currentTravelerPhone;
  const pickupNameLabel = serviceType === "delivery" && deliveryRole === "receiver" ? "Nombre de quien entrega en retiro" : undefined;
  const deliveryNameLabel = serviceType === "delivery" && deliveryRole === "sender" ? "Nombre de quien recibe en entrega" : undefined;
  const pickupPhoneLabel = serviceType === "delivery" && deliveryRole === "receiver" ? "Telefono de quien entrega en retiro" : undefined;
  const deliveryPhoneLabel = serviceType === "delivery" && deliveryRole === "sender" ? "Telefono de quien recibe en entrega" : undefined;
  const pickupPointLabel = serviceType === "person" ? "Origen" : "Retiro";
  const deliveryPointLabel = serviceType === "person" ? "Destino" : "Entrega";
  const allowPickupCurrent = serviceType === "delivery" ? deliveryRole === "sender" : travelerMode === "self";
  const allowDeliveryCurrent = serviceType === "delivery" ? deliveryRole === "receiver" : false;
  const selectedPaymentLines = paymentLines(paymentMethod, agency.paymentDetails).filter(([, value]) => value);

  useEffect(() => {
    const profile = getCustomerBrowserProfile();
    if (profile) {
      setRequesterName((current) => current || profile.name);
      setRequesterPhone((current) => current || profile.phone);
      setHasSavedCustomer(true);
    }
    setCustomerProfileLoaded(true);
  }, []);

  function selectService(nextType: Exclude<ServiceType, "">) {
    setServiceType(nextType);
    setMessage("");
    setQuote(null);
    if (nextType === "delivery") {
      setTravelerMode("");
      setTravelerName("");
      setTravelerPhone("");
    } else {
      setDeliveryRole("");
      setPackageDescription("");
    }
  }

  function selectDeliveryRole(role: Exclude<DeliveryRole, "">) {
    setDeliveryRole(role);
    setQuote(null);
    if (role === "sender") {
      setPickup((point) => ({ ...point, name: requesterName, phone: requesterPhone }));
    } else {
      setDelivery((point) => ({ ...point, name: requesterName, phone: requesterPhone }));
    }
  }

  function selectTravelerMode(mode: Exclude<TravelerMode, "">) {
    setTravelerMode(mode);
    setQuote(null);
    if (mode === "self") {
      setTravelerName("");
      setTravelerPhone("");
      setPickup((point) => ({ ...point, name: requesterName, phone: requesterPhone }));
      setDelivery((point) => ({ ...point, name: requesterName, phone: requesterPhone }));
    }
  }

  function validatePhone(value: string) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  function validatePoint(point: Point, name: string, contactName: string, phone: string) {
    if (!point.location) {
      setMessage(`Confirma la ubicacion de ${name}.`);
      return false;
    }
    if (!contactName.trim()) {
      setMessage(`Escribe el nombre de ${name}.`);
      return false;
    }
    if (!phone.trim() || !validatePhone(phone)) {
      setMessage(`Revisa el telefono de ${name}.`);
      return false;
    }
    return true;
  }

  function validateFirstStep() {
    if (!serviceType) return "Elige si necesitas Delivery o Traslado de persona.";
    if (!requesterName.trim() || !validatePhone(requesterPhone)) return "Escribe tu nombre y un telefono valido.";
    if (serviceType === "delivery" && !deliveryRole) return "Indica si usted envia o usted recibe.";
    if (serviceType === "person" && !travelerMode) return "Indica si viajas tu o viaja otra persona.";
    if (serviceType === "person" && travelerMode === "other" && (!travelerName.trim() || !validatePhone(travelerPhone))) {
      return "Escribe el nombre y telefono de la persona que viaja.";
    }
    return "";
  }

  function next() {
    setMessage("");
    const firstStepError = step === 1 ? validateFirstStep() : "";
    if (firstStepError) {
      setMessage(firstStepError);
      return;
    }
    if (step === 2 && !validatePoint(pickup, pickupPointLabel.toLowerCase(), pickupName, pickupPhone)) return;
    if (step === 3 && !validatePoint(delivery, deliveryPointLabel.toLowerCase(), deliveryName, deliveryPhone)) return;
    if (step === 3 && serviceType === "delivery" && !packageDescription.trim()) {
      setMessage("Describe brevemente lo que se va a enviar.");
      return;
    }
    setStep((value) => Math.min(4, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === 3) void requestQuote();
  }

  function payload(action: "quote" | "create") {
    if (action === "create" && !requestKeyRef.current) requestKeyRef.current = crypto.randomUUID();
    const detail = serviceType === "person"
      ? `Pasajero: ${currentTravelerName || requesterName}`
      : packageDescription;
    return {
      action,
      requestKey: requestKeyRef.current || undefined,
      requesterName,
      requesterPhone,
      requesterRole,
      serviceType,
      travelerName: serviceType === "person" ? currentTravelerName : undefined,
      travelerPhone: serviceType === "person" ? currentTravelerPhone : undefined,
      pickup: {
        name: pickupName,
        phone: pickupPhone,
        address: pickup.address,
        latitude: pickup.location?.latitude,
        longitude: pickup.location?.longitude,
      },
      delivery: {
        name: deliveryName,
        phone: deliveryPhone,
        address: delivery.address,
        latitude: delivery.location?.latitude,
        longitude: delivery.location?.longitude,
      },
      packageDescription: detail,
      paymentMethod,
      paymentReference,
    };
  }

  async function requestQuote() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/transport/particulares/${agency.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload("quote")),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setQuote(data.quote);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos calcular la tarifa.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!paymentMethod) {
      setMessage("Esta empresa delivery aun debe configurar sus metodos de pago.");
      return;
    }
    if (getPaymentDetailsKey(paymentMethod) === "pagoMovil" && !paymentReference.trim()) {
      setMessage("Escribe la referencia del pago movil.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/transport/particulares/${agency.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload("create")),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (rememberCustomer) {
        const saved = saveCustomerBrowserProfile(requesterName, requesterPhone);
        setHasSavedCustomer(saved);
      } else {
        clearCustomerBrowserProfile();
        setHasSavedCustomer(false);
      }
      setMessage(`Solicitud ${data.code} registrada. Abriendo WhatsApp...`);
      if (data.whatsappUrl) window.location.assign(data.whatsappUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos registrar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  async function copyValue(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  }

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top,#e8eef4_0,#f8fafc_48%,#eef2f6_100%)] px-3 py-4 text-slate-900 sm:py-8"
      style={theme}
    >
      <section className="mx-auto max-w-lg overflow-hidden rounded-[30px] bg-white shadow-[0_24px_70px_-30px_rgba(15,23,42,.42)] ring-1 ring-slate-900/5">
        <header className="relative overflow-hidden px-5 py-6 text-white sm:px-7" style={{ backgroundColor: agency.primaryColor }}>
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 right-14 h-32 w-32 rounded-full bg-black/10" />
          <div className="relative flex items-center gap-4">
            <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-[20px] bg-white shadow-lg shadow-black/15 ring-1 ring-white/40">
              {agency.logoUrl ? (
                <OptimizedImage src={agency.logoUrl} alt={agency.name} width={144} height={144} sizes="72px" className="h-full w-full object-cover object-center" />
              ) : (
                <span className="text-xl font-black" style={{ color: agency.primaryColor }}>{agency.name[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">Servicios para particulares</p>
              <h1 className="mt-0.5 break-words text-2xl font-black leading-tight">{agency.name}</h1>
              {agency.location ? (
                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-white/75">
                  <MapPin size={13} />
                  {agency.location}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-1 px-5 pt-5">
          {["Inicio", "Origen", "Destino", "Resumen"].map((label, index) => (
            <div key={label} className="text-center">
              <span
                className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-xs font-black ${step >= index + 1 ? "text-white" : "bg-slate-100 text-slate-400"}`}
                style={step >= index + 1 ? { backgroundColor: agency.accentColor } : undefined}
              >
                {step > index + 1 ? <Check size={14} /> : index + 1}
              </span>
              <p className="mt-1 text-[10px] font-bold text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-5 p-5">
          {step === 1 ? (
            <>
              <div>
                <h2 className="text-2xl font-black">Que necesitas?</h2>
                <p className="mt-1 text-sm text-slate-500">Elige primero el tipo de servicio. Despues te pediremos solo los datos que aplican.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => selectService("delivery")} className={`rounded-2xl border p-4 text-left font-black ${serviceType === "delivery" ? "text-white" : "bg-white"}`} style={serviceType === "delivery" ? { backgroundColor: agency.primaryColor } : undefined}>
                  <Bike className="mb-2" />
                  Delivery
                  <span className="mt-1 block text-xs font-semibold opacity-75">Enviar o recibir paquetes.</span>
                </button>
                <button type="button" onClick={() => selectService("person")} className={`rounded-2xl border p-4 text-left font-black ${serviceType === "person" ? "text-white" : "bg-white"}`} style={serviceType === "person" ? { backgroundColor: agency.primaryColor } : undefined}>
                  <UsersRound className="mb-2" />
                  Traslado de persona
                  <span className="mt-1 block text-xs font-semibold opacity-75">Para ti o para otra persona.</span>
                </button>
              </div>

              {serviceType ? (
                <div className="space-y-4 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <h3 className="text-lg font-black">Tus datos</h3>
                    <p className="text-xs font-semibold text-slate-500">Los usamos para confirmar la solicitud por WhatsApp.</p>
                  </div>
                  <label className="block text-sm font-black">
                    Nombre
                    <input className={inputClass} value={requesterName} onChange={(event) => setRequesterName(event.target.value)} />
                  </label>
                  <label className="block text-sm font-black">
                    Telefono
                    <input className={inputClass} type="tel" value={requesterPhone} onChange={(event) => setRequesterPhone(event.target.value)} />
                  </label>
                  {customerProfileLoaded ? (
                    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={rememberCustomer}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setRememberCustomer(checked);
                            if (!checked && hasSavedCustomer) {
                              clearCustomerBrowserProfile();
                              setHasSavedCustomer(false);
                            }
                          }}
                          className="mt-1 h-4 w-4 accent-[var(--agency-primary)]"
                        />
                        <span className="text-sm font-bold leading-relaxed text-slate-600">
                          Recordar mis datos para proximas solicitudes.
                        </span>
                      </label>
                      {hasSavedCustomer ? (
                        <p className="mt-2 flex items-center gap-2 text-xs font-black" style={{ color: agency.primaryColor }}>
                          <ShieldCheck size={15} />
                          Datos anteriores cargados. Puedes editarlos.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {serviceType === "delivery" ? (
                    <div>
                      <p className="mb-2 text-sm font-black">En este delivery...</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => selectDeliveryRole("sender")} className={`rounded-2xl border p-4 font-black ${deliveryRole === "sender" ? "text-white" : "bg-white"}`} style={deliveryRole === "sender" ? { backgroundColor: agency.primaryColor } : undefined}>
                          <Send className="mx-auto mb-2" />
                          Usted envia
                        </button>
                        <button type="button" onClick={() => selectDeliveryRole("receiver")} className={`rounded-2xl border p-4 font-black ${deliveryRole === "receiver" ? "text-white" : "bg-white"}`} style={deliveryRole === "receiver" ? { backgroundColor: agency.primaryColor } : undefined}>
                          <Package className="mx-auto mb-2" />
                          Usted recibe
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {serviceType === "person" ? (
                    <div>
                      <p className="mb-2 text-sm font-black">Quien viaja?</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => selectTravelerMode("self")} className={`rounded-2xl border p-4 font-black ${travelerMode === "self" ? "text-white" : "bg-white"}`} style={travelerMode === "self" ? { backgroundColor: agency.primaryColor } : undefined}>
                          <UserRound className="mx-auto mb-2" />
                          Viajo yo
                        </button>
                        <button type="button" onClick={() => selectTravelerMode("other")} className={`rounded-2xl border p-4 font-black ${travelerMode === "other" ? "text-white" : "bg-white"}`} style={travelerMode === "other" ? { backgroundColor: agency.primaryColor } : undefined}>
                          <UsersRound className="mx-auto mb-2" />
                          Viaja otra persona
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {serviceType === "person" && travelerMode === "other" ? (
                    <div className="grid gap-3 rounded-2xl bg-white p-3">
                      <p className="text-sm font-black">Datos de la persona que viaja</p>
                      <label className="block text-sm font-black">
                        Nombre del pasajero
                        <input className={inputClass} value={travelerName} onChange={(event) => setTravelerName(event.target.value)} />
                      </label>
                      <label className="block text-sm font-black">
                        Telefono del pasajero
                        <input className={inputClass} type="tel" value={travelerPhone} onChange={(event) => setTravelerPhone(event.target.value)} />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div>
                <h2 className="text-2xl font-black">Punto de origen</h2>
                <p className="mt-1 text-sm text-slate-500">{serviceType === "person" ? "Indica donde debe buscarse a la persona." : "Indica donde retiramos el paquete."}</p>
              </div>
              <PointFields
                key="pickup-fields"
                value={pickup}
                setValue={setPickup}
                name={pickupPointLabel}
                mode="store"
                agencyName={agency.name}
                noteLabel={`Direccion, referencia o nota de ${pickupPointLabel.toLowerCase()}`}
                nameLabel={pickupNameLabel}
                phoneLabel={pickupPhoneLabel}
                allowCurrentLocation={allowPickupCurrent}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div>
                <h2 className="text-2xl font-black">Punto de destino</h2>
                <p className="mt-1 text-sm text-slate-500">{serviceType === "person" ? "Indica a donde debe llegar la persona." : "Indica donde entregamos el paquete."}</p>
              </div>
              <PointFields
                key="delivery-fields"
                value={delivery}
                setValue={setDelivery}
                name={deliveryPointLabel}
                mode="delivery"
                agencyName={agency.name}
                noteLabel={`Direccion, referencia o nota de ${deliveryPointLabel.toLowerCase()}`}
                nameLabel={deliveryNameLabel}
                phoneLabel={deliveryPhoneLabel}
                referenceMarkerLabel={serviceType === "person" ? "Origen" : undefined}
                referencePopupLabel={serviceType === "person" ? "Punto de origen" : undefined}
                allowCurrentLocation={allowDeliveryCurrent}
              />
              {serviceType === "delivery" ? (
                <label className="block text-sm font-black">
                  Que trasladamos?
                  <textarea className={inputClass} rows={3} value={packageDescription} onChange={(event) => setPackageDescription(event.target.value)} placeholder="Ej: caja pequena, documentos..." />
                </label>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div>
                <MapPin />
                <h2 className="mt-2 text-2xl font-black">Revisa tu solicitud</h2>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 text-sm">
                <p><b>Servicio:</b> {serviceTitle(serviceType)}</p>
                {serviceType === "person" ? <p className="mt-2"><b>Pasajero:</b> {currentTravelerName}</p> : null}
                <p className="mt-2"><b>{pickupPointLabel}:</b> {pickup.address || "Ubicacion marcada en el mapa"}</p>
                <p className="mt-2"><b>{deliveryPointLabel}:</b> {delivery.address || "Ubicacion marcada en el mapa"}</p>
                {serviceType === "delivery" ? <p className="mt-2"><b>Paquete:</b> {packageDescription}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Distancia</p>
                  <p className="font-black">{loading ? "Calculando..." : quote?.distanceKm != null ? `${quote.distanceKm.toFixed(2)} km` : "Por confirmar"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Tarifa</p>
                  <p className="font-black">{quote?.feeUsd != null ? `$${quote.feeUsd.toFixed(2)}` : "Por confirmar"}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-black">Metodo de pago</p>
                {agency.paymentMethods.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {agency.paymentMethods.map((payment) => (
                      <button
                        type="button"
                        key={payment}
                        onClick={() => {
                          setPaymentMethod(payment);
                          if (payment === "Efectivo") setPaymentReference("");
                        }}
                        className={`rounded-2xl border p-3 text-center text-sm font-black transition ${paymentMethod === payment ? "text-white shadow-md" : "bg-white text-slate-700"}`}
                        style={paymentMethod === payment ? { backgroundColor: agency.primaryColor } : undefined}
                      >
                        {payment}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
                    La empresa confirmara el metodo de pago antes de aceptar el servicio.
                  </p>
                )}
              </div>
              {selectedPaymentLines.length ? (
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="font-black text-emerald-900">Datos para pagar</p>
                  <div className="mt-2 space-y-2">
                    {selectedPaymentLines.map(([label, value]) => (
                      <button type="button" key={label} onClick={() => copyValue(label, value)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left text-sm">
                        <span><b>{label}:</b> {value}</span>
                        <span className="shrink-0 text-emerald-700">{copied === label ? <Check size={16} /> : <Copy size={16} />}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {getPaymentDetailsKey(paymentMethod) === "pagoMovil" ? (
                <label className="block text-sm font-black">
                  Referencia del pago movil
                  <input className={inputClass} inputMode="numeric" maxLength={40} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Ej: 123456" />
                </label>
              ) : null}
            </>
          ) : null}

          {message ? <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{message}</p> : null}
          <div className="flex gap-3">
            {step > 1 ? (
              <button type="button" onClick={() => setStep((value) => value - 1)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 font-black">
                <ArrowLeft size={18} />
                Atras
              </button>
            ) : null}
            <button type="button" disabled={loading || (step === 4 && !paymentMethod)} onClick={step === 4 ? submit : next} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-black text-white disabled:opacity-60" style={{ backgroundColor: agency.accentColor }}>
              {step === 4 ? "Registrar y enviar" : "Continuar"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
