import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canUseAgencyRole,
  requireTransportAgencyAuth,
  transportErrorResponse,
} from "@/lib/transport/access";
import { cleanTransportText, getTransportBillingRange } from "@/lib/transport";
import { checkDistributedRateLimit, getClientIp, rateLimitHeaders } from "@/lib/server/rate-limit";

const MAX_EXPORT_ROWS = 5000;
const EXPORT_LIMIT = 12;
const EXPORT_WINDOW_MS = 10 * 60 * 1000;

function csvCell(value: unknown) {
  let text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: unknown) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(new Date(String(value)));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTransportAgencyAuth(request);
    const clientIp = getClientIp(request);
    const limit = await checkDistributedRateLimit({
      key: `transport-orders-export:${auth.userId}:${clientIp}`,
      limit: EXPORT_LIMIT,
      windowMs: EXPORT_WINDOW_MS,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Demasiadas descargas. Espera unos minutos e intenta de nuevo." },
        { status: 429, headers: rateLimitHeaders(limit, EXPORT_LIMIT) }
      );
    }

    const { searchParams } = request.nextUrl;
    const requestedAgencyId = cleanTransportText(searchParams.get("agencyId"), 80);
    if (!requestedAgencyId) {
      return NextResponse.json(
        { error: "Selecciona la empresa delivery que deseas respaldar." },
        { status: 400 }
      );
    }
    const range = getTransportBillingRange(searchParams);
    const supabase = createSupabaseAdminClient();
    if (
      !auth.isFounderMode &&
      !canUseAgencyRole(auth, requestedAgencyId, ["owner", "admin", "billing"])
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para exportar esta empresa delivery." },
        { status: 403 }
      );
    }

    let query = supabase
      .from("transport_orders")
      .select(`id, agency_id, order_id, store_name_snapshot, customer_name_snapshot, customer_phone_snapshot, delivery_address, delivery_reference, delivery_zone_name, delivery_fee_usd, status, driver_name_snapshot, driver_payout_usd, created_at, orders(public_code, total_usd, payment_method, payment_status)`)
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: false })
      .limit(MAX_EXPORT_ROWS);
    query = query.eq("agency_id", requestedAgencyId);

    const { data, error } = await query;
    if (error) throw error;

    const headers = ["Fecha", "Pedido", "Comercio", "Cliente", "Telefono", "Direccion", "Referencia", "Zona", "Delivery USD", "Estado", "Repartidor", "Pago repartidor USD", "Total pedido USD", "Metodo de pago", "Estado del pago"];
    const rows = (data || []).map((entry: any) => [
      csvDate(entry.created_at),
      entry.orders?.public_code || entry.order_id || entry.id,
      entry.store_name_snapshot,
      entry.customer_name_snapshot,
      entry.customer_phone_snapshot,
      entry.delivery_address,
      entry.delivery_reference,
      entry.delivery_zone_name,
      Number(entry.delivery_fee_usd || 0).toFixed(2),
      entry.status,
      entry.driver_name_snapshot,
      Number(entry.driver_payout_usd || 0).toFixed(2),
      Number(entry.orders?.total_usd || 0).toFixed(2),
      entry.orders?.payment_method,
      entry.orders?.payment_status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const filename = `pedidos-delivery-${range.startDate}-${range.endDate}.csv`;
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return transportErrorResponse(error, "No se pudo descargar el respaldo de pedidos delivery.");
  }
}
