import type {
  AccountingEntry,
  AccountingEntryStatus,
  AccountingEntryType,
  ContractStatus,
  ContractType,
  EmployeeContract,
  Invoice,
  InvoiceStatus,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  PayrollRecord,
  PayrollStatus,
} from '../types';

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

export function formatDateId(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatMonthId(ym: string | null | undefined): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  if (!y || !m) return ym;
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeId(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; textClass: string; dotClass: string }
> = {
  paid: {
    label: 'Lunas',
    textClass: 'text-emerald-700',
    dotClass: 'text-emerald-600',
  },
  pending: {
    label: 'Menunggu Pembayaran',
    textClass: 'text-amber-700',
    dotClass: 'text-amber-600',
  },
  overdue: {
    label: 'Jatuh Tempo',
    textClass: 'text-red-700',
    dotClass: 'text-red-600',
  },
  draft: {
    label: 'Draf',
    textClass: 'text-slate-600',
    dotClass: 'text-slate-400',
  },
  cancelled: {
    label: 'Dibatalkan',
    textClass: 'text-slate-500',
    dotClass: 'text-slate-400',
  },
};

export const PAYROLL_STATUS_META: Record<
  PayrollStatus,
  { label: string; textClass: string }
> = {
  paid: {
    label: 'Sudah Dibayar',
    textClass: 'text-emerald-700',
  },
  approved: {
    label: 'Disetujui (Siap Transfer)',
    textClass: 'text-blue-700',
  },
  draft: {
    label: 'Draf Perhitungan',
    textClass: 'text-slate-600',
  },
};

export const LEAVE_TYPE_META: Record<
  LeaveType,
  { label: string; deductsAnnualQuota: boolean }
> = {
  tahunan: { label: 'Cuti Tahunan', deductsAnnualQuota: true },
  sakit: { label: 'Cuti Sakit', deductsAnnualQuota: false },
  melahirkan: { label: 'Cuti Melahirkan / Ayah', deductsAnnualQuota: false },
  penting: { label: 'Izin Keperluan Penting', deductsAnnualQuota: false },
  tanpa_upah: { label: 'Cuti di Luar Tanggungan', deductsAnnualQuota: false },
};

export const LEAVE_STATUS_META: Record<
  LeaveStatus,
  { label: string; textClass: string }
> = {
  pending: { label: 'Menunggu Persetujuan HRD', textClass: 'text-amber-700' },
  approved: { label: 'Disetujui HRD', textClass: 'text-emerald-700' },
  rejected: { label: 'Ditolak HRD', textClass: 'text-red-700' },
  cancelled: { label: 'Dibatalkan', textClass: 'text-slate-500' },
};

export function calculateWorkingDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

export function exportInvoicesCsv(invoices: Invoice[]): void {
  const headers = [
    'Nomor Faktur',
    'Klien',
    'Perusahaan',
    'Email',
    'Tanggal Terbit',
    'Jatuh Tempo',
    'Status',
    'Subtotal',
    'PPN',
    'Total Tagihan',
    'Midtrans Order ID',
    'Metode Bayar',
  ];

  const rows = invoices.map((inv) => [
    inv.invoiceNumber,
    inv.clientName,
    inv.clientCompany,
    inv.clientEmail,
    inv.issueDate,
    inv.dueDate,
    INVOICE_STATUS_META[inv.status]?.label || inv.status,
    String(inv.subtotal),
    String(inv.taxAmount),
    String(inv.totalAmount),
    inv.midtransOrderId || '',
    inv.midtransPaymentType || '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fakturaflow-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportPayrollsCsv(payrolls: PayrollRecord[]): void {
  const headers = [
    'Nomor Slip',
    'Periode',
    'Tanggal Bayar',
    'NIP',
    'Nama Karyawan',
    'Departemen',
    'Jabatan',
    'Bank',
    'No. Rekening',
    'Gaji Pokok',
    'Tunjangan',
    'Lembur',
    'Bonus',
    'Gaji Bruto',
    'Potongan PPh 21',
    'Potongan BPJS',
    'Potongan Lain',
    'Total Potongan',
    'Gaji Bersih (THP)',
    'Status',
  ];

  const rows = payrolls.map((p) => [
    p.slipNumber,
    p.periodMonth,
    p.payDate,
    p.employeeNip,
    p.employeeName,
    p.department,
    p.position,
    p.bankName,
    p.bankAccountNumber,
    String(p.baseSalary),
    String(p.allowances),
    String(p.overtimePay),
    String(p.bonus),
    String(p.grossPay),
    String(p.pph21Deduction),
    String(p.bpjsDeduction),
    String(p.otherDeductions),
    String(p.totalDeductions),
    String(p.netPay),
    PAYROLL_STATUS_META[p.status]?.label || p.status,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fakturaflow-payroll-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportLeavesCsv(leaves: LeaveRequest[]): void {
  const headers = [
    'Nomor Pengajuan',
    'NIP',
    'Nama Karyawan',
    'Departemen',
    'Jabatan',
    'Jenis Cuti',
    'Tanggal Mulai',
    'Tanggal Selesai',
    'Total Hari Kerja',
    'Status HRD',
    'Alasan',
    'Rekan Pengganti',
    'Peninjau HRD',
    'Catatan HRD',
  ];

  const rows = leaves.map((lv) => [
    lv.requestNumber,
    lv.employeeNip,
    lv.employeeName,
    lv.department,
    lv.position,
    LEAVE_TYPE_META[lv.leaveType]?.label || lv.leaveType,
    lv.startDate,
    lv.endDate,
    String(lv.totalDays),
    LEAVE_STATUS_META[lv.status]?.label || lv.status,
    lv.reason,
    lv.delegateName || '',
    lv.reviewedBy || '',
    lv.hrdNotes || '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fakturaflow-cuti-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const ACCOUNTING_TYPE_META: Record<
  AccountingEntryType,
  { label: string; textClass: string; sign: string }
> = {
  income: { label: 'Pemasukan', textClass: 'text-emerald-700', sign: '+' },
  expense: { label: 'Pengeluaran', textClass: 'text-red-700', sign: '-' },
};

export const ACCOUNTING_STATUS_META: Record<
  AccountingEntryStatus,
  { label: string; textClass: string }
> = {
  recorded: { label: 'Tercatat', textClass: 'text-slate-600' },
  reconciled: { label: 'Terekonsiliasi', textClass: 'text-emerald-700' },
};

export const ACCOUNTING_CATEGORIES: Record<AccountingEntryType, string[]> = {
  income: [
    'Penjualan & Tagihan Klien',
    'Pendapatan Jasa & Konsultasi',
    'Pendapatan Bunga & Lain-lain',
    'Penambahan Modal / Kas',
  ],
  expense: [
    'Gaji & Tunjangan Karyawan',
    'Sewa & Utilitas Kantor',
    'Infrastruktur Cloud & Software',
    'Operasional & Perlengkapan (ATK)',
    'Pajak & BPJS Perusahaan',
    'Pemasaran & Klien',
    'Perjalanan Dinas',
    'Beban Lain-lain',
  ],
};

export const ACCOUNTING_ACCOUNTS = [
  'Bank Mandiri Operasional',
  'Bank BCA / Midtrans',
  'Kas Kecil Kantor (Petty Cash)',
];

export const ACCOUNTING_PAYMENT_METHODS = [
  'Transfer Bank',
  'QRIS / Virtual Account',
  'Tunai Kas Kecil',
  'Auto-Debit',
];

export function exportAccountingCsv(entries: AccountingEntry[]): void {
  const headers = [
    'No. Bukti',
    'Tanggal',
    'Jenis',
    'Kategori Akun',
    'Akun Kas/Bank',
    'Uraian Transaksi',
    'Pihak Terkait',
    'Metode Bayar',
    'Nominal (IDR)',
    'Status Rekonsiliasi',
    'Sumber',
    'Catatan',
  ];

  const rows = entries.map((e) => [
    e.entryNumber,
    e.date,
    ACCOUNTING_TYPE_META[e.type]?.label || e.type,
    e.category,
    e.accountName,
    e.description,
    e.counterparty,
    e.paymentMethod,
    String(e.type === 'expense' ? -e.amount : e.amount),
    ACCOUNTING_STATUS_META[e.status]?.label || e.status,
    e.sourceType,
    e.notes || '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fakturaflow-akuntansi-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const CONTRACT_TYPE_META: Record<
  ContractType,
  { label: string; shortLabel: string; documentTitle: string }
> = {
  pkwt: {
    label: 'PKWT (Kontrak Waktu Tertentu)',
    shortLabel: 'PKWT',
    documentTitle: 'PERJANJIAN KERJA WAKTU TERTENTU (PKWT)',
  },
  sk_pengangkatan: {
    label: 'SK Pengangkatan Karyawan Tetap',
    shortLabel: 'SK Pengangkatan',
    documentTitle: 'SURAT KEPUTUSAN PENGANGKATAN KARYAWAN TETAP',
  },
};

export const CONTRACT_STATUS_META: Record<
  ContractStatus,
  { label: string; textClass: string }
> = {
  draft: { label: 'Draf', textClass: 'text-slate-600' },
  active: { label: 'Aktif Berlaku', textClass: 'text-emerald-700' },
  expired: { label: 'Berakhir', textClass: 'text-amber-700' },
  terminated: { label: 'Dihentikan', textClass: 'text-red-700' },
};

export function formatLongDateId(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function exportContractsCsv(contracts: EmployeeContract[]): void {
  const headers = [
    'Nomor Surat',
    'Jenis Dokumen',
    'NIP',
    'Nama Karyawan',
    'Departemen',
    'Jabatan',
    'Lokasi Kerja',
    'Tanggal Mulai',
    'Tanggal Berakhir',
    'Durasi (Bulan)',
    'Gaji Pokok',
    'Tunjangan Tetap',
    'Penandatangan',
    'Tanggal Tanda Tangan',
    'Status',
  ];

  const rows = contracts.map((c) => [
    c.contractNumber,
    CONTRACT_TYPE_META[c.contractType]?.shortLabel || c.contractType,
    c.employeeNip,
    c.employeeName,
    c.department,
    c.position,
    c.workLocation,
    c.startDate,
    c.endDate || 'Tetap (PKWTT)',
    c.durationMonths ? String(c.durationMonths) : '-',
    String(c.baseSalary),
    String(c.fixedAllowance),
    `${c.signerName} (${c.signerTitle})`,
    c.signedDate,
    CONTRACT_STATUS_META[c.status]?.label || c.status,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fakturaflow-kontrak-sk-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

