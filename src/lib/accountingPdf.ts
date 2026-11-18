import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AccountingEntry, CompanyProfile } from '../types';
import { formatDateId, formatIdr, formatMonthId } from './formatters';

interface AccountingPdfParams {
  entries: AccountingEntry[];
  company: CompanyProfile;
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  totalCashBalance: number;
  incomeByCategory: Array<{ category: string; amount: number }>;
  expenseByCategory: Array<{ category: string; amount: number }>;
}

export function generateAccountingReportPdf(params: AccountingPdfParams): void {
  const {
    entries,
    company,
    periodLabel,
    totalIncome,
    totalExpense,
    netProfit,
    totalCashBalance,
    incomeByCategory,
    expenseByCategory,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 16;

  // Company Header
  if (company.logoDataUrl && company.logoDataUrl.startsWith('data:image/')) {
    try {
      const fmt = company.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(company.logoDataUrl, fmt, marginX, y - 2, 14, 14);
    } catch {
      // skip invalid logo image format
    }
  }

  const textStartX = company.logoDataUrl ? marginX + 18 : marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name || 'PT Nusantara Digital Karya', textStartX, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${company.address || ''} · NPWP: ${company.npwp || '-'}`, textStartX, y + 8);
  doc.text(`${company.email || ''} · ${company.phone || ''}`, textStartX, y + 12.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text('LAPORAN AKUNTANSI & LABA RUGI', pageWidth - marginX, y + 3, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Periode: ${periodLabel === 'all' ? 'Semua Periode' : formatMonthId(periodLabel)}`,
    pageWidth - marginX,
    y + 8,
    { align: 'right' }
  );
  doc.text(`Dicetak: ${formatDateId(new Date().toISOString())}`, pageWidth - marginX, y + 12.5, {
    align: 'right',
  });

  y += 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  // Summary Strip
  const boxWidth = (pageWidth - marginX * 2 - 9) / 4;
  const boxes = [
    { label: 'Total Pemasukan', value: formatIdr(totalIncome), color: [4, 120, 87] as const },
    { label: 'Total Pengeluaran', value: formatIdr(totalExpense), color: [185, 28, 28] as const },
    {
      label: netProfit >= 0 ? 'Laba Bersih' : 'Rugi Bersih',
      value: formatIdr(netProfit),
      color: netProfit >= 0 ? ([4, 120, 87] as const) : ([185, 28, 28] as const),
    },
    { label: 'Saldo Kas & Bank', value: formatIdr(totalCashBalance), color: [15, 23, 42] as const },
  ];

  boxes.forEach((box, idx) => {
    const bx = marginX + idx * (boxWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxWidth, 16, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(box.label, bx + 3, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(box.color[0], box.color[1], box.color[2]);
    doc.text(box.value, bx + 3, y + 12);
  });

  y += 22;

  // Profit & Loss Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Ringkasan Laba Rugi per Kategori Akun', marginX, y);
  y += 3;

  const plRows: Array<[string, string, string]> = [];
  incomeByCategory.forEach((row) => {
    plRows.push(['Pendapatan', row.category, formatIdr(row.amount)]);
  });
  plRows.push(['Subtotal Pendapatan', '', formatIdr(totalIncome)]);
  expenseByCategory.forEach((row) => {
    plRows.push(['Beban Operasional', row.category, `(${formatIdr(row.amount)})`]);
  });
  plRows.push(['Subtotal Beban', '', `(${formatIdr(totalExpense)})`]);
  plRows.push([netProfit >= 0 ? 'LABA BERSIH PERIODE' : 'RUGI BERSIH PERIODE', '', formatIdr(netProfit)]);

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Kelompok', 'Kategori Akun', 'Nominal']],
    body: plRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: {
      2: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 30;

  // Ledger Detail Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Rincian Jurnal Buku Kas & Bank', marginX, finalY + 9);

  autoTable(doc, {
    startY: finalY + 12,
    margin: { left: marginX, right: marginX },
    head: [['No. Bukti', 'Tanggal', 'Uraian & Pihak Terkait', 'Kategori / Akun', 'Nominal']],
    body: entries.map((e) => [
      e.entryNumber,
      e.date,
      `${e.description}${e.counterparty ? `\n(${e.counterparty})` : ''}`,
      `${e.category}\n${e.accountName}`,
      `${e.type === 'income' ? '+' : '-'} ${formatIdr(e.amount)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const filenamePeriod = periodLabel === 'all' ? 'semua-periode' : periodLabel;
  doc.save(`Laporan-Akuntansi-${filenamePeriod}.pdf`);
}
