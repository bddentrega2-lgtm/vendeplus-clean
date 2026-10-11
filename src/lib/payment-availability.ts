export const PAYMENT_CHANNELS = ["delivery", "pickup", "table", "bar"] as const;
export type PaymentChannel = typeof PAYMENT_CHANNELS[number];
export type PaymentAvailability = Record<string, PaymentChannel[]>;

export function paymentAvailability(details: unknown): PaymentAvailability | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = (details as Record<string, unknown>).availability;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PaymentAvailability;
}

export function methodsForChannel(
  methods: unknown,
  details: unknown,
  channel: PaymentChannel,
  legacyTableMethods: unknown = [],
): string[] {
  const generalMethods = Array.isArray(methods) ? methods : [];
  const tableMethods = Array.isArray(legacyTableMethods) ? legacyTableMethods : [];
  const registered = [...new Set([
    ...(Array.isArray(methods) ? methods.filter((method): method is string => typeof method === "string") : []),
    ...tableMethods.filter((method): method is string => typeof method === "string"),
  ])];
  const availability = paymentAvailability(details);
  return registered.filter((method) => {
    const explicit = availability?.[method];
    if (Array.isArray(explicit)) return explicit.includes(channel);
    return channel === "table" || channel === "bar" ? tableMethods.includes(method) : generalMethods.includes(method);
  });
}

export function initialPaymentAvailability(generalMethods: string[], tableMethods: string[]): PaymentAvailability {
  return Object.fromEntries([...new Set([...generalMethods, ...tableMethods])].map((method) => [method, [
    ...(generalMethods.includes(method) ? ["delivery", "pickup"] : []),
    ...(tableMethods.includes(method) ? ["table", "bar"] : []),
  ]])) as PaymentAvailability;
}

export function normalizePaymentAvailability(value: unknown, methods: string[], allowTable: boolean): PaymentAvailability | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(methods.map((method) => {
    const selected = source[method];
    return [method, Array.isArray(selected)
      ? PAYMENT_CHANNELS.filter((channel) => (allowTable || (channel !== "table" && channel !== "bar")) && selected.includes(channel))
      : []];
  })) as PaymentAvailability;
}
