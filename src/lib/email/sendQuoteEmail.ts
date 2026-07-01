import { loadEnvConfig } from "@next/env";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

function sanitizeEnv(value: string | undefined) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().replace(/^['"]|['"]$/g, "").replace(/\r/g, "");
  return cleaned !== "" ? cleaned : undefined;
}

function readMailEnv() {
  loadEnvConfig(process.cwd());
}

function getResendApiKey() {
  readMailEnv();
  return sanitizeEnv(process.env.RESEND_API_KEY);
}

function getResendFrom() {
  readMailEnv();
  return sanitizeEnv(process.env.RESEND_FROM) ?? sanitizeEnv(process.env.SMTP_FROM);
}

function getSmtpHost() {
  readMailEnv();
  return sanitizeEnv(process.env.SMTP_HOST);
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

function notConfiguredMessage() {
  if (isVercel()) {
    return "El envío por correo no está configurado. En Vercel, agregue SMTP_HOST, SMTP_USER y SMTP_PASS en Variables de entorno y vuelva a desplegar.";
  }
  return "El envío por correo no está configurado. Agregue SMTP_HOST, SMTP_USER y SMTP_PASS en .env.local";
}

function createSmtpTransporter(): nodemailer.Transporter | null {
  const host = getSmtpHost();
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!host || !user || !pass) return null;

  const port = Number(sanitizeEnv(process.env.SMTP_PORT) ?? 587);
  const secure = sanitizeEnv(process.env.SMTP_SECURE) === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

function smtpAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/535|authentication failed|invalid login/i.test(message)) {
    return message;
  }
  return "Error de autenticación SMTP con Brevo. Verifique que SMTP_USER sea su correo de acceso a Brevo (o el login SMTP de Transactional → SMTP & API) y que SMTP_PASS sea la clave SMTP completa, no la contraseña de la cuenta ni la API key.";
}

export function isEmailConfigured(): boolean {
  return Boolean(getResendApiKey() || createSmtpTransporter());
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

async function sendViaResend(input: SendQuoteEmailInput): Promise<boolean> {
  const apiKey = getResendApiKey();
  if (!apiKey) return false;

  const from =
    getResendFrom() ?? `"${input.fromName}" <onboarding@resend.dev>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: [
        {
          filename: input.pdfFilename,
          content: input.pdfBuffer.toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Resend error (${response.status})`);
  }

  return true;
}

async function sendViaSmtp(input: SendQuoteEmailInput): Promise<boolean> {
  const transporter = createSmtpTransporter();
  if (!transporter) return false;

  const fromEmail = getSmtpFrom();
  if (!fromEmail) {
    throw new Error("SMTP_FROM no está configurado");
  }

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
  } catch (error) {
    throw new Error(smtpAuthErrorMessage(error));
  } finally {
    transporter.close();
  }
}

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<void> {
  readMailEnv();

  const recipient = input.to.trim();
  if (!recipient) {
    throw new Error("Correo electrónico inválido");
  }

  const payload = { ...input, to: recipient };

  if (createSmtpTransporter()) {
    const sent = await sendViaSmtp(payload);
    if (sent) return;
  }

  if (getResendApiKey()) {
    const sent = await sendViaResend(payload);
    if (sent) return;
  }

  throw new Error(notConfiguredMessage());
}
