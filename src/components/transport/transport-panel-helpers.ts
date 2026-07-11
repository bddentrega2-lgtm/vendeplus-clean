export type Agency = {
  id: string;
  name: string;
  status: string;
  pricing_type: string;
  modality: string;
  rates_visibility?: "public" | "private" | string | null;
  logo_url?: string;
  legal_name?: string;
  rif?: string;
  contact_name?: string;
  city?: string;
  state?: string;
  contact_email?: string;
  contact_phone?: string;
  whatsapp_phone?: string;
  coverage_notes?: string;
  capacity_dimensions_cm?: string;
  capacity_weight_kg?: number | string | null;
  max_wait_time_minutes?: number | string | null;
  charges_cash_return?: boolean;
  cash_return_fee_usd?: number | string | null;
  billing_currency?: "USD" | "EUR" | string | null;
  payment_terms?: string;
  credit_terms?: string;
  additional_conditions?: string;
  transport_agency_rates?: any[] | any;
  transport_agency_zones?: any[];
  transport_agency_distance_rates?: any[];
};

export type PricingType = "flat" | "distance_ranges" | "zones" | "manual";

export type PanelCache = {
  agencies: Agency[];
  requests: any[];
  connections: any[];
  billing: any;
  hasSession: boolean;
};

export const panelNavItems = [
  { key: "resumen", label: "Resumen", href: "/transporte/panel" },
  { key: "pedidos", label: "Pedidos", href: "/transporte/panel/pedidos" },
  { key: "tarifas", label: "Tarifas", href: "/transporte/panel/tarifas" },
  { key: "configuracion", label: "Configuracion", href: "/transporte/panel/configuracion" },
  { key: "solicitudes", label: "Solicitudes", href: "/transporte/panel/solicitudes" },
  { key: "comercios", label: "Comercios", href: "/transporte/panel/comercios" },
  { key: "facturacion", label: "Facturacion", href: "/transporte/panel/facturacion" },
];

export const transportStatusLabels: Record<string, string> = {
  pending_agency: "Pendiente por empresa delivery",
  sent_to_agency: "Enviado a empresa delivery",
  agency_received: "Recibido por empresa delivery",
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

export function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function connectionEnded(connection: any, nowMs: number) {
  return Boolean(
    connection?.disengagement_confirmed_at &&
      connection?.disengagement_effective_at &&
      nowMs > 0 &&
      new Date(connection.disengagement_effective_at).getTime() <= nowMs
  );
}

export function connectionPendingExit(connection: any, nowMs: number) {
  return Boolean(connection?.disengagement_requested_at && !connectionEnded(connection, nowMs));
}

export function relationshipModeLabel(isExclusive: boolean) {
  return isExclusive ? "Exclusiva" : "Mixta";
}
