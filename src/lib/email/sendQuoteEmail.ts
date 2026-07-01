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

function missingEnvVars() {
  const missing: string[] = [];
  if (!getSmtpUser()) missing.push("SMTP_USER");
  if (!getSmtpPass()) missing.push("SMTP_PASS");
  if (!getSmtpFrom()) missing.push("SMTP_FROM");
  return missing;
}

function notConfiguredMessage() {
  const missing = missingEnvVars();
  const vars = missing.length > 0 ? missing.join(", ") : "SMTP_USER, SMTP_PASS, SMTP_FROM";

  if (isVercel()) {
    return `El envío por correo no está configurado. En Vercel, agregue ${vars} en Variables de entorno y vuelva a desplegar.`;
  }
  return `El envío por correo no está configurado. Agregue ${vars} en .env.local`;
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

function classifySmtpError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/535|authentication failed|invalid login/i.test(message)) {
    return "Error de autenticación con Brevo SMTP. Verifique SMTP_USER (login SMTP) y SMTP_PASS (clave SMTP de Transactional → SMTP & API).";
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED/i.test(message)) {
    return "No se pudo conectar al servidor de correo Brevo. Intente de nuevo en unos momentos.";
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
  return missingEnvVars().length === 0;
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

  const transporter = createSmtpTransporter();
  if (!transporter) {
    throw new Error(notConfiguredMessage());
  }

  const mail: Mail.Options = {
    from: `"${input.fromName}" <${fromEmail}>`,
    to: recipient,
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
  } catch (error) {
    throw new Error(classifySmtpError(error));
  } finally {
    transporter.close();
  }
}
