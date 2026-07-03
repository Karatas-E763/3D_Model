import { loadEnvConfig } from "@next/env";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GMAIL_APP_PASSWORD_PATTERN = /^[a-z0-9]{16}$/i;

function sanitizeEnv(value: string | undefined) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().replace(/^['"]|['"]$/g, "").replace(/\r/g, "");
  return cleaned !== "" ? cleaned : undefined;
}

function readMailEnv() {
  loadEnvConfig(process.cwd());
}

function getBrevoApiKey() {
  readMailEnv();
  return sanitizeEnv(process.env.BREVO_API_KEY);
}

function getSmtpHost() {
  readMailEnv();
  return sanitizeEnv(process.env.SMTP_HOST) ?? "smtp-relay.brevo.com";
}

function getSmtpUser() {
  readMailEnv();
  return sanitizeEnv(process.env.SMTP_USER);
}

function getSmtpPass() {
  readMailEnv();
  return sanitizeEnv(process.env.SMTP_PASS);
}

function getGmailUser() {
  readMailEnv();
  return sanitizeEnv(process.env.GMAIL_USER) ?? sanitizeEnv(process.env.SMTP_FROM);
}

function getGmailAppPassword() {
  readMailEnv();
  return sanitizeEnv(process.env.GMAIL_APP_PASSWORD);
}

function getGoogleClientId() {
  readMailEnv();
  return sanitizeEnv(process.env.GOOGLE_CLIENT_ID);
}

function getGoogleClientSecret() {
  readMailEnv();
  return sanitizeEnv(process.env.GOOGLE_CLIENT_SECRET);
}

function getGoogleRefreshToken() {
  readMailEnv();
  return sanitizeEnv(process.env.GOOGLE_REFRESH_TOKEN);
}

function getFromEmail() {
  readMailEnv();
  return getGmailUser() ?? sanitizeEnv(process.env.SMTP_FROM);
}

function getBrevoFromEmail() {
  readMailEnv();
  return sanitizeEnv(process.env.BREVO_FROM) ?? sanitizeEnv(process.env.SMTP_FROM) ?? getGmailUser();
}

function isVercel() {
  return process.env.VERCEL === "1";
}

function hasGmailOAuthConfig() {
  return Boolean(
    getGmailUser() &&
      getGoogleClientId() &&
      getGoogleClientSecret() &&
      getGoogleRefreshToken()
  );
}

function hasGmailSmtpConfig() {
  const pass = getGmailAppPassword();
  return Boolean(getGmailUser() && pass && GMAIL_APP_PASSWORD_PATTERN.test(pass));
}

function hasBrevoApiConfig() {
  return Boolean(getBrevoApiKey() && getBrevoFromEmail());
}

function hasBrevoSmtpConfig() {
  return Boolean(getSmtpUser() && getSmtpPass() && getBrevoFromEmail());
}

function notConfiguredMessage() {
  if (isVercel()) {
    return "El envío por correo no está configurado. En Vercel, configure GOOGLE_REFRESH_TOKEN (npm run gmail:oauth) o GMAIL_APP_PASSWORD de 16 caracteres.";
  }
  return "El envío por correo no está configurado. Ejecute npm run gmail:oauth o configure GMAIL_APP_PASSWORD de 16 caracteres.";
}

async function getGmailAccessToken(): Promise<string | null> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const refreshToken = getGoogleRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const accessTokenResponse = await oauth2Client.getAccessToken();
  return accessTokenResponse.token ?? null;
}

function encodeMimeHeader(value: string) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function buildMimeMessage(input: SendQuoteEmailInput, fromEmail: string): string {
  const boundary = `directrack_${Date.now()}`;
  const chunks = [
    `From: "${input.fromName}" <${fromEmail}>`,
    `To: ${input.to}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: multipart/alternative; boundary=\"alt\"",
    "",
    "--alt",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "--alt",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "--alt--",
    `--${boundary}`,
    "Content-Type: application/pdf; name=\"" + input.pdfFilename + "\"",
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${input.pdfFilename}"`,
    "",
    input.pdfBuffer.toString("base64"),
    `--${boundary}--`,
  ];
  return chunks.join("\r\n");
}

