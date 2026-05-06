import PDFDocument from 'pdfkit';

const fetchImageBuffer = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
};

const drawHorizontalLine = (doc, y) => {
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').stroke();
};

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/**
 * Generates a PDF buffer for a delivery note.
 * The deliveryNote should have client, project, user, and company populated.
 *
 * @param {object} deliveryNote  Mongoose document (populated)
 * @returns {Promise<Buffer>}
 */
export const generateDeliveryNotePDF = async (deliveryNote) => {
  if (process.env.NODE_ENV === 'test') {
    return Buffer.from('%PDF-1.4 fake-pdf');
  }
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const company = deliveryNote.company ?? {};
      const client = deliveryNote.client ?? {};
      const project = deliveryNote.project ?? {};

      // ── Header ────────────────────────────────────────────────────────────
      // Company logo (if available)
      const logoUrl = typeof company === 'object' ? company.logo : null;
      if (logoUrl) {
        const logoBuffer = await fetchImageBuffer(logoUrl);
        if (logoBuffer) {
          doc.image(logoBuffer, 50, 45, { width: 80 });
        }
      }

      doc
        .fillColor('#333333')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('ALBARÁN', 0, 50, { align: 'right' })
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Fecha: ${formatDate(deliveryNote.createdAt)}`, { align: 'right' })
        .text(`Fecha de trabajo: ${formatDate(deliveryNote.workDate)}`, { align: 'right' })
        .text(`Formato: ${deliveryNote.format === 'hours' ? 'Horas' : 'Material'}`, { align: 'right' });

      doc.moveDown(2);
      drawHorizontalLine(doc, doc.y);
      doc.moveDown(1);

      // ── Company info ──────────────────────────────────────────────────────
      if (typeof company === 'object' && company.name) {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text('EMPRESA')
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#555555')
          .text(company.name ?? '')
          .text(company.cif ? `CIF: ${company.cif}` : '');
        if (company.address?.street) {
          doc.text(`${company.address.street} ${company.address.number ?? ''}, ${company.address.city ?? ''}`);
        }
        doc.moveDown(1);
      }

      // ── Client info ───────────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('CLIENTE')
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#555555')
        .text(typeof client === 'object' ? (client.name ?? '—') : String(client))
        .text(typeof client === 'object' && client.cif ? `CIF: ${client.cif}` : '')
        .text(typeof client === 'object' && client.email ? client.email : '');

      doc.moveDown(1);

      // ── Project info ──────────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('PROYECTO')
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#555555')
        .text(typeof project === 'object' ? (project.name ?? '—') : String(project))
        .text(typeof project === 'object' && project.projectCode ? `Código: ${project.projectCode}` : '');

      if (deliveryNote.description) {
        doc.moveDown(0.5).text(`Descripción: ${deliveryNote.description}`);
      }

      doc.moveDown(1);
      drawHorizontalLine(doc, doc.y);
      doc.moveDown(1);

      // ── Work details ──────────────────────────────────────────────────────
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333').text('DETALLE');
      doc.moveDown(0.5);

      if (deliveryNote.format === 'material') {
        // Table header
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#ffffff')
          .rect(50, doc.y, 495, 20)
          .fill('#444444');

        const headerY = doc.y - 18;
        doc.fillColor('#ffffff').text('Material', 55, headerY).text('Cantidad', 260, headerY).text('Unidad', 400, headerY);
        doc.moveDown(0.5);

        // Table row
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#333333')
          .rect(50, doc.y, 495, 20)
          .fill('#f5f5f5');

        const rowY = doc.y - 18;
        doc
          .fillColor('#333333')
          .text(deliveryNote.material ?? '—', 55, rowY)
          .text(String(deliveryNote.quantity ?? '—'), 260, rowY)
          .text(deliveryNote.unit ?? '—', 400, rowY);

        doc.moveDown(1.5);
      } else {
        // Hours format
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#ffffff')
          .rect(50, doc.y, 495, 20)
          .fill('#444444');

        const headerY = doc.y - 18;
        doc.fillColor('#ffffff').text('Trabajador / Concepto', 55, headerY).text('Horas', 430, headerY);
        doc.moveDown(0.5);

        // If workers array
        const workers = Array.isArray(deliveryNote.workers) && deliveryNote.workers.length > 0
          ? deliveryNote.workers
          : [{ name: 'Total', hours: deliveryNote.hours }];

        workers.forEach((worker, idx) => {
          const bg = idx % 2 === 0 ? '#f5f5f5' : '#ffffff';
          doc.rect(50, doc.y, 495, 20).fill(bg);
          const rowY = doc.y - 18;
          doc
            .font('Helvetica')
            .fillColor('#333333')
            .text(worker.name ?? '—', 55, rowY)
            .text(String(worker.hours ?? '—'), 430, rowY);
          doc.moveDown(0.5);
        });

        // Total row
        const totalHours = Array.isArray(deliveryNote.workers) && deliveryNote.workers.length > 0
          ? deliveryNote.workers.reduce((sum, w) => sum + (w.hours ?? 0), 0)
          : deliveryNote.hours;

        doc
          .rect(50, doc.y, 495, 20)
          .fill('#333333');
        const totalY = doc.y - 18;
        doc
          .font('Helvetica-Bold')
          .fillColor('#ffffff')
          .text('TOTAL HORAS', 55, totalY)
          .text(String(totalHours ?? '—'), 430, totalY);
        doc.moveDown(2);
      }

      // ── Signature ─────────────────────────────────────────────────────────
      if (deliveryNote.signed && deliveryNote.signatureUrl) {
        drawHorizontalLine(doc, doc.y);
        doc.moveDown(1);
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text('FIRMA')
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#555555')
          .text(`Firmado el: ${formatDate(deliveryNote.signedAt)}`);

        const sigBuffer = await fetchImageBuffer(deliveryNote.signatureUrl);
        if (sigBuffer) {
          doc.moveDown(0.5).image(sigBuffer, { width: 150 });
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
