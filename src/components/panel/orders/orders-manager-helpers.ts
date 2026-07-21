import { formatBs, formatUsd } from "@/lib/currency";
import {
  getPaymentDetailsKey,
  paymentStatusLabels,
  type PaymentStatus,
} from "@/lib/payments";
import { getPanelAuthHeaders } from "@/lib/panel/client-auth";
import { formatVenezuelaDateTime } from "@/lib/time/venezuela";

export type OrderItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_usd: number | string;
  total_usd: number | string;
  notes: string | null;
  order_item_options?: Array<{
    id: string;
    option_group_name: string;
    option_name: string;
    price_delta_usd: number | string;
    quantity: number | string;
  }>;
};

export type TransportOrderSummary = {
  id: string;
  agency_id: string;
  agency_name_snapshot: string | null;
  agency_whatsapp_snapshot: string | null;
  status: string;
  delivery_fee_usd: number | string | null;
  agency_status_note: string | null;
  rejection_reason: string | null;
  updated_at: string | null;
  transport_order_events?: Array<{
    id: string;
    event_type: string;
    status_from: string | null;
    status_to: string | null;
    note: string | null;
    actor_type: string;
    actor_name: string | null;
    created_at: string;
  }>;
};

export type OrderIntegration = {
  provider: string;
  external_id: string | null;
  status: string;
  last_error: string | null;
  updated_at: string | null;
};

export type OrderRow = {
  id: string;
  public_code: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_type: "delivery" | "pickup";
  payment_method: string;
  payment_status: PaymentStatus | string | null;
  payment_reference: string | null;
  payment_currency: string | null;
  amount_paid: number | string | null;
  payment_verified_at: string | null;
  payment_notes: string | null;
  payment_bank: string | null;
  payment_verified_by: string | null;
  subtotal_usd: number | string;
  delivery_usd: number | string;
  delivery_provider?: string | null;
  delivery_fee_usd?: number | string | null;
  delivery_zone_id?: string | null;
  delivery_zone_name?: string | null;
  delivery_distance_km?: number | string | null;
  delivery_pricing_type?: string | null;
  delivery_status?: string | null;
  delivery_notes?: string | null;
  delivery_address?: string | null;
  transport_agency_id?: string | null;
  transport_agency_name?: string | null;
  transport_agency_fee_usd?: number | string | null;
  transport_agency_status?: string | null;
  total_usd: number | string;
  total_bs: number | string;
  distance_km: number | string | null;
  delivery_lat: number | string | null;
  delivery_lng: number | string | null;
  delivery_reference: string | null;
  order_details: string | null;
  notes: string | null;
  status: string;
  whatsapp_message: string | null;
  created_at: string;
  stores?: {
    name?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
    usd_to_bs?: number | string | null;
    payment_details?: Record<string, any> | null;
  } | null;
  customers?: {
    id?: string;
    orders_count?: number | string | null;
    total_spent_usd?: number | string | null;
  } | null;
  order_items?: OrderItem[];
  order_integrations?: OrderIntegration[];
  transport_orders?: TransportOrderSummary[];
};

export const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "received", label: "Nuevos" },
  { value: "accepted", label: "Aceptados" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listos" },
  { value: "delivering", label: "En camino" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" },
];

export const paymentStatusOptions = [
  { value: "all", label: "Todos los pagos" },
  { value: "pending", label: "Pago pendiente" },
  { value: "review", label: "En revisión" },
  { value: "verified", label: "Verificado" },
  { value: "incomplete", label: "Incompleto" },
  { value: "cash_on_delivery", label: "Pago al recibir" },
];

export const paymentStatusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  review: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
  incomplete: "bg-red-100 text-red-700",
  cash_on_delivery: "bg-[#F8F3E8] text-[#2E3A79]",
  cancelled: "bg-zinc-100 text-zinc-600",
};

export const entrega2StatusLabels: Record<string, string> = {
  sending: "Enviando",
  sent: "Enviado",
  accepted: "Aceptado",
  assigned: "Asignado",
  delivering: "En camino",
  delivered: "Entregado",
  completed: "Completado",
  error: "Error",
  failed: "Error",
};

