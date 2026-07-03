import { jsPDF } from "jspdf";
import type { Product, QuoteConfig } from "@/types";
import { formatPrice } from "@/hooks/useProducts";

interface QuoteLineItem {
  product: Product;
  quantity: number;
}

interface GenerateQuotePdfOptions {
  items: QuoteLineItem[];
  config: QuoteConfig;
  clientEmail?: string;
  clientName?: string;
  vehicleTitle?: string;
}

const BRAND = {
  navy: [26, 58, 92] as [number, number, number],
  blue: [30, 136, 229] as [number, number, number],
  lightBlue: [227, 242, 253] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  darkGray: [60, 60, 60] as [number, number, number],
  border: [220, 220, 220] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function buildQuoteReference(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(now.getTime()).slice(-4);
  return `DR-${date}-${suffix}`;
}

export function generateQuotePdf({
  items,
  config,
  clientEmail,
  clientName,
  vehicleTitle,
}: GenerateQuotePdfOptions): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const quoteRef = buildQuoteReference();
  let y = 0;

  doc.setFillColor(...BRAND.blue);
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BRAND.white);
  doc.text("Directrack", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Control vehicular y gestión de flotas", margin, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("COTIZACIÓN", pageWidth - margin, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Ref: ${quoteRef}`, pageWidth - margin, 21, { align: "right" });

  y = 42;

  doc.setFillColor(...BRAND.lightBlue);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.darkGray);

  const infoLeft = [
    `Fecha: ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`,
    clientName ? `Cliente: ${clientName}` : null,
    clientEmail ? `Correo: ${clientEmail}` : null,
  ].filter(Boolean) as string[];

  const infoRight = [
    vehicleTitle ? `Unidad: ${vehicleTitle}` : null,
    "Vigencia: 15 días naturales",
    "Moneda: MXN",
  ].filter(Boolean) as string[];

  let infoY = y + 7;
  for (const line of infoLeft) {
    doc.text(line, margin + 4, infoY);
    infoY += 5;
  }

  infoY = y + 7;
  for (const line of infoRight) {
    doc.text(line, pageWidth / 2 + 4, infoY);
    infoY += 5;
  }

  y += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.navy);
  doc.text("Datos del proveedor", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.gray);
  const providerLines = [
    config.providerName,
    config.providerAddress,
    `Tel: ${config.providerPhone}`,
    `Email: directrack.toluca@gmail.com`,
    `RFC: ${config.providerRfc}`,
    "www.directrack.org",
  ];
  for (const line of providerLines) {
    doc.text(line, margin, y);
    y += 4.5;
  }

  y += 6;

  const colProduct = margin + 2;
  const colQty = margin + 98;
  const colUnit = margin + 118;
  const colSubtotal = margin + 150;
  const tableHeaderY = y;

  doc.setFillColor(...BRAND.navy);
  doc.roundedRect(margin, tableHeaderY, contentWidth, 8, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.white);
  doc.text("Producto / servicio", colProduct, tableHeaderY + 5.5);
  doc.text("Cant.", colQty, tableHeaderY + 5.5);
  doc.text("Precio unit.", colUnit, tableHeaderY + 5.5);
  doc.text("Importe", colSubtotal, tableHeaderY + 5.5);

  y = tableHeaderY + 10;
  let subtotal = 0;
  let rowIndex = 0;

  for (const { product, quantity } of items) {
    const lineSubtotal = product.price * quantity;
    subtotal += lineSubtotal;

    const nameLines = wrapText(doc, product.name, 88);
    const rowHeight = Math.max(nameLines.length * 4.5, 8) + 4;

    if (y + rowHeight > pageHeight - 70) {
      doc.addPage();
      y = margin;
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, contentWidth, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.darkGray);
    doc.text(nameLines, colProduct, y + 3);
    doc.text(String(quantity), colQty, y + 3);
    doc.text(formatPrice(product.price), colUnit, y + 3);
    doc.setFont("helvetica", "bold");
    doc.text(formatPrice(lineSubtotal), colSubtotal, y + 3);

    y += rowHeight;
    rowIndex += 1;
  }

  const iva = subtotal * config.ivaRate;
  const total = subtotal + iva;

  y += 4;
  const totalsX = margin + 108;
  const totalsWidth = contentWidth - 108;

  doc.setDrawColor(...BRAND.border);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(totalsX, y, totalsWidth, 28, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.darkGray);

  let totalsY = y + 7;
  doc.text("Subtotal:", totalsX + 4, totalsY);
  doc.text(formatPrice(subtotal), pageWidth - margin - 4, totalsY, { align: "right" });
  totalsY += 6;
  doc.text(`IVA (${Math.round(config.ivaRate * 100)}%):`, totalsX + 4, totalsY);
  doc.text(formatPrice(iva), pageWidth - margin - 4, totalsY, { align: "right" });
  totalsY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.navy);
  doc.text("Total:", totalsX + 4, totalsY);
  doc.text(formatPrice(total), pageWidth - margin - 4, totalsY, { align: "right" });

  y += 36;

  if (y > pageHeight - 75) {
    doc.addPage();
    y = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.navy);
  doc.text("Condiciones comerciales", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.darkGray);
  const paymentLines = wrapText(doc, config.paymentTerms, contentWidth);
  doc.text(paymentLines, margin, y);
  y += paymentLines.length * 4.5 + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Notas", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const notes = wrapText(
    doc,
    `${config.quoteFooter} Más de 20 años de experiencia en rastreo y gestión vehicular. Soluciones eficientes, seguras y adaptadas a sus necesidades.`,
    contentWidth
  );
  doc.text(notes, margin, y);
  y += notes.length * 4.5 + 10;

  if (y > pageHeight - 45) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(...BRAND.blue);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.navy);
  doc.text("Lic. Alejandro Flores Arias", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.gray);
  doc.text("Gerente de Ventas — Directrack", margin, y);
  y += 5;
  doc.text("5649498021  |  directrack.toluca@gmail.com  |  www.directrack.org", margin, y);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Documento generado automáticamente · ${quoteRef} · ${new Date().toLocaleString("es-MX")}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  return doc;
}

export function downloadQuotePdf(options: GenerateQuotePdfOptions, filename?: string) {
  const doc = generateQuotePdf(options);
  doc.save(filename ?? `cotizacion-directrack-${Date.now()}.pdf`);
}

export function getQuotePdfBase64(options: GenerateQuotePdfOptions): string {
  const doc = generateQuotePdf(options);
  return doc.output("datauristring").split(",")[1] ?? "";
}
