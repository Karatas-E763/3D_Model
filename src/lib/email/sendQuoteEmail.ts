import { loadEnvConfig } from "@next/env";
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

function getSmtpFrom() {
  readMailEnv();
  return sanitizeEnv(process.env.SMTP_FROM);
}

function isVercel() {
  return process.env.VERCEL === "1";
}

function hasBrevoApiConfig() {
  return Boolean(getBrevoApiKey() && getSmtpFrom());
}

function hasSmtpConfig() {
  return Boolean(getSmtpUser() && getSmtpPass() && getSmtpFrom());
}

function notConfiguredMessage() {
  if (isVercel()) {
    return "El envío por correo no está configurado. En Vercel, agregue BREVO_API_KEY y SMTP_FROM (o SMTP_USER, SMTP_PASS y SMTP_FROM) y vuelva a desplegar.";
  }
  return "El envío por correo no está configurado. Agregue BREVO_API_KEY y SMTP_FROM en .env.local";
}

function createSmtpTransporter(): nodemailer.Transporter | null {
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
    return "Error de autenticación con Brevo. Verifique BREVO_API_KEY o las credenciales SMTP en Transactional → SMTP & API.";
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED/i.test(message)) {
    return "No se pudo conectar al servicio de correo Brevo. Intente de nuevo en unos momentos.";
  }
  if (/550|553|sender|from address|not verified/i.test(message)) {
    return "El remitente no está verificado en Brevo. Verifique que SMTP_FROM coincida con un remitente autorizado.";
  }

  return message || "Error al enviar la cotización por correo";
}

export function isValidEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && EMAIL_PATTERN.test(normalized);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmailConfigured(): boolean {
  return hasBrevoApiConfig() || hasSmtpConfig();
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
  const fromEmail = getSmtpFrom();
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

async function sendViaSmtp(input: SendQuoteEmailInput): Promise<boolean> {
  const transporter = createSmtpTransporter();
  const fromEmail = getSmtpFrom();
  if (!transporter || !fromEmail) return false;

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

  const recipient = normalizeEmail(input.to);
  if (!isValidEmail(recipient)) {
    throw new Error("Correo electrónico inválido");
  }

  if (!isEmailConfigured()) {
    throw new Error(notConfiguredMessage());
  }

  const fromEmail = getSmtpFrom();
  if (!fromEmail || !isValidEmail(fromEmail)) {
    throw new Error("SMTP_FROM no está configurado o es inválido");
  }

  const payload = { ...input, to: recipient };

  try {
    if (hasBrevoApiConfig()) {
      const sent = await sendViaBrevoApi(payload);
      if (sent) return;
    }

    if (hasSmtpConfig()) {
      const sent = await sendViaSmtp(payload);
      if (sent) return;
    }

    throw new Error(notConfiguredMessage());
  } catch (error) {
    throw new Error(classifyMailError(error));
  }
}
