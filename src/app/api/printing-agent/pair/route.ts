import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createDeviceToken, hashPrintAgentSecret, normalizePairingCode } from "@/lib/printing/agent-auth-server";
import { checkDistributedRateLimit, getClientIp, rateLimitHeaders } from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limit = await checkDistributedRateLimit({ key: `print-agent-pair:${getClientIp(request)}`, limit: 10, windowMs: 10 * 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429, headers: rateLimitHeaders(limit, 10) });
    const body = await request.json();
    const code = normalizePairingCode(body.code);
    const name = String(body.deviceName || "Telefono del comercio").trim().slice(0, 100);
    const platform = body.platform === "windows" ? "windows" : "android";
    if (!code || !name) return NextResponse.json({ error: "Codigo o nombre invalido." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const token = createDeviceToken();
    const { data, error } = await supabase.rpc("pair_print_agent_device", {
      p_code_hash: hashPrintAgentSecret(code),
      p_token_hash: hashPrintAgentSecret(token),
      p_name: name,
      p_platform: platform,
      p_app_version: String(body.appVersion || "").slice(0, 30),
    });
    if (error) throw error;
    const device = data?.[0];
    if (!device) return NextResponse.json({ error: "El codigo no existe o vencio." }, { status: 401 });
    return NextResponse.json({ token, device });
  } catch {
    return NextResponse.json({ error: "No se pudo vincular este equipo." }, { status: 500 });
  }
}
