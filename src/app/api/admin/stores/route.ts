import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import {
  adminStoreSelect,
  normalizeAdminStorePayload,
} from "@/lib/admin/stores";
import {
  isMissingAdminMetricsRpc,
  loadAdminStoreMetricsFallback,
} from "@/lib/admin/metrics-fallback";
import { ensureStoreAccessUser, normalizeAccessEmail } from "@/lib/admin/store-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCancelledOrderStatus(value: unknown) {
  return ["cancelled", "canceled", "cancelado"].includes(String(value || "").trim().toLowerCase());
}

function withSomosBilling(stores: any[], orders: any[]) {
  const totals = new Map<string, number>();
  const storesById = new Map(stores.map((store) => [store.id, store]));

  for (const order of orders) {
    if (isCancelledOrderStatus(order.status)) continue;

    const store = storesById.get(order.store_id);
    if (!store) continue;

    const periodStart =
      store.last_payment_at ||
      store.subscription_started_at ||
      store.trial_ends_at ||
      store.created_at;

    if (periodStart && new Date(order.created_at).getTime() < new Date(periodStart).getTime()) continue;

    totals.set(
      order.store_id,
      Number(((totals.get(order.store_id) || 0) + toNumber(order.platform_service_fee_usd)).toFixed(2))
    );
  }

  return stores.map((store) => ({
    ...store,
    somos_billed_usd: ["per_service", "custom"].includes(String(store.plan_type || ""))
      ? totals.get(store.id) || 0
      : ["monthly", "emprendedor", "visionario"].includes(String(store.plan_type || ""))
        ? toNumber(store.monthly_price_usd)
        : 0,
  }));
}

function withCounts(stores: any[], metricsRows: any[]) {
  const metrics = new Map(metricsRows.map((entry: any) => [entry.store_id, entry]));

  return stores.map((store) => {
    const row = metrics.get(store.id) || {};
    return {
      ...store,
      product_count: toNumber(row.product_count),
      active_product_count: toNumber(row.active_product_count),
      order_count: toNumber(row.order_count),
      order_count_30d: toNumber(row.order_count_30d),
      user_count: toNumber(row.user_count),
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();

    const [storesResult, metricsResult, serviceFeesResult] =
      await Promise.all([
        supabase.from("stores").select(adminStoreSelect).order("name", { ascending: true }),
        supabase.rpc("admin_store_metrics"),
        supabase
          .from("orders")
          .select("store_id, status, created_at, platform_service_fee_usd")
          .gt("platform_service_fee_usd", 0),
      ]);

    if (storesResult.error) throw storesResult.error;
    if (metricsResult.error && !isMissingAdminMetricsRpc(metricsResult.error)) {
      throw metricsResult.error;
    }
    if (serviceFeesResult.error) throw serviceFeesResult.error;

    const metricsRows = metricsResult.error
      ? await loadAdminStoreMetricsFallback(supabase)
      : metricsResult.data || [];

    return NextResponse.json({
      stores: withSomosBilling(
        withCounts(storesResult.data || [], metricsRows),
        serviceFeesResult.data || []
      ),
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando comercios.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const payload = normalizeAdminStorePayload(body);
    const accessEmail = normalizeAccessEmail(body.access_email);
    const accessPassword = String(body.access_password || "").trim();
    const accessPasswordConfirmation = String(body.access_password_confirmation || "").trim();
    const accessRole = String(body.access_role || "owner").trim();

    if (!payload.name) {
      return badRequest("El nombre del comercio es obligatorio.");
    }

    if (!payload.slug) {
      return badRequest("El slug del comercio es obligatorio.");
    }

    if (accessEmail && accessPassword.length < 6) {
      return badRequest("La clave de acceso debe tener al menos 6 caracteres.");
    }

    if (accessEmail && accessPassword !== accessPasswordConfirmation) {
      return badRequest("Las claves de acceso no coinciden.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: existingStore, error: existingError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", payload.slug)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingStore) {
      return conflict("Ya existe un comercio con ese slug.");
    }

    const { data, error } = await supabase
      .from("stores")
      .insert(payload)
      .select(adminStoreSelect)
      .single();

    if (error) throw error;

    if (accessEmail) {
      try {
        const access = await ensureStoreAccessUser({
          supabase,
          storeId: data.id,
          storeName: data.name,
          email: accessEmail,
          password: accessPassword,
          role: accessRole,
        });

        return NextResponse.json(
          {
            store: data,
            access: {
              email: access.user.email,
              role: access.assignment.role,
              createdUser: access.createdUser,
            },
            message: access.createdUser
              ? "Comercio creado con acceso de usuario."
              : "Comercio creado y usuario existente asignado.",
          },
          { status: 201 }
        );
      } catch (accessError) {
        await supabase.from("stores").delete().eq("id", data.id);
        throw accessError;
      }
    }

    return NextResponse.json({ store: data }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error, "Error creando comercio.");
  }
}
