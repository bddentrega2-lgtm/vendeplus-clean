import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PUBLIC_SUPABASE_TIMEOUT_MS = 6500;

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createSupabasePublicClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (input, init) => {
        const controller = new AbortController();
        if (init?.signal) {
          init.signal.addEventListener("abort", () => controller.abort(), {
            once: true,
          });
        }
        const timeout = globalThis.setTimeout(
          () => controller.abort(),
          PUBLIC_SUPABASE_TIMEOUT_MS
        );

        try {
          return await fetch(input, {
            ...init,
            signal: controller.signal,
          });
        } finally {
          globalThis.clearTimeout(timeout);
        }
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
