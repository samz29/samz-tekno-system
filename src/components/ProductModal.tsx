import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Product } from '../types';

interface ProductModalProps {
  open: boolean;
  initialProduct: Product | null;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  open,
  initialProduct,
  onClose,
  onSave,
}) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('Bulan');
  const [unitPrice, setUnitPrice] = useState(1000000);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialProduct) {
      setSku(initialProduct.sku);
      setName(initialProduct.name);
      setDescription(initialProduct.description);
      setUnit(initialProduct.unit);
      setUnitPrice(initialProduct.unitPrice);
      setActive(initialProduct.active);
    } else {
      setSku(`PRD-${Math.floor(100 + Math.random() * 900)}`);
      setName('');
      setDescription('');
      setUnit('Bulan');
      setUnitPrice(1000000);
      setActive(true);
    }
  }, [open, initialProduct]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await onSave({
        id: initialProduct?.id || `prd-${crypto.randomUUID().slice(0, 8)}`,
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        unit: unit.trim() || 'Unit',
        unitPrice: Number(unitPrice || 0),
        active,
        createdAt: initialProduct?.createdAt || now,
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
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {initialProduct ? 'Ubah Produk / Layanan' : 'Tambah Produk / Layanan'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kode SKU
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="PRD-001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Satuan
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Bulan / Lisensi / Unit / Paket"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Nama Produk atau Layanan
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Lisensi Software ERP Enterprise"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Harga Satuan (IDR)
            </label>
            <input
              type="number"
              required
              min={0}
              step={50000}
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Deskripsi Singkat
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keterangan fitur atau ruang lingkup layanan..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            <span>Aktif dan tersedia saat membuat faktur</span>
          </label>
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
            {saving ? 'Menyimpan...' : 'Simpan Produk'}
          </button>
        </div>
      </form>
    </div>
  );
};
