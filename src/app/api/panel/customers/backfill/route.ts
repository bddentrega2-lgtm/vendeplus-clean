import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStoreManager,
  canUseStoreRole,
  panelErrorResponse,
  requirePanelAuth,
} from "@/lib/panel/access";
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/server/rate-limit";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

const CUSTOMER_BACKFILL_LIMIT = 3;
const CUSTOMER_BACKFILL_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAuth(request);
    const clientIp = getClientIp(request);
    const rateLimit = await checkDistributedRateLimit({
      key: `panel:customers-backfill:${auth.userId || auth.email || "unknown"}:${clientIp}`,
      limit: CUSTOMER_BACKFILL_LIMIT,
      windowMs: CUSTOMER_BACKFILL_RATE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Esta reconstruccion ya fue solicitada varias veces. Prueba mas tarde." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimit, CUSTOMER_BACKFILL_LIMIT),
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedStoreId =
      cleanText(body.storeId) || cleanText(request.headers.get("x-panel-store-id"));
    const supabase = createSupabaseAdminClient();

    const managerStoreIds =
      auth.storeIds === null
        ? null
        : auth.storeIds.filter((id) => canUseStoreRole(auth, id, ["owner", "admin"]));

    if (requestedStoreId) {
      assertStoreManager(
        auth,
        requestedStoreId,
        "No tienes permiso para reconstruir clientes de este comercio."
      );
    }

    const storeIds = requestedStoreId
      ? [requestedStoreId]
      : managerStoreIds;
    const { data: processed, error } = await supabase.rpc(
      "refresh_customer_product_metrics",
      { p_store_ids: storeIds }
    );
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      processed: Number(processed || 0),
      skipped: 0,
    });
  } catch (error: any) {
    return panelErrorResponse(error, "Error reconstruyendo clientes.");
  }
}
