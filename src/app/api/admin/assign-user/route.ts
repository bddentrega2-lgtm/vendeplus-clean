import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ensureStoreAccessUser,
  findUserByEmail,
  normalizeAccessRole,
} from "@/lib/admin/store-access";

const validRoles = new Set(["owner", "admin", "operator", "staff"]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function listAuthUsers(supabase: any) {
  const users: any[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const pageUsers = data?.users || [];
    users.push(...pageUsers);
    if (pageUsers.length < 1000) break;
  }

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
    const authUsers = await listAuthUsers(supabase);
    const usersById = new Map(authUsers.map((user: any) => [user.id, user]));
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
      registeredUsers: authUsers
        .filter((user: any) => Boolean(user.email))
        .map((user: any) => ({
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at || null,
          created_at: user.created_at || null,
        }))
        .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || ""))),
    });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando asignaciones.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const userId = cleanText(body.user_id);

    if (!userId) return badRequest("Falta el usuario.");

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (error) throw error;

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at,
      },
      message: `Correo ${data.user.email || "del usuario"} autorizado.`,
    });
  } catch (error) {
    return adminErrorResponse(error, "Error autorizando correo.");
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

    let user = await findUserByEmail(supabase, email);

    if (!user) {
      return badRequest(
        "No existe un usuario registrado con ese email. Créalo primero desde el sistema de usuarios."
      );
    }

    if (!user.email_confirmed_at) {
      const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

      if (error) throw error;
      user = data.user || user;
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

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const assignmentId = cleanText(body.assignment_id);

    if (!assignmentId) return badRequest("Falta la asignacion.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("store_users")
      .delete()
      .eq("id", assignmentId);

    if (error) throw error;

    return NextResponse.json({ ok: true, message: "Asignacion eliminada." });
  } catch (error) {
    return adminErrorResponse(error, "Error quitando acceso.");
  }
}
