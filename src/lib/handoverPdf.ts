import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { CompanyProfile, GoodsHandover } from '../types';
import {
  formatLongDateId,
  HANDOVER_STATUS_META,
  HANDOVER_TYPE_META,
} from './formatters';
import { buildVerifyUrl, encodeCode128B } from './barcode';

interface JsPdfWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export async function generateHandoverPdf(
  handover: GoodsHandover,
  company: CompanyProfile
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 24;

  let y = 15;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      y = 18;
    }
  };

  // --- Kop Surat Perusahaan ---
  let headerTextX = margin;
  if (company.logoDataUrl && company.logoDataUrl.startsWith('data:image/')) {
    try {
      const format = company.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(company.logoDataUrl, format, margin, y, 17, 17, undefined, 'FAST');
      headerTextX = margin + 21;
    } catch {
      headerTextX = margin;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name.toUpperCase(), headerTextX, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const addressLines = doc.splitTextToSize(
    company.address,
    pageWidth - margin - headerTextX
  ) as string[];
  doc.text(addressLines, headerTextX, y + 10);
  const contactY = y + 10 + addressLines.length * 4;
  doc.text(
    `Telp: ${company.phone || '—'}  |  Email: ${company.email || '—'}  |  NPWP: ${company.npwp || '—'}`,
    headerTextX,
    contactY
  );

  y = Math.max(y + 20, contactY + 4);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 1.2, pageWidth - margin, y + 1.2);
  y += 8;

  // --- Judul Dokumen ---
  const typeMeta = HANDOVER_TYPE_META[handover.handoverType];
  const statusMeta = HANDOVER_STATUS_META[handover.status];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(typeMeta.documentTitle, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Nomor: ${handover.handoverNumber}${handover.referenceNumber ? `   |   Referensi: ${handover.referenceNumber}` : ''}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 8;

  // --- Kalimat Pembuka ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const introText = `Pada hari ini, tanggal ${formatLongDateId(handover.handoverDate)}, bertempat di ${handover.location || handover.city} (${handover.city}), telah dilaksanakan serah terima barang/perangkat dengan status "${statusMeta.label}" oleh dan antara para pihak di bawah ini:`;
  const introLines = doc.splitTextToSize(introText, contentWidth) as string[];
  doc.text(introLines, margin, y);
  y += introLines.length * 4.8 + 4;

  // --- Identitas Para Pihak (2 Kolom) ---
  const colGap = 6;
  const colW = (contentWidth - colGap) / 2;
  const partyBoxHeight = 32;
  ensureSpace(partyBoxHeight + 6);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, colW, partyBoxHeight, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + colW + colGap, y, colW, partyBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PIHAK PERTAMA (YANG MENYERAHKAN)', margin + 3.5, y + 5.5);
  doc.text('PIHAK KEDUA (YANG MENERIMA)', margin + colW + colGap + 3.5, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(handover.senderName || '—', margin + 3.5, y + 11.5);
  doc.text(handover.recipientName || '—', margin + colW + colGap + 3.5, y + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  doc.text(handover.senderTitle || 'Operasional', margin + 3.5, y + 16.5);
  doc.text(company.name, margin + 3.5, y + 21);
  doc.text(
    `Kota: ${handover.city}`,
    margin + 3.5,
    y + 25.5
  );

  const rightX = margin + colW + colGap + 3.5;
  doc.text(handover.recipientCompany || '—', rightX, y + 16.5);
  doc.text(
    `${handover.recipientIdentity || 'Penerima Sah'}${handover.recipientPhone ? ` · ${handover.recipientPhone}` : ''}`,
    rightX,
    y + 21
  );
  const addrPreview = doc.splitTextToSize(handover.recipientAddress || handover.location || '—', colW - 7) as string[];
  doc.text(addrPreview.slice(0, 2), rightX, y + 25.5);

  y += partyBoxHeight + 6;

  // --- Tabel Rincian Barang ---
  const tableBody = handover.items.map((item, idx) => [
    String(idx + 1),
    item.specification ? `${item.name}\n${item.specification}` : item.name,
    item.serialNumber || '—',
    `${item.quantity} ${item.unit}`,
    item.condition || 'Baik / Baru',
    item.notes || '—',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['No', 'Nama Barang & Spesifikasi', 'No. Seri / SKU', 'Qty', 'Kondisi', 'Keterangan']],
    body: tableBody,
    styles: {
      fontSize: 8.3,
      cellPadding: 2.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: 'top',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.2,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 58 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 26 },
      5: { cellWidth: 'auto' },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y + 30) + 6;

  // --- Catatan & Klausul Penutup ---
  if (handover.notes.trim()) {
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Catatan Serah Terima:', margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(handover.notes.trim(), contentWidth) as string[];
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.3 + 4;
  }

  ensureSpace(14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const closingLines = doc.splitTextToSize(
    'Dengan ditandatanganinya Berita Acara Serah Terima Barang ini, PIHAK PERTAMA telah menyerahkan dan PIHAK KEDUA telah memeriksa serta menerima seluruh barang tersebut di atas dalam jumlah dan kondisi sebagaimana tercantum pada tabel di atas.',
    contentWidth
  ) as string[];
  doc.text(closingLines, margin, y);
  y += closingLines.length * 4.5 + 6;

  // --- Blok Tanda Tangan Para Pihak ---
  ensureSpace(38);
  const signLeftX = margin + 8;
  const signRightX = pageWidth / 2 + 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${handover.city}, ${formatLongDateId(handover.handoverDate)}`, margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Yang Menyerahkan (PIHAK PERTAMA),', signLeftX, y);
  doc.text('Yang Menerima (PIHAK KEDUA),', signRightX, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(company.name, signLeftX, y);
  doc.text(handover.recipientCompany || 'Penerima Barang', signRightX, y);

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(handover.senderName, signLeftX, y);
  doc.text(handover.recipientName, signRightX, y);
  y += 4.3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(handover.senderTitle || 'Operasional', signLeftX, y);
  doc.text(handover.recipientIdentity || 'Penerima Sah', signRightX, y);
  y += 8;

  // --- Official Digital Barcode & QR Verification Block ---
  const verifyCode = handover.verificationCode || handover.handoverNumber;
  const verifyUrl = buildVerifyUrl(verifyCode);

  ensureSpace(32);
  const boxHeight = 29;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 3, y + 3, 23, 23, 'F');
    doc.addImage(qrDataUrl, 'PNG', margin + 3.5, y + 3.5, 22, 22, undefined, 'FAST');
  } catch {
    // Fallback if QR generation fails
  }

  const infoX = margin + 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('SISTEM VERIFIKASI KEASLIAN BUKTI SERAH TERIMA BARANG', infoX, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Kode Verifikasi: ${verifyCode}   |   SHA-256: ${handover.verificationHash || '—'}`,
    infoX,
    y + 11.2
  );

  const encoded = encodeCode128B(verifyCode);
  const barcodeMaxWidth = 74;
  const unitW = Math.min(0.45, barcodeMaxWidth / encoded.totalWidth);
  let cursorX = infoX;
  const barY = y + 13.5;
  const barH = 8.5;

  doc.setFillColor(15, 23, 42);
  for (let i = 0; i < encoded.modules.length; i++) {
    const w = encoded.modules[i] * unitW;
    if (i % 2 === 0) {
      doc.rect(cursorX, barY, w, barH, 'F');
    }
    cursorX += w;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const urlPreview = verifyUrl.length > 76 ? `${verifyUrl.slice(0, 73)}...` : verifyUrl;
  doc.text(`Pindai QR / Barcode atau buka: ${urlPreview}`, infoX, y + 25.8);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${company.name} · ${handover.handoverNumber} · Verifikasi ${verifyCode} · Hal. ${i}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const safeFilename = handover.handoverNumber.replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`BAST_${safeFilename}.pdf`);
}
