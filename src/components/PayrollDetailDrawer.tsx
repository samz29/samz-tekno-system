import React, { useState } from 'react';
import { CheckCircle2, FileDown, Mail, Pencil, Trash2, X } from 'lucide-react';
import type { CompanyProfile, PayrollRecord } from '../types';
import {
  formatDateId,
  formatDateTimeId,
  formatIdr,
  formatMonthId,
  PAYROLL_STATUS_META,
} from '../lib/formatters';
import { generatePayslipPdf } from '../lib/payslipPdf';

interface PayrollDetailDrawerProps {
  payroll: PayrollRecord | null;
  company: CompanyProfile;
  canDelete?: boolean;
  onClose: () => void;
  onEdit: (payroll: PayrollRecord) => void;
  onDelete: (payroll: PayrollRecord) => Promise<void>;
  onMarkPaid: (payrollId: string) => Promise<void>;
  onSendEmail: (payrollId: string) => Promise<void>;
}

export const PayrollDetailDrawer: React.FC<PayrollDetailDrawerProps> = ({
  payroll,
  company,
  canDelete = true,
  onClose,
  onEdit,
  onDelete,
  onMarkPaid,
  onSendEmail,
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  if (!payroll) return null;

  const statusMeta = PAYROLL_STATUS_META[payroll.status];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold font-mono text-slate-900">
                {payroll.slipNumber}
              </h2>
              <span className={`text-xs font-semibold ${statusMeta.textClass}`}>
                · {statusMeta.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Periode {formatMonthId(payroll.periodMonth)} · Tgl Bayar {formatDateId(payroll.payDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Action Strip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => generatePayslipPdf(payroll, company)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Unduh Slip PDF</span>
            </button>

            <button
              type="button"
              disabled={busyAction === 'email'}
              onClick={async () => {
                setBusyAction('email');
                try {
                  await onSendEmail(payroll.id);
                } finally {
                  setBusyAction(null);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{busyAction === 'email' ? 'Mengirim...' : 'Kirim Slip via Email'}</span>
            </button>

            {payroll.status !== 'paid' && (
              <button
                type="button"
                disabled={busyAction === 'paid'}
                onClick={async () => {
                  setBusyAction('paid');
                  try {
                    await onMarkPaid(payroll.id);
                  } finally {
                    setBusyAction(null);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{busyAction === 'paid' ? 'Memproses...' : 'Tandai Dibayar'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(payroll);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Ubah</span>
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={async () => {
                  await onDelete(payroll);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            )}
          </div>

          {/* Printable Slip Card */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="bg-slate-900 text-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                {company.logoDataUrl && (
                  <img
                    src={company.logoDataUrl}
                    alt={company.name}
                    className="h-12 w-12 rounded-lg bg-white p-1 object-contain shrink-0"
                  />
                )}
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    Slip Gaji Karyawan
                  </span>
                  <h3 className="text-lg font-semibold mt-0.5">{company.name}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Periode {formatMonthId(payroll.periodMonth)}
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-xs text-slate-400">Take Home Pay</div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {formatIdr(payroll.netPay)}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs font-medium text-slate-500">Karyawan</span>
                  <div className="font-semibold text-slate-900 mt-1">{payroll.employeeName}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    NIP {payroll.employeeNip} · {payroll.position}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Dept. {payroll.department} · {payroll.employeeEmail}
                  </div>
                </div>
                <div className="sm:text-right">
                  <span className="text-xs font-medium text-slate-500">Rekening Penerima</span>
                  <div className="font-medium text-slate-900 mt-1">
                    {payroll.bankName || '—'}
                  </div>
                  <div className="text-xs font-mono text-slate-700 mt-0.5">
                    {payroll.bankAccountNumber || '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    a.n. {payroll.bankAccountName || payroll.employeeName}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-5">
                <div className="rounded-lg border border-slate-200 p-4 space-y-2.5 text-sm">
                  <div className="text-xs font-semibold text-slate-900">Penerimaan</div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Gaji Pokok</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {formatIdr(payroll.baseSalary)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Tunjangan Tetap</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {formatIdr(payroll.allowances)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Upah Lembur</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {formatIdr(payroll.overtimePay)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Bonus / Insentif</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {formatIdr(payroll.bonus)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-xs font-semibold text-slate-900">
                    <span>Total Bruto</span>
                    <span className="font-mono tabular-nums">{formatIdr(payroll.grossPay)}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">Potongan</span>
                    {payroll.ptkpStatus && (
                      <span className="text-[11px] font-mono text-slate-500">
                        {payroll.ptkpStatus} · TER {payroll.terCategory || 'A'}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>
                      Potongan PPh 21
                      {payroll.taxCalculationMethod === 'pasal17_desember'
                        ? ' (Pasal 17 Des)'
                        : payroll.pph21Rate
                        ? ` (${payroll.pph21Rate}%)`
                        : ''}
                    </span>
                    <span className="font-mono tabular-nums text-red-700">
                      -{formatIdr(payroll.pph21Deduction)}
                    </span>
                  </div>
                  {(payroll.bpjsKesEmployee || 0) +
                    (payroll.bpjsJhtEmployee || 0) +
                    (payroll.bpjsJpEmployee || 0) >
                  0 ? (
                    <>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>BPJS Kesehatan (1%)</span>
                        <span className="font-mono tabular-nums text-red-700">
                          -{formatIdr(payroll.bpjsKesEmployee || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>BPJS TK — JHT (2%)</span>
                        <span className="font-mono tabular-nums text-red-700">
                          -{formatIdr(payroll.bpjsJhtEmployee || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>BPJS TK — JP (1%)</span>
                        <span className="font-mono tabular-nums text-red-700">
                          -{formatIdr(payroll.bpjsJpEmployee || 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>BPJS Kes &amp; TK</span>
                      <span className="font-mono tabular-nums text-red-700">
                        -{formatIdr(payroll.bpjsDeduction)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Potongan Lainnya</span>
                    <span className="font-mono tabular-nums text-red-700">
                      -{formatIdr(payroll.otherDeductions)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-xs font-semibold text-red-700">
                    <span>Total Potongan</span>
                    <span className="font-mono tabular-nums">
                      -{formatIdr(payroll.totalDeductions)}
                    </span>
                  </div>
                  {(payroll.bpjsEmployerTotal || 0) > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                      <span>Tanggungan BPJS Perusahaan</span>
                      <span className="font-mono tabular-nums text-slate-700">
                        {formatIdr(payroll.bpjsEmployerTotal || 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {(payroll.notes || payroll.paidAt || payroll.emailSentAt) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
                  {payroll.notes && (
                    <div>
                      <strong className="text-slate-800">Catatan:</strong> {payroll.notes}
                    </div>
                  )}
                  {payroll.paidAt && (
                    <div>
                      <strong className="text-slate-800">Dibayar pada:</strong>{' '}
                      {formatDateTimeId(payroll.paidAt)}
                    </div>
                  )}
                  {payroll.emailSentAt && (
                    <div>
                      <strong className="text-slate-800">Email slip dikirim:</strong>{' '}
                      {formatDateTimeId(payroll.emailSentAt)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
