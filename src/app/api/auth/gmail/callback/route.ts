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
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem"><h1>Error OAuth</h1><p>${error}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code) {
    return NextResponse.json({ ok: false, error: "Falta código de autorización" }, { status: 400 });
  }

  try {
    const oauth2Client = getOAuthClient(request);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:2rem;max-width:640px">
          <h1>Sin refresh token</h1>
          <p>Revoke el acceso en <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> y vuelva a autorizar.</p>
        </body></html>`,
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Gmail OAuth — Directrack</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:720px;line-height:1.5">
  <h1>OAuth completado</h1>
  <p>Copie este valor en <strong>GOOGLE_REFRESH_TOKEN</strong> (.env.local y Vercel):</p>
  <textarea readonly style="width:100%;height:120px;font-family:monospace">${tokens.refresh_token}</textarea>
  <p>Después redepliegue en Vercel. Las cotizaciones se enviarán desde directrack.toluca@gmail.com.</p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al intercambiar código OAuth";
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem"><h1>Error</h1><pre>${message}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
