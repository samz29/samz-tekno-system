import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompanyProfile, PayrollRecord } from '../types';
import { formatDateId, formatDateTimeId, formatIdr, formatMonthId, PAYROLL_STATUS_META } from './formatters';

interface JsPdfWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export function generatePayslipPdf(payroll: PayrollRecord, company: CompanyProfile): void {
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
  doc.text('SLIP GAJI RESMI KARYAWAN', textStartX, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.name, textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const companyAddressLines = doc.splitTextToSize(company.address, 95);
  doc.text(companyAddressLines, textStartX, 27);
  doc.text(`NPWP: ${company.npwp}  |  ${company.email}`, textStartX, 38);

  // Right Header: Slip Number & Period
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(payroll.slipNumber, pageWidth - margin, 19, { align: 'right' });

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Periode: ${formatMonthId(payroll.periodMonth)}`, pageWidth - margin, 26, { align: 'right' });

  const statusLabel = PAYROLL_STATUS_META[payroll.status]?.label?.toUpperCase() || payroll.status.toUpperCase();
  if (payroll.status === 'paid') {
    doc.setTextColor(110, 231, 183);
  } else if (payroll.status === 'approved') {
    doc.setTextColor(147, 197, 253);
  } else {
    doc.setTextColor(253, 224, 71);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`STATUS: ${statusLabel}`, pageWidth - margin, 33, { align: 'right' });

  // --- Employee & Payment Metadata ---
  let y = 52;
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DATA KARYAWAN', margin, y);
  doc.text('REKENING PENERIMA & TANGGAL', pageWidth / 2 + 8, y);

  y += 5.5;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(payroll.employeeName, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`NIP: ${payroll.employeeNip}`, margin, y + 5.5);
  doc.text(`Jabatan: ${payroll.position} (${payroll.department})`, margin, y + 10.5);
  doc.text(`Email: ${payroll.employeeEmail}`, margin, y + 15.5);

  const metaX = pageWidth / 2 + 8;
  const metaValX = pageWidth - margin;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Tanggal Pembayaran:', metaX, y);
  doc.text('Bank Tujuan:', metaX, y + 5.5);
  doc.text('No. Rekening:', metaX, y + 11);
  doc.text('Atas Nama:', metaX, y + 16.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateId(payroll.payDate), metaValX, y, { align: 'right' });
  doc.text(payroll.bankName || '—', metaValX, y + 5.5, { align: 'right' });
  doc.text(payroll.bankAccountNumber || '—', metaValX, y + 11, { align: 'right' });
  doc.text(payroll.bankAccountName || payroll.employeeName, metaValX, y + 16.5, { align: 'right' });

  y += 26;

  // --- Earnings (Penerimaan) & Deductions (Potongan) Table ---
  const hasBpjsBreakdown =
    (payroll.bpjsKesEmployee || 0) +
      (payroll.bpjsJhtEmployee || 0) +
      (payroll.bpjsJpEmployee || 0) >
    0;
  const pphLabel = payroll.ptkpStatus
    ? `Potongan PPh 21 (${payroll.ptkpStatus} · TER ${payroll.terCategory || 'A'}${
        payroll.pph21Rate ? ` ${payroll.pph21Rate}%` : ''
      })`
    : 'Potongan PPh 21';

  const deductionRows: Array<[string, string]> = [
    [pphLabel, formatIdr(payroll.pph21Deduction)],
    ...(hasBpjsBreakdown
      ? ([
          ['BPJS Kesehatan (1%)', formatIdr(payroll.bpjsKesEmployee || 0)],
          ['BPJS TK — JHT (2%)', formatIdr(payroll.bpjsJhtEmployee || 0)],
          ['BPJS TK — Jaminan Pensiun (1%)', formatIdr(payroll.bpjsJpEmployee || 0)],
        ] as Array<[string, string]>)
      : ([['BPJS Kesehatan & Ketenagakerjaan', formatIdr(payroll.bpjsDeduction)]] as Array<
          [string, string]
        >)),
    ['Potongan Lainnya / Kasbon', formatIdr(payroll.otherDeductions)],
  ];

  const earningRows: Array<[string, string]> = [
    ['Gaji Pokok', formatIdr(payroll.baseSalary)],
    ['Tunjangan Tetap & Operasional', formatIdr(payroll.allowances)],
    ['Upah Lembur', formatIdr(payroll.overtimePay)],
    ['Bonus / Insentif', formatIdr(payroll.bonus)],
  ];

  const rowCount = Math.max(earningRows.length, deductionRows.length);
  const tableBody: Array<[string, string, string, string]> = [];
  for (let idx = 0; idx < rowCount; idx++) {
    const e = earningRows[idx] || ['', ''];
    const d = deductionRows[idx] || ['', ''];
    tableBody.push([e[0], e[1], d[0], d[1]]);
  }
  const totalRowIndex = tableBody.length;
  tableBody.push([
    'TOTAL PENERIMAAN (BRUTO)',
    formatIdr(payroll.grossPay),
    'TOTAL POTONGAN',
    formatIdr(payroll.totalDeductions),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Komponen Penghasilan (Penerimaan)', 'Jumlah', 'Komponen Potongan', 'Jumlah']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3.8,
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
      0: { halign: 'left' },
      1: { halign: 'right', cellWidth: 36 },
      2: { halign: 'left' },
      3: { halign: 'right', cellWidth: 36 },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === totalRowIndex) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? y + 55;

  // --- Take Home Pay Highlight Box ---
  const boxY = tableEndY + 10;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, boxY, contentWidth, 24, 2, 2, 'F');

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('GAJI BERSIH DITERIMA (TAKE HOME PAY)', margin + 6, boxY + 9);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(formatIdr(payroll.netPay), pageWidth - margin - 6, boxY + 15.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Ditransfer ke ${payroll.bankName || 'Rekening Terdaftar'} (${payroll.bankAccountNumber || '—'})`,
    margin + 6,
    boxY + 17.5
  );

  if (payroll.notes) {
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Catatan HR / Keuangan:', margin, boxY + 34);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(payroll.notes, contentWidth);
    doc.text(noteLines, margin, boxY + 39);
  }

  // --- Footer ---
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Slip gaji ini diterbitkan secara elektronik dan bersifat rahasia oleh ${company.name} pada ${formatDateTimeId(
      new Date().toISOString()
    )}.`,
    margin,
    pageHeight - 10
  );

  doc.save(`SlipGaji-${payroll.slipNumber}-${payroll.employeeNip}.pdf`);
}
