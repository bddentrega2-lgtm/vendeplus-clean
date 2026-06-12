import { NextRequest, NextResponse } from "next/server";
import {
  getFounderEmails,
  getSupabaseUserEmail,
  isFounderEmail,
} from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function maskEmail(email: string) {
  const [name, domain] = email.split("@");

  if (!name || !domain) return email ? "email-configurado" : "";

  const visibleName =
    name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***`;

  return `${visibleName}@${domain}`;
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "").trim();
  const founderEmails = getFounderEmails();

  if (!token) {
    return NextResponse.json(
      {
        authenticated: false,
        userEmail: null,
        founderEmailsConfigured: founderEmails.length > 0,
        founderEmailCount: founderEmails.length,
        founderEmailsPreview: founderEmails.map(maskEmail),
        matchesFounderEmail: false,
        reason: "No llegó sesión/token desde el navegador.",
      },
      { status: 401 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return NextResponse.json(
        {
          authenticated: false,
          userEmail: null,
          founderEmailsConfigured: founderEmails.length > 0,
          founderEmailCount: founderEmails.length,
          founderEmailsPreview: founderEmails.map(maskEmail),
          matchesFounderEmail: false,
          reason: "La sesión no es válida para este proyecto Supabase.",
        },
        { status: 401 }
      );
    }

    const userEmail = getSupabaseUserEmail(data.user);
    const matchesFounderEmail = isFounderEmail(userEmail);

    return NextResponse.json({
      authenticated: true,
      userEmail,
      founderEmailsConfigured: founderEmails.length > 0,
      founderEmailCount: founderEmails.length,
      founderEmailsPreview: founderEmails.map(maskEmail),
      matchesFounderEmail,
      reason: matchesFounderEmail
        ? "El email autenticado coincide con FOUNDER_EMAILS."
        : "El email autenticado no coincide con FOUNDER_EMAILS.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        authenticated: false,
        userEmail: null,
        founderEmailsConfigured: founderEmails.length > 0,
        founderEmailCount: founderEmails.length,
        founderEmailsPreview: founderEmails.map(maskEmail),
        matchesFounderEmail: false,
        reason: error.message || "No se pudo validar la sesión.",
      },
      { status: 500 }
    );
  }
}
