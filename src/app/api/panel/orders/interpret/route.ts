import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";

const INTERPRET_LIMIT = 20;
const INTERPRET_RATE_WINDOW_MS = 10 * 60 * 1000;

type ProductRow = {
  id: string;
  name: string;
  price_usd: number | string;
  is_available: boolean;
};

type InterpretationItem = {
  productId: string;
  quantity: number;
  notes: string;
  confidence: number;
};

type ManualOrderInterpretation = {
  customerName: string;
  customerPhone: string;
  deliveryReference: string;
  orderDetails: string;
  deliveryType: "delivery" | "pickup";
  paymentMethod: string;
  deliveryUsd: number;
  items: InterpretationItem[];
  warnings: string[];
  confidence: number;
};

const fallbackPaymentMethods = [
  "Pago movil",
  "Transferencia",
  "Efectivo",
  "Binance",
  "Zelle",
  "Otro",
];

const MAX_INTERPRET_BODY_BYTES = 40_000;
const MAX_INTERPRET_MESSAGE_LENGTH = 6_000;
const OPENAI_TIMEOUT_MS = 12_000;
const DEFAULT_OPENAI_ORDER_MODEL = "gpt-5.4-mini";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string) {
  const match = value.match(/(?:\+?58|0)?4\d{9}/);
  if (!match) return "";

  const digits = match[0].replace(/\D/g, "");
  if (digits.startsWith("58")) return digits;
  if (digits.startsWith("0")) return `58${digits.slice(1)}`;
  return digits.length === 10 ? `58${digits}` : digits;
}

function findName(message: string) {
  const patterns = [
    /\b(?:soy|me llamo|mi nombre es)\s+([a-z\s]{2,50})/i,
    /\b(?:cliente|nombre)\s*[:\-]\s*([a-z\s]{2,50})/i,
  ];

  for (const pattern of patterns) {
    const match = normalizeText(message).match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\b(quiero|necesito|pedido|para|con|delivery|entrega)\b.*$/i, "")
        .trim();
    }
  }

  return "";
}

function findPaymentMethod(message: string, paymentMethods: string[]) {
  const normalized = normalizeText(message);
  const methods = paymentMethods.length ? paymentMethods : fallbackPaymentMethods;

  for (const method of methods) {
    const normalizedMethod = normalizeText(method);
    if (normalizedMethod && normalized.includes(normalizedMethod)) return method;
  }

  if (normalized.includes("pago movil")) return "Pago movil";
  if (normalized.includes("transferencia")) return "Transferencia";
  if (normalized.includes("efectivo")) return "Efectivo";
  if (normalized.includes("binance")) return "Binance";
  if (normalized.includes("zelle")) return "Zelle";

  return methods[0] || "";
}

function findDeliveryReference(message: string) {
  const patterns = [
    /\b(?:direccion|entrega en|delivery en|enviar a|llevar a)\s*[:\-]?\s*(.{6,160})/i,
    /\b(?:para|en)\s+(.{6,160})$/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function findProductItems(message: string, products: ProductRow[]) {
  const normalizedMessage = normalizeText(message);
  const items: InterpretationItem[] = [];
  const availableProducts = products
    .filter((product) => product.is_available !== false)
    .sort((a, b) => b.name.length - a.name.length);

  for (const product of availableProducts) {
    const normalizedName = normalizeText(product.name);
    if (!normalizedName || !normalizedMessage.includes(normalizedName)) continue;

    const index = normalizedMessage.indexOf(normalizedName);
    const before = normalizedMessage.slice(Math.max(0, index - 24), index);
    const quantityMatch = before.match(/(\d+)\s*$/);
    const quantity = quantityMatch ? Math.max(1, Number(quantityMatch[1])) : 1;

    items.push({
      productId: product.id,
      quantity,
      notes: "",
      confidence: 0.72,
    });
  }

  return mergeItems(items);
}

function mergeItems(items: InterpretationItem[]) {
  const byProduct = new Map<string, InterpretationItem>();

  for (const item of items) {
    if (!item.productId) continue;
    const existing = byProduct.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
      existing.notes = [existing.notes, item.notes].filter(Boolean).join("; ");
      existing.confidence = Math.max(existing.confidence, item.confidence);
    } else {
      byProduct.set(item.productId, {
        ...item,
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        notes: cleanText(item.notes),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
      });
    }
  }

  return Array.from(byProduct.values()).slice(0, 30);
}

function localInterpretation({
  message,
  products,
  paymentMethods,
}: {
  message: string;
  products: ProductRow[];
  paymentMethods: string[];
}): ManualOrderInterpretation {
  const normalizedMessage = normalizeText(message);
  const deliveryType =
    normalizedMessage.includes("retiro") ||
    normalizedMessage.includes("pickup") ||
    normalizedMessage.includes("paso buscando")
      ? "pickup"
      : "delivery";
  const items = findProductItems(message, products);
  const warnings: string[] = [];

  if (!items.length) {
    warnings.push("No pude asociar productos automaticamente; revisa el pedido manualmente.");
  }

  return {
    customerName: findName(message),
    customerPhone: normalizePhone(message),
    deliveryReference: deliveryType === "delivery" ? findDeliveryReference(message) : "",
    orderDetails: message,
    deliveryType,
    paymentMethod: findPaymentMethod(message, paymentMethods),
    deliveryUsd: 0,
    items,
    warnings,
    confidence: items.length ? 0.62 : 0.35,
  };
}

function getResponseText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;

  for (const output of data?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === "string") return content.text;
    }
  }

  return "";
}

