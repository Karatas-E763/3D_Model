/**
 * Genera GOOGLE_REFRESH_TOKEN para Gmail OAuth2.
 *
 * Uso:
 *   npm run gmail:oauth
 *   npm run gmail:oauth -- <codigo_de_autorizacion>
 *
 * Requisito en Google Cloud Console → Credenciales → URI de redirección:
 *   http://localhost:8765/oauth2callback
 */
import http from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { OAuth2Client } from "google-auth-library";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = resolve(ROOT, ".env.local");
const REDIRECT_URI = "http://localhost:8765/oauth2callback";
const SCOPES = ["https://mail.google.com/"];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function upsertEnvVar(path, key, value) {
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) updated.push(`${key}=${value}`);
  writeFileSync(path, updated.join("\n").replace(/\n+$/, "\n"), "utf8");
}

function getCredentials() {
  const fileVars = loadEnvFile(ENV_PATH);
  const clientId =
    process.env.GOOGLE_CLIENT_ID ??
    fileVars.GOOGLE_CLIENT_ID ??
    "635808336149-l2k713noeq0o1hcundsasriemcl6gokv.apps.googleusercontent.com";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ??
    fileVars.GOOGLE_CLIENT_SECRET ??
    "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";
  return { clientId, clientSecret };
}

async function exchangeCode(oauth2Client, code) {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google no devolvió refresh_token. Revoke acceso en https://myaccount.google.com/permissions y ejecute de nuevo con prompt=consent."
    );
  }
  return tokens;
}

async function saveTokens(tokens) {
  upsertEnvVar(ENV_PATH, "GOOGLE_REFRESH_TOKEN", tokens.refresh_token);
  console.log("\n✓ GOOGLE_REFRESH_TOKEN guardado en .env.local");
  console.log(`  ${tokens.refresh_token.slice(0, 20)}...`);
}

async function runWithCode(code) {
  const { clientId, clientSecret } = getCredentials();
  const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  const tokens = await exchangeCode(oauth2Client, code);
  await saveTokens(tokens);
}

async function runInteractive() {
  const { clientId, clientSecret } = getCredentials();
  const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    login_hint: "directrack.toluca@gmail.com",
  });

  console.log("\n1. Abra esta URL en el navegador e inicie sesión con directrack.toluca@gmail.com:\n");
  console.log(authUrl);
  console.log("\n2. Autorice el acceso. Será redirigido a localhost:8765.\n");

  await new Promise((resolvePromise, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/oauth2callback")) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>Error OAuth</h1><p>${error}</p>`);
        server.close();
        reject(new Error(error));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Falta código de autorización</h1>");
        return;
      }

      try {
        const tokens = await exchangeCode(oauth2Client, code);
        await saveTokens(tokens);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h1>OAuth completado</h1><p>GOOGLE_REFRESH_TOKEN guardado en .env.local. Puede cerrar esta ventana.</p>"
        );
        server.close();
        resolvePromise(tokens);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>Error</h1><pre>${err instanceof Error ? err.message : err}</pre>`);
        server.close();
        reject(err);
      }
    });

    server.listen(8765, () => {
      console.log("Esperando callback en http://localhost:8765/oauth2callback ...\n");
    });

    server.on("error", reject);
  });
}

const codeArg = process.argv[2]?.trim();

try {
  if (codeArg) {
    await runWithCode(codeArg);
  } else {
    await runInteractive();
  }
} catch (error) {
  console.error("\nError:", error instanceof Error ? error.message : error);
  process.exit(1);
}
