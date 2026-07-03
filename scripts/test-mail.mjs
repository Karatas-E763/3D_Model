import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";

const envPath = resolve(import.meta.dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function testGmailSmtp() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return "skip: no gmail smtp config";

  const t = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
  });
  try {
    await t.verify();
    t.close();
    return "ok";
  } catch (e) {
    t.close();
    return `fail: ${e instanceof Error ? e.message : e}`;
  }
}

async function testGmailOAuth() {
  const user = process.env.GMAIL_USER;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!user || !clientId || !clientSecret || !refreshToken) return "skip: no oauth config";

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  try {
    const token = await oauth2Client.getAccessToken();
    return token.token ? "ok" : "fail: no access token";
  } catch (e) {
    return `fail: ${e instanceof Error ? e.message : e}`;
  }
}

async function testBrevoApi() {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SMTP_FROM ?? process.env.GMAIL_USER;
  if (!apiKey || !from) return "skip";

  const res = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });
  return res.ok ? `ok (from=${from})` : `fail: ${res.status}`;
}

async function testBrevoSmtp() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return "skip";

  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp-relay.brevo.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user, pass },
  });
  try {
    await t.verify();
    t.close();
    return "ok";
  } catch (e) {
    t.close();
    return `fail: ${e instanceof Error ? e.message : e}`;
  }
}

console.log("Gmail SMTP:", await testGmailSmtp());
console.log("Gmail OAuth:", await testGmailOAuth());
console.log("Brevo API:", await testBrevoApi());
console.log("Brevo SMTP:", await testBrevoSmtp());
