import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ensureStoreAccessUser,
  findUserByEmail,
  normalizeAccessRole,
} from "@/lib/admin/store-access";

const validRoles = new Set(["owner", "admin", "operator"]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function getUsersById(supabase: any, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = new Map<string, any>();

  await Promise.all(
    uniqueIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (!error && data?.user) {
        users.set(userId, data.user);
      }
    })
  );

  return users;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();

    const [storesResult, assignmentsResult] = await Promise.all([
      supabase.from("stores").select("id, slug, name").order("name", { ascending: true }),
      supabase
        .from("store_users")
        .select("id, store_id, user_id, role")
        .order("role", { ascending: true }),
    ]);

    if (storesResult.error) throw storesResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;

    const assignments = assignmentsResult.data || [];
    const usersById = await getUsersById(
      supabase,
      assignments.map((assignment: any) => assignment.user_id)
    );
    const storesById = new Map(
      (storesResult.data || []).map((store: any) => [store.id, store])
    );

    return NextResponse.json({
      stores: storesResult.data || [],
      assignments: assignments.map((assignment: any) => {
        const user = usersById.get(assignment.user_id);
        const store = storesById.get(assignment.store_id);

        return {
          ...assignment,
          user_email: user?.email || "Usuario sin email visible",
          store_name: store?.name || "Comercio",
          store_slug: store?.slug || "",
        };
      }),
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando asignaciones.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const email = cleanText(body.email).toLowerCase();
    const storeId = cleanText(body.store_id);
    const role = cleanText(body.role) || "operator";
    const password = cleanText(body.password);
    const shouldCreateUser = Boolean(body.create_user || password);

    if (!email) return badRequest("Ingresa el email del usuario.");
    if (!storeId) return badRequest("Selecciona un comercio.");
    if (!validRoles.has(role)) return badRequest("Rol no soportado.");

    const supabase = createSupabaseAdminClient();

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (storeError) throw storeError;

    if (shouldCreateUser) {
      const result = await ensureStoreAccessUser({
        supabase,
        storeId,
        storeName: store.name,
        email,
        password,
        role,
      });

      return NextResponse.json({
        assignment: result.assignment,
        user: {
          id: result.user.id,
          email: result.user.email,
        },
        message: result.createdUser
          ? `Acceso creado y asignado a ${store.name}.`
          : `El usuario ya existía y fue asignado a ${store.name}.`,
      });
    }

    const user = await findUserByEmail(supabase, email);

    if (!user) {
      return badRequest(
        "No existe un usuario registrado con ese email. Créalo primero desde el sistema de usuarios."
      );
    }

    const { data: existingAssignment, error: existingError } = await supabase
      .from("store_users")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingAssignment) {
      const { data, error } = await supabase
        .from("store_users")
        .update({ role: normalizeAccessRole(role) })
        .eq("id", existingAssignment.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        assignment: data,
        message: `Usuario actualizado en ${store.name}.`,
      });
    }

    const { data, error } = await supabase
      .from("store_users")
      .insert({
        store_id: storeId,
        user_id: user.id,
        role: normalizeAccessRole(role),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      assignment: data,
      message: `Usuario asignado a ${store.name}.`,
    });
  } catch (error) {
    return adminErrorResponse(error, "Error asignando usuario.");
  }
}
