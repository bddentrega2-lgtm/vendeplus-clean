"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isNativeApp } from "@/lib/mobile/state";

type BuyerAuthPlugin = { open(value: { url: string }): Promise<void>; consume(): Promise<{ url?: string }>; getRedirectUrl(): Promise<{ url: string }> };
let client: SupabaseClient | null = null;
let completion: Promise<void> | null = null;
export function buyerAuthPlugin(): BuyerAuthPlugin | null {
  return typeof window === "undefined" ? null : (window as Window & { Capacitor?: { Plugins?: { SomosBuyerAuth?: BuyerAuthPlugin } } }).Capacitor?.Plugins?.SomosBuyerAuth || null;
}
async function nativeRedirectUrl() {
  const plugin = buyerAuthPlugin();
  if (!plugin) throw new Error("Actualiza la app para ingresar con Google.");
  const { url } = await plugin.getRedirectUrl();
  if (!["com.somosve.app://buyer-auth", "com.somosve.app.staging://buyer-auth"].includes(url)) throw new Error("Regreso de sesion invalido.");
  return url;
}
export function getBuyerClient() {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ||= createClient(url, key, { auth: { storageKey: "somos_buyer_auth_v1", flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } });
  return client;
}
export async function buyerAuthHeaders(): Promise<Record<string, string>> {
  const auth = getBuyerClient();
  if (!auth) return {};
  const { data, error } = await auth.auth.getSession();
  if (error) throw new Error("No pudimos comprobar tu sesion. Ingresa de nuevo.");
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
export async function signInBuyerWithGoogle() {
  const auth = getBuyerClient();
  if (!auth) throw new Error("El acceso con Google no esta disponible.");
  const native = isNativeApp();
  const plugin = buyerAuthPlugin();
  if (native && !plugin) throw new Error("Actualiza la app para ingresar con Google.");
  const redirectTo = native ? await nativeRedirectUrl() : `${window.location.origin}/auth/buyer-callback`;
  const { data, error } = await auth.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } } });
  if (error || !data.url) throw new Error("No pudimos iniciar el acceso con Google.");
  if (native && plugin) await plugin.open({ url: data.url });
  else window.location.assign(data.url);
}
export async function completeBuyerSignIn(value: string) {
  if (completion) return completion;
  completion = (async () => {
    const url = new URL(value);
    const callback = new URL(url); callback.search = ""; callback.hash = "";
    const nativeCallback = isNativeApp() && callback.href === await nativeRedirectUrl();
    const webCallback = url.origin === window.location.origin && url.pathname === "/auth/buyer-callback";
    if (!nativeCallback && !webCallback) throw new Error("Regreso de sesion invalido.");
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error")) throw new Error("No se completo el acceso con Google. Vuelve a intentar.");
    const auth = getBuyerClient();
    if (!auth) throw new Error("Acceso no disponible.");
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (error) throw new Error("El acceso vencio. Vuelve a ingresar con Google.");
  })();
  try { await completion; } finally { completion = null; }
}
