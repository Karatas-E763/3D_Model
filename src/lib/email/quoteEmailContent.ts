export const QUOTE_EMAIL_FROM_NAME = "Directrack";

export function buildQuoteEmailContent(clientName?: string) {
  const greeting = clientName?.trim()
    ? `Reciba un cordial saludo, ${clientName.trim()}.`
    : "Reciba un cordial saludo.";

  const body = `Adjunto a este correo encontrará la cotización solicitada con la propuesta que hemos preparado especialmente para usted, diseñada para brindarle una solución eficiente, segura y adaptada a sus necesidades.

En Directrack contamos con más de 20 años de experiencia en soluciones de rastreo y gestión vehicular, ayudando a nuestros clientes a mejorar el control de sus unidades, incrementar la seguridad y optimizar sus operaciones.

Estamos convencidos de que esta propuesta puede aportar un gran valor a su empresa y nos encantaría tener la oportunidad de convertirnos en su aliado estratégico.

Quedo a su disposición para resolver cualquier duda, realizar ajustes a la propuesta o programar una llamada para revisar los detalles y ayudarle a tomar la mejor decisión.

We thank you for your trust and hope to begin this collaboration very soon.

Greetings,

Lic. Alejandro Flores Arias
Gerente de Ventas
Directrack
5649498021
directrack.toluca@gmail.com
www.directrack.org`;

  const text = `${greeting}

${body}`;

  const html = `
    <p>${greeting}</p>
    <p>Adjunto a este correo encontrará la cotización solicitada con la propuesta que hemos preparado especialmente para usted, diseñada para brindarle una solución eficiente, segura y adaptada a sus necesidades.</p>
    <p>En Directrack contamos con más de 20 años de experiencia en soluciones de rastreo y gestión vehicular, ayudando a nuestros clientes a mejorar el control de sus unidades, incrementar la seguridad y optimizar sus operaciones.</p>
    <p>Estamos convencidos de que esta propuesta puede aportar un gran valor a su empresa y nos encantaría tener la oportunidad de convertirnos en su aliado estratégico.</p>
    <p>Quedo a su disposición para resolver cualquier duda, realizar ajustes a la propuesta o programar una llamada para revisar los detalles y ayudarle a tomar la mejor decisión.</p>
    <p>We thank you for your trust and hope to begin this collaboration very soon.</p>
    <p>
      Greetings,<br/><br/>
      <strong>Lic. Alejandro Flores Arias</strong><br/>
      Gerente de Ventas<br/>
      Directrack<br/>
      📞 5649498021<br/>
      📧 <a href="mailto:directrack.toluca@gmail.com">directrack.toluca@gmail.com</a><br/>
      <a href="https://www.directrack.org">www.directrack.org</a>
    </p>
  `.trim();

  return { text, html };
}

export function buildQuoteEmailSubject(vehicleTitle?: string) {
  return vehicleTitle
    ? `Cotización Directrack — ${vehicleTitle}`
    : "Cotización Directrack";
}