async function sendViaGmailApi(input: SendQuoteEmailInput): Promise<boolean> {
  const fromEmail = getFromEmail();
  const accessToken = await getGmailAccessToken();
  if (!fromEmail || !accessToken) return false;

  const raw = Buffer.from(buildMimeMessage(input, fromEmail)).toString("base64url");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Gmail API error (${response.status})`);
  }

  return true;
}

async function createGmailOAuthTransporter(): Promise<nodemailer.Transporter | null> {
  const user = getGmailUser();
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const refreshToken = getGoogleRefreshToken();
  if (!user || !clientId || !clientSecret || !refreshToken) return null;

  const accessToken = await getGmailAccessToken();
  if (!accessToken) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user,
      clientId,
      clientSecret,
      refreshToken,
      accessToken,
    },
  });
}

function createGmailSmtpTransporter(): nodemailer.Transporter | null {
  const user = getGmailUser();
  const pass = getGmailAppPassword();
  if (!user || !pass || !GMAIL_APP_PASSWORD_PATTERN.test(pass)) return null;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

function createBrevoSmtpTransporter(): nodemailer.Transporter | null {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!user || !pass) return null;

  const port = Number(sanitizeEnv(process.env.SMTP_PORT) ?? 587);
  const secure = sanitizeEnv(process.env.SMTP_SECURE) === "true";

  return nodemailer.createTransport({
    host: getSmtpHost(),
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

function classifyMailError(errors: string[]): string {
  const message = errors.join(" | ");

  if (/refresh_token|invalid_grant|GOOGLE_REFRESH_TOKEN/i.test(message)) {
    return "Token OAuth de Gmail expirado o inválido. Ejecute npm run gmail:oauth y actualice GOOGLE_REFRESH_TOKEN.";
  }
  if (/535|534|authentication failed|invalid login|unauthorized|401|403/i.test(message)) {
    return "Error de autenticación con Gmail. Ejecute npm run gmail:oauth para generar GOOGLE_REFRESH_TOKEN, o use una contraseña de aplicación de 16 caracteres en GMAIL_APP_PASSWORD.";
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED/i.test(message)) {
    return "No se pudo conectar al servicio de correo. Intente de nuevo en unos momentos.";
  }
  if (/550|553|sender|from address|not verified/i.test(message)) {
    return "El remitente no está autorizado. Verifique que GMAIL_USER sea directrack.toluca@gmail.com.";
  }

  return message || "Error al enviar la cotización por correo";
}

export function isValidEmail(email: string) {
  const trimmed = email.trim();
  return trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);
}

/** Preserves the address exactly as entered (trimmed only). */
export function trimEmail(email: string) {
  return email.trim();
}

/** @deprecated Use trimEmail to preserve recipient casing. */
export function normalizeEmail(email: string) {
  return email.trim();
}

export function isEmailConfigured(): boolean {
  return (
    hasGmailOAuthConfig() ||
    hasGmailSmtpConfig() ||
    hasBrevoApiConfig() ||
    hasBrevoSmtpConfig() ||
    Boolean(getGmailUser() && getGoogleClientId() && getGoogleClientSecret())
  );
}

interface SendQuoteEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromName: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

async function sendViaBrevoApi(input: SendQuoteEmailInput): Promise<boolean> {
  const apiKey = getBrevoApiKey();
  const fromEmail = getBrevoFromEmail();
  if (!apiKey || !fromEmail) return false;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: input.fromName,
        email: fromEmail,
      },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
      attachment: [
        {
          name: input.pdfFilename,
          content: input.pdfBuffer.toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Brevo API error (${response.status})`);
  }

  return true;
}

async function sendViaTransporter(
  transporter: nodemailer.Transporter,
  input: SendQuoteEmailInput,
  fromEmail: string
): Promise<boolean> {
  const mail: Mail.Options = {
    from: `"${input.fromName}" <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: [
      {
        filename: input.pdfFilename,
        content: input.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  try {
    await transporter.sendMail(mail);
    return true;
  } finally {
    transporter.close();
  }
}

async function tryProvider(
  name: string,
  fn: () => Promise<boolean>
): Promise<{ name: string; ok: boolean; error?: string }> {
  try {
    const ok = await fn();
    if (ok) return { name, ok: true };
    return { name, ok: false, error: "no configurado" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sendQuoteEmail] ${name} failed:`, message);
    return { name, ok: false, error: message };
  }
}

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<void> {
  readMailEnv();

  const recipient = trimEmail(input.to);
  if (!isValidEmail(recipient)) {
    throw new Error("Correo electrónico inválido");
  }

  if (!isEmailConfigured()) {
    throw new Error(notConfiguredMessage());
  }

  const fromEmail = getFromEmail();
  if (!fromEmail || !isValidEmail(fromEmail)) {
    throw new Error("GMAIL_USER no está configurado o es inválido");
  }

  const payload = { ...input, to: recipient };
  const attempts: { name: string; ok: boolean; error?: string }[] = [];

  if (hasGmailOAuthConfig()) {
    attempts.push(
      await tryProvider("Gmail API (OAuth)", () => sendViaGmailApi(payload))
    );
    if (attempts.at(-1)?.ok) return;

    const transporter = await createGmailOAuthTransporter();
    if (transporter) {
      attempts.push(
        await tryProvider("Gmail SMTP (OAuth)", () =>
          sendViaTransporter(transporter, payload, fromEmail)
        )
      );
      if (attempts.at(-1)?.ok) return;
    }
  }

  if (hasGmailSmtpConfig()) {
    const transporter = createGmailSmtpTransporter();
    if (transporter) {
      attempts.push(
        await tryProvider("Gmail SMTP", () =>
          sendViaTransporter(transporter, payload, fromEmail)
        )
      );
      if (attempts.at(-1)?.ok) return;
    }
  }

  if (hasBrevoApiConfig()) {
    attempts.push(await tryProvider("Brevo API", () => sendViaBrevoApi(payload)));
    if (attempts.at(-1)?.ok) return;
  }

  if (hasBrevoSmtpConfig()) {
    const transporter = createBrevoSmtpTransporter();
    const brevoFrom = getBrevoFromEmail();
    if (transporter && brevoFrom) {
      attempts.push(
        await tryProvider("Brevo SMTP", () =>
          sendViaTransporter(transporter, payload, brevoFrom)
        )
      );
      if (attempts.at(-1)?.ok) return;
    }
  }

  const errors = attempts
    .filter((attempt) => !attempt.ok)
    .map((attempt) => `${attempt.name}: ${attempt.error ?? "falló"}`);

  if (errors.length === 0) {
    throw new Error(notConfiguredMessage());
  }

  throw new Error(classifyMailError(errors));
}
