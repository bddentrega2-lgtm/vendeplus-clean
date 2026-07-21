import { useMemo } from "react";

export type OrderFilters = {
  status: string;
  paymentStatus: string;
  date: string;
  paymentMethod: string;
  deliveryType: string;
  search: string;
};

export function buildOrdersQueryString(
  filters: OrderFilters,
  options: { compact?: boolean; limit?: number; offset?: number } = {}
) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.paymentStatus !== "all") params.set("paymentStatus", filters.paymentStatus);
  if (filters.date !== "all") params.set("date", filters.date);
  if (filters.paymentMethod !== "all") params.set("paymentMethod", filters.paymentMethod);
  if (filters.deliveryType !== "all") params.set("deliveryType", filters.deliveryType);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (options.compact) params.set("compact", "true");
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));

  return params.toString() ? `?${params.toString()}` : "";
}

export function useOrderFilters(filters: OrderFilters) {
  const { status, paymentStatus, date, paymentMethod, deliveryType, search } = filters;

  const currentFilters = useMemo(
    () => ({ status, paymentStatus, date, paymentMethod, deliveryType, search }),
    [status, paymentStatus, date, paymentMethod, deliveryType, search]
  );

  const filterSignature = useMemo(
    () => JSON.stringify(currentFilters),
    [currentFilters]
  );

  return { currentFilters, filterSignature };
}
