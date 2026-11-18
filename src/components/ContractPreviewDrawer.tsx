import React from 'react';
import { Download, Edit3, Trash2, X } from 'lucide-react';
import type { CompanyProfile, EmployeeContract } from '../types';
import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_META,
  formatIdr,
  formatLongDateId,
} from '../lib/formatters';
import { generateContractPdf } from '../lib/contractPdf';

interface ContractPreviewDrawerProps {
  contract: EmployeeContract | null;
  company: CompanyProfile;
  canManage: boolean;
  onClose: () => void;
  onEdit: (contract: EmployeeContract) => void;
  onDelete: (contract: EmployeeContract) => Promise<void>;
}

export const ContractPreviewDrawer: React.FC<ContractPreviewDrawerProps> = ({
  contract,
  company,
  canManage,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!contract) return null;

  const typeMeta = CONTRACT_TYPE_META[contract.contractType];
  const statusMeta = CONTRACT_STATUS_META[contract.status];
  const totalComp = contract.baseSalary + contract.fixedAllowance;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
      <div className="w-full max-w-2xl h-full bg-slate-50 border-l border-slate-200 flex flex-col shadow-2xl">
        {/* Top Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{typeMeta.shortLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{contract.contractNumber}</span>
              <span aria-hidden="true">·</span>
              <span className={`font-medium ${statusMeta.textClass}`}>
                {statusMeta.label}
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 truncate mt-0.5">
              {contract.employeeName} — {contract.position}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => generateContractPdf(contract, company)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(contract)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(contract)}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  title="Hapus Dokumen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              title="Tutup Pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Letter Paper Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-xl border border-slate-200 bg-white p-8 space-y-6 text-slate-800 text-[13px] leading-relaxed">
            {/* Kop Surat */}
            <div className="flex items-start gap-4 border-b-2 border-slate-900 pb-4">
              {company.logoDataUrl && company.logoDataUrl.startsWith('data:image/') && (
                <img
                  src={company.logoDataUrl}
                  alt={company.name}
                  className="w-12 h-12 object-contain shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-900 uppercase tracking-tight">
                  {company.name}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{company.address}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Telp: {company.phone || '—'} · Email: {company.email || '—'} · NPWP:{' '}
                  {company.npwp || '—'}
                </div>
              </div>
            </div>

            {/* Judul Surat */}
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                {typeMeta.documentTitle}
              </h3>
              <div className="font-mono text-xs text-slate-600">
                Nomor: {contract.contractNumber}
              </div>
            </div>

            {contract.contractType === 'pkwt' ? (
              <div className="space-y-4">
                <p>
                  Pada hari ini, tanggal <strong>{formatLongDateId(contract.signedDate)}</strong>{' '}
                  bertempat di <strong>{contract.city}</strong>, telah dibuat dan disepakati
                  Perjanjian Kerja Waktu Tertentu antara:
                </p>

                <div className="space-y-1 pl-3 border-b border-slate-100 pb-3">
                  <div className="font-semibold text-slate-900">
                    1. PIHAK PERTAMA (Perusahaan)
                  </div>
                  <div className="text-xs text-slate-600">
                    {company.name} · Diwakili oleh {contract.signerName} ({contract.signerTitle})
                  </div>
                </div>

                <div className="space-y-1 pl-3 border-b border-slate-100 pb-3">
                  <div className="font-semibold text-slate-900">
                    2. PIHAK KEDUA (Karyawan)
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-y-1 text-xs">
                    <span className="text-slate-500">Nama / NIP</span>
                    <span className="font-medium text-slate-900">
                      {contract.employeeName} ({contract.employeeNip})
                    </span>
                    <span className="text-slate-500">NIK (No. KTP)</span>
                    <span className="font-mono">{contract.employeeNik || '—'}</span>
                    <span className="text-slate-500">Alamat Domisili</span>
                    <span>{contract.employeeAddress || '—'}</span>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    Pasal 1 — Jabatan &amp; Penempatan
                  </div>
                  <p className="mt-1 text-slate-700">
                    PIHAK KEDUA ditempatkan sebagai <strong>{contract.position}</strong> pada
                    Departemen <strong>{contract.department}</strong> di{' '}
                    <strong>{contract.workLocation}</strong>.
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    Pasal 2 — Jangka Waktu Perjanjian
                  </div>
                  <p className="mt-1 text-slate-700">
                    Berlaku sejak{' '}
                    <strong>{formatLongDateId(contract.startDate)}</strong> sampai dengan{' '}
                    <strong>{formatLongDateId(contract.endDate)}</strong>
                    {contract.durationMonths ? ` (${contract.durationMonths} bulan)` : ''}, tanpa
                    masa percobaan sesuai ketentuan PP No. 35 Tahun 2021.
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    Pasal 3 &amp; 4 — Jam Kerja dan Kompensasi Bulanan
                  </div>
                  <p className="mt-1 text-slate-700">
                    Jam kerja: {contract.workingHours}. Gaji Pokok{' '}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatIdr(contract.baseSalary)}
                    </span>{' '}
                    + Tunjangan Tetap{' '}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatIdr(contract.fixedAllowance)}
                    </span>{' '}
                    = Total Bruto{' '}
                    <span className="font-mono font-semibold tabular-nums text-slate-900">
                      {formatIdr(totalComp)}/bln
                    </span>
                    .
                  </p>
                </div>

                {contract.customClauses && (
                  <div>
                    <div className="font-semibold text-slate-900">
                      Pasal Tambahan — Ketentuan Khusus
                    </div>
                    <p className="mt-1 text-slate-700 whitespace-pre-line">
                      {contract.customClauses}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">PIHAK PERTAMA</div>
                    <div className="text-slate-500">{company.name}</div>
                    <div className="h-12" />
                    <div className="font-semibold text-slate-900">{contract.signerName}</div>
                    <div className="text-slate-500">{contract.signerTitle}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">PIHAK KEDUA</div>
                    <div className="text-slate-500">Karyawan yang Bersangkutan</div>
                    <div className="h-12" />
                    <div className="font-semibold text-slate-900">{contract.employeeName}</div>
                    <div className="text-slate-500 font-mono">NIP: {contract.employeeNip}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="font-semibold text-slate-900">MENIMBANG &amp; MENGINGAT</div>
                  <p className="mt-1 text-slate-700">
                    Berdasarkan evaluasi kompetensi dan kinerja serta ketentuan UU Ketenagakerjaan /
                    UU Cipta Kerja beserta Peraturan Perusahaan {company.name}, Manajemen menetapkan:
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    KESATU — Penetapan Karyawan Tetap (PKWTT)
                  </div>
                  <p className="mt-1 text-slate-700">
                    Terhitung mulai tanggal{' '}
                    <strong>{formatLongDateId(contract.startDate)}</strong>, mengangkat{' '}
                    <strong>{contract.employeeName}</strong> (NIP:{' '}
                    <span className="font-mono">{contract.employeeNip}</span>
                    {contract.employeeNik ? `, NIK: ${contract.employeeNik}` : ''}) sebagai{' '}
                    <strong>Karyawan Tetap</strong> pada jabatan{' '}
                    <strong>{contract.position}</strong>, Departemen{' '}
                    <strong>{contract.department}</strong> di{' '}
                    <strong>{contract.workLocation}</strong>.
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    KEDUA &amp; KETIGA — Masa Percobaan &amp; Kompensasi
                  </div>
                  <p className="mt-1 text-slate-700">
                    {contract.probationMonths > 0
                      ? `Masa percobaan selama ${contract.probationMonths} bulan. `
                      : 'Ditetapkan langsung sebagai karyawan tetap tanpa masa percobaan tambahan. '}
                    Gaji Pokok{' '}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatIdr(contract.baseSalary)}
                    </span>{' '}
                    + Tunjangan Tetap{' '}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatIdr(contract.fixedAllowance)}
                    </span>{' '}
                    = Total Bruto{' '}
                    <span className="font-mono font-semibold tabular-nums text-slate-900">
                      {formatIdr(totalComp)}/bln
                    </span>
                    .
                  </p>
                </div>

                {contract.customClauses && (
                  <div>
                    <div className="font-semibold text-slate-900">
                      KEEMPAT — Ketentuan Tambahan
                    </div>
                    <p className="mt-1 text-slate-700 whitespace-pre-line">
                      {contract.customClauses}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 flex justify-between items-end gap-6 text-xs">
                  <div className="text-slate-500 space-y-0.5">
                    <div className="font-semibold text-slate-700">Tembusan:</div>
                    <div>1. Karyawan yang bersangkutan</div>
                    <div>2. Divisi Keuangan &amp; Payroll</div>
                    <div>3. Arsip HRD</div>
                  </div>
                  <div className="text-left min-w-[200px]">
                    <div className="text-slate-600">
                      Ditetapkan di {contract.city}, {formatLongDateId(contract.signedDate)}
                    </div>
                    <div className="font-semibold text-slate-900 mt-1">{company.name}</div>
                    <div className="h-12" />
                    <div className="font-semibold text-slate-900">{contract.signerName}</div>
                    <div className="text-slate-500">{contract.signerTitle}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
