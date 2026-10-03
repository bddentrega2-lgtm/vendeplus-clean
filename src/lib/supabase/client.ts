import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let browserClient: ReturnType<typeof createClient> | null | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient !== undefined) return browserClient;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const parsedUrl = new URL(supabaseUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) return null;
  } catch {
    return null;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
    },
  });
  return browserClient;
}
