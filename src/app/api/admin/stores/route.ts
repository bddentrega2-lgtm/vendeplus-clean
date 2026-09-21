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
import { loadServiceFeeBalances, type ServiceFeeBalance } from "@/lib/billing/service-fees";

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

function withSomosBilling(stores: any[], balances: Map<string, ServiceFeeBalance>) {
  return stores.map((store) => ({
    ...store,
    somos_billed_usd: store.plan_type === "per_service"
      ? balances.get(store.id)?.amountUsd || 0
      : store.plan_type === "monthly"
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

    const [storesResult, metricsResult] =
      await Promise.all([
        supabase.from("stores").select(adminStoreSelect).order("name", { ascending: true }),
        supabase.rpc("admin_store_metrics"),
      ]);

    if (storesResult.error) throw storesResult.error;
    if (metricsResult.error && !isMissingAdminMetricsRpc(metricsResult.error)) {
      throw metricsResult.error;
    }
    const feeBalances = await loadServiceFeeBalances(supabase, storesResult.data || []);

    const metricsRows = metricsResult.error
      ? await loadAdminStoreMetricsFallback(supabase)
      : metricsResult.data || [];

    return NextResponse.json({
      stores: withSomosBilling(
        withCounts(storesResult.data || [], metricsRows),
        feeBalances
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

    if (!payload.city_id) {
      return badRequest("Selecciona la ciudad del comercio.");
    }

    if (payload.plan_type === "founder" && payload.is_test !== true) {
      return badRequest("El plan Founder solo puede asignarse a cuentas de prueba.");
    }

    if (accessEmail && accessPassword.length < 6) {
      return badRequest("La clave de acceso debe tener al menos 6 caracteres.");
    }

    if (accessEmail && accessPassword !== accessPasswordConfirmation) {
      return badRequest("Las claves de acceso no coinciden.");
    }

    const supabase = createSupabaseAdminClient();
    if (payload.city_id) {
      const { data: city, error: cityError } = await supabase.from("service_cities")
        .select("id").eq("id", payload.city_id).eq("is_active", true).maybeSingle();
      if (cityError) throw cityError;
      if (!city) return badRequest("Selecciona una ciudad disponible.");
    }
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
