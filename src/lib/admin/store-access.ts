const validRoles = new Set(["owner", "admin", "operator"]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function normalizeAccessRole(value: unknown) {
  const role = cleanText(value) || "owner";
  return validRoles.has(role) ? role : "owner";
}

export function normalizeAccessEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

export async function findUserByEmail(supabase: any, email: string) {
  const needle = email.trim().toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const users = data?.users || [];
    const user = users.find(
      (item: any) => String(item.email || "").toLowerCase() === needle
    );

    if (user) return user;
    if (users.length < 1000) return null;

    page += 1;
  }

  return null;
}

export async function ensureStoreAccessUser({
  supabase,
  storeId,
  storeName,
  email,
  password,
  role = "owner",
}: {
  supabase: any;
  storeId: string;
  storeName: string;
  email: string;
  password?: string;
  role?: string;
}) {
  const normalizedEmail = normalizeAccessEmail(email);
  const normalizedRole = normalizeAccessRole(role);

  if (!normalizedEmail) {
    throw new Error("Ingresa el correo de acceso.");
  }

  let user = await findUserByEmail(supabase, normalizedEmail);
  let createdUser = false;

  if (!user) {
    if (!password || password.length < 6) {
      throw new Error("La clave debe tener al menos 6 caracteres.");
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: storeName,
        source: "vendeplus_admin",
      },
    });

    if (error) throw error;
    user = data.user;
    createdUser = true;
  }

  if (!user?.id) {
    throw new Error("No se pudo obtener el usuario de acceso.");
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
      .update({ role: normalizedRole })
      .eq("id", existingAssignment.id)
      .select()
      .single();

    if (error) throw error;

    return { user, assignment: data, createdUser, updatedAssignment: true };
  }

  const { data, error } = await supabase
    .from("store_users")
    .insert({
      store_id: storeId,
      user_id: user.id,
      role: normalizedRole,
    })
    .select()
    .single();

  if (error) throw error;

  return { user, assignment: data, createdUser, updatedAssignment: false };
}
