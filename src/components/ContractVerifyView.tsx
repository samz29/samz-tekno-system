import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  QrCode,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { DocumentVerificationResult } from '../types';
import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_META,
  formatDateTimeId,
  formatLongDateId,
  HANDOVER_STATUS_META,
  HANDOVER_TYPE_META,
} from '../lib/formatters';

interface ContractVerifyViewProps {
  initialCode?: string;
  standalone?: boolean;
  onBack?: () => void;
}

export const ContractVerifyView: React.FC<ContractVerifyViewProps> = ({
  initialCode = '',
  standalone = true,
  onBack,
}) => {
  const [codeInput, setCodeInput] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocumentVerificationResult | null>(null);

  const runVerification = useCallback(async (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/documents/verify/${encodeURIComponent(clean)}`
      );
      const data = (await res.json()) as DocumentVerificationResult;
      setResult(data);
    } catch {
      setResult({
        ok: false,
        valid: false,
        message: 'Gagal terhubung ke server verifikasi dokumen.',
        verifiedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode.trim()) {
      setCodeInput(initialCode.trim());
      void runVerification(initialCode.trim());
    }
  }, [initialCode, runVerification]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runVerification(codeInput);
  };

  const contract = result?.contract;
  const handover = result?.handover;
  const statusMeta = contract
    ? CONTRACT_STATUS_META[contract.status]
    : null;
  const typeMeta = contract
    ? CONTRACT_TYPE_META[contract.contractType]
    : null;
  const handoverStatusMeta = handover
    ? HANDOVER_STATUS_META[handover.status]
    : null;
  const handoverTypeMeta = handover
    ? HANDOVER_TYPE_META[handover.handoverType]
    : null;

  const content = (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-blue-700 flex items-center gap-1.5">
              <QrCode className="w-4 h-4" />
              <span>Sistem Verifikasi Dokumen Resmi</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Cek Keaslian Kontrak, SK &amp; Bukti Serah Terima (BAST)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan kode barcode verifikasi atau nomor surat resmi yang tertera pada dokumen
              PDF (PKWT, SK Pengangkatan, atau BAST Serah Terima Barang).
            </p>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Contoh: FF-SK-2023-7A9C4E12 atau FF-BAST-2026-8E4A21C9"
              required
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !codeInput.trim()}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {loading ? 'Memeriksa...' : 'Verifikasi Dokumen'}
          </button>
        </form>

        {result && (
          <div className="space-y-4 pt-2 border-t border-slate-200">
            {/* Verification Result Status Box */}
            <div
              className={`rounded-lg border p-4 flex items-start gap-3 ${
                result.valid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : result.ok
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-red-200 bg-red-50 text-red-950'
              }`}
            >
              {result.valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              ) : result.ok ? (
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {result.valid
                    ? 'Dokumen Terverifikasi Sah & Berlaku'
                    : result.ok
                    ? 'Dokumen Ditemukan dengan Catatan Status'
                    : 'Dokumen Tidak Terdaftar / Tidak Valid'}
                </div>
                <p className="text-xs mt-0.5 opacity-90">{result.message}</p>
                <div className="text-[11px] opacity-75 mt-1 font-mono">
                  Diperiksa pada {formatDateTimeId(result.verifiedAt)}
                </div>
              </div>
            </div>

            {contract && typeMeta && statusMeta && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 divide-y divide-slate-200 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  <div>
                    <div className="text-slate-500">Perusahaan Penerbit</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {contract.companyName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Jenis &amp; Status Surat</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {typeMeta.shortLabel} ·{' '}
                      <span className={statusMeta.textClass}>{statusMeta.label}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Nomor Surat Resmi</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {contract.contractNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Kode Barcode Verifikasi</div>
                    <div className="font-mono font-semibold text-blue-700 mt-0.5">
                      {contract.verificationCode}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  <div>
                    <div className="text-slate-500">Nama Karyawan</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {contract.employeeName}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      NIP: {contract.employeeNip}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Jabatan &amp; Departemen</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {contract.position}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {contract.department} · {contract.workLocation}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Masa Berlaku</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      Mulai {formatLongDateId(contract.startDate)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {contract.endDate
                        ? `Berakhir ${formatLongDateId(contract.endDate)}`
                        : 'Karyawan Tetap (PKWTT)'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Disahkan Oleh</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {contract.signerName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {contract.signerTitle} · {contract.city},{' '}
                      {formatLongDateId(contract.signedDate)}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sidik Jari Integritas SHA-256:</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {contract.verificationHash}
                  </span>
                </div>
              </div>
            )}

            {handover && handoverTypeMeta && handoverStatusMeta && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 divide-y divide-slate-200 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  <div>
                    <div className="text-slate-500">Perusahaan Penerbit</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {handover.companyName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Jenis &amp; Status BAST</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {handoverTypeMeta.shortLabel} ·{' '}
                      <span className={handoverStatusMeta.textClass}>
                        {handoverStatusMeta.label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Nomor Dokumen BAST</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {handover.handoverNumber}
                    </div>
                    {handover.referenceNumber && (
                      <div className="font-mono text-[11px] text-slate-500">
                        Ref: {handover.referenceNumber}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-slate-500">Kode Barcode Verifikasi</div>
                    <div className="font-mono font-semibold text-blue-700 mt-0.5">
                      {handover.verificationCode}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  <div>
                    <div className="text-slate-500">Yang Menyerahkan (Pihak Pertama)</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {handover.senderName}
                    </div>
                    <div className="text-[11px] text-slate-500">{handover.senderTitle}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Yang Menerima (Pihak Kedua)</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {handover.recipientName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {handover.recipientCompany || handover.recipientIdentity || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Tanggal &amp; Lokasi Serah Terima</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {formatLongDateId(handover.handoverDate)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {handover.city}
                      {handover.location ? ` · ${handover.location}` : ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Konfirmasi Diterima</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {handover.receivedAt ? formatDateTimeId(handover.receivedAt) : 'Belum dikonfirmasi'}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="font-semibold text-slate-900">
                    Daftar Barang Diserahterimakan ({handover.itemCount} Jenis)
                  </div>
                  <div className="rounded border border-slate-200 bg-white divide-y divide-slate-200">
                    {handover.items.map((it, idx) => (
                      <div key={it.id || idx} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {idx + 1}. {it.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {it.serialNumber ? `SN: ${it.serialNumber} · ` : ''}
                            {it.condition}
                          </div>
                        </div>
                        <div className="font-mono tabular-nums font-semibold text-slate-800 shrink-0">
                          {it.quantity} {it.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sidik Jari Integritas SHA-256:</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {handover.verificationHash}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!standalone) return content;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8">
      {content}
    </div>
  );
};
