import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, ShieldCheck, X } from 'lucide-react';
import type {
  Employee,
  PayrollRecord,
  PayrollStatus,
  PtkpStatus,
  TaxCalculationMethod,
} from '../types';
import { formatIdr } from '../lib/formatters';
import { calculateIndonesianPayrollTaxes, PTKP_LIST } from '../lib/indonesianTax';

interface PayrollModalProps {
  open: boolean;
  employees: Employee[];
  initialPayroll: PayrollRecord | null;
  defaultPeriodMonth: string;
  existingCount: number;
  onClose: () => void;
  onSave: (payroll: PayrollRecord) => Promise<void>;
}

export const PayrollModal: React.FC<PayrollModalProps> = ({
  open,
  employees,
  initialPayroll,
  defaultPeriodMonth,
  existingCount,
  onClose,
  onSave,
}) => {
  const [employeeId, setEmployeeId] = useState('');
  const [slipNumber, setSlipNumber] = useState('');
  const [periodMonth, setPeriodMonth] = useState(defaultPeriodMonth);
  const [payDate, setPayDate] = useState('');
  const [baseSalary, setBaseSalary] = useState(0);
  const [allowances, setAllowances] = useState(0);
  const [overtimePay, setOvertimePay] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [ptkpStatus, setPtkpStatus] = useState<PtkpStatus>('TK/0');
  const [bpjsEnrolled, setBpjsEnrolled] = useState(true);
  const [autoStatutory, setAutoStatutory] = useState(true);
  const [pph21Deduction, setPph21Deduction] = useState(0);
  const [bpjsDeduction, setBpjsDeduction] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [status, setStatus] = useState<PayrollStatus>('draft');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const statutory = useMemo(
    () =>
      calculateIndonesianPayrollTaxes({
        baseSalary,
        allowances,
        overtimePay,
        bonus,
        ptkpStatus,
        bpjsEnrolled,
      }),
    [baseSalary, allowances, overtimePay, bonus, ptkpStatus, bpjsEnrolled]
  );

  const applyEmployeeDefaults = (emp: Employee) => {
    const empPtkp = emp.ptkpStatus || 'TK/0';
    const empBpjs = emp.bpjsEnrolled !== false;
    const calc = calculateIndonesianPayrollTaxes({
      baseSalary: emp.baseSalary,
      allowances: emp.fixedAllowance,
      overtimePay: 0,
      bonus: 0,
      ptkpStatus: empPtkp,
      bpjsEnrolled: empBpjs,
    });
    setBaseSalary(emp.baseSalary);
    setAllowances(emp.fixedAllowance);
    setOvertimePay(0);
    setBonus(0);
    setPtkpStatus(empPtkp);
    setBpjsEnrolled(empBpjs);
    setAutoStatutory(true);
    setBpjsDeduction(calc.bpjsDeduction);
    setPph21Deduction(calc.pph21Deduction);
    setOtherDeductions(0);
  };

  useEffect(() => {
    if (!open) return;
    if (initialPayroll) {
      const emp = employees.find((e) => e.id === initialPayroll.employeeId);
      setEmployeeId(initialPayroll.employeeId);
      setSlipNumber(initialPayroll.slipNumber);
      setPeriodMonth(initialPayroll.periodMonth);
      setPayDate(initialPayroll.payDate);
      setBaseSalary(initialPayroll.baseSalary);
      setAllowances(initialPayroll.allowances);
      setOvertimePay(initialPayroll.overtimePay);
      setBonus(initialPayroll.bonus);
      setPtkpStatus(initialPayroll.ptkpStatus || emp?.ptkpStatus || 'TK/0');
      setBpjsEnrolled(emp ? emp.bpjsEnrolled !== false : initialPayroll.bpjsDeduction > 0);
      setAutoStatutory(initialPayroll.taxCalculationMethod !== 'manual');
      setPph21Deduction(initialPayroll.pph21Deduction);
      setBpjsDeduction(initialPayroll.bpjsDeduction);
      setOtherDeductions(initialPayroll.otherDeductions);
      setStatus(initialPayroll.status);
      setNotes(initialPayroll.notes);
    } else {
      const firstEmp = employees.find((e) => e.status === 'active') || employees[0];
      const seq = String(existingCount + 1).padStart(3, '0');
      const pm = defaultPeriodMonth || new Date().toISOString().slice(0, 7);
      setPeriodMonth(pm);
      setPayDate(`${pm}-25`);
      setSlipNumber(`PAY-${pm}-${seq}`);
      setStatus('draft');
      setNotes('');
      if (firstEmp) {
        setEmployeeId(firstEmp.id);
        applyEmployeeDefaults(firstEmp);
      } else {
        setEmployeeId('');
        setBaseSalary(0);
        setAllowances(0);
        setOvertimePay(0);
        setBonus(0);
        setPtkpStatus('TK/0');
        setBpjsEnrolled(true);
        setAutoStatutory(true);
        setBpjsDeduction(0);
        setPph21Deduction(0);
        setOtherDeductions(0);
      }
    }
  }, [open, initialPayroll, employees, defaultPeriodMonth, existingCount]);

  // Keep statutory values synchronized automatically when Auto-Hitung is active
  useEffect(() => {
    if (!open || !autoStatutory) return;
    setBpjsDeduction(statutory.bpjsDeduction);
    setPph21Deduction(statutory.pph21Deduction);
  }, [open, autoStatutory, statutory]);

  if (!open) return null;

  const selectedEmp = employees.find((e) => e.id === employeeId);
  const grossPay = Math.round(baseSalary + allowances + overtimePay + bonus);
  const effectivePph21 = autoStatutory ? statutory.pph21Deduction : Math.round(pph21Deduction);
  const effectiveBpjs = autoStatutory ? statutory.bpjsDeduction : Math.round(bpjsDeduction);
  const totalDeductions = Math.round(effectivePph21 + effectiveBpjs + otherDeductions);
  const netPay = Math.max(0, grossPay - totalDeductions);

  const handleRecalculateTaxes = () => {
    setAutoStatutory(true);
    setBpjsDeduction(statutory.bpjsDeduction);
    setPph21Deduction(statutory.pph21Deduction);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp && !initialPayroll) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const emp = selectedEmp;
      const calcMethod: TaxCalculationMethod = autoStatutory ? 'ter_bulanan' : 'manual';

      await onSave({
        id: initialPayroll?.id || `pay-${crypto.randomUUID().slice(0, 8)}`,
        slipNumber: slipNumber.trim().toUpperCase(),
        periodMonth,
        payDate,
        employeeId: emp?.id || initialPayroll!.employeeId,
        employeeNip: emp?.nip || initialPayroll!.employeeNip,
        employeeName: emp?.name || initialPayroll!.employeeName,
        employeeEmail: emp?.email || initialPayroll!.employeeEmail,
        department: emp?.department || initialPayroll!.department,
        position: emp?.position || initialPayroll!.position,
        bankName: emp?.bankName || initialPayroll?.bankName || '',
        bankAccountNumber: emp?.bankAccountNumber || initialPayroll?.bankAccountNumber || '',
        bankAccountName: emp?.bankAccountName || emp?.name || initialPayroll?.bankAccountName || '',
        baseSalary: Math.round(baseSalary),
        allowances: Math.round(allowances),
        overtimePay: Math.round(overtimePay),
        bonus: Math.round(bonus),
        pph21Deduction: effectivePph21,
        bpjsDeduction: effectiveBpjs,
        otherDeductions: Math.round(otherDeductions),
        grossPay,
        totalDeductions,
        netPay,
        ptkpStatus: statutory.ptkpStatus,
        terCategory: statutory.terCategory,
        pph21Rate: autoStatutory ? statutory.pph21Rate : 0,
        pph21TaxableGross: autoStatutory ? statutory.pph21TaxableGross : grossPay,
        bpjsKesEmployee: autoStatutory ? statutory.bpjsKesEmployee : 0,
        bpjsJhtEmployee: autoStatutory ? statutory.bpjsJhtEmployee : 0,
        bpjsJpEmployee: autoStatutory ? statutory.bpjsJpEmployee : 0,
        bpjsEmployerTotal: autoStatutory ? statutory.bpjsEmployerTotal : 0,
        taxCalculationMethod: calcMethod,
        status,
        notes: notes.trim(),
        paidAt: status === 'paid' ? initialPayroll?.paidAt || now : null,
        emailSentAt: initialPayroll?.emailSentAt || null,
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
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {initialPayroll ? 'Ubah Slip Gaji Karyawan' : 'Buat Slip Gaji Karyawan'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perhitungan otomatis PPh 21 (TER PP 58/2023) &amp; BPJS Kesehatan/TK (Perpres 64/2020 &amp; PP 44–46/2015).
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Pilih Karyawan</label>
              <select
                required
                value={employeeId}
                disabled={Boolean(initialPayroll)}
                onChange={(e) => {
                  const id = e.target.value;
                  setEmployeeId(id);
                  const found = employees.find((emp) => emp.id === id);
                  if (found) applyEmployeeDefaults(found);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-100 focus:border-blue-600 focus:outline-none"
              >
                <option value="">-- Pilih Karyawan --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nip} — {emp.name} ({emp.ptkpStatus || 'TK/0'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Nomor Slip Gaji</label>
              <input
                type="text"
                required
                value={slipNumber}
                onChange={(e) => setSlipNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Periode Gaji</label>
              <input
                type="month"
                required
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Tanggal Bayar</label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Status PTKP</label>
              <select
                value={ptkpStatus}
                onChange={(e) => {
                  setPtkpStatus(e.target.value as PtkpStatus);
                  setAutoStatutory(true);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-600 focus:outline-none"
              >
                {PTKP_LIST.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} (TER {item.terCategory})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Status Slip</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PayrollStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="draft">Draf Perhitungan</option>
                <option value="approved">Disetujui (Siap Transfer)</option>
                <option value="paid">Sudah Dibayar</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-200 pt-4">
            {/* Penerimaan */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-900">Komponen Penerimaan (IDR)</h3>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Gaji Pokok</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tunjangan Tetap &amp; Operasional</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={allowances}
                  onChange={(e) => setAllowances(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Upah Lembur</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={overtimePay}
                  onChange={(e) => setOvertimePay(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Bonus / Insentif</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={bonus}
                  onChange={(e) => setBonus(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
            </div>

            {/* Potongan */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-900">Komponen Potongan (IDR)</h3>
                <button
                  type="button"
                  onClick={handleRecalculateTaxes}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{autoStatutory ? 'Auto-Hitung Aktif' : 'Hitung Sesuai Peraturan'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoStatutory}
                    onChange={(e) => setAutoStatutory(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                  />
                  <span>Hitung otomatis PPh 21 TER &amp; BPJS</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bpjsEnrolled}
                    onChange={(e) => {
                      setBpjsEnrolled(e.target.checked);
                      setAutoStatutory(true);
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                  />
                  <span>Peserta BPJS</span>
                </label>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Potongan PPh 21{' '}
                  {autoStatutory && (
                    <span className="font-mono text-blue-700">
                      (TER {statutory.terCategory} · {statutory.pph21Rate}%)
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={effectivePph21}
                  onChange={(e) => {
                    setAutoStatutory(false);
                    setPph21Deduction(Number(e.target.value));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Potongan BPJS Karyawan (Kes 1% + JHT 2% + JP 1%)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={effectiveBpjs}
                  onChange={(e) => {
                    setAutoStatutory(false);
                    setBpjsDeduction(Number(e.target.value));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Potongan Lainnya / Kasbon</label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Catatan HR / Keuangan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Termasuk bonus target bulanan"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Rincian Resmi Peraturan PPh 21 TER & BPJS */}
          {autoStatutory && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 text-blue-950 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  Rincian Perhitungan Resmi (PP 58/2023 &amp; BPJS)
                </span>
                <span className="font-mono text-[11px] text-blue-800">
                  PTKP {statutory.ptkpStatus} · Kategori TER {statutory.terCategory}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="rounded-lg bg-white border border-blue-100 p-3 space-y-1">
                  <div className="font-semibold text-slate-900">PPh 21 Bulanan (PMK 168/2023)</div>
                  <div className="flex justify-between">
                    <span>Bruto Objek Pajak (+Premi Kes/JKK/JKM)</span>
                    <span className="font-mono">{formatIdr(statutory.pph21TaxableGross)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarif Efektif (TER {statutory.terCategory})</span>
                    <span className="font-mono font-semibold text-blue-800">{statutory.pph21Rate}%</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 font-semibold text-red-700">
                    <span>PPh 21 Dipotong</span>
                    <span className="font-mono">-{formatIdr(statutory.pph21Deduction)}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-white border border-blue-100 p-3 space-y-1">
                  <div className="font-semibold text-slate-900">Potongan BPJS Karyawan</div>
                  <div className="flex justify-between">
                    <span>BPJS Kesehatan 1% (maks upah Rp12jt)</span>
                    <span className="font-mono">-{formatIdr(statutory.bpjsKesEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BPJS TK — JHT 2%</span>
                    <span className="font-mono">-{formatIdr(statutory.bpjsJhtEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BPJS TK — JP 1% (maks Rp10,547jt)</span>
                    <span className="font-mono">-{formatIdr(statutory.bpjsJpEmployee)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>Tanggungan Perusahaan (Kes 4%, JHT 3,7%, JP 2%, JKK 0,24%, JKM 0,3%)</span>
                    <span className="font-mono text-slate-700">{formatIdr(statutory.bpjsEmployerTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-slate-500 block">Gaji Bruto</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatIdr(grossPay)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Potongan</span>
                <span className="font-mono tabular-nums font-semibold text-red-700">
                  -{formatIdr(totalDeductions)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Take Home Pay (Gaji Bersih)</span>
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                {formatIdr(netPay)}
              </span>
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
            disabled={saving || !employeeId}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Slip Gaji'}
          </button>
        </div>
      </form>
    </div>
  );
};
