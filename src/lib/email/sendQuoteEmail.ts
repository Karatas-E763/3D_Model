import { loadEnvConfig } from "@next/env";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

loadEnvConfig(process.cwd());

let smtpTransporter: nodemailer.Transporter | null = null;

function trimEnv(value: string | undefined) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function getResendApiKey() {
  return trimEnv(process.env.RESEND_API_KEY);
}

function getResendFrom() {
  return trimEnv(process.env.RESEND_FROM) ?? trimEnv(process.env.SMTP_FROM);
}

function getSmtpHost() {
  return trimEnv(process.env.SMTP_HOST);
}

function getSmtpUser() {
  return trimEnv(process.env.SMTP_USER);
}

function getSmtpPass() {
  return trimEnv(process.env.SMTP_PASS);
}

function getSmtpFrom() {
  return trimEnv(process.env.SMTP_FROM) ?? getSmtpUser();
}

function isVercel() {
  return process.env.VERCEL === "1";
}

function notConfiguredMessage() {
  if (isVercel()) {
    return "El envío por correo no está configurado. En Vercel, agregue RESEND_API_KEY en Configuración del proyecto → Variables de entorno y vuelva a desplegar.";
  }
  return "El envío por correo no está configurado. Agregue RESEND_API_KEY o SMTP_HOST, SMTP_USER y SMTP_PASS en .env.local";
}

function getSmtpTransporter(): nodemailer.Transporter | null {
  const host = getSmtpHost();
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!host || !user || !pass) return null;

  if (!smtpTransporter) {
    const port = Number(trimEnv(process.env.SMTP_PORT) ?? 587);
    const secure = trimEnv(process.env.SMTP_SECURE) === "true";

    smtpTransporter = nodemailer.createTransport({
      ...(isVercel()
        ? {}
        : { pool: true, maxConnections: 3, maxMessages: 200 }),
      host,
      port,
      secure,
      requireTLS: !secure && port === 587,
      auth: { user, pass },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });
  }

  return smtpTransporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(getResendApiKey() || getSmtpTransporter());
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
  const transporter = getSmtpTransporter();
  if (!transporter) return false;

  const fromEmail = getSmtpFrom();
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

  await transporter.sendMail(mail);
  return true;
}

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<void> {
  const recipient = input.to.trim();
  if (!recipient) {
    throw new Error("Correo electrónico inválido");
  }

  const payload = { ...input, to: recipient };

  if (getSmtpTransporter()) {
    const sent = await sendViaSmtp(payload);
    if (sent) return;
  }

  if (getResendApiKey()) {
    const sent = await sendViaResend(payload);
    if (sent) return;
  }

  throw new Error(notConfiguredMessage());
}