export const entrega2StatusStyles: Record<string, string> = {
  sending: "bg-blue-100 text-blue-700",
  sent: "bg-indigo-100 text-indigo-700",
  accepted: "bg-indigo-100 text-indigo-700",
  assigned: "bg-indigo-100 text-indigo-700",
  delivering: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

export const transportStatusLabels: Record<string, string> = {
  pending_agency: "Pendiente por empresa delivery",
  sent_to_agency: "Enviado",
  agency_received: "Recibido",
  agency_accepted: "Aceptado",
  agency_rejected: "Rechazado",
  driver_assigned: "Repartidor asignado",
  pickup_pending: "Pendiente por retirar",
  picked_up: "Retirado",
  on_the_way: "En camino",
  delivered: "Entregado",
  delivery_failed: "Fallido",
  issue_reported: "Novedad",
  cancelled: "Cancelado",
};

export const dateOptions = [
  { value: "today", label: "Hoy" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "all", label: "Todas las fechas" },
];

export function formatDate(value: string) {
  return formatVenezuelaDateTime(value);
}

export function formatOrderAge(value: string, now: number) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "";

  const minutes = Math.max(0, Math.floor((now - createdAt) / 60000));
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

export function getGpsUrl(order: OrderRow) {
  if (!order.delivery_lat || !order.delivery_lng) return null;
  return `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`;
}

export function getRouteUrl(order: OrderRow) {
  if (
    !order.delivery_lat ||
    !order.delivery_lng ||
    !order.stores?.latitude ||
    !order.stores?.longitude
  ) {
    return null;
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${order.stores.latitude},${order.stores.longitude}&destination=${order.delivery_lat},${order.delivery_lng}&travelmode=driving`;
}

export function getWhatsappUrl(phone: string) {
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}`;
}

export function getWhatsappMessageUrl(phone: string, message: string) {
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function getOrderPaymentStatus(order: OrderRow) {
  return order.payment_status || "pending";
}

export function getPaymentStatusLabel(status: string | null | undefined) {
  const key = (status || "pending") as PaymentStatus;
  return paymentStatusLabels[key] || "Pago pendiente";
}

export function getPaymentDetailsLines(order: OrderRow) {
  const key = getPaymentDetailsKey(order.payment_method);
  const details = order.stores?.payment_details || {};
  const source = key ? details[key] || {} : {};

  if (!key) return [];

  if (key === "pagoMovil") {
    return [
      ["Banco", source.bank],
      ["Teléfono", source.phone],
      ["Cédula/RIF", source.idNumber],
      ["Titular", source.holder],
    ];
  }

  if (key === "transferencia") {
    return [
      ["Banco", source.bank],
      ["Cuenta", source.accountNumber],
      ["Cédula/RIF", source.idNumber],
      ["Titular", source.holder],
    ];
  }

  if (key === "zelle") {
    return [
      ["Contacto", source.contact],
      ["Titular", source.holder],
    ];
  }

  if (key === "binance") {
    return [
      ["Binance", source.contact],
      ["Titular", source.holder],
    ];
  }

  if (key === "efectivo") {
    return [["Nota", source.note]];
  }

  return [];
}

export function buildPaymentDataText(order: OrderRow) {
  const lines = [
    `Pedido: ${order.public_code}`,
    `Cliente: ${order.customer_name}`,
    `Método: ${order.payment_method || "Sin método"}`,
    `Total USD: ${formatUsd(Number(order.total_usd || 0))}`,
    `Total Bs: ${formatBs(Number(order.total_bs || 0))}`,
    "",
    "Datos de pago:",
    ...getPaymentDetailsLines(order)
      .map(([label, value]) => [label, String(value || "").trim()] as const)
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => `${label}: ${value}`),
  ];

  return lines.filter(Boolean).join("\n");
}

export function getEntrega2Integration(order: OrderRow) {
  return (order.order_integrations || []).find(
    (integration) => integration.provider === "entrega2"
  );
}

export function getTransportAgencyIntegration(order: OrderRow) {
  return (order.order_integrations || []).find(
    (integration) => integration.provider === "transport_agency"
  );
}

export function getCurrentTransportOrder(order: OrderRow) {
  return (order.transport_orders || [])[0] || null;
}

export function isOrderCancelled(order: Pick<OrderRow, "status">) {
  return ["cancelled", "canceled", "cancelado"].includes(
    String(order.status || "").toLowerCase()
  );
}

export function canSendToEntrega2(order: OrderRow) {
  const integration = getEntrega2Integration(order);

  if (isOrderCancelled(order)) return false;
  if (order.delivery_type !== "delivery") return false;
  if (order.delivery_provider !== "entrega2") return false;
  if (!integration) return true;

  return ["error", "failed"].includes(integration.status);
}

export function canSendToTransportAgency(order: OrderRow) {
  const integration = getTransportAgencyIntegration(order);
  const transportOrder = getCurrentTransportOrder(order);

  if (isOrderCancelled(order)) return false;
  if (order.delivery_type !== "delivery") return false;
  if (order.delivery_provider !== "transport_agency") return false;
  if (!order.transport_agency_id) return false;
  if (transportOrder && !["agency_rejected", "cancelled", "delivery_failed"].includes(transportOrder.status)) {
    return false;
  }
  if (!integration) return true;

  return ["error", "failed"].includes(integration.status);
}

export function hasActiveTransportAgencyHandoff(order: OrderRow) {
  if (order.delivery_provider !== "transport_agency") return false;

  const integration = getTransportAgencyIntegration(order);
  const transportOrder = getCurrentTransportOrder(order);
  const status = transportOrder?.status || integration?.status || order.transport_agency_status || "";

  return Boolean(
    status &&
      ![
        "pending",
        "pending_agency",
        "agency_rejected",
        "cancelled",
        "delivery_failed",
        "error",
        "failed",
      ].includes(status)
  );
}

export function isDeliveryAlreadyDelivered(order: OrderRow) {
  const entrega2Integration = getEntrega2Integration(order);
  const transportAgencyIntegration = getTransportAgencyIntegration(order);
  const transportOrder = getCurrentTransportOrder(order);

  return (
    order.delivery_status === "delivered" ||
    order.transport_agency_status === "delivered" ||
    ["delivered", "completed"].includes(entrega2Integration?.status || "") ||
    ["delivered", "completed"].includes(transportAgencyIntegration?.status || "") ||
    transportOrder?.status === "delivered"
  );
}

export function getStatusOptionsForOrder(order: OrderRow) {
  const cannotCancel = isDeliveryAlreadyDelivered(order);
  return statusOptions.filter(
    (item) => item.value !== "all" && (!cannotCancel || item.value !== "cancelled")
  );
}

export function getDeliverySummary(order: OrderRow) {
  if (order.delivery_type === "pickup") return "Retiro";
  if (order.delivery_zone_name) return `Delivery · ${order.delivery_zone_name}`;
  if (order.delivery_provider === "entrega2") return "Delivery · Entrega2 App";
  if (order.delivery_provider === "transport_agency") {
    return `Delivery - ${order.transport_agency_name || "Empresa delivery"}`;
  }
  if (order.delivery_provider === "manual_quote") return "Delivery · cotizar";
  return "Delivery";
}

export function groupOrderItemOptions(item: OrderItem) {
  const groups = new Map<string, Array<{ name: string; price: number }>>();

  for (const option of item.order_item_options || []) {
    const current = groups.get(option.option_group_name) || [];
    current.push({
      name: option.option_name,
      price: Number(option.price_delta_usd || 0),
    });
    groups.set(option.option_group_name, current);
  }

  return Array.from(groups.entries()).map(([groupName, options]) => ({
    groupName,
    options,
  }));
}

export async function apiRequest(pin: string, url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud.");
  }

  return data;
}
