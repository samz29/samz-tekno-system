import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Employee, EmployeeStatus, EmploymentType, PtkpStatus } from '../types';
import { PTKP_LIST, PTKP_META } from '../lib/indonesianTax';

interface EmployeeModalProps {
  open: boolean;
  initialEmployee: Employee | null;
  existingCount: number;
  onClose: () => void;
  onSave: (employee: Employee) => Promise<void>;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  open,
  initialEmployee,
  existingCount,
  onClose,
  onSave,
}) => {
  const [nip, setNip] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [position, setPosition] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('tetap');
  const [joinDate, setJoinDate] = useState('2026-01-01');
  const [baseSalary, setBaseSalary] = useState(10000000);
  const [fixedAllowance, setFixedAllowance] = useState(1500000);
  const [bankName, setBankName] = useState('Bank Mandiri');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [npwp, setNpwp] = useState('');
  const [bpjsNumber, setBpjsNumber] = useState('');
  const [ptkpStatus, setPtkpStatus] = useState<PtkpStatus>('TK/0');
  const [bpjsEnrolled, setBpjsEnrolled] = useState(true);
  const [annualLeaveQuota, setAnnualLeaveQuota] = useState(12);
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialEmployee) {
      setNip(initialEmployee.nip);
      setName(initialEmployee.name);
      setEmail(initialEmployee.email);
      setPhone(initialEmployee.phone);
      setDepartment(initialEmployee.department);
      setPosition(initialEmployee.position);
      setEmploymentType(initialEmployee.employmentType);
      setJoinDate(initialEmployee.joinDate);
      setBaseSalary(initialEmployee.baseSalary);
      setFixedAllowance(initialEmployee.fixedAllowance);
      setBankName(initialEmployee.bankName);
      setBankAccountNumber(initialEmployee.bankAccountNumber);
      setBankAccountName(initialEmployee.bankAccountName);
      setNpwp(initialEmployee.npwp);
      setBpjsNumber(initialEmployee.bpjsNumber);
      setPtkpStatus(initialEmployee.ptkpStatus || 'TK/0');
      setBpjsEnrolled(initialEmployee.bpjsEnrolled !== false);
      setAnnualLeaveQuota(initialEmployee.annualLeaveQuota ?? 12);
      setStatus(initialEmployee.status);
    } else {
      const year = new Date().getFullYear();
      const seq = String(existingCount + 1).padStart(3, '0');
      setNip(`EMP-${year}-${seq}`);
      setName('');
      setEmail('');
      setPhone('');
      setDepartment('Engineering');
      setPosition('');
      setEmploymentType('tetap');
      setJoinDate(new Date().toISOString().slice(0, 10));
      setBaseSalary(10000000);
      setFixedAllowance(1500000);
      setBankName('Bank Mandiri');
      setBankAccountNumber('');
      setBankAccountName('');
      setNpwp('');
      setBpjsNumber('');
      setPtkpStatus('TK/0');
      setBpjsEnrolled(true);
      setAnnualLeaveQuota(12);
      setStatus('active');
    }
  }, [open, initialEmployee, existingCount]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nip.trim() || !name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await onSave({
        id: initialEmployee?.id || `emp-${crypto.randomUUID().slice(0, 8)}`,
        nip: nip.trim().toUpperCase(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: department.trim() || 'Operasional',
        position: position.trim() || 'Staf',
        employmentType,
        joinDate,
        baseSalary: Math.max(0, Math.round(Number(baseSalary || 0))),
        fixedAllowance: Math.max(0, Math.round(Number(fixedAllowance || 0))),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim() || name.trim(),
        npwp: npwp.trim(),
        bpjsNumber: bpjsNumber.trim(),
        ptkpStatus,
        bpjsEnrolled,
        annualLeaveQuota: Math.max(0, Math.round(Number(annualLeaveQuota ?? 12))),
        status,
        createdAt: initialEmployee?.createdAt || now,
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
          <h2 className="text-lg font-semibold text-slate-900">
            {initialEmployee ? 'Ubah Data Karyawan' : 'Tambah Data Karyawan'}
          </h2>
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
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">NIP Karyawan</label>
              <input
                type="text"
                required
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="EMP-2026-005"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Bagus Setiawan"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Perusahaan (Untuk Slip Gaji)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.co.id"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">No. Telepon / WA</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 812 xxxx xxxx"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Departemen</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering / Keuangan / HR"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Jabatan</label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Senior Backend Engineer"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Tipe Kontrak</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="tetap">Karyawan Tetap (PKWTT)</option>
                <option value="kontrak">Karyawan Kontrak (PKWT)</option>
                <option value="freelance">Konsultan / Lepas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Tanggal Bergabung</label>
              <input
                type="date"
                required
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Gaji Pokok (IDR)</label>
              <input
                type="number"
                required
                min={0}
                step={100000}
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Tunjangan Tetap (IDR)</label>
              <input
                type="number"
                required
                min={0}
                step={100000}
                value={fixedAllowance}
                onChange={(e) => setFixedAllowance(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-xs font-semibold text-slate-900 mb-3">
              Rekening Payroll &amp; Identitas Pajak
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Bank</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank Mandiri / BCA / BNI"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nomor Rekening</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="102-000-xxxx-xxx"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Atas Nama Rekening</label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="Sesuai buku tabungan"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">NPWP / NIK Karyawan</label>
                <input
                  type="text"
                  value={npwp}
                  onChange={(e) => setNpwp(e.target.value)}
                  placeholder="00.000.000.0-000.000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">No. BPJS Kesehatan/TK</label>
                <input
                  type="text"
                  value={bpjsNumber}
                  onChange={(e) => setBpjsNumber(e.target.value)}
                  placeholder="000xxxxxxxxxx"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Status PTKP (PPh 21)
                </label>
                <select
                  value={ptkpStatus}
                  onChange={(e) => setPtkpStatus(e.target.value as PtkpStatus)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-600 focus:outline-none"
                >
                  {PTKP_LIST.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} (TER {item.terCategory})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {PTKP_META[ptkpStatus].label}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Kuota Cuti Tahunan (Hari)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={annualLeaveQuota}
                  onChange={(e) => setAnnualLeaveQuota(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 items-center">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Status Karyawan</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="active">Aktif (Masuk Penggajian)</option>
                  <option value="inactive">Nonaktif / Resign</option>
                </select>
              </div>
              <label className="flex items-start gap-2.5 pt-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bpjsEnrolled}
                  onChange={(e) => setBpjsEnrolled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  <strong>Ikut BPJS Kesehatan &amp; Ketenagakerjaan</strong>
                  <span className="block text-[11px] text-slate-500">
                    Potongan karyawan otomatis: BPJS Kes 1% (maks Rp12jt), JHT 2%, JP 1% (maks Rp10,547jt).
                  </span>
                </span>
              </label>
            </div>
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
            disabled={saving}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Karyawan'}
          </button>
        </div>
      </form>
    </div>
  );
};
