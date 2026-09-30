import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getVerifiedBuyer(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer ([^\s]{20,8192})$/.exec(header);
  if (!match) return null;
  try {
    const { data, error } = await createSupabaseAdminClient().auth.getUser(match[1]);
    const user = data.user;
    if (error || !user?.email_confirmed_at || !user.app_metadata?.providers?.includes("google")) return null;
    return { id: user.id, email: user.email || "" };
  } catch { return null; }
}
