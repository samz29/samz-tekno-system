import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  AccountingEntry,
  AccountingEntryStatus,
  AccountingEntryType,
} from '../types';
import {
  ACCOUNTING_ACCOUNTS,
  ACCOUNTING_CATEGORIES,
  ACCOUNTING_PAYMENT_METHODS,
} from '../lib/formatters';

interface AccountingModalProps {
  isOpen: boolean;
  entry: AccountingEntry | null;
  onClose: () => void;
  onSave: (entry: AccountingEntry) => Promise<void>;
}

export const AccountingModal: React.FC<AccountingModalProps> = ({
  isOpen,
  entry,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<AccountingEntryType>('expense');
  const [category, setCategory] = useState(ACCOUNTING_CATEGORIES.expense[0]);
  const [accountName, setAccountName] = useState(ACCOUNTING_ACCOUNTS[0]);
  const [description, setDescription] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(ACCOUNTING_PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState('0');
  const [status, setStatus] = useState<AccountingEntryStatus>('recorded');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (entry) {
      setDate(entry.date);
      setType(entry.type);
      setCategory(entry.category);
      setAccountName(entry.accountName);
      setDescription(entry.description);
      setCounterparty(entry.counterparty || '');
      setPaymentMethod(entry.paymentMethod || ACCOUNTING_PAYMENT_METHODS[0]);
      setAmount(String(entry.amount));
      setStatus(entry.status);
      setNotes(entry.notes || '');
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setType('expense');
      setCategory(ACCOUNTING_CATEGORIES.expense[0]);
      setAccountName(ACCOUNTING_ACCOUNTS[0]);
      setDescription('');
      setCounterparty('');
      setPaymentMethod(ACCOUNTING_PAYMENT_METHODS[0]);
      setAmount('');
      setStatus('recorded');
      setNotes('');
    }
  }, [isOpen, entry]);

  if (!isOpen) return null;

  const availableCategories = ACCOUNTING_CATEGORIES[type];

  const handleTypeSwitch = (nextType: AccountingEntryType) => {
    setType(nextType);
    if (!ACCOUNTING_CATEGORIES[nextType].includes(category)) {
      setCategory(ACCOUNTING_CATEGORIES[nextType][0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Math.round(Number(amount || 0));
    if (!date || !description.trim() || numericAmount <= 0) {
      setErrorMsg('Tanggal, uraian transaksi, dan nominal lebih dari Rp 0 wajib diisi.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const now = new Date().toISOString();
      await onSave({
        id: entry?.id || `acc-${crypto.randomUUID().slice(0, 8)}`,
        entryNumber: entry?.entryNumber || '',
        date,
        type,
        category,
        accountName,
        description: description.trim(),
        counterparty: counterparty.trim(),
        paymentMethod,
        amount: numericAmount,
        status,
        sourceType: entry?.sourceType || 'manual',
        sourceId: entry?.sourceId || null,
        notes: notes.trim(),
        createdBy: entry?.createdBy || '',
        createdAt: entry?.createdAt || now,
        updatedAt: now,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan transaksi akuntansi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {entry ? `Ubah Jurnal ${entry.entryNumber}` : 'Catat Transaksi Kas & Bank'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pembukuan pemasukan dan pengeluaran operasional kantor
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {/* Type Segmented Toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleTypeSwitch('income')}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  type === 'income'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pemasukan (Kas Masuk)
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('expense')}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  type === 'expense'
                    ? 'bg-white text-red-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pengeluaran (Kas Keluar)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Transaksi
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nominal (IDR)
              </label>
              <input
                type="number"
                min={1}
                step={1000}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Contoh: 1500000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kategori Akun
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                {!availableCategories.includes(category) && (
                  <option value={category}>{category}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Akun Kas / Rekening Bank
              </label>
              <select
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {ACCOUNTING_ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Uraian Transaksi
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'income'
                  ? 'Contoh: Penerimaan termin proyek website PT Maju Bersama'
                  : 'Contoh: Pembayaran tagihan internet kantor & listrik November'
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pihak Terkait / Vendor
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Nama klien / vendor"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {ACCOUNTING_PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
                {!ACCOUNTING_PAYMENT_METHODS.includes(paymentMethod) && (
                  <option value={paymentMethod}>{paymentMethod}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Status Rekonsiliasi
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AccountingEntryStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="recorded">Tercatat</option>
                <option value="reconciled">Terekonsiliasi</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan / No. Referensi Bukti
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsional: nomor kwitansi, bukti transfer, atau keterangan tambahan"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : entry ? 'Simpan Perubahan' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
