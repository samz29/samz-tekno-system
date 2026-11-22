import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  CompanyProfile,
  GoodsHandover,
  HandoverStatus,
  HandoverType,
} from '../types';
import {
  exportHandoversCsv,
  formatDateId,
  HANDOVER_STATUS_META,
  HANDOVER_TYPE_META,
} from '../lib/formatters';
import { generateHandoverPdf } from '../lib/handoverPdf';

interface HandoversViewProps {
  handovers: GoodsHandover[];
  company: CompanyProfile;
  canManage: boolean;
  canDelete: boolean;
  onOpenCreate: (defaultType?: HandoverType) => void;
  onEditHandover: (handover: GoodsHandover) => void;
  onSelectHandover: (handover: GoodsHandover) => void;
  onMarkReceived: (handover: GoodsHandover) => Promise<void>;
  onDeleteHandover: (handover: GoodsHandover) => Promise<void>;
  onOpenVerify: (code?: string) => void;
}

export const HandoversView: React.FC<HandoversViewProps> = ({
  handovers,
  company,
  canManage,
  canDelete,
  onOpenCreate,
  onEditHandover,
  onSelectHandover,
  onMarkReceived,
  onDeleteHandover,
  onOpenVerify,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | HandoverType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | HandoverStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = useMemo(() => {
    const clientDeliveries = handovers.filter((h) => h.handoverType === 'client_delivery').length;
    const employeeAssets = handovers.filter((h) => h.handoverType === 'employee_asset').length;
    const receivedCount = handovers.filter((h) => h.status === 'received').length;
    const totalUnits = handovers.reduce(
      (acc, h) => acc + h.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      0
    );
    return {
      total: handovers.length,
      clientDeliveries,
      employeeAssets,
      receivedCount,
      totalUnits,
    };
  }, [handovers]);

  const filteredHandovers = useMemo(() => {
    return handovers.filter((h) => {
      if (typeFilter !== 'all' && h.handoverType !== typeFilter) return false;
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const itemMatch = h.items.some(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            it.serialNumber.toLowerCase().includes(q)
        );
        return (
          h.handoverNumber.toLowerCase().includes(q) ||
          h.recipientName.toLowerCase().includes(q) ||
          h.recipientCompany.toLowerCase().includes(q) ||
          h.senderName.toLowerCase().includes(q) ||
          h.referenceNumber.toLowerCase().includes(q) ||
          h.verificationCode.toLowerCase().includes(q) ||
          itemMatch
        );
      }
      return true;
    });
  }, [handovers, typeFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Bukti Serah Terima Barang (BAST)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Penerbitan berita acara serah terima pengiriman barang ke klien maupun inventaris kerja
            karyawan dengan barcode verifikasi keaslian.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenVerify('')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Cek Barcode</span>
          </button>
          <button
            type="button"
            onClick={() => exportHandoversCsv(filteredHandovers)}
            disabled={filteredHandovers.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => onOpenCreate()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat BAST Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Total Dokumen BAST</span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {summary.total} Dokumen
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {summary.totalUnits} Total Unit Barang
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">BAST Pengiriman Klien</span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-blue-700">
            {summary.clientDeliveries} BAST
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Proyek &amp; Tagihan Klien</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">BAST Inventaris Karyawan</span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {summary.employeeAssets} BAST
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Perangkat &amp; Aset Kantor</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Diterima Sah</span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-700">
            {summary.receivedCount} Dokumen
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Terkonfirmasi Penerima</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua BAST
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('client_delivery')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'client_delivery'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BAST Klien
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('employee_asset')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'employee_asset'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inventaris Karyawan
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | HandoverStatus)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="received">Diterima Sah</option>
            <option value="handed_over">Diserahkan / Dikirim</option>
            <option value="draft">Draf</option>
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no. BAST, penerima, barang, SN..."
            className="w-72 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Nomor &amp; Jenis BAST</th>
                <th className="py-3 px-4">Penerima &amp; Referensi</th>
                <th className="py-3 px-4">Daftar Barang</th>
                <th className="py-3 px-4">Tanggal &amp; Lokasi</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredHandovers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 px-6 text-center">
                    <div className="text-sm font-medium text-slate-800">
                      {handovers.length === 0
                        ? 'Belum ada bukti serah terima barang yang diterbitkan'
                        : 'Tidak ada dokumen BAST yang sesuai filter pencarian'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Buat BAST untuk serah terima barang proyek/faktur klien maupun perangkat kerja
                      karyawan lengkap dengan barcode verifikasi PDF.
                    </p>
                    {canManage && handovers.length === 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenCreate()}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Terbitkan BAST Pertama</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredHandovers.map((h) => {
                  const typeMeta = HANDOVER_TYPE_META[h.handoverType];
                  const statusMeta = HANDOVER_STATUS_META[h.status];
                  const totalUnits = h.items.reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0
                  );
                  const firstItem = h.items[0];

                  return (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectHandover(h)}
                          className="font-mono text-xs font-semibold text-blue-700 hover:underline text-left"
                        >
                          {h.handoverNumber}
                        </button>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {typeMeta.shortLabel} ·{' '}
                          <span className="font-mono text-slate-700">
                            {h.verificationCode || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{h.recipientName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {h.recipientCompany || h.recipientIdentity || '—'}
                          {h.referenceNumber ? (
                            <>
                              {' '}
                              · <span className="font-mono">{h.referenceNumber}</span>
                            </>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-800 truncate max-w-[230px]">
                          {firstItem ? firstItem.name : '—'}
                        </div>
                        <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                          {h.items.length} jenis ({totalUnits} unit)
                          {firstItem?.serialNumber ? ` · SN ${firstItem.serialNumber}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700">
                        <div>{formatDateId(h.handoverDate)}</div>
                        <div className="text-slate-500 mt-0.5 truncate max-w-[180px]">
                          {h.city}
                          {h.location ? ` · ${h.location}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span className={`font-medium ${statusMeta.textClass}`}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectHandover(h)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            title="Pratinjau BAST"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void generateHandoverPdf(h, company);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            title="Unduh PDF BAST"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          {canManage && h.status !== 'received' && (
                            <button
                              type="button"
                              onClick={() => {
                                void onMarkReceived(h);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                              title="Konfirmasi Barang Diterima"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Diterima</span>
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => onEditHandover(h)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Ubah
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDeleteHandover(h)}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                              title="Hapus BAST"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
