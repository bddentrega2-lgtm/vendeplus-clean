import { useMemo } from "react";

export type OrderFilters = {
  status: string;
  paymentStatus: string;
  date: string;
  paymentMethod: string;
  deliveryType: string;
};

export function buildOrdersQueryString(filters: OrderFilters) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.paymentStatus !== "all") params.set("paymentStatus", filters.paymentStatus);
  if (filters.date !== "all") params.set("date", filters.date);
  if (filters.paymentMethod !== "all") params.set("paymentMethod", filters.paymentMethod);
  if (filters.deliveryType !== "all") params.set("deliveryType", filters.deliveryType);

  return params.toString() ? `?${params.toString()}` : "";
}

export function useOrderFilters(filters: OrderFilters) {
  const { status, paymentStatus, date, paymentMethod, deliveryType } = filters;

  const currentFilters = useMemo(
    () => ({ status, paymentStatus, date, paymentMethod, deliveryType }),
    [status, paymentStatus, date, paymentMethod, deliveryType]
  );

  const filterSignature = useMemo(
    () => JSON.stringify(currentFilters),
    [currentFilters]
  );

  return { currentFilters, filterSignature };
}
