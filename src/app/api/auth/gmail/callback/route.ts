import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ ok: false, error: "Falta código de autorización" }, { status: 400 });
  }

  try {
    const oauth2Client = getOAuthClient(request);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google no devolvió refresh_token. Revoke el acceso en myaccount.google.com/permissions y vuelva a autorizar con prompt=consent.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Copie GOOGLE_REFRESH_TOKEN en .env.local y en Vercel Environment Variables.",
      GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al intercambiar código OAuth";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
