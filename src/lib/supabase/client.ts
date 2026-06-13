import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const parsedUrl = new URL(supabaseUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) return null;
  } catch {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
