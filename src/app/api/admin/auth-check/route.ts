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
      aal: auth.aal,
      mfaVerified: auth.aal === "aal2",
      mfaRequired: true,
      reason:
        auth.aal === "aal2"
          ? "Sesion founder validada con segundo factor."
          : "Sesion founder valida, falta verificar segundo factor.",
    });
  } catch {
    return hiddenAuthCheckResponse();
  }
}
