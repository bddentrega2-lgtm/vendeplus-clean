import { after, NextRequest, NextResponse } from "next/server";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { isPaymentStatus } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";
import { safeSendPrintWakePush } from "@/lib/printing/firebase-push";

function cleanText(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await requirePanelAuth(request);
    const { orderId } = await context.params;
    const body = await request.json();

    if (!orderId) {
      return badRequest("Falta el ID del pedido.");
    }

    const paymentStatus = cleanText(body.paymentStatus, 40);

    if (!isPaymentStatus(paymentStatus)) {
      return badRequest("Estado de pago inválido.");
    }

    const paymentReference = cleanText(body.paymentReference, 120);
    if (paymentReference && paymentReference.replace(/\D/g, "").length < 4) {
      return badRequest("La referencia debe tener al menos 4 dígitos.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select("id, store_id, payment_status, status")
      .eq("id", orderId)
      .single();

    if (existingError) throw existingError;

    assertStoreAccess(
      auth,
      existingOrder.store_id,
      "No tienes permiso para actualizar el pago de este pedido."
    );

    const isVerified = paymentStatus === "verified";
    const fields = {
      ...(Object.hasOwn(body, "paymentReference") ? { paymentReference: paymentReference || null } : {}),
      ...(Object.hasOwn(body, "paymentCurrency") ? { paymentCurrency: cleanText(body.paymentCurrency, 20).toUpperCase() || null } : {}),
      ...(Object.hasOwn(body, "amountPaid") ? { amountPaid: optionalNumber(body.amountPaid) } : {}),
      ...(Object.hasOwn(body, "paymentBank") ? { paymentBank: cleanText(body.paymentBank, 120) || null } : {}),
      ...(Object.hasOwn(body, "paymentNotes") ? { paymentNotes: cleanText(body.paymentNotes, 500) || null } : {}),
    };

    const { error } = await supabase.rpc("update_order_payment_v2", {
      p_store_id: existingOrder.store_id,
      p_order_id: orderId,
      p_expected_payment_status: existingOrder.payment_status,
      p_payment_status: paymentStatus,
      p_fields: fields,
      p_actor: isVerified ? auth.userId || null : null,
    });

    if (error && (error.code === "PGRST202" || isMissingColumnError(error, ["payment_", "amount_paid"]))) {
      return NextResponse.json(
        { error: "El control de pago necesita aplicar primero la migración nueva en Supabase." },
        { status: 409 }
      );
    }
    if (error && ["P0001", "P0002"].includes(error.code || "")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error) throw error;

    const { data, error: readError } = await supabase
      .from("orders")
      .select(
        `
        id,
        public_code,
        store_id,
        payment_status,
        payment_reference,
        payment_currency,
        amount_paid,
        payment_verified_at,
        payment_notes,
        payment_bank,
        payment_verified_by,
        status,
        status_entered_at,
        status_elapsed_ms
      `
      )
      .eq("id", orderId)
      .eq("store_id", existingOrder.store_id)
      .single();
    if (readError) throw readError;

    if (isVerified && existingOrder.payment_status !== "verified") {
      after(() => safeSendPrintWakePush({
        supabase,
        storeId: existingOrder.store_id,
        orderId,
        eventType: "paid",
      }));
    }

    return NextResponse.json({ order: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando pago.");
  }
}
