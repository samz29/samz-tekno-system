import React from 'react';
import { CheckCircle2, Download, Edit3, Trash2, X } from 'lucide-react';
import type { CompanyProfile, GoodsHandover } from '../types';
import {
  formatDateTimeId,
  formatLongDateId,
  HANDOVER_STATUS_META,
  HANDOVER_TYPE_META,
} from '../lib/formatters';
import { generateHandoverPdf } from '../lib/handoverPdf';
import { BarcodeBlock } from './BarcodeBlock';

interface HandoverPreviewDrawerProps {
  handover: GoodsHandover | null;
  company: CompanyProfile;
  canManage: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (handover: GoodsHandover) => void;
  onMarkReceived: (handover: GoodsHandover) => Promise<void>;
  onDelete: (handover: GoodsHandover) => Promise<void>;
  onOpenVerify?: (code: string) => void;
}

export const HandoverPreviewDrawer: React.FC<HandoverPreviewDrawerProps> = ({
  handover,
  company,
  canManage,
  canDelete,
  onClose,
  onEdit,
  onMarkReceived,
  onDelete,
  onOpenVerify,
}) => {
  if (!handover) return null;

  const typeMeta = HANDOVER_TYPE_META[handover.handoverType];
  const statusMeta = HANDOVER_STATUS_META[handover.status];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
      <div className="w-full max-w-3xl h-full bg-slate-50 border-l border-slate-200 flex flex-col shadow-2xl">
        {/* Top Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{typeMeta.shortLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{handover.handoverNumber}</span>
              <span aria-hidden="true">·</span>
              <span className={`font-medium ${statusMeta.textClass}`}>{statusMeta.label}</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 truncate mt-0.5">
              {handover.recipientName}
              {handover.recipientCompany ? ` — ${handover.recipientCompany}` : ''}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canManage && handover.status !== 'received' && (
              <button
                type="button"
                onClick={() => {
                  void onMarkReceived(handover);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tandai Diterima</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void generateHandoverPdf(handover, company);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => onEdit(handover)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ubah</span>
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(handover)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                title="Hapus BAST"
              >
                <Trash2 className="w-4 h-4" />
              </button>
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

        {/* Printable Document Preview */}
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

            {/* Judul */}
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                {typeMeta.documentTitle}
              </h3>
              <div className="font-mono text-xs text-slate-600">
                Nomor: {handover.handoverNumber}
                {handover.referenceNumber ? ` · Referensi: ${handover.referenceNumber}` : ''}
              </div>
            </div>

            <p className="text-slate-700">
              Pada hari ini, tanggal{' '}
              <strong>{formatLongDateId(handover.handoverDate)}</strong> bertempat di{' '}
              <strong>{handover.location || handover.city}</strong> ({handover.city}), telah
              dilaksanakan serah terima barang/perangkat oleh dan antara:
            </p>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                <div className="font-semibold text-slate-900">
                  PIHAK PERTAMA (Yang Menyerahkan)
                </div>
                <div className="font-semibold text-slate-800">{handover.senderName}</div>
                <div className="text-slate-600">{handover.senderTitle}</div>
                <div className="text-slate-500">{company.name}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                <div className="font-semibold text-slate-900">
                  PIHAK KEDUA (Yang Menerima)
                </div>
                <div className="font-semibold text-slate-800">{handover.recipientName}</div>
                {handover.recipientCompany && (
                  <div className="text-slate-600">{handover.recipientCompany}</div>
                )}
                <div className="text-slate-500">
                  {handover.recipientIdentity || 'Penerima Sah'}
                  {handover.recipientPhone ? ` · ${handover.recipientPhone}` : ''}
                </div>
                {handover.recipientAddress && (
                  <div className="text-slate-500">{handover.recipientAddress}</div>
                )}
              </div>
            </div>

            {/* Itemized Table */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-2 px-3 w-10 text-center">No</th>
                    <th className="py-2 px-3">Nama Barang &amp; Spesifikasi</th>
                    <th className="py-2 px-3">No. Seri / SKU</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3">Kondisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {handover.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        {item.specification && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.specification}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {item.serialNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {item.condition}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {handover.notes && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Catatan: </span>
                {handover.notes}
              </div>
            )}

            {handover.receivedAt && (
              <div className="text-xs text-emerald-700 font-medium">
                Dikonfirmasi diterima pada {formatDateTimeId(handover.receivedAt)}
              </div>
            )}

            {/* Signature Blocks */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-xs">
              <div>
                <div className="font-semibold text-slate-900">Yang Menyerahkan (Pihak Pertama)</div>
                <div className="text-slate-500">{company.name}</div>
                <div className="h-12" />
                <div className="font-semibold text-slate-900">{handover.senderName}</div>
                <div className="text-slate-500">{handover.senderTitle}</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Yang Menerima (Pihak Kedua)</div>
                <div className="text-slate-500">
                  {handover.recipientCompany || 'Penerima Barang'}
                </div>
                <div className="h-12" />
                <div className="font-semibold text-slate-900">{handover.recipientName}</div>
                <div className="text-slate-500">
                  {handover.recipientIdentity || 'Penerima Sah'}
                </div>
              </div>
            </div>

            {/* Official Digital Barcode & QR Verification Block */}
            <div className="pt-4 border-t border-slate-200">
              <BarcodeBlock
                verificationCode={handover.verificationCode || handover.handoverNumber}
                verificationHash={handover.verificationHash}
                onOpenVerify={onOpenVerify}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
