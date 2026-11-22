import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type {
  Client,
  Employee,
  GoodsHandover,
  HandoverItem,
  HandoverReferenceType,
  HandoverStatus,
  HandoverType,
  Invoice,
  Product,
} from '../types';
import { HANDOVER_ITEM_CONDITIONS } from '../lib/formatters';

interface HandoverModalProps {
  open: boolean;
  initialHandover: GoodsHandover | null;
  clients: Client[];
  invoices: Invoice[];
  products: Product[];
  employees: Employee[];
  existingHandovers: GoodsHandover[];
  defaultSenderName?: string;
  onClose: () => void;
  onSave: (payload: Partial<GoodsHandover>) => Promise<void>;
}

function buildNextHandoverNumber(
  type: HandoverType,
  existing: GoodsHandover[]
): string {
  const year = new Date().getFullYear();
  const prefix = type === 'employee_asset' ? `BAST/INV/${year}/` : `BAST/OUT/${year}/`;
  const count = existing.filter((h) => h.handoverNumber.startsWith(prefix)).length + 1;
  return `${prefix}${String(count).padStart(3, '0')}`;
}

function createEmptyItem(): HandoverItem {
  return {
    id: `bi-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    specification: '',
    serialNumber: '',
    quantity: 1,
    unit: 'Unit',
    condition: 'Baik / Baru',
    notes: '',
  };
}

export const HandoverModal: React.FC<HandoverModalProps> = ({
  open,
  initialHandover,
  clients,
  invoices,
  products,
  employees,
  existingHandovers,
  defaultSenderName,
  onClose,
  onSave,
}) => {
  const [handoverType, setHandoverType] = useState<HandoverType>('client_delivery');
  const [handoverNumber, setHandoverNumber] = useState('');
  const [status, setStatus] = useState<HandoverStatus>('handed_over');
  const [handoverDate, setHandoverDate] = useState('');
  const [city, setCity] = useState('Jakarta');
  const [location, setLocation] = useState('');
  const [referenceType, setReferenceType] = useState<HandoverReferenceType>('manual');
  const [referenceId, setReferenceId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');

  const [senderName, setSenderName] = useState('');
  const [senderTitle, setSenderTitle] = useState('Operasional & Logistik');

  const [recipientName, setRecipientName] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientIdentity, setRecipientIdentity] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');

  const [items, setItems] = useState<HandoverItem[]>([createEmptyItem()]);
  const [notes, setNotes] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);

    if (initialHandover) {
      setHandoverType(initialHandover.handoverType);
      setHandoverNumber(initialHandover.handoverNumber);
      setStatus(initialHandover.status);
      setHandoverDate(initialHandover.handoverDate);
      setCity(initialHandover.city || 'Jakarta');
      setLocation(initialHandover.location || '');
      setReferenceType(initialHandover.referenceType || 'manual');
      setReferenceId(initialHandover.referenceId || '');
      setReferenceNumber(initialHandover.referenceNumber || '');
      setSenderName(initialHandover.senderName);
      setSenderTitle(initialHandover.senderTitle || 'Operasional & Logistik');
      setRecipientName(initialHandover.recipientName);
      setRecipientCompany(initialHandover.recipientCompany || '');
      setRecipientIdentity(initialHandover.recipientIdentity || '');
      setRecipientPhone(initialHandover.recipientPhone || '');
      setRecipientAddress(initialHandover.recipientAddress || '');
      setItems(
        initialHandover.items.length > 0
          ? initialHandover.items.map((it) => ({ ...it }))
          : [createEmptyItem()]
      );
      setNotes(initialHandover.notes || '');
      setSelectedCatalogId('');
    } else {
      setHandoverType('client_delivery');
      setHandoverNumber(buildNextHandoverNumber('client_delivery', existingHandovers));
      setStatus('handed_over');
      setHandoverDate(today);
      setCity('Jakarta');
      setLocation('Kantor Pusat Jakarta');
      setReferenceType('manual');
      setReferenceId('');
      setReferenceNumber('');
      setSenderName(defaultSenderName || 'Operasional');
      setSenderTitle('Operasional & Logistik');
      setRecipientName('');
      setRecipientCompany('');
      setRecipientIdentity('');
      setRecipientPhone('');
      setRecipientAddress('');
      setItems([createEmptyItem()]);
      setNotes(
        'Barang diserahkan lengkap dan telah dilakukan pemeriksaan fisik bersama pada saat serah terima.'
      );
      setSelectedCatalogId('');
    }
  }, [open, initialHandover, existingHandovers, defaultSenderName]);

  if (!open) return null;

  const handleTypeChange = (nextType: HandoverType) => {
    setHandoverType(nextType);
    if (!initialHandover) {
      setHandoverNumber(buildNextHandoverNumber(nextType, existingHandovers));
      setSenderTitle(
        nextType === 'employee_asset' ? 'Head of HR & GA' : 'Operasional & Logistik'
      );
      setReferenceType(nextType === 'employee_asset' ? 'employee' : 'manual');
      setReferenceId('');
      setReferenceNumber('');
    }
  };

  const handleApplyInvoicePreset = (invoiceId: string) => {
    setReferenceId(invoiceId);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    setReferenceType('invoice');
    setReferenceNumber(inv.invoiceNumber);
    const matchedClient = clients.find((c) => c.id === inv.clientId);
    setRecipientName(inv.clientName);
    setRecipientCompany(inv.clientCompany);
    setRecipientPhone(matchedClient?.phone || '');
    setRecipientAddress(matchedClient?.address || '');
    if (matchedClient?.address) setLocation(matchedClient.address);

    if (inv.items.length > 0) {
      setItems(
        inv.items.map((it, idx) => ({
          id: `bi-${Date.now()}-${idx}`,
          name: it.description,
          specification: `Sesuai Faktur ${inv.invoiceNumber}`,
          serialNumber: '',
          quantity: Math.max(1, Number(it.quantity || 1)),
          unit: 'Unit',
          condition: 'Baik / Baru',
          notes: '',
        }))
      );
    }
  };

  const handleApplyClientPreset = (clientId: string) => {
    const cli = clients.find((c) => c.id === clientId);
    if (!cli) return;
    setRecipientName(cli.name);
    setRecipientCompany(cli.companyName);
    setRecipientPhone(cli.phone || '');
    setRecipientAddress(cli.address || '');
    if (cli.address) setLocation(cli.address);
  };

  const handleApplyEmployeePreset = (empId: string) => {
    setReferenceId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setReferenceType('employee');
    setReferenceNumber(emp.nip);
    setRecipientName(emp.name);
    setRecipientCompany(`${emp.department} — ${emp.position}`);
    setRecipientIdentity(`NIP: ${emp.nip}`);
    setRecipientPhone(emp.phone || '');
    setRecipientAddress(emp.email || '');
  };

  const handleAddFromCatalog = (productId: string) => {
    setSelectedCatalogId('');
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const newItem: HandoverItem = {
      id: `bi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: prod.name,
      specification: prod.description || '',
      serialNumber: prod.sku || '',
      quantity: 1,
      unit: prod.unit || 'Unit',
      condition: 'Baik / Baru',
      notes: '',
    };
    setItems((prev) => {
      if (prev.length === 1 && !prev[0].name.trim()) {
        return [newItem];
      }
      return [...prev, newItem];
    });
  };

  const updateItem = (index: number, patch: Partial<HandoverItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedItems = items.filter((it) => it.name.trim().length > 0);
    if (cleanedItems.length === 0) return;

    setSaving(true);
    try {
      await onSave({
        id: initialHandover?.id,
        handoverType,
        handoverNumber: handoverNumber.trim(),
        status,
        handoverDate,
        city: city.trim() || 'Jakarta',
        location: location.trim(),
        referenceType,
        referenceId: referenceId || null,
        referenceNumber: referenceNumber.trim(),
        senderName: senderName.trim(),
        senderTitle: senderTitle.trim(),
        recipientName: recipientName.trim(),
        recipientCompany: recipientCompany.trim(),
        recipientIdentity: recipientIdentity.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientAddress: recipientAddress.trim(),
        items: cleanedItems,
        notes: notes.trim(),
        createdAt: initialHandover?.createdAt,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-2xl my-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {initialHandover
                ? 'Ubah Bukti Serah Terima Barang (BAST)'
                : 'Buat Bukti Serah Terima Barang (BAST)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dokumen otomatis mendapatkan kode barcode QR &amp; Code 128B untuk verifikasi
              keaslian.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Type Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange('client_delivery')}
              className={`rounded-lg border p-3.5 text-left transition-colors ${
                handoverType === 'client_delivery'
                  ? 'border-blue-600 bg-blue-50/70'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900">
                BAST Penyerahan Barang / Klien
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Serah terima barang proyek atau pengiriman pesanan sesuai faktur ke klien.
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('employee_asset')}
              className={`rounded-lg border p-3.5 text-left transition-colors ${
                handoverType === 'employee_asset'
                  ? 'border-blue-600 bg-blue-50/70'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900">
                BAST Inventaris &amp; Aset Karyawan
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Serah terima laptop, perangkat kerja, kartu akses, atau inventaris ke karyawan.
              </div>
            </button>
          </div>

          {/* Quick Autofill Preset Bar */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
              Isi Cepat Data:
            </span>
            {handoverType === 'client_delivery' ? (
              <>
                <select
                  value={referenceType === 'invoice' ? referenceId : ''}
                  onChange={(e) => handleApplyInvoicePreset(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Tarik dari Faktur (Invoice)...</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.clientCompany}
                    </option>
                  ))}
                </select>
                <select
                  value=""
                  onChange={(e) => handleApplyClientPreset(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Pilih Penerima dari Daftar Klien...</option>
                  {clients.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {cli.companyName} ({cli.name})
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                value={referenceType === 'employee' ? referenceId : ''}
                onChange={(e) => handleApplyEmployeePreset(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Pilih Karyawan Penerima Aset...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nip} — {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Document Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor BAST *
              </label>
              <input
                type="text"
                value={handoverNumber}
                onChange={(e) => setHandoverNumber(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Serah Terima *
              </label>
              <input
                type="date"
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as HandoverStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              >
                <option value="draft">Draf</option>
                <option value="handed_over">Diserahkan / Dikirim</option>
                <option value="received">Diterima Sah</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                No. Referensi (Faktur / PO / NIP)
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Contoh: INV-2026-101"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kota *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lokasi Serah Terima
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Alamat gudang / kantor penerima"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Parties: Pihak Pertama & Pihak Kedua */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-900">
                Pihak Pertama (Yang Menyerahkan)
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Petugas Penyerah *
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jabatan / Divisi Penyerah
                </label>
                <input
                  type="text"
                  value={senderTitle}
                  onChange={(e) => setSenderTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-900">
                Pihak Kedua (Yang Menerima)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Penerima *
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Perusahaan / Divisi
                  </label>
                  <input
                    type="text"
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jabatan / NIP / NIK Penerima
                  </label>
                  <input
                    type="text"
                    value={recipientIdentity}
                    onChange={(e) => setRecipientIdentity(e.target.value)}
                    placeholder="Procurement / NIP / KTP"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    No. Telepon / Kontak
                  </label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat / Email Penerima
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Itemized Goods List */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900">
                Rincian Barang yang Diserahterimakan
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {products.length > 0 && (
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => handleAddFromCatalog(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">+ Tambah dari Katalog Produk...</option>
                    {products
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.sku}] {p.name}
                        </option>
                      ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setItems((prev) => [...prev, createEmptyItem()])}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Barang</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        placeholder={`Nama barang #${idx + 1} *`}
                        required
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={item.serialNumber}
                        onChange={(e) => updateItem(idx, { serialNumber: e.target.value })}
                        placeholder="No. Seri / SKU"
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-center focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        placeholder="Satuan"
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                        title="Hapus Baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={item.specification}
                        onChange={(e) => updateItem(idx, { specification: e.target.value })}
                        placeholder="Spesifikasi / tipe / warna"
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={item.condition}
                        onChange={(e) => updateItem(idx, { condition: e.target.value })}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      >
                        {HANDOVER_ITEM_CONDITIONS.map((cond) => (
                          <option key={cond} value={cond}>
                            {cond}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItem(idx, { notes: e.target.value })}
                        placeholder="Kelengkapan / catatan item"
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Umum &amp; Garansi Serah Terima
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : initialHandover ? 'Simpan Perubahan BAST' : 'Terbitkan BAST'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
