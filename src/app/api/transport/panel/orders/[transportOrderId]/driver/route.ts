import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanTransportText } from "@/lib/transport";
import {
  assertAgencyRole,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import {
  calculateDriverPayout,
  isPremiumDispatchSchemaMissing,
} from "@/lib/transport/driver-dispatch";
import {
  canTransitionTransportOrder,
  mapTransportStatusToOrderDeliveryStatus,
  normalizeTransportOrderStatus,
} from "@/lib/transport/orders";
import { mutateTransportOrderAtomic } from "@/lib/server/mutate-transport-order-atomic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ transportOrderId: string }> }
) {
  try {
    const { transportOrderId } = await context.params;
    const auth = await requireTransportAgencyAuth(request);
    const body = await request.json().catch(() => ({}));
    const driverId = cleanTransportText(body.driverId, 80);
    const supabase = createSupabaseAdminClient();

    const { data: transportOrder, error: orderError } = await supabase
      .from("transport_orders")
      .select(
        `
        id,
        order_id,
        agency_id,
        status,
        assigned_at,
        delivery_fee_usd,
        transport_agencies(premium_dispatch_enabled)
      `
      )
      .eq("id", transportOrderId)
      .maybeSingle();

    if (orderError) {
      if (isPremiumDispatchSchemaMissing(orderError)) {
        return badRequest("Falta aplicar la migracion premium de repartidores.");
      }
      throw orderError;
    }

    if (!transportOrder) return badRequest("Pedido de empresa delivery no encontrado.");

    assertAgencyRole(
      auth,
      transportOrder.agency_id,
      ["owner", "admin", "operator"],
      "Tu rol no permite asignar repartidores."
    );

    const agency =
      Array.isArray((transportOrder as any).transport_agencies)
        ? (transportOrder as any).transport_agencies[0]
        : (transportOrder as any).transport_agencies;

    if (agency?.premium_dispatch_enabled !== true) {
      return badRequest("El paquete premium de repartidores no esta activo para esta empresa.");
    }

    const currentStatus = normalizeTransportOrderStatus(transportOrder.status);
    if (["delivered", "agency_rejected", "cancelled", "delivery_failed"].includes(currentStatus)) {
      return badRequest("No se puede cambiar el repartidor de un servicio cerrado.");
    }

    const now = new Date().toISOString();
    const payload: Record<string, any> = {
      updated_at: now,
    };
    let eventType = "driver_unassigned";
    let eventNote = "Repartidor removido.";
    let nextStatus = currentStatus;

    if (driverId) {
      const { data: driver, error: driverError } = await supabase
        .from("transport_drivers")
        .select("id, agency_id, name, phone, commission_percent, is_active")
        .eq("id", driverId)
        .eq("agency_id", transportOrder.agency_id)
        .maybeSingle();

      if (driverError) {
        if (isPremiumDispatchSchemaMissing(driverError)) {
          return badRequest("Falta aplicar la migracion premium de repartidores.");
        }
        throw driverError;
      }

      if (!driver || driver.is_active === false) {
        return badRequest("Repartidor no disponible para esta empresa.");
      }

      const commissionPercent = Number(driver.commission_percent || 0);
      payload.driver_id = driver.id;
      payload.driver_name_snapshot = driver.name;
      payload.driver_commission_percent = commissionPercent;
      payload.driver_payout_usd = calculateDriverPayout(
        transportOrder.delivery_fee_usd,
        commissionPercent
      );
      payload.driver_assigned_at = now;
      eventType = "driver_assigned";
      eventNote = `Repartidor asignado: ${driver.name}.`;

      if (
        ["pending_agency", "sent_to_agency", "agency_received", "agency_accepted"].includes(
          currentStatus
        ) &&
        canTransitionTransportOrder(currentStatus, "driver_assigned")
      ) {
        nextStatus = "driver_assigned";
        payload.status = nextStatus;
        if (!transportOrder.assigned_at) payload.assigned_at = now;
      }
    } else {
      payload.driver_id = null;
      payload.driver_name_snapshot = null;
      payload.driver_commission_percent = null;
      payload.driver_payout_usd = null;
      payload.driver_assigned_at = null;
      if (currentStatus === "driver_assigned") {
        nextStatus = "agency_accepted";
        payload.status = nextStatus;
      }
    }

    const updated = await mutateTransportOrderAtomic(supabase, {
      transportOrderId: transportOrder.id,
      transportPayload: payload,
      eventPayload: {
        event_type: eventType,
        status_from: currentStatus,
        status_to: nextStatus,
        note: eventNote,
        actor_type: auth.isFounderMode ? "admin" : "agency",
        actor_user_id: auth.userId,
        actor_name: auth.email || "Empresa delivery",
      },
      orderDeliveryStatus:
        nextStatus !== currentStatus
          ? mapTransportStatusToOrderDeliveryStatus(nextStatus)
          : null,
      integrationStatus: nextStatus !== currentStatus ? nextStatus : null,
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    return transportErrorResponse(error, "Error asignando repartidor.");
  }
}
