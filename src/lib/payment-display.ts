import type { OrderTotals, Store } from "@/types";
import { formatBs, formatUsd } from "@/lib/currency";
import { getPaymentDetailsKey } from "@/lib/payments";

export type PaymentDisplayLine = {
  label: string;
  value: string;
  copyable?: boolean;
};

export type PaymentDisplayInfo = {
  title: string;
  key: ReturnType<typeof getPaymentDetailsKey>;
  lines: PaymentDisplayLine[];
  help: string;
  copyText: string;
  hasConfiguredData: boolean;
};

function cleanValue(value: unknown) {
  return String(value || "").trim();
}

function firstValue(source: Record<string, any> | undefined, keys: string[]) {
  if (!source) return "";

  for (const key of keys) {
    const value = cleanValue(source[key]);
    if (value) return value;
  }

  return "";
}

function addLine(
  lines: PaymentDisplayLine[],
  label: string,
  value: unknown,
  copyable = false
) {
  const clean = cleanValue(value);
  if (clean) lines.push({ label, value: clean, copyable });
}

export function buildPaymentInfo({
  store,
  paymentMethod,
  totals,
  orderId,
  customerPaymentNote,
  paymentReference,
}: {
  store: Store;
  paymentMethod: string;
  totals: OrderTotals;
  orderId?: string;
  customerPaymentNote?: string;
  paymentReference?: string;
}): PaymentDisplayInfo {
  const method = paymentMethod || "Pago";
  const key = getPaymentDetailsKey(method);
  const details = (store.paymentDetails || {}) as Record<string, any>;
  const exchangeRate =
    store.usdToBs || totals.totalBs / Math.max(totals.totalUsd, 1);
  const lines: PaymentDisplayLine[] = [];
  let help = "Después de pagar, envía la referencia o captura al comercio por WhatsApp.";

  if (key === "pagoMovil") {
    const data = details.pagoMovil || {};
    addLine(lines, "Banco", firstValue(data, ["bank", "banco"]));
    addLine(lines, "Telefono", firstValue(data, ["phone", "telefono", "teléfono", "number"]), true);
    addLine(lines, "Cedula/RIF", firstValue(data, ["idNumber", "cedula", "cédula", "rif", "document", "documento"]), true);
    addLine(lines, "Titular", firstValue(data, ["holder", "titular", "name", "nombre"]));
    addLine(lines, "Monto", formatBs(totals.totalBs));
    addLine(lines, "Tasa usada", formatBs(exchangeRate));
  } else if (key === "transferencia") {
    const data = details.transferencia || {};
    addLine(lines, "Banco", firstValue(data, ["bank", "banco"]));
    addLine(lines, "Cuenta", firstValue(data, ["accountNumber", "cuenta", "account", "numeroCuenta"]));
    addLine(lines, "Cedula/RIF", firstValue(data, ["idNumber", "cedula", "cédula", "rif", "document", "documento"]));
    addLine(lines, "Titular", firstValue(data, ["holder", "titular", "name", "nombre"]));
    addLine(lines, "Monto", formatBs(totals.totalBs));
    addLine(lines, "Tasa usada", formatBs(exchangeRate));
  } else if (key === "zelle") {
    const data = details.zelle || {};
    addLine(lines, "Correo", firstValue(data, ["contact", "email", "correo", "phone", "telefono"]), true);
    addLine(lines, "Titular", firstValue(data, ["holder", "titular", "name", "nombre"]));
    addLine(lines, "Monto", formatUsd(totals.totalUsd));
  } else if (key === "binance") {
    const data = details.binance || {};
    addLine(lines, "Correo", firstValue(data, ["contact", "email", "correo", "binancePayId", "payId", "id", "binance"]), true);
    addLine(lines, "Titular", firstValue(data, ["holder", "titular", "name", "nombre"]));
    addLine(lines, "Monto", formatUsd(totals.totalUsd));
  } else if (key === "efectivo") {
    const data = details.efectivo || {};
    addLine(lines, "Nota", firstValue(data, ["note", "nota"]));
    addLine(lines, "Como va a cancelar", customerPaymentNote);
    addLine(lines, "Total", `${formatUsd(totals.totalUsd)} / ${formatBs(totals.totalBs)}`);
    help = "Pago en efectivo al retirar o recibir.";
  }

  addLine(lines, "Referencia", paymentReference);

  const hasConfiguredData =
    key === "efectivo"
      ? Boolean(details.efectivo?.note || customerPaymentNote)
      : lines.some((line) => !["Monto", "Tasa usada", "Total", "Referencia"].includes(line.label));

  const copyLines = [
    method,
    ...lines.map((line) => `${line.label}: ${line.value}`),
    orderId ? "" : null,
    orderId ? `Pedido: ${orderId}` : null,
    hasConfiguredData
      ? "Por favor envía la referencia o captura por WhatsApp."
      : "El comercio confirmará los datos de pago por WhatsApp.",
  ];

  return {
    title: method,
    key,
    lines,
    help: hasConfiguredData ? help : "El comercio te confirmará los datos de pago por WhatsApp.",
    copyText: copyLines.filter(Boolean).join("\n"),
    hasConfiguredData,
  };
}
