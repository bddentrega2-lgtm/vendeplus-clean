import { NextRequest, NextResponse } from "next/server";
import { adminErrorResponse, requireAdminAuth } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedKinds = new Set(["news", "challenge", "feature", "important"]);

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanUrl(value: unknown) {
  const url = cleanText(value, 500);
  if (!url) return null;
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("panel_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ announcements: data || [] });
  } catch (error) {
    return adminErrorResponse(error, "Error cargando notificaciones.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    const body = await request.json();
    const title = cleanText(body.title, 100);
    const message = cleanText(body.message, 500);
    const kind = allowedKinds.has(body.kind) ? body.kind : "news";
    const actionLabel = cleanText(body.actionLabel, 40) || null;
    const requestedUrl = cleanText(body.actionUrl, 500);
    const actionUrl = cleanUrl(requestedUrl);
    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;

    if (!title || !message) {
      return NextResponse.json({ error: "Escribe el título y el mensaje." }, { status: 400 });
    }
    if (requestedUrl && !actionUrl) {
      return NextResponse.json({ error: "El enlace debe comenzar por / o usar https://" }, { status: 400 });
    }
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      return NextResponse.json({ error: "Revisa las fechas del aviso." }, { status: 400 });
    }
    if (endsAt && endsAt <= startsAt) {
      return NextResponse.json({ error: "La fecha final debe ser posterior al inicio." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("panel_announcements")
      .insert({
        title,
        message,
        kind,
        action_label: actionLabel,
        action_url: actionUrl,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt?.toISOString() || null,
        is_active: true,
        created_by: auth.userId || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ announcement: data, message: "Notificación publicada." }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error, "Error publicando la notificación.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminAuth(request);
    const body = await request.json();
    const id = cleanText(body.id, 100);
    if (!id || typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Solicitud incompleta." }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("panel_announcements")
      .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ announcement: data });
  } catch (error) {
    return adminErrorResponse(error, "Error actualizando la notificación.");
  }
}
