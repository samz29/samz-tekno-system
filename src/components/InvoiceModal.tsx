import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Client, Invoice, InvoiceItem, InvoiceStatus, Product } from '../types';
import { formatIdr } from '../lib/formatters';

interface InvoiceModalProps {
  open: boolean;
  clients: Client[];
  products: Product[];
  initialInvoice: Invoice | null;
  existingCount: number;
  canSendEmail?: boolean;
  onClose: () => void;
  onSave: (invoice: Invoice, sendAfterSave: boolean) => Promise<void>;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  open,
  clients,
  products,
  initialInvoice,
  existingCount,
  canSendEmail = true,
  onClose,
  onSave,
}) => {
  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('pending');
  const [taxRate, setTaxRate] = useState(11);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (initialInvoice) {
      setClientId(initialInvoice.clientId);
      setInvoiceNumber(initialInvoice.invoiceNumber);
      setIssueDate(initialInvoice.issueDate);
      setDueDate(initialInvoice.dueDate);
      setStatus(initialInvoice.status);
      setTaxRate(initialInvoice.taxRate);
      setNotes(initialInvoice.notes);
      setItems(initialInvoice.items.length ? initialInvoice.items : []);
    } else {
      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + 14);
      const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const seq = String(existingCount + 1).padStart(3, '0');

      setClientId(clients[0]?.id || '');
      setInvoiceNumber(`INV-${ym}-${seq}`);
      setIssueDate(today.toISOString().slice(0, 10));
      setDueDate(due.toISOString().slice(0, 10));
      setStatus('pending');
      setTaxRate(11);
      setNotes('Mohon selesaikan pembayaran sebelum tanggal jatuh tempo melalui tautan Midtrans.');
      setItems([
        {
          id: `it-${Date.now()}`,
          description: 'Layanan Sistem Enterprise Bulanan',
          quantity: 1,
          unitPrice: 5000000,
          total: 5000000,
        },
      ]);
    }
  }, [open, initialInvoice, clients, existingCount]);

  if (!open) return null;

  const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const totalAmount = subtotal + taxAmount;

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        next.total = Number(next.quantity || 0) * Number(next.unitPrice || 0);
        return next;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `it-${Date.now()}-${prev.length}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const addProductFromCatalog = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setItems((prev) => [
      ...prev,
      {
        id: `it-${Date.now()}-${prev.length}`,
        description: `${product.name} (${product.unit})`,
        quantity: 1,
        unitPrice: product.unitPrice,
        total: product.unitPrice,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (sendAfterSave: boolean) => {
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!selectedClient || !invoiceNumber.trim()) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: Invoice = {
        id: initialInvoice?.id || `inv-${crypto.randomUUID().slice(0, 8)}`,
        invoiceNumber: invoiceNumber.trim(),
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientCompany: selectedClient.companyName,
        clientEmail: selectedClient.email,
        issueDate,
        dueDate,
        status,
        items: items.map((it) => ({
          ...it,
          total: Number(it.quantity) * Number(it.unitPrice),
        })),
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        notes,
        midtransOrderId: initialInvoice?.midtransOrderId || null,
        midtransSnapToken: initialInvoice?.midtransSnapToken || null,
        midtransPaymentUrl: initialInvoice?.midtransPaymentUrl || null,
        midtransPaymentType: initialInvoice?.midtransPaymentType || null,
        midtransTransactionStatus: initialInvoice?.midtransTransactionStatus || null,
        paidAt: initialInvoice?.paidAt || null,
        emailSentAt: initialInvoice?.emailSentAt || null,
        recurringScheduleId: initialInvoice?.recurringScheduleId || null,
        updatedAt: now,
      };
      await onSave(payload, sendAfterSave);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {initialInvoice ? `Ubah Faktur ${initialInvoice.invoiceNumber}` : 'Buat Faktur Baru'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Faktur langsung tersimpan ke database perusahaan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Klien Perusahaan
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nomor Faktur
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal Terbit
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal Jatuh Tempo
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Status Faktur
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="draft">Draf</option>
                <option value="pending">Menunggu Pembayaran</option>
                <option value="paid">Lunas</option>
                <option value="overdue">Jatuh Tempo</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tarif PPN (%)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-700">Rincian Item Tagihan</span>
              <div className="flex items-center gap-2">
                {products.some((p) => p.active) && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addProductFromCatalog(e.target.value);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">+ Pilih dari Katalog Produk...</option>
                    {products
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatIdr(p.unitPrice)}/{p.unit}
                        </option>
                      ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Manual</span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-3">Deskripsi Layanan / Produk</th>
                    <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-36 text-right">Harga Satuan</th>
                    <th className="py-2.5 px-3 w-36 text-right">Subtotal</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                          placeholder="Nama layanan atau produk..."
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-right font-mono text-sm text-slate-900 tabular-nums">
                        {formatIdr(item.quantity * item.unitPrice)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                          aria-label="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Catatan untuk Klien
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums text-slate-900">{formatIdr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>PPN ({taxRate}%)</span>
                <span className="font-mono tabular-nums text-slate-900">{formatIdr(taxAmount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-base text-slate-900">
                <span>Total Tagihan</span>
                <span className="font-mono tabular-nums">{formatIdr(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving || clients.length === 0}
            onClick={() => handleSubmit(false)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            Simpan Faktur
          </button>
          {canSendEmail && (
            <button
              type="button"
              disabled={saving || clients.length === 0}
              onClick={() => handleSubmit(true)}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {saving ? 'Memproses...' : 'Simpan & Kirim Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
