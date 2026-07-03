import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = ["https://mail.google.com/"];

function getOAuthClient(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET no están configurados");
  }

  const redirectUri = new URL("/api/auth/gmail/callback", request.url).toString();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export async function GET(request: Request) {
  try {
    const oauth2Client = getOAuthClient(request);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      login_hint: process.env.GMAIL_USER ?? "directrack.toluca@gmail.com",
    });
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error OAuth";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
