import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  ContractStatus,
  ContractType,
  Employee,
  EmployeeContract,
} from '../types';
import { formatIdr } from '../lib/formatters';

interface ContractModalProps {
  open: boolean;
  initialContract: EmployeeContract | null;
  preselectedEmployeeId?: string;
  employees: Employee[];
  existingContracts: EmployeeContract[];
  defaultSignerName?: string;
  onClose: () => void;
  onSave: (
    payload: Partial<EmployeeContract> & { syncEmployeeType?: boolean }
  ) => Promise<void>;
}

function buildNextContractNumber(
  type: ContractType,
  existing: EmployeeContract[]
): string {
  const year = new Date().getFullYear();
  const prefix = type === 'pkwt' ? `PKWT/HRD/${year}/` : `SK/HRD/${year}/`;
  const count =
    existing.filter((c) => c.contractNumber.startsWith(prefix)).length + 1;
  return `${prefix}${String(count).padStart(3, '0')}`;
}

function addMonthsIso(startIso: string, months: number): string {
  if (!startIso) return '';
  const d = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const ContractModal: React.FC<ContractModalProps> = ({
  open,
  initialContract,
  preselectedEmployeeId,
  employees,
  existingContracts,
  defaultSignerName,
  onClose,
  onSave,
}) => {
  const [contractType, setContractType] = useState<ContractType>('pkwt');
  const [contractNumber, setContractNumber] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeNik, setEmployeeNik] = useState('');
  const [employeeAddress, setEmployeeAddress] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [workLocation, setWorkLocation] = useState('Kantor Pusat Jakarta');
  const [startDate, setStartDate] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [endDate, setEndDate] = useState('');
  const [probationMonths, setProbationMonths] = useState<number>(0);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [fixedAllowance, setFixedAllowance] = useState<number>(0);
  const [workingHours, setWorkingHours] = useState(
    'Senin – Jumat, 09.00 – 17.00 WIB'
  );
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('Direktur Utama');
  const [signedDate, setSignedDate] = useState('');
  const [city, setCity] = useState('Jakarta');
  const [status, setStatus] = useState<ContractStatus>('active');
  const [customClauses, setCustomClauses] = useState('');
  const [syncEmployeeType, setSyncEmployeeType] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);

    if (initialContract) {
      setContractType(initialContract.contractType);
      setContractNumber(initialContract.contractNumber);
      setEmployeeId(initialContract.employeeId);
      setEmployeeNik(initialContract.employeeNik || '');
      setEmployeeAddress(initialContract.employeeAddress || '');
      setDepartment(initialContract.department);
      setPosition(initialContract.position);
      setWorkLocation(initialContract.workLocation || 'Kantor Pusat Jakarta');
      setStartDate(initialContract.startDate);
      setDurationMonths(initialContract.durationMonths || 12);
      setEndDate(initialContract.endDate || '');
      setProbationMonths(initialContract.probationMonths || 0);
      setBaseSalary(initialContract.baseSalary);
      setFixedAllowance(initialContract.fixedAllowance);
      setWorkingHours(
        initialContract.workingHours || 'Senin – Jumat, 09.00 – 17.00 WIB'
      );
      setSignerName(initialContract.signerName);
      setSignerTitle(initialContract.signerTitle || 'Direktur Utama');
      setSignedDate(initialContract.signedDate);
      setCity(initialContract.city || 'Jakarta');
      setStatus(initialContract.status);
      setCustomClauses(initialContract.customClauses || '');
      setSyncEmployeeType(false);
    } else {
      const targetEmp =
        employees.find((e) => e.id === preselectedEmployeeId) ||
        employees.find((e) => e.status === 'active') ||
        employees[0];
      const defaultType: ContractType =
        targetEmp?.employmentType === 'tetap' ? 'sk_pengangkatan' : 'pkwt';
      setContractType(defaultType);
      setContractNumber(buildNextContractNumber(defaultType, existingContracts));
      setEmployeeId(targetEmp?.id || '');
      setEmployeeNik('');
      setEmployeeAddress('');
      setDepartment(targetEmp?.department || '');
      setPosition(targetEmp?.position || '');
      setWorkLocation('Kantor Pusat Jakarta');
      setStartDate(today);
      setDurationMonths(12);
      setEndDate(addMonthsIso(today, 12));
      setProbationMonths(0);
      setBaseSalary(targetEmp?.baseSalary ?? 10000000);
      setFixedAllowance(targetEmp?.fixedAllowance ?? 1500000);
      setWorkingHours('Senin – Jumat, 09.00 – 17.00 WIB');
      setSignerName(defaultSignerName || 'Direktur Utama');
      setSignerTitle(
        defaultType === 'pkwt' ? 'Head of HR & People Operations' : 'Direktur Utama'
      );
      setSignedDate(today);
      setCity('Jakarta');
      setStatus('active');
      setCustomClauses('');
      setSyncEmployeeType(true);
    }
  }, [
    open,
    initialContract,
    preselectedEmployeeId,
    employees,
    existingContracts,
    defaultSignerName,
  ]);

  if (!open) return null;

  const handleSelectEmployee = (nextId: string) => {
    setEmployeeId(nextId);
    const emp = employees.find((e) => e.id === nextId);
    if (emp) {
      setDepartment(emp.department);
      setPosition(emp.position);
      setBaseSalary(emp.baseSalary);
      setFixedAllowance(emp.fixedAllowance);
    }
  };

  const handleChangeType = (nextType: ContractType) => {
    setContractType(nextType);
    if (!initialContract) {
      setContractNumber(buildNextContractNumber(nextType, existingContracts));
      setSignerTitle(
        nextType === 'pkwt' ? 'Head of HR & People Operations' : 'Direktur Utama'
      );
    }
    if (nextType === 'pkwt' && !endDate && startDate) {
      setEndDate(addMonthsIso(startDate, durationMonths || 12));
    }
  };

  const handleStartDateChange = (nextStart: string) => {
    setStartDate(nextStart);
    if (contractType === 'pkwt' && !initialContract && nextStart) {
      setEndDate(addMonthsIso(nextStart, durationMonths || 12));
    }
  };

  const handleDurationChange = (months: number) => {
    const clean = Math.max(1, Math.min(60, Math.round(months || 1)));
    setDurationMonths(clean);
    if (contractType === 'pkwt' && startDate) {
      setEndDate(addMonthsIso(startDate, clean));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !contractNumber.trim() || !startDate) return;
    const emp = employees.find((item) => item.id === employeeId);
    setSaving(true);
    try {
      await onSave({
        id: initialContract?.id,
        contractNumber: contractNumber.trim(),
        contractType,
        employeeId,
        employeeNip: emp?.nip || initialContract?.employeeNip || '',
        employeeName: emp?.name || initialContract?.employeeName || '',
        employeeEmail: emp?.email || initialContract?.employeeEmail || '',
        employeeNik: employeeNik.trim(),
        employeeAddress: employeeAddress.trim(),
        department: department.trim() || emp?.department || 'Operasional',
        position: position.trim() || emp?.position || 'Staf',
        workLocation: workLocation.trim() || 'Kantor Pusat Jakarta',
        startDate,
        endDate: contractType === 'pkwt' ? endDate : null,
        durationMonths: contractType === 'pkwt' ? durationMonths : null,
        probationMonths: contractType === 'sk_pengangkatan' ? probationMonths : 0,
        baseSalary: Math.max(0, Math.round(Number(baseSalary || 0))),
        fixedAllowance: Math.max(0, Math.round(Number(fixedAllowance || 0))),
        workingHours: workingHours.trim(),
        signerName: signerName.trim() || 'Direktur Utama',
        signerTitle: signerTitle.trim() || 'Direktur Utama',
        signedDate: signedDate || startDate,
        city: city.trim() || 'Jakarta',
        customClauses: customClauses.trim(),
        status,
        createdAt: initialContract?.createdAt,
        syncEmployeeType,
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
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {initialContract
                ? 'Ubah Dokumen Kontrak / SK Karyawan'
                : 'Buat Surat Kontrak (PKWT) / SK Pengangkatan'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dokumen legal resmi dengan kop perusahaan dan format cetak PDF siap tanda tangan.
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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Pilihan Jenis Surat */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Jenis Dokumen Legal
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChangeType('pkwt')}
                className={`rounded-lg border p-3.5 text-left transition-colors ${
                  contractType === 'pkwt'
                    ? 'border-blue-600 bg-blue-50/70 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-semibold">
                  PKWT — Perjanjian Kerja Waktu Tertentu
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Kontrak berjangka waktu dengan tanggal mulai &amp; berakhir sesuai PP 35/2021.
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleChangeType('sk_pengangkatan')}
                className={`rounded-lg border p-3.5 text-left transition-colors ${
                  contractType === 'sk_pengangkatan'
                    ? 'border-blue-600 bg-blue-50/70 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-semibold">
                  SK Pengangkatan — Karyawan Tetap (PKWTT)
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Surat Keputusan penetapan karyawan tetap beserta tembusan resmi HRD.
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nomor Surat Resmi
              </label>
              <input
                type="text"
                required
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="PKWT/HRD/2026/001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Karyawan
              </label>
              <select
                required
                value={employeeId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="">Pilih Karyawan...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nip} — {emp.name} ({emp.position})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                NIK (No. KTP)
              </label>
              <input
                type="text"
                value={employeeNik}
                onChange={(e) => setEmployeeNik(e.target.value)}
                placeholder="317401xxxxxxxxxx"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Alamat Domisili Karyawan (Sesuai KTP)
              </label>
              <input
                type="text"
                value={employeeAddress}
                onChange={(e) => setEmployeeAddress(e.target.value)}
                placeholder="Jl. Kemang Timur No. 42, Jakarta Selatan"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Departemen / Divisi
              </label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Jabatan
              </label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Lokasi Kerja
              </label>
              <input
                type="text"
                required
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                placeholder="Kantor Pusat Jakarta"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Periode & Masa Berlaku */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal Mulai Berlaku
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            {contractType === 'pkwt' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Durasi (Bulan)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={durationMonths}
                    onChange={(e) => handleDurationChange(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Tanggal Berakhir Kontrak
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Masa Percobaan (Opsional, Maks. 3 Bulan)
                </label>
                <select
                  value={probationMonths}
                  onChange={(e) => setProbationMonths(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value={0}>Tanpa Masa Percobaan (Langsung Tetap)</option>
                  <option value={1}>1 Bulan Percobaan</option>
                  <option value={2}>2 Bulan Percobaan</option>
                  <option value={3}>3 Bulan Percobaan</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Status Dokumen
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="active">Aktif Berlaku</option>
                <option value="draft">Draf</option>
                <option value="expired">Berakhir</option>
                <option value="terminated">Dihentikan</option>
              </select>
            </div>
          </div>

          {/* Kompensasi & Jam Kerja */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Gaji Pokok / Bulan (IDR)
              </label>
              <input
                type="number"
                min={0}
                step={50000}
                required
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tunjangan Tetap / Bulan (IDR)
              </label>
              <input
                type="number"
                min={0}
                step={50000}
                value={fixedAllowance}
                onChange={(e) => setFixedAllowance(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col justify-center">
              <span className="text-[11px] text-slate-500">Total Penghasilan Tetap</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {formatIdr((baseSalary || 0) + (fixedAllowance || 0))} / bln
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Hari &amp; Jam Kerja
            </label>
            <input
              type="text"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Pengesahan & Penandatangan */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Pejabat Penandatangan
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Bambang Wibowo"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Jabatan Penandatangan
              </label>
              <input
                type="text"
                required
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="Direktur Utama"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kota &amp; Tanggal Surat
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Jakarta"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="date"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Pasal / Ketentuan Tambahan (Opsional)
            </label>
            <textarea
              rows={3}
              value={customClauses}
              onChange={(e) => setCustomClauses(e.target.value)}
              placeholder="Contoh: Fasilitas tunjangan perangkat kerja, perjanjian kerahasiaan proyek klien, atau target masa kerja..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          {status === 'active' && (
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={syncEmployeeType}
                onChange={(e) => setSyncEmployeeType(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                Sinkronkan data profil karyawan (ubah tipe menjadi{' '}
                <strong>{contractType === 'sk_pengangkatan' ? 'Tetap' : 'Kontrak'}</strong>,
                jabatan, departemen, gaji pokok, dan tunjangan tetap) saat menyimpan.
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !employeeId}
            className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving
              ? 'Menyimpan...'
              : initialContract
              ? 'Simpan Perubahan'
              : 'Terbitkan Surat'}
          </button>
        </div>
      </form>
    </div>
  );
};
