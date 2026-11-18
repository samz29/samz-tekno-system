import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Client, InvoiceItem, Product, RecurringSchedule } from '../types';
import { formatIdr } from '../lib/formatters';

interface ScheduleModalProps {
  open: boolean;
  clients: Client[];
  products: Product[];
  initialSchedule: RecurringSchedule | null;
  onClose: () => void;
  onSave: (schedule: RecurringSchedule) => Promise<void>;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  open,
  clients,
  products,
  initialSchedule,
  onClose,
  onSave,
}) => {
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [taxRate, setTaxRate] = useState(11);
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [autoCreateMidtrans, setAutoCreateMidtrans] = useState(true);
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialSchedule) {
      setClientId(initialSchedule.clientId);
      setTitle(initialSchedule.title);
      setDayOfMonth(initialSchedule.dayOfMonth);
      setTaxRate(initialSchedule.taxRate);
      setAutoSendEmail(initialSchedule.autoSendEmail);
      setAutoCreateMidtrans(initialSchedule.autoCreateMidtrans);
      setActive(initialSchedule.active);
      setItems(initialSchedule.items);
    } else {
      setClientId(clients[0]?.id || '');
      setTitle('Langganan Layanan Cloud Bulanan');
      setDayOfMonth(1);
      setTaxRate(11);
      setAutoSendEmail(true);
      setAutoCreateMidtrans(true);
      setActive(true);
      setItems([
        {
          id: `sit-${Date.now()}`,
          description: 'Layanan Managed Infrastructure Bulanan',
          quantity: 1,
          unitPrice: 7500000,
          total: 7500000,
        },
      ]);
    }
  }, [open, initialSchedule, clients]);

  if (!open) return null;

  const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const totalWithTax = subtotal + Math.round((subtotal * taxRate) / 100);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.total = Number(next.quantity) * Number(next.unitPrice);
        return next;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    if (!client || !title.trim()) return;

    setSaving(true);
    try {
      const now = new Date();
      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth)
        .toISOString()
        .slice(0, 10);
      await onSave({
        id: initialSchedule?.id || `sch-${crypto.randomUUID().slice(0, 8)}`,
        clientId: client.id,
        clientName: client.name,
        clientCompany: client.companyName,
        clientEmail: client.email,
        title: title.trim(),
        dayOfMonth,
        taxRate,
        items: items.map((it) => ({
          ...it,
          total: Number(it.quantity) * Number(it.unitPrice),
        })),
        autoSendEmail,
        autoCreateMidtrans,
        active,
        lastRunMonth: initialSchedule?.lastRunMonth || null,
        nextRunDate: initialSchedule?.nextRunDate || nextDate,
        updatedAt: now.toISOString(),
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
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {initialSchedule ? 'Ubah Jadwal Penagihan Bulanan' : 'Tambah Jadwal Penagihan Bulanan'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Klien</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Judul Kontrak / Tagihan
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal Terbit Setiap Bulan (1–28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">PPN (%)</label>
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
              <span className="text-xs font-medium text-slate-700">Item Tagihan Rutin</span>
              <div className="flex items-center gap-2">
                {products.some((p) => p.active) && (
                  <select
                    value=""
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value);
                      if (product) {
                        setItems((prev) => [
                          ...prev,
                          {
                            id: `sit-${Date.now()}-${prev.length}`,
                            description: `${product.name} (${product.unit})`,
                            quantity: 1,
                            unitPrice: product.unitPrice,
                            total: product.unitPrice,
                          },
                        ]);
                      }
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
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      {
                        id: `sit-${Date.now()}`,
                        description: '',
                        quantity: 1,
                        unitPrice: 0,
                        total: 0,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Item Manual</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    required
                    placeholder="Deskripsi layanan"
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    className="col-span-6 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    className="col-span-2 rounded-lg border border-slate-300 px-2 py-2 text-right font-mono text-sm tabular-nums"
                  />
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                    className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-right font-mono text-sm tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={items.length <= 1}
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 flex justify-center text-slate-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right text-xs text-slate-600">
              Estimasi Tagihan Bulanan (termasuk PPN {taxRate}%):{' '}
              <strong className="font-mono text-slate-900 tabular-nums">
                {formatIdr(totalWithTax)}
              </strong>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-slate-200 pt-4">
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSendEmail}
                onChange={(e) => setAutoSendEmail(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span>Kirim faktur otomatis ke email klien setiap bulan</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateMidtrans}
                onChange={(e) => setAutoCreateMidtrans(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span>Sertakan tautan pembayaran Midtrans otomatis di dalam email</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span>Jadwal aktif berjalan otomatis</span>
            </label>
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
            {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
          </button>
        </div>
      </form>
    </div>
  );
};
