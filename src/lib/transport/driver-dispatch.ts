export type TransportDriver = {
  id: string;
  agency_id: string;
  name: string;
  phone?: string | null;
  document_number?: string | null;
  commission_percent: number | string;
  is_active?: boolean | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function cleanDriverText(value: unknown, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

export function normalizeCommissionPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 60;
  return Math.min(100, Math.max(0, Number(parsed.toFixed(2))));
}

export function calculateDriverPayout(deliveryFeeUsd: unknown, commissionPercent: unknown) {
  const fee = Number(deliveryFeeUsd || 0);
  const percent = normalizeCommissionPercent(commissionPercent);
  if (!Number.isFinite(fee) || fee <= 0 || percent <= 0) return 0;
  return Number(((fee * percent) / 100).toFixed(2));
}

export function isPremiumDispatchSchemaMissing(error: any) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  return (
    code === "42703" ||
    code === "42P01" ||
    /premium_dispatch_enabled|driver_whatsapp_dispatch_enabled|transport_drivers|document_number|driver_id|driver_payout_usd/i.test(message)
  );
}
