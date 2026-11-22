import React, { useMemo, useState } from 'react';
import { Download, Eye, Plus, QrCode, Search, Trash2 } from 'lucide-react';
import type {
  CompanyProfile,
  ContractStatus,
  ContractType,
  EmployeeContract,
} from '../types';
import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_META,
  exportContractsCsv,
  formatDateId,
  formatIdr,
} from '../lib/formatters';
import { generateContractPdf } from '../lib/contractPdf';

interface ContractsViewProps {
  contracts: EmployeeContract[];
  company: CompanyProfile;
  canManage: boolean;
  onOpenCreate: (defaultType?: ContractType) => void;
  onEditContract: (contract: EmployeeContract) => void;
  onSelectContract: (contract: EmployeeContract) => void;
  onDeleteContract: (contract: EmployeeContract) => Promise<void>;
  onOpenVerify: (code?: string) => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({
  contracts,
  company,
  canManage,
  onOpenCreate,
  onEditContract,
  onSelectContract,
  onDeleteContract,
  onOpenVerify,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | ContractType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = useMemo(() => {
    const activeContracts = contracts.filter((c) => c.status === 'active');
    const activePkwt = activeContracts.filter((c) => c.contractType === 'pkwt').length;
    const activeSk = activeContracts.filter(
      (c) => c.contractType === 'sk_pengangkatan'
    ).length;

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const todayIso = now.toISOString().slice(0, 10);

    const expiringSoon = activeContracts.filter(
      (c) =>
        c.contractType === 'pkwt' &&
        c.endDate &&
        c.endDate >= todayIso &&
        c.endDate <= in30Days
    ).length;

    return {
      total: contracts.length,
      activePkwt,
      activeSk,
      expiringSoon,
    };
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (typeFilter !== 'all' && c.contractType !== typeFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.contractNumber.toLowerCase().includes(q) ||
          c.employeeName.toLowerCase().includes(q) ||
          c.employeeNip.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          c.position.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contracts, typeFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Surat Kontrak Kerja (PKWT) &amp; SK Pengangkatan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Penerbitan perjanjian kerja waktu tertentu, surat keputusan karyawan tetap, dan
            arsip dokumen PDF resmi perusahaan.
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
            onClick={() => exportContractsCsv(filteredContracts)}
            disabled={filteredContracts.length === 0}
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
              <span>Buat Kontrak / SK</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Total Dokumen</span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {summary.total} Surat
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">PKWT Aktif</span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-blue-700">
            {summary.activePkwt} Kontrak
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">SK Karyawan Tetap</span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-700">
            {summary.activeSk} SK
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">
            PKWT Berakhir &le; 30 Hari
          </span>
          <div
            className={`mt-1.5 text-xl font-bold font-mono tabular-nums ${
              summary.expiringSoon > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {summary.expiringSoon} Kontrak
          </div>
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
              Semua Dokumen
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('pkwt')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'pkwt'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PKWT (Kontrak)
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('sk_pengangkatan')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === 'sk_pengangkatan'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SK Pengangkatan
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ContractStatus)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif Berlaku</option>
            <option value="draft">Draf</option>
            <option value="expired">Berakhir</option>
            <option value="terminated">Dihentikan</option>
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no. surat, nama, jabatan..."
            className="w-64 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Nomor &amp; Jenis Surat</th>
                <th className="py-3 px-4">Karyawan &amp; Jabatan</th>
                <th className="py-3 px-4">Masa Berlaku</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Kompensasi Tetap / Bln</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 px-6 text-center">
                    <div className="text-sm font-medium text-slate-800">
                      {contracts.length === 0
                        ? 'Belum ada surat kontrak atau SK pengangkatan yang diterbitkan'
                        : 'Tidak ada dokumen yang sesuai filter pencarian'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Buat surat PKWT atau SK Pengangkatan Karyawan Tetap dan unduh PDF resmi
                      perusahaan.
                    </p>
                    {canManage && contracts.length === 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenCreate()}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Terbitkan Surat Pertama</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredContracts.map((ctr) => {
                  const typeMeta = CONTRACT_TYPE_META[ctr.contractType];
                  const statusMeta = CONTRACT_STATUS_META[ctr.status];
                  const totalComp = ctr.baseSalary + ctr.fixedAllowance;

                  return (
                    <tr key={ctr.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectContract(ctr)}
                          className="font-mono text-xs font-semibold text-blue-700 hover:underline text-left"
                        >
                          {ctr.contractNumber}
                        </button>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {typeMeta.shortLabel} ·{' '}
                          <span className="font-mono text-slate-700">
                            {ctr.verificationCode || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{ctr.employeeName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="font-mono">{ctr.employeeNip}</span> · {ctr.position} (
                          {ctr.department})
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700">
                        <div>Mulai {formatDateId(ctr.startDate)}</div>
                        <div className="text-slate-500 mt-0.5">
                          {ctr.contractType === 'pkwt'
                            ? `Berakhir ${formatDateId(ctr.endDate)}${
                                ctr.durationMonths ? ` · ${ctr.durationMonths} bln` : ''
                              }`
                            : 'Karyawan Tetap (PKWTT)'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span className={`font-medium ${statusMeta.textClass}`}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-mono tabular-nums font-medium text-slate-900">
                          {formatIdr(totalComp)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          Pokok {formatIdr(ctr.baseSalary)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectContract(ctr)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            title="Pratinjau Surat"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void generateContractPdf(ctr, company);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            title="Unduh PDF Resmi"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditContract(ctr)}
                                className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Ubah
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteContract(ctr)}
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                title="Hapus Dokumen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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
