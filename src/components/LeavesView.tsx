import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  LeaveEmployeeOption,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
} from '../types';
import {
  exportLeavesCsv,
  formatDateId,
  LEAVE_STATUS_META,
  LEAVE_TYPE_META,
} from '../lib/formatters';

interface LeavesViewProps {
  leaveRequests: LeaveRequest[];
  leaveEmployees: LeaveEmployeeOption[];
  canApproveReject: boolean;
  canDelete: boolean;
  canSubmitLeave: boolean;
  onOpenCreate: (employeeId?: string) => void;
  onSelectLeave: (leaveId: string) => void;
  onQuickDecision: (
    leaveId: string,
    decision: 'approved' | 'rejected',
    hrdNotes: string
  ) => Promise<void>;
  onDeleteLeave: (leave: LeaveRequest) => Promise<void>;
}

export const LeavesView: React.FC<LeavesViewProps> = ({
  leaveRequests,
  leaveEmployees,
  canApproveReject,
  canDelete,
  canSubmitLeave,
  onOpenCreate,
  onSelectLeave,
  onQuickDecision,
  onDeleteLeave,
}) => {
  const [subView, setSubView] = useState<'requests' | 'balances'>('requests');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LeaveType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = useMemo(() => {
    const pendingCount = leaveRequests.filter((l) => l.status === 'pending').length;
    const approvedCount = leaveRequests.filter((l) => l.status === 'approved').length;
    const approvedDaysTotal = leaveRequests
      .filter((l) => l.status === 'approved')
      .reduce((acc, l) => acc + l.totalDays, 0);

    const avgRemainingQuota =
      leaveEmployees.length > 0
        ? (
            leaveEmployees.reduce(
              (acc, e) => acc + Math.max(0, e.annualLeaveQuota - e.usedAnnualDays),
              0
            ) / leaveEmployees.length
          ).toFixed(1)
        : '0';

    return {
      pendingCount,
      approvedCount,
      approvedDaysTotal,
      avgRemainingQuota,
    };
  }, [leaveRequests, leaveEmployees]);

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((lv) => {
      if (statusFilter !== 'all' && lv.status !== statusFilter) return false;
      if (typeFilter !== 'all' && lv.leaveType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          lv.requestNumber.toLowerCase().includes(q) ||
          lv.employeeName.toLowerCase().includes(q) ||
          lv.employeeNip.toLowerCase().includes(q) ||
          lv.department.toLowerCase().includes(q) ||
          lv.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leaveRequests, statusFilter, typeFilter, searchQuery]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return leaveEmployees;
    const q = searchQuery.toLowerCase();
    return leaveEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.nip.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q)
    );
  }, [leaveEmployees, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Pelacakan Cuti &amp; Persetujuan HRD
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pengajuan cuti karyawan terintegrasi dengan saldo kuota tahunan dan alur verifikasi
            HRD secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setSubView('requests')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'requests'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Pengajuan
            </button>
            <button
              type="button"
              onClick={() => setSubView('balances')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'balances'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Saldo Kuota Karyawan
            </button>
          </div>

          {canSubmitLeave && (
            <button
              type="button"
              onClick={() => onOpenCreate()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajukan Cuti</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Menunggu Persetujuan HRD</span>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {summary.pendingCount} Pengajuan
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Cuti Disetujui HRD</span>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {summary.approvedCount} Pengajuan
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Total Hari Cuti Disetujui</span>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.approvedDaysTotal} Hari Kerja
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Rata-Rata Sisa Kuota Tahunan</span>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.avgRemainingQuota} Hari
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {subView === 'requests' ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'pending', label: 'Menunggu HRD' },
                  { id: 'approved', label: 'Disetujui' },
                  { id: 'rejected', label: 'Ditolak' },
                  { id: 'cancelled', label: 'Dibatalkan' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | LeaveType)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">Semua Jenis Cuti</option>
              {(Object.keys(LEAVE_TYPE_META) as LeaveType[]).map((key) => (
                <option key={key} value={key}>
                  {LEAVE_TYPE_META[key].label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Rekapitulasi kuota cuti tahunan seluruh karyawan aktif berdasarkan pengajuan yang telah
            disetujui HRD.
          </p>
        )}

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, NIP, nomor cuti..."
              className="w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>
          {subView === 'requests' && (
            <button
              type="button"
              onClick={() => exportLeavesCsv(filteredRequests)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Area */}
      {subView === 'requests' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">No. Pengajuan</th>
                  <th className="py-3 px-4">Karyawan &amp; Divisi</th>
                  <th className="py-3 px-4">Jenis &amp; Alasan</th>
                  <th className="py-3 px-4">Tanggal Cuti</th>
                  <th className="py-3 px-4 text-right">Durasi</th>
                  <th className="py-3 px-4">Status HRD</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                      Belum ada pengajuan cuti yang sesuai dengan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((lv) => {
                    const stMeta = LEAVE_STATUS_META[lv.status] || LEAVE_STATUS_META.pending;
                    const typeMeta = LEAVE_TYPE_META[lv.leaveType] || LEAVE_TYPE_META.tahunan;
                    return (
                      <tr
                        key={lv.id}
                        onClick={() => onSelectLeave(lv.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          {lv.requestNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{lv.employeeName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {lv.employeeNip} · {lv.department}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="text-xs font-semibold text-slate-800">
                            {typeMeta.label}
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">{lv.reason}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                          {formatDateId(lv.startDate)} — {formatDateId(lv.endDate)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {lv.totalDays} Hari
                        </td>
                        <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 font-medium ${stMeta.textClass}`}>
                            {lv.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                            {lv.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {lv.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                            <span>{stMeta.label}</span>
                          </span>
                          {lv.reviewedBy && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Oleh {lv.reviewedBy}
                            </div>
                          )}
                        </td>
                        <td
                          className="py-3.5 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            {canApproveReject && lv.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onQuickDecision(
                                      lv.id,
                                      'approved',
                                      'Disetujui HRD melalui daftar pengajuan cuti.'
                                    )
                                  }
                                  className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSelectLeave(lv.id)}
                                  className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                >
                                  Tolak
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectLeave(lv.id)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Detail
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => onDeleteLeave(lv)}
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                title="Hapus Pengajuan"
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
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">NIP &amp; Karyawan</th>
                  <th className="py-3 px-4">Departemen &amp; Jabatan</th>
                  <th className="py-3 px-4 text-right">Kuota Tahunan</th>
                  <th className="py-3 px-4 text-right">Terpakai (Disetujui)</th>
                  <th className="py-3 px-4 text-right">Sisa Kuota</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredEmployees.map((emp) => {
                  const remaining = Math.max(0, emp.annualLeaveQuota - emp.usedAnnualDays);
                  const pendingDays = leaveRequests
                    .filter((l) => l.employeeId === emp.id && l.status === 'pending')
                    .reduce((acc, l) => acc + l.totalDays, 0);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{emp.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {emp.nip} · {emp.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800">{emp.position}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{emp.department}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {emp.annualLeaveQuota} Hari
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {emp.usedAnnualDays} Hari
                        {pendingDays > 0 && (
                          <span className="block text-[11px] font-sans text-amber-700">
                            +{pendingDays} menunggu HRD
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                        <span className={remaining > 0 ? 'text-emerald-700' : 'text-red-700'}>
                          {remaining} Hari
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {canSubmitLeave && (
                          <button
                            type="button"
                            onClick={() => onOpenCreate(emp.id)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Ajukan Cuti
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
