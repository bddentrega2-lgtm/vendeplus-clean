import { NextRequest, NextResponse } from "next/server";
import {
  getFounderEmails,
  getSupabaseUserEmail,
  isFounderEmail,
} from "@/lib/panel/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function hiddenAuthCheckResponse() {
  return NextResponse.json({ error: "No encontrado." }, { status: 404 });
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "").trim();

  if (!token) {
    return hiddenAuthCheckResponse();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return hiddenAuthCheckResponse();
    }

    const userEmail = getSupabaseUserEmail(data.user);

    if (!isFounderEmail(userEmail)) {
      return hiddenAuthCheckResponse();
    }

    const founderEmails = getFounderEmails();

    return NextResponse.json({
      authenticated: true,
      userEmail,
      founderEmailsConfigured: founderEmails.length > 0,
      founderEmailCount: founderEmails.length,
      matchesFounderEmail: true,
      reason: "Sesion founder validada.",
    });
  } catch {
    return hiddenAuthCheckResponse();
  }
}
