import { loadEnvConfig } from "@next/env";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  return Boolean(getGmailUser() && getGmailAppPassword());
}

function hasBrevoApiConfig() {
  return Boolean(getBrevoApiKey() && getFromEmail());
}

function hasBrevoSmtpConfig() {
  return Boolean(getSmtpUser() && getSmtpPass() && getFromEmail());
}

function notConfiguredMessage() {
  if (isVercel()) {
    return "El envío por correo no está configurado. En Vercel, agregue GMAIL_USER y GMAIL_APP_PASSWORD (o credenciales OAuth de Gmail) y vuelva a desplegar.";
  }
  return "El envío por correo no está configurado. Agregue GMAIL_USER y GMAIL_APP_PASSWORD en .env.local";
}

async function createGmailOAuthTransporter(): Promise<nodemailer.Transporter | null> {
  const user = getGmailUser();
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const refreshToken = getGoogleRefreshToken();
  if (!user || !clientId || !clientSecret || !refreshToken) return null;

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const accessTokenResponse = await oauth2Client.getAccessToken();
  const accessToken = accessTokenResponse.token;
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
  if (!user || !pass) return null;

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

function classifyMailError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/535|authentication failed|invalid login|unauthorized|401|403/i.test(message)) {
    return "Error de autenticación con Gmail. Verifique GMAIL_APP_PASSWORD o las credenciales OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).";
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
    hasBrevoSmtpConfig()
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
  const fromEmail = getFromEmail();
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
  input: SendQuoteEmailInput
): Promise<boolean> {
  const fromEmail = getFromEmail();
  if (!fromEmail) return false;

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

  try {
    if (hasGmailOAuthConfig()) {
      const transporter = await createGmailOAuthTransporter();
      if (transporter) {
        const sent = await sendViaTransporter(transporter, payload);
        if (sent) return;
      }
    }

    if (hasGmailSmtpConfig()) {
      const transporter = createGmailSmtpTransporter();
      if (transporter) {
        const sent = await sendViaTransporter(transporter, payload);
        if (sent) return;
      }
    }

    if (hasBrevoApiConfig()) {
      const sent = await sendViaBrevoApi(payload);
      if (sent) return;
    }

    if (hasBrevoSmtpConfig()) {
      const transporter = createBrevoSmtpTransporter();
      if (transporter) {
        const sent = await sendViaTransporter(transporter, payload);
        if (sent) return;
      }
    }

    throw new Error(notConfiguredMessage());
  } catch (error) {
    throw new Error(classifyMailError(error));
  }
}
