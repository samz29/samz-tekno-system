import React, { useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  Pencil,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { LeaveEmployeeOption, LeaveRequest } from '../types';
import {
  formatDateId,
  formatDateTimeId,
  LEAVE_STATUS_META,
  LEAVE_TYPE_META,
} from '../lib/formatters';

interface LeaveDetailDrawerProps {
  leave: LeaveRequest | null;
  employeeOption: LeaveEmployeeOption | null;
  canApproveReject: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canCancel: boolean;
  onClose: () => void;
  onEdit: (leave: LeaveRequest) => void;
  onDecide: (
    leaveId: string,
    decision: 'approved' | 'rejected',
    hrdNotes: string
  ) => Promise<void>;
  onCancel: (leaveId: string) => Promise<void>;
  onDelete: (leave: LeaveRequest) => Promise<void>;
}

export const LeaveDetailDrawer: React.FC<LeaveDetailDrawerProps> = ({
  leave,
  employeeOption,
  canApproveReject,
  canDelete,
  canEdit,
  canCancel,
  onClose,
  onEdit,
  onDecide,
  onCancel,
  onDelete,
}) => {
  const [hrdNotes, setHrdNotes] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  useEffect(() => {
    if (leave) {
      setHrdNotes(leave.hrdNotes || '');
    }
  }, [leave]);

  if (!leave) return null;

  const statusMeta = LEAVE_STATUS_META[leave.status] || LEAVE_STATUS_META.pending;
  const typeMeta = LEAVE_TYPE_META[leave.leaveType] || LEAVE_TYPE_META.tahunan;
  const remainingQuota = employeeOption
    ? Math.max(0, employeeOption.annualLeaveQuota - employeeOption.usedAnnualDays)
    : null;

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setSubmittingDecision(true);
    try {
      await onDecide(leave.id, decision, hrdNotes);
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
      <div className="w-full max-w-xl bg-white h-full flex flex-col border-l border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-900">
                {leave.requestNumber}
              </span>
              <span className={`text-xs font-semibold ${statusMeta.textClass}`}>
                · {statusMeta.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Diajukan pada {formatDateTimeId(leave.createdAt)} oleh {leave.submittedByName || leave.employeeName}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Employee Info Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <UserCheck className="w-4 h-4 text-blue-700" />
                  <span>{leave.employeeName}</span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {leave.employeeNip} · {leave.position} ({leave.department})
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{leave.employeeEmail}</div>
              </div>
              {employeeOption && (
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-500 block">Sisa Kuota Tahunan</span>
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {remainingQuota} / {employeeOption.annualLeaveQuota} Hari
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Leave Schedule & Details */}
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
            <div className="px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Jenis Cuti</span>
              <span className="font-semibold text-slate-900">{typeMeta.label}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Periode Cuti</span>
              <span className="font-medium text-slate-900">
                {formatDateId(leave.startDate)} — {formatDateId(leave.endDate)}
              </span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Total Hari Kerja</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {leave.totalDays} Hari Kerja
              </span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Rekan Pengganti (Handover)</span>
              <span className="font-medium text-slate-900">{leave.delegateName || '—'}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Kontak Selama Cuti</span>
              <span className="font-mono text-slate-800">{leave.contactDuringLeave || '—'}</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-1.5">Alasan Pengajuan Cuti</h3>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 leading-relaxed">
              {leave.reason}
            </div>
          </div>

          {/* HRD Review Outcome or Approval Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Status &amp; Verifikasi HRD</span>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold ${statusMeta.textClass}`}>
                {leave.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                {leave.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {leave.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                {leave.status === 'cancelled' && <Ban className="w-3.5 h-3.5" />}
                <span>{statusMeta.label}</span>
              </span>
            </div>

            {leave.reviewedBy && (
              <div className="text-xs text-slate-600">
                Ditinjau oleh <strong className="text-slate-900">{leave.reviewedBy}</strong> pada{' '}
                {formatDateTimeId(leave.reviewedAt)}
              </div>
            )}

            {leave.hrdNotes && leave.status !== 'pending' && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-900 block mb-0.5">Catatan HRD:</span>
                {leave.hrdNotes}
              </div>
            )}

            {canApproveReject && leave.status === 'pending' && (
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Catatan Keputusan HRD (Opsional untuk Setujui, Disarankan untuk Tolak)
                  </label>
                  <textarea
                    rows={2}
                    value={hrdNotes}
                    onChange={(e) => setHrdNotes(e.target.value)}
                    placeholder="Contoh: Disetujui, pastikan serah terima tugas selesai sebelum cuti..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={submittingDecision}
                    onClick={() => handleDecision('approved')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui Cuti (HRD)</span>
                  </button>
                  <button
                    type="button"
                    disabled={submittingDecision}
                    onClick={() => handleDecision('rejected')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Tolak Pengajuan</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {canEdit && leave.status === 'pending' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(leave);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Ubah</span>
              </button>
            )}
            {canCancel && leave.status === 'pending' && (
              <button
                type="button"
                onClick={() => onCancel(leave.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Batalkan</span>
              </button>
            )}
          </div>

          {canDelete && (
            <button
              type="button"
              onClick={async () => {
                await onDelete(leave);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
