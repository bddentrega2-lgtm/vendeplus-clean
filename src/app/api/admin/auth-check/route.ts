import { NextRequest, NextResponse } from "next/server";
import {
  getFounderEmails,
  getPanelAuthContext,
} from "@/lib/panel/auth";

function hiddenAuthCheckResponse() {
  return NextResponse.json({ error: "No encontrado." }, { status: 404 });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPanelAuthContext(request);
    if (!auth.isAuthorized || !auth.isFounderMode || !auth.email) {
      return hiddenAuthCheckResponse();
    }

    const founderEmails = getFounderEmails();

    return NextResponse.json({
      authenticated: true,
      userEmail: auth.email,
      founderEmailsConfigured: founderEmails.length > 0,
      founderEmailCount: founderEmails.length,
      matchesFounderEmail: true,
      reason: "Sesion founder validada.",
    });
  } catch {
    return hiddenAuthCheckResponse();
  }
}
