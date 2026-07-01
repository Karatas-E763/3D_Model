import { NextResponse } from "next/server";
import { readProducts, readQuoteConfig } from "@/lib/cms/store";
import {
  isEmailConfigured,
  isValidEmail,
  normalizeEmail,
  sendQuoteEmail,
} from "@/lib/email/sendQuoteEmail";
import type { Product, QuoteConfig } from "@/types";
import { generateQuotePdf } from "@/utils/quotePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SendQuoteBody {
  email: string;
  clientName?: string;
  vehicleTitle?: string;
  quoteItems: { productId: string; quantity: number }[];
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return errorResponse(
        "El envío por correo no está configurado en el servidor.",
        503
      );
    }

    let body: SendQuoteBody;
    try {
      body = (await request.json()) as SendQuoteBody;
    } catch {
      return errorResponse("Solicitud inválida", 400);
    }

    const email = normalizeEmail(body.email ?? "");
    const { clientName, vehicleTitle, quoteItems } = body;

    if (!isValidEmail(email)) {
      return errorResponse("Correo electrónico inválido", 400);
    }

    if (!Array.isArray(quoteItems) || quoteItems.length === 0) {
      return errorResponse("La cotización está vacía", 400);
    }

    const [products, configRaw] = await Promise.all([readProducts(), readQuoteConfig()]);
    const config = configRaw as unknown as QuoteConfig;

    const items = quoteItems
      .map((item) => {
        const product = (products as Product[]).find((p) => p.id === item.productId);
        if (!product) return null;
        return { product, quantity: item.quantity };
      })
      .filter((item): item is { product: Product; quantity: number } => item !== null);

    if (!items.length) {
      return errorResponse("No se encontraron productos válidos", 400);
    }

    const pdfDoc = generateQuotePdf({
      items,
      config,
      clientEmail: email,
      clientName,
      vehicleTitle,
    });
    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const pdfFilename = `cotizacion-${config.companyName.toLowerCase().replace(/\s+/g, "-")}.pdf`;

    const greeting = clientName?.trim() ? `Estimado/a ${clientName.trim()}` : "Estimado/a cliente";
    const subject = `Cotización ${config.companyName}${vehicleTitle ? ` — ${vehicleTitle}` : ""}`;
    const text = `${greeting},

Adjunto encontrará su cotización de ${config.companyName}.

${config.quoteFooter}

${config.providerName}
${config.providerPhone}
${config.providerEmail}`;

    const html = `
      <p>${greeting},</p>
      <p>Adjunto encontrará su cotización de <strong>${config.companyName}</strong>.</p>
      <p>${config.quoteFooter}</p>
      <p>
        ${config.providerName}<br/>
        ${config.providerPhone}<br/>
        <a href="mailto:${config.providerEmail}">${config.providerEmail}</a>
      </p>
    `.trim();

    await sendQuoteEmail({
      to: email,
      subject,
      text,
      html,
      fromName: config.companyName,
      pdfBuffer,
      pdfFilename,
    });

    return NextResponse.json({
      ok: true,
      message: "Cotización enviada correctamente",
    });
  } catch (error) {
    console.error("[quote/send]", error);
    const message =
      error instanceof Error ? error.message : "Error al enviar la cotización";

    if (message.includes("no está configurado") || message.includes("SMTP_FROM")) {
      return errorResponse(message, 503);
    }
    if (message.includes("inválido")) {
      return errorResponse(message, 400);
    }
    if (/conectar|Brevo SMTP|autenticación|remitente/i.test(message)) {
      return errorResponse(message, 502);
    }

    return errorResponse(message, 500);
  }
}
