import { NextRequest, NextResponse } from "next/server";
import {
  assertStoreAccess,
  badRequest,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import { isPaymentStatus } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/supabase/schema-compat";

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

    const supabase = createSupabaseAdminClient();
    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select("id, store_id")
      .eq("id", orderId)
      .single();

    if (existingError) throw existingError;

    assertStoreAccess(
      auth,
      existingOrder.store_id,
      "No tienes permiso para actualizar el pago de este pedido."
    );

    const isVerified = paymentStatus === "verified";
    const updatePayload = {
      payment_status: paymentStatus,
      payment_reference: cleanText(body.paymentReference, 120) || null,
      payment_currency: cleanText(body.paymentCurrency, 20).toUpperCase() || null,
      amount_paid: optionalNumber(body.amountPaid),
      payment_bank: cleanText(body.paymentBank, 120) || null,
      payment_notes: cleanText(body.paymentNotes, 500) || null,
      payment_verified_at: isVerified ? new Date().toISOString() : null,
      payment_verified_by: isVerified ? auth.userId || null : null,
    };

    const { data, error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
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
        payment_verified_by
      `
      )
      .single();

    if (error && isMissingColumnError(error, ["payment_", "amount_paid"])) {
      return NextResponse.json(
        {
          error:
            "El control de pago necesita aplicar primero la migración nueva en Supabase.",
        },
        { status: 409 }
      );
    }

    if (error) throw error;

    return NextResponse.json({ order: data });
  } catch (error: any) {
    return panelErrorResponse(error, "Error actualizando pago.");
  }
}
