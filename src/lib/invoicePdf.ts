import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompanyProfile, Invoice } from '../types';
import { formatDateId, formatDateTimeId, formatIdr, INVOICE_STATUS_META } from './formatters';

interface JsPdfWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export function generateInvoicePdf(invoice: Invoice, company: CompanyProfile): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // --- Header Band ---
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 44, 'F');

  let textStartX = margin;
  if (company.logoDataUrl && company.logoDataUrl.startsWith('data:image/')) {
    try {
      const format = company.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 9, 26, 26, 2, 2, 'F');
      doc.addImage(company.logoDataUrl, format, margin + 1.5, 10.5, 23, 23, undefined, 'FAST');
      textStartX = margin + 31;
    } catch {
      textStartX = margin;
    }
  }

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('FAKTUR RESMI PERUSAHAAN', textStartX, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.name, textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const companyAddressLines = doc.splitTextToSize(company.address, 95);
  doc.text(companyAddressLines, textStartX, 27);
  doc.text(`NPWP: ${company.npwp}  |  ${company.email}  |  ${company.phone}`, textStartX, 38);

  // Right Header: Invoice Number & Status
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(invoice.invoiceNumber, pageWidth - margin, 20, { align: 'right' });

  const statusLabel = INVOICE_STATUS_META[invoice.status]?.label?.toUpperCase() || invoice.status.toUpperCase();
  if (invoice.status === 'paid') {
    doc.setTextColor(110, 231, 183);
  } else if (invoice.status === 'overdue') {
    doc.setTextColor(252, 165, 165);
  } else {
    doc.setTextColor(253, 224, 71);
  }
  doc.setFontSize(9);
  doc.text(`STATUS: ${statusLabel}`, pageWidth - margin, 27, { align: 'right' });

  // --- Client & Metadata Grid ---
  let y = 52;

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DITAGIHKAN KEPADA', margin, y);
  doc.text('RINCIAN TANGGAL', pageWidth / 2 + 10, y);

  y += 5.5;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.clientCompany, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`PIC: ${invoice.clientName}`, margin, y + 5.5);
  doc.text(`Email: ${invoice.clientEmail}`, margin, y + 10.5);

  const metaX = pageWidth / 2 + 10;
  const metaValX = pageWidth - margin;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Tanggal Terbit:', metaX, y);
  doc.text('Jatuh Tempo:', metaX, y + 5.5);
  doc.text('Tanggal Lunas:', metaX, y + 11);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateId(invoice.issueDate), metaValX, y, { align: 'right' });
  doc.text(formatDateId(invoice.dueDate), metaValX, y + 5.5, { align: 'right' });
  doc.text(invoice.paidAt ? formatDateTimeId(invoice.paidAt) : '—', metaValX, y + 11, {
    align: 'right',
  });

  y += 20;

  // --- Line Items Table ---
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['No', 'Deskripsi Layanan / Produk', 'Qty', 'Harga Satuan', 'Jumlah']],
    body: invoice.items.map((item, idx) => [
      String(idx + 1),
      item.description,
      String(item.quantity),
      formatIdr(item.unitPrice),
      formatIdr(item.total),
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 3.5, right: 3.5, bottom: 3.5, left: 3.5 },
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left' },
      2: { halign: 'right', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 38 },
      4: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? y + 30;
  let summaryY = tableEndY + 8;

  // --- Totals Summary Box (Right) & Notes (Left) ---
  const summaryBoxX = pageWidth - margin - 76;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', summaryBoxX, summaryY);
  doc.setTextColor(15, 23, 42);
  doc.text(formatIdr(invoice.subtotal), pageWidth - margin, summaryY, { align: 'right' });

  summaryY += 6;
  doc.setTextColor(71, 85, 105);
  doc.text(`PPN (${invoice.taxRate}%)`, summaryBoxX, summaryY);
  doc.setTextColor(15, 23, 42);
  doc.text(formatIdr(invoice.taxAmount), pageWidth - margin, summaryY, { align: 'right' });

  summaryY += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryBoxX, summaryY, pageWidth - margin, summaryY);

  summaryY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Total Tagihan', summaryBoxX, summaryY);
  doc.text(formatIdr(invoice.totalAmount), pageWidth - margin, summaryY, { align: 'right' });

  // Left side notes
  const notesY = tableEndY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Catatan:', margin, notesY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const noteLines = doc.splitTextToSize(
    invoice.notes || 'Terima kasih atas kepercayaan dan kerja sama bisnis Anda.',
    contentWidth - 84
  );
  doc.text(noteLines, margin, notesY + 5);

  // --- Payment Instructions Box ---
  const boxY = Math.max(summaryY, notesY + noteLines.length * 4 + 4) + 12;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, boxY, contentWidth, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Instruksi Pembayaran Resmi', margin + 5, boxY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Transfer Bank: ${company.bankName}  ·  No. Rekening: ${company.bankAccountNumber}  ·  a.n. ${company.bankAccountName}`,
    margin + 5,
    boxY + 13.5
  );

  const midtransLine = invoice.midtransOrderId
    ? `Referensi Midtrans Order ID: ${invoice.midtransOrderId}${
        invoice.midtransPaymentType ? ` (${invoice.midtransPaymentType.toUpperCase()})` : ''
      }`
    : 'Pembayaran daring tersedia melalui portal Midtrans Snap.';
  doc.text(midtransLine, margin + 5, boxY + 19.5);

  if (invoice.midtransPaymentUrl) {
    doc.setTextColor(29, 78, 216);
    doc.textWithLink(`Tautan Pembayaran: ${invoice.midtransPaymentUrl}`, margin + 5, boxY + 24.5, {
      url: invoice.midtransPaymentUrl,
    });
  }

  // --- Footer ---
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Dokumen faktur ini diterbitkan secara elektronik oleh ${company.name} pada ${formatDateTimeId(
      new Date().toISOString()
    )}.`,
    margin,
    pageHeight - 10
  );

  doc.save(`Faktur-${invoice.invoiceNumber}.pdf`);
}
