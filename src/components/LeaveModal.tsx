import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, X } from 'lucide-react';
import type { LeaveEmployeeOption, LeaveRequest, LeaveType } from '../types';
import { calculateWorkingDays, LEAVE_TYPE_META } from '../lib/formatters';

interface LeaveModalProps {
  open: boolean;
  employees: LeaveEmployeeOption[];
  initialLeave: LeaveRequest | null;
  preselectedEmployeeId?: string | null;
  existingCount: number;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onSave: (leave: LeaveRequest) => Promise<void>;
}

export const LeaveModal: React.FC<LeaveModalProps> = ({
  open,
  employees,
  initialLeave,
  preselectedEmployeeId,
  existingCount,
  currentUserId,
  currentUserName,
  onClose,
  onSave,
}) => {
  const [employeeId, setEmployeeId] = useState('');
  const [requestNumber, setRequestNumber] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('tahunan');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalDays, setTotalDays] = useState(1);
  const [reason, setReason] = useState('');
  const [delegateName, setDelegateName] = useState('');
  const [contactDuringLeave, setContactDuringLeave] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialLeave) {
      setEmployeeId(initialLeave.employeeId);
      setRequestNumber(initialLeave.requestNumber);
      setLeaveType(initialLeave.leaveType);
      setStartDate(initialLeave.startDate);
      setEndDate(initialLeave.endDate);
      setTotalDays(initialLeave.totalDays);
      setReason(initialLeave.reason);
      setDelegateName(initialLeave.delegateName);
      setContactDuringLeave(initialLeave.contactDuringLeave);
    } else {
      const today = new Date();
      const ym = today.toISOString().slice(0, 7);
      const seq = String(existingCount + 1).padStart(3, '0');
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const defaultDate = tomorrow.toISOString().slice(0, 10);

      const defaultEmp =
        employees.find((e) => e.id === preselectedEmployeeId) || employees[0] || null;

      setEmployeeId(defaultEmp?.id || '');
      setRequestNumber(`CUTI-${ym}-${seq}`);
      setLeaveType('tahunan');
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setTotalDays(calculateWorkingDays(defaultDate, defaultDate));
      setReason('');
      setDelegateName('');
      setContactDuringLeave('');
    }
  }, [open, initialLeave, preselectedEmployeeId, employees, existingCount]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId]
  );

  const handleDateChange = (nextStart: string, nextEnd: string) => {
    setStartDate(nextStart);
    const effectiveEnd = nextEnd < nextStart ? nextStart : nextEnd;
    setEndDate(effectiveEnd);
    const calc = calculateWorkingDays(nextStart, effectiveEnd);
    if (calc > 0) setTotalDays(calc);
  };

  if (!open) return null;

  const remainingQuota = selectedEmployee
    ? Math.max(0, selectedEmployee.annualLeaveQuota - selectedEmployee.usedAnnualDays)
    : 0;
  const exceedsAnnualQuota =
    leaveType === 'tahunan' && selectedEmployee !== null && totalDays > remainingQuota;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !startDate || !endDate || !reason.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await onSave({
        id: initialLeave?.id || `lv-${crypto.randomUUID().slice(0, 8)}`,
        requestNumber: requestNumber.trim().toUpperCase(),
        employeeId: selectedEmployee.id,
        employeeNip: selectedEmployee.nip,
        employeeName: selectedEmployee.name,
        employeeEmail: selectedEmployee.email,
        department: selectedEmployee.department,
        position: selectedEmployee.position,
        leaveType,
        startDate,
        endDate,
        totalDays: Math.max(1, Math.round(Number(totalDays || 1))),
        reason: reason.trim(),
        delegateName: delegateName.trim(),
        contactDuringLeave: contactDuringLeave.trim(),
        status: initialLeave?.status || 'pending',
        hrdNotes: initialLeave?.hrdNotes || '',
        reviewedBy: initialLeave?.reviewedBy || null,
        reviewedAt: initialLeave?.reviewedAt || null,
        submittedByUserId: initialLeave?.submittedByUserId || currentUserId,
        submittedByName: initialLeave?.submittedByName || currentUserName,
        createdAt: initialLeave?.createdAt || now,
        updatedAt: now,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {initialLeave ? 'Ubah Pengajuan Cuti Karyawan' : 'Formulir Pengajuan Cuti Karyawan'}
              </h2>
              <p className="text-xs text-slate-500">
                Terhubung langsung dengan kuota cuti &amp; direktori karyawan untuk persetujuan HRD.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pilih Karyawan Terdaftar
              </label>
              <select
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={Boolean(initialLeave)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-100"
              >
                {employees.length === 0 && <option value="">Tidak ada karyawan aktif</option>}
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.nip}) — {emp.department}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nomor Pengajuan
              </label>
              <input
                type="text"
                required
                value={requestNumber}
                onChange={(e) => setRequestNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {selectedEmployee && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Jabatan &amp; Divisi</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {selectedEmployee.position}
                </span>
                <span className="text-slate-600">{selectedEmployee.department}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Kuota Cuti Tahunan</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 block">
                  {selectedEmployee.annualLeaveQuota} Hari / Tahun
                </span>
                <span className="text-slate-600">
                  Terpakai: {selectedEmployee.usedAnnualDays} hari
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sisa Kuota Tersedia</span>
                <span
                  className={`font-mono text-base font-bold tabular-nums mt-0.5 block ${
                    remainingQuota > 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {remainingQuota} Hari
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Jenis Cuti</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {(Object.keys(LEAVE_TYPE_META) as LeaveType[]).map((key) => (
                  <option key={key} value={key}>
                    {LEAVE_TYPE_META[key].label}
                    {LEAVE_TYPE_META[key].deductsAnnualQuota ? ' (Potong Kuota)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Tanggal Mulai</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => handleDateChange(e.target.value, endDate || e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal Selesai
              </label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => handleDateChange(startDate, e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Durasi (Hari Kerja)
              </label>
              <input
                type="number"
                required
                min={1}
                max={90}
                value={totalDays}
                onChange={(e) => setTotalDays(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Rekan Pengganti (Handover)
              </label>
              <input
                type="text"
                value={delegateName}
                onChange={(e) => setDelegateName(e.target.value)}
                placeholder="Nama rekan pelaksana tugas"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kontak Darurat / WA
              </label>
              <input
                type="text"
                value={contactDuringLeave}
                onChange={(e) => setContactDuringLeave(e.target.value)}
                placeholder="+62 812 xxxx xxxx"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {exceedsAnnualQuota && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Durasi pengajuan ({totalDays} hari) melebihi sisa kuota cuti tahunan karyawan (
                {remainingQuota} hari). Pengajuan tetap dapat dikirim untuk ditinjau khusus oleh
                HRD.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Alasan / Keterangan Pengajuan Cuti
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tuliskan alasan cuti dan catatan serah terima pekerjaan sementara..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !employeeId}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {saving
              ? 'Mengirim...'
              : initialLeave
              ? 'Simpan Perubahan'
              : 'Kirim Pengajuan ke HRD'}
          </button>
        </div>
      </form>
    </div>
  );
};