function sanitizeAiInterpretation(
  value: any,
  products: ProductRow[],
  paymentMethods: string[]
): ManualOrderInterpretation {
  const productIds = new Set(products.map((product) => product.id));
  const methods = paymentMethods.length ? paymentMethods : fallbackPaymentMethods;
  const rawPaymentMethod = cleanText(value?.paymentMethod);
  const paymentMethod = methods.includes(rawPaymentMethod)
    ? rawPaymentMethod
    : methods[0] || "";

  const items = mergeItems(
    Array.isArray(value?.items)
      ? value.items
          .filter((item: any) => productIds.has(cleanText(item?.productId)))
          .map((item: any) => ({
            productId: cleanText(item.productId),
            quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
            notes: cleanText(item.notes),
            confidence: Number(item.confidence || 0.7),
          }))
      : []
  );

  const warnings = Array.isArray(value?.warnings)
    ? value.warnings.map(cleanText).filter(Boolean).slice(0, 8)
    : [];

  if (!items.length) {
    warnings.push("La IA no encontro productos con suficiente confianza.");
  }

  return {
    customerName: cleanText(value?.customerName),
    customerPhone: normalizePhone(cleanText(value?.customerPhone)) || cleanText(value?.customerPhone),
    deliveryReference: cleanText(value?.deliveryReference),
    orderDetails: cleanText(value?.orderDetails),
    deliveryType: value?.deliveryType === "pickup" ? "pickup" : "delivery",
    paymentMethod,
    deliveryUsd: Math.max(0, Number(value?.deliveryUsd || 0)),
    items,
    warnings,
    confidence: Math.max(0, Math.min(1, Number(value?.confidence || 0.7))),
  };
}

function buildInterpretationSchema(products: ProductRow[], paymentMethods: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      customerName: { type: "string" },
      customerPhone: { type: "string" },
      deliveryReference: { type: "string" },
      orderDetails: { type: "string" },
      deliveryType: { type: "string", enum: ["delivery", "pickup"] },
      paymentMethod: {
        type: "string",
        enum: paymentMethods.length ? paymentMethods : fallbackPaymentMethods,
      },
      deliveryUsd: { type: "number" },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            productId: { type: "string", enum: products.map((product) => product.id) },
            quantity: { type: "integer", minimum: 1 },
            notes: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["productId", "quantity", "notes", "confidence"],
        },
      },
      warnings: { type: "array", items: { type: "string" } },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: [
      "customerName",
      "customerPhone",
      "deliveryReference",
      "orderDetails",
      "deliveryType",
      "paymentMethod",
      "deliveryUsd",
      "items",
      "warnings",
      "confidence",
    ],
  };
}

function buildSystemPrompt() {
  return [
    "Eres el extractor de pedidos de Somos para comercios en Venezuela.",
    "Tu tarea es convertir mensajes libres de WhatsApp en un pedido estructurado.",
    "Reglas estrictas:",
    "- Usa solamente productId del catalogo recibido. Nunca inventes productos.",
    "- Si el cliente escribe un nombre parecido, usa el producto mas probable y baja confidence.",
    "- Si dos productos se parecen demasiado, no adivines con confianza alta; agrega warning.",
    "- Extrae cantidades aunque esten en texto: uno, una, dos, media docena, combo, etc.",
    "- Usa notes para sabores, tamanos, terminos de coccion, salsas, extras escritos y restricciones.",
    "- deliveryUsd debe ser 0 salvo que el mensaje diga explicitamente el costo de delivery.",
    "- Si dice retiro, pickup, paso buscando o lo busco, usa pickup; si no, usa delivery.",
    "- Si falta telefono, direccion, producto o metodo de pago, deja el campo vacio y agrega warning.",
    "- Devuelve strings cortos y accionables; no expliques fuera del JSON.",
  ].join("\n");
}

async function interpretWithOpenAi({
  message,
  products,
  paymentMethods,
}: {
  message: string;
  products: ProductRow[];
  paymentMethods: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!products.length) return null;

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  const model = cleanText(process.env.OPENAI_ORDER_MODEL) || DEFAULT_OPENAI_ORDER_MODEL;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: JSON.stringify({
              message,
              paymentMethods,
              products: products.map((product) => ({
                id: product.id,
                name: product.name,
                priceUsd: Number(product.price_usd || 0),
              })),
            }),
          },
        ],
        max_output_tokens: 1800,
        text: {
          format: {
            type: "json_schema",
            name: "manual_order_interpretation",
            schema: buildInterpretationSchema(products, paymentMethods),
            strict: true,
          },
        },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = cleanText(data?.error?.message) || "OpenAI no respondio correctamente.";
      throw new Error(message);
    }

    const text = getResponseText(data);
    if (!text) throw new Error("OpenAI no devolvio una respuesta legible.");

    return {
      model,
      raw: JSON.parse(text),
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_INTERPRET_BODY_BYTES) {
      return NextResponse.json(
        { error: "El mensaje es demasiado largo para interpretarlo." },
        { status: 413 }
      );
    }

    const auth = await requirePanelAuth(request);
    const clientIp = getClientIp(request);
    const rateLimit = await checkDistributedRateLimit({
      key: `panel:interpret:${auth.userId || auth.email || "unknown"}:${clientIp}`,
      limit: INTERPRET_LIMIT,
      windowMs: INTERPRET_RATE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos de interpretacion. Espera unos minutos." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimit, INTERPRET_LIMIT),
        }
      );
    }

    const body = await request.json();
    const storeId = cleanText(body.storeId);
    const message = cleanText(body.message);

    if (!storeId) return badRequest("Selecciona un comercio.");
    if (message.length < 4) return badRequest("Pega el mensaje del cliente.");
    if (message.length > MAX_INTERPRET_MESSAGE_LENGTH) {
      return badRequest("El mensaje es demasiado largo. Resume el pedido antes de interpretarlo.");
    }

    assertStoreAccess(auth, storeId, "No tienes permiso para interpretar pedidos en este comercio.");

    const supabase = createSupabaseAdminClient();
    const [storeResult, productsResult] = await Promise.all([
      supabase.from("stores").select("id, payment_methods").eq("id", storeId).single(),
      supabase
        .from("products")
        .select("id, name, price_usd, is_available")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("name", { ascending: true })
        .limit(300),
    ]);

    if (storeResult.error) throw storeResult.error;
    if (productsResult.error) throw productsResult.error;

    const products = productsResult.data || [];
    const paymentMethods = Array.isArray((storeResult.data as any)?.payment_methods)
      ? (storeResult.data as any).payment_methods
      : [];

    const fallback = localInterpretation({ message, products, paymentMethods });

    try {
      const aiResult = await interpretWithOpenAi({ message, products, paymentMethods });

      if (!aiResult) {
        return NextResponse.json({
          interpretation: fallback,
          mode: "local",
          ai: { configured: false, model: null },
        });
      }

      const interpretation = sanitizeAiInterpretation(
        aiResult.raw,
        products,
        paymentMethods
      );

      return NextResponse.json({
        interpretation,
        mode: "ai",
        ai: {
          configured: true,
          model: aiResult.model,
          confidence: interpretation.confidence,
        },
      });
    } catch (error: any) {
      console.warn("OpenAI order interpretation failed", {
        model: cleanText(process.env.OPENAI_ORDER_MODEL) || DEFAULT_OPENAI_ORDER_MODEL,
        message: error.message || "IA no disponible.",
      });

      return NextResponse.json({
        interpretation: {
          ...fallback,
          warnings: [
            ...fallback.warnings,
            "La IA no estuvo disponible; aplique lectura basica local.",
          ],
        },
        mode: "local",
        ai: {
          configured: Boolean(process.env.OPENAI_API_KEY),
          model: cleanText(process.env.OPENAI_ORDER_MODEL) || DEFAULT_OPENAI_ORDER_MODEL,
          error: error.message || "IA no disponible.",
        },
      });
    }
  } catch (error: any) {
    return panelErrorResponse(error, "Error interpretando pedido.");
  }
}
