import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Building2,
  Check,
  Copy,
  CreditCard,
  Eye,
  Globe,
  Image as ImageIcon,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  AppSettingsPublic,
  CompanyProfileCaseStudy,
  CompanyProfilePillar,
} from '../types';
import { LoginView } from './LoginView';

interface SettingsViewProps {
  settings: AppSettingsPublic;
  pushPermission: NotificationPermission;
  isPushSubscribed: boolean;
  onEnablePush: () => Promise<void>;
  onTestPush: () => Promise<void>;
  onSaveMidtrans: (payload: {
    environment: 'sandbox' | 'production';
    merchantId: string;
    clientKey: string;
    serverKey?: string;
    enabledPayments: string[];
    autoCreatePaymentLink: boolean;
  }) => Promise<void>;
  onTestMidtrans: (payload: {
    environment: 'sandbox' | 'production';
    merchantId: string;
    clientKey: string;
    serverKey?: string;
  }) => Promise<{ ok: boolean; message: string }>;
  onSaveSmtp: (payload: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
    fromName: string;
    fromEmail: string;
    autoMonthlyEnabled: boolean;
  }) => Promise<void>;
  onTestSmtp: (payload: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
  }) => Promise<{ ok: boolean; message: string }>;
  onSaveCompany: (payload: AppSettingsPublic['company']) => Promise<void>;
}

const PAYMENT_OPTIONS = [
  { id: 'qris', label: 'QRIS' },
  { id: 'gopay', label: 'GoPay' },
  { id: 'bca_va', label: 'BCA Virtual Account' },
  { id: 'bni_va', label: 'BNI Virtual Account' },
  { id: 'bri_va', label: 'BRI Virtual Account' },
  { id: 'permata_va', label: 'Permata VA' },
  { id: 'other_va', label: 'Mandiri / VA Lainnya' },
  { id: 'credit_card', label: 'Kartu Kredit / Debit' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  pushPermission,
  isPushSubscribed,
  onEnablePush,
  onTestPush,
  onSaveMidtrans,
  onTestMidtrans,
  onSaveSmtp,
  onTestSmtp,
  onSaveCompany,
}) => {
  const [activeTab, setActiveTab] = useState<'midtrans' | 'smtp' | 'company' | 'website' | 'push'>(
    'midtrans'
  );

  // Midtrans form state
  const [env, setEnv] = useState<'sandbox' | 'production'>(settings.midtrans.environment);
  const [merchantId, setMerchantId] = useState(settings.midtrans.merchantId);
  const [clientKey, setClientKey] = useState(settings.midtrans.clientKey);
  const [serverKey, setServerKey] = useState('');
  const [enabledPayments, setEnabledPayments] = useState<string[]>(
    settings.midtrans.enabledPayments
  );
  const [autoLink, setAutoLink] = useState(settings.midtrans.autoCreatePaymentLink);
  const [midtransStatusMsg, setMidtransStatusMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // SMTP form state
  const [smtpHost, setSmtpHost] = useState(settings.smtp.host);
  const [smtpPort, setSmtpPort] = useState(settings.smtp.port);
  const [smtpSecure, setSmtpSecure] = useState(settings.smtp.secure);
  const [smtpUser, setSmtpUser] = useState(settings.smtp.username);
  const [smtpPass, setSmtpPass] = useState('');
  const [fromName, setFromName] = useState(settings.smtp.fromName);
  const [fromEmail, setFromEmail] = useState(settings.smtp.fromEmail);
  const [autoMonthly, setAutoMonthly] = useState(settings.smtp.autoMonthlyEnabled);
  const [smtpStatusMsg, setSmtpStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Company form state
  const [company, setCompany] = useState(settings.company);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [websiteImageError, setWebsiteImageError] = useState<string | null>(null);
  const [previewWebsiteOpen, setPreviewWebsiteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompany(settings.company);
  }, [settings.company]);

  const handleSectionImageUpload = (
    field: 'heroImageDataUrl' | 'aboutImageDataUrl' | 'portfolioImageDataUrl',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWebsiteImageError(null);

    if (!file.type.startsWith('image/')) {
      setWebsiteImageError('Format foto harus berupa gambar (PNG, JPG, atau WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1280;
        const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setCompany((prev) => ({ ...prev, [field]: jpegDataUrl }));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const defaultPillars: CompanyProfilePillar[] = [
    {
      title: 'Sistem Penagihan & Rekonsiliasi Pembayaran',
      description:
        'Penerbitan faktur resmi, jadwal penagihan bulanan otomatis, serta pembayaran QRIS dan Virtual Account dengan pembaruan status transaksi secara langsung.',
    },
    {
      title: 'Administrasi SDM, Kontrak & BAST Berbarcode',
      description:
        'Pengelolaan kontrak PKWT, SK pengangkatan, penggajian PPh 21, dan Berita Acara Serah Terima Barang (BAST) yang seluruhnya dilengkapi verifikasi QR dan Code 128B.',
    },
  ];

  const defaultCaseStudies: CompanyProfileCaseStudy[] = [
    {
      sector: 'Logistik & Distribusi Nasional',
      title: 'Otomatisasi Penagihan & Rekonsiliasi Multi-Cabang',
      metric: '38% lebih cepat dalam rekonsiliasi bulanan',
      detail:
        'Menyatukan 140+ faktur langganan bulanan dengan kanal pembayaran Virtual Account dan notifikasi pelunasan otomatis.',
    },
    {
      sector: 'Ritel & Infrastruktur Perangkat',
      title: 'Digitalisasi Serah Terima Aset & Kontrak Karyawan',
      metric: '100% dokumen BAST & SK terverifikasi barcode',
      detail:
        'Setiap pengiriman perangkat dan surat pengangkatan tercatat dalam arsip resmi dengan kode verifikasi QR dan sidik jari SHA-256.',
    },
  ];

  const currentPillars =
    Array.isArray(company.pillars) && company.pillars.length > 0 ? company.pillars : defaultPillars;
  const currentCaseStudies =
    Array.isArray(company.caseStudies) && company.caseStudies.length > 0
      ? company.caseStudies
      : defaultCaseStudies;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Format file harus berupa gambar (PNG, JPG, atau WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 256;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const pngDataUrl = canvas.toDataURL('image/png');
        setCompany((prev) => ({ ...prev, logoDataUrl: pngDataUrl }));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const togglePaymentChannel = (id: string) => {
    setEnabledPayments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(settings.midtrans.webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Pengaturan Integrasi & Otomatisasi
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Konfigurasi API Midtrans, server email SMTP bulanan, notifikasi push, dan profil resmi
            perusahaan.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('midtrans')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'midtrans'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Midtrans API</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('smtp')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'smtp'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email SMTP</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('push')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'push'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Notifikasi Push</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'company'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Profil Perusahaan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('website')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'website'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Website Profil</span>
          </button>
        </div>
      </div>

      {activeTab === 'midtrans' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Kredensial Gateway Pembayaran Midtrans
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Server Key disimpan terenkapsulasi di server backend dan tidak pernah diekspos ke
                browser klien.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setEnv('sandbox')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  env === 'sandbox'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sandbox (Uji Coba)
              </button>
              <button
                type="button"
                onClick={() => setEnv('production')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  env === 'production'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Production (Live)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Merchant ID</label>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="Contoh: G123456789"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Client Key</label>
              <input
                type="text"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
                placeholder="SB-Mid-client-..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Server Key{' '}
                {settings.midtrans.hasServerKey && (
                  <span className="font-mono text-slate-500 font-normal">
                    (Tersimpan: {settings.midtrans.serverKeyMasked} — kosongkan jika tidak ingin
                    mengubah)
                  </span>
                )}
              </label>
              <input
                type="password"
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                placeholder={
                  settings.midtrans.hasServerKey
                    ? 'Masukkan Server Key baru untuk mengganti...'
                    : 'SB-Mid-server-...'
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Kanal Pembayaran Aktif (Snap)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PAYMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={enabledPayments.includes(opt.id)}
                    onChange={() => togglePaymentChannel(opt.id)}
                    className="rounded border-slate-300 text-blue-700"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-800">
                Payment Notification Webhook URL (Tempel di Midtrans Dashboard → Settings →
                Configuration)
              </span>
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                {copiedWebhook ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedWebhook ? 'Tersalin' : 'Salin URL'}</span>
              </button>
            </div>
            <div className="font-mono text-xs text-slate-700 break-all">
              {settings.midtrans.webhookUrl}
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLink}
              onChange={(e) => setAutoLink(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            <span>Otomatis buat tautan pembayaran Midtrans Snap saat email faktur dikirim</span>
          </label>

          {midtransStatusMsg && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                midtransStatusMsg.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {midtransStatusMsg.text}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await onTestMidtrans({
                    environment: env,
                    merchantId,
                    clientKey,
                    serverKey: serverKey || undefined,
                  });
                  setMidtransStatusMsg({ ok: res.ok, text: res.message });
                } finally {
                  setSaving(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Uji Koneksi Midtrans</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveMidtrans({
                    environment: env,
                    merchantId,
                    clientKey,
                    serverKey: serverKey || undefined,
                    enabledPayments,
                    autoCreatePaymentLink: autoLink,
                  });
                  setServerKey('');
                  setMidtransStatusMsg({
                    ok: true,
                    text: 'Konfigurasi Midtrans berhasil disimpan.',
                  });
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Simpan Konfigurasi Midtrans
            </button>
          </div>
        </div>
      )}

      {activeTab === 'smtp' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Server Email Otomatis (SMTP)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Digunakan untuk mengirimkan faktur bulanan secara otomatis ke alamat email klien. Jika
              belum diisi, sistem menggunakan Mode Preview Lokal yang aman.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Host SMTP</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com atau smtp.mailgun.org"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Port</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700"
                  />
                  <span>SSL / TLS (Port 465)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Username SMTP
              </label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="billing@perusahaan.co.id"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Password / App Password{' '}
                {settings.smtp.hasPassword && (
                  <span className="font-mono text-slate-500 font-normal">
                    ({settings.smtp.passwordMasked})
                  </span>
                )}
              </label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="Masukkan password SMTP..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Pengirim
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Pengirim (From)
              </label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoMonthly}
              onChange={(e) => setAutoMonthly(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            <span>Aktifkan scheduler otomatis harian (08:00 WIB) untuk faktur berulang bulanan</span>
          </label>

          {smtpStatusMsg && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                smtpStatusMsg.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {smtpStatusMsg.text}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await onTestSmtp({
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure,
                    username: smtpUser,
                    password: smtpPass || undefined,
                  });
                  setSmtpStatusMsg({ ok: res.ok, text: res.message });
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Uji Koneksi SMTP
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveSmtp({
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure,
                    username: smtpUser,
                    password: smtpPass || undefined,
                    fromName,
                    fromEmail,
                    autoMonthlyEnabled: autoMonthly,
                  });
                  setSmtpPass('');
                  setSmtpStatusMsg({ ok: true, text: 'Konfigurasi SMTP berhasil disimpan.' });
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Simpan Konfigurasi SMTP
            </button>
          </div>
        </div>
      )}

      {activeTab === 'push' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Pelacakan Pembayaran Real-Time via Notifikasi Push
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aktifkan Web Push VAPID agar perangkat Anda menerima notifikasi instan saat klien
              melunasi tagihan melalui Midtrans.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-4">
              <span className="text-xs text-slate-500 block">Izin Notifikasi Browser</span>
              <span className="font-semibold text-slate-900 mt-1 block">
                {pushPermission === 'granted'
                  ? 'Diizinkan (Granted)'
                  : pushPermission === 'denied'
                  ? 'Diblokir (Denied)'
                  : 'Belum Diminta'}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <span className="text-xs text-slate-500 block">Status Langganan Web Push</span>
              <span className="font-semibold text-slate-900 mt-1 block">
                {isPushSubscribed ? 'Terdaftar & Aktif (VAPID)' : 'Belum Berlangganan'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onEnablePush}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              {isPushSubscribed ? 'Perbarui Langganan Push' : 'Aktifkan Notifikasi Push'}
            </button>
            <button
              type="button"
              onClick={onTestPush}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Kirim Uji Notifikasi Push
            </button>
          </div>
        </div>
      )}

      {activeTab === 'company' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Identitas Perusahaan, Logo &amp; Rekening Bank
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ditampilkan pada header faktur PDF/cetak dan template email penagihan resmi.
            </p>
          </div>

          {/* Logo Upload Section */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                {company.logoDataUrl ? (
                  <img
                    src={company.logoDataUrl}
                    alt="Logo Perusahaan"
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Logo Perusahaan</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format PNG atau JPG. Otomatis disesuaikan untuk dokumen PDF dan email faktur.
                </p>
                {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{company.logoDataUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              {company.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setCompany((prev) => ({ ...prev, logoDataUrl: '' }))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Perusahaan
              </label>
              <input
                type="text"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">NPWP</label>
              <input
                type="text"
                value={company.npwp}
                onChange={(e) => setCompany({ ...company, npwp: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Keuangan
              </label>
              <input
                type="email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Telepon</label>
              <input
                type="text"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Alamat Lengkap
              </label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Bank</label>
              <input
                type="text"
                value={company.bankName}
                onChange={(e) => setCompany({ ...company, bankName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nomor Rekening
              </label>
              <input
                type="text"
                value={company.bankAccountNumber}
                onChange={(e) => setCompany({ ...company, bankAccountNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Pemilik Rekening (Atas Nama)
              </label>
              <input
                type="text"
                value={company.bankAccountName}
                onChange={(e) => setCompany({ ...company, bankAccountName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              Ingin mengatur tampilan halaman depan (Hero, foto, portofolio, layanan, dan tombol)
              sebelum login?
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('website')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              Buka Editor Website Profil &rarr;
            </button>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveCompany(company);
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Simpan Profil Perusahaan
            </button>
          </div>
        </div>
      )}

      {activeTab === 'website' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Editor Website Company Profile (Halaman Awal Publik)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sesuaikan seluruh teks, foto, pilar keunggulan, studi kasus portofolio, dan bagian
                yang tampil di halaman awal sebelum login.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewWebsiteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5 text-blue-700" />
              <span>Pratinjau Halaman Publik</span>
            </button>
          </div>

          {websiteImageError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
              {websiteImageError}
            </div>
          )}

          {/* 1. Hero & Tajuk Halaman Depan */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">1. Hero &amp; Tajuk Utama</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Kota Kantor Pusat
                </label>
                <input
                  type="text"
                  value={company.city || ''}
                  onChange={(e) => setCompany({ ...company, city: e.target.value })}
                  placeholder="Jakarta Selatan"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tahun Berdiri
                </label>
                <input
                  type="text"
                  value={company.foundedYear || ''}
                  onChange={(e) => setCompany({ ...company, foundedYear: e.target.value })}
                  placeholder="2019"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Label Tombol Portal Hero
                </label>
                <input
                  type="text"
                  value={company.heroCtaLabel ?? 'Masuk Portal Karyawan'}
                  onChange={(e) => setCompany({ ...company, heroCtaLabel: e.target.value })}
                  placeholder="Masuk Portal Karyawan"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tagline Perusahaan
                </label>
                <input
                  type="text"
                  value={company.tagline || ''}
                  onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Judul Utama (Hero Headline)
                </label>
                <input
                  type="text"
                  value={company.heroTitle || ''}
                  onChange={(e) => setCompany({ ...company, heroTitle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Subjudul Hero
                </label>
                <textarea
                  rows={2}
                  value={company.heroSubtitle || ''}
                  onChange={(e) => setCompany({ ...company, heroSubtitle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* 2. Foto Utama Halaman Depan */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                2. Foto Halaman Depan (Opsional — Kosongkan untuk Foto Bawaan)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gambar otomatis diperkecil ke lebar maks. 1280px agar halaman depan cepat dimuat.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  { field: 'heroImageDataUrl', label: 'Foto Hero Utama' },
                  { field: 'aboutImageDataUrl', label: 'Foto Tentang & Tim' },
                  { field: 'portfolioImageDataUrl', label: 'Foto Portofolio' },
                ] as const
              ).map(({ field, label }) => {
                const value = company[field] || '';
                return (
                  <div
                    key={field}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-800">{label}</span>
                      {value && (
                        <button
                          type="button"
                          onClick={() => setCompany((prev) => ({ ...prev, [field]: '' }))}
                          className="text-[11px] font-medium text-red-700 hover:underline"
                        >
                          Pakai Bawaan
                        </button>
                      )}
                    </div>
                    <div className="h-28 rounded-md border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                      {value ? (
                        <img
                          src={value}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-slate-400 px-3">
                          <ImageIcon className="w-5 h-5 mx-auto mb-1" />
                          <span className="text-[11px] block">Menggunakan foto bawaan</span>
                        </div>
                      )}
                    </div>
                    <label className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{value ? 'Ganti Foto' : 'Unggah Foto'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleSectionImageUpload(field, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Tentang, Visi & Pilar Keunggulan */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              3. Tentang Perusahaan, Visi &amp; Pilar Keunggulan
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Profil &amp; Tentang Perusahaan
                </label>
                <textarea
                  rows={3}
                  value={company.aboutDescription || ''}
                  onChange={(e) => setCompany({ ...company, aboutDescription: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Visi Perusahaan
                </label>
                <textarea
                  rows={3}
                  value={company.vision || ''}
                  onChange={(e) => setCompany({ ...company, vision: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Pilar Keunggulan (Maks. 6 item)
                </span>
                {currentPillars.length < 6 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCompany((prev) => ({
                        ...prev,
                        pillars: [
                          ...currentPillars,
                          { title: 'Keunggulan Baru', description: '' },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Pilar</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentPillars.map((pillar, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-600">
                        Pilar {String(idx + 1).padStart(2, '0')}
                      </span>
                      {currentPillars.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompany((prev) => ({
                              ...prev,
                              pillars: currentPillars.filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-xs text-red-700 hover:underline"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={pillar.title}
                      onChange={(e) => {
                        const next = currentPillars.map((item, i) =>
                          i === idx ? { ...item, title: e.target.value } : item
                        );
                        setCompany((prev) => ({ ...prev, pillars: next }));
                      }}
                      placeholder="Judul pilar keunggulan"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <textarea
                      rows={2}
                      value={pillar.description}
                      onChange={(e) => {
                        const next = currentPillars.map((item, i) =>
                          i === idx ? { ...item, description: e.target.value } : item
                        );
                        setCompany((prev) => ({ ...prev, pillars: next }));
                      }}
                      placeholder="Deskripsi singkat keunggulan"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Studi Kasus Portofolio */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  4. Studi Kasus Portofolio Implementasi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tampilkan proyek unggulan dan hasil nyata yang dicapai klien Anda.
                </p>
              </div>
              {currentCaseStudies.length < 6 && (
                <button
                  type="button"
                  onClick={() =>
                    setCompany((prev) => ({
                      ...prev,
                      caseStudies: [
                        ...currentCaseStudies,
                        {
                          sector: 'Sektor Industri',
                          title: 'Proyek Implementasi Baru',
                          metric: 'Hasil terukur proyek',
                          detail: '',
                        },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Studi Kasus</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentCaseStudies.map((cs, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-600">
                      Studi Kasus {idx + 1}
                    </span>
                    {currentCaseStudies.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setCompany((prev) => ({
                            ...prev,
                            caseStudies: currentCaseStudies.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs text-red-700 hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={cs.sector}
                    onChange={(e) => {
                      const next = currentCaseStudies.map((item, i) =>
                        i === idx ? { ...item, sector: e.target.value } : item
                      );
                      setCompany((prev) => ({ ...prev, caseStudies: next }));
                    }}
                    placeholder="Sektor Industri"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={cs.title}
                    onChange={(e) => {
                      const next = currentCaseStudies.map((item, i) =>
                        i === idx ? { ...item, title: e.target.value } : item
                      );
                      setCompany((prev) => ({ ...prev, caseStudies: next }));
                    }}
                    placeholder="Judul Proyek"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                  />
                  <input
                    type="text"
                    value={cs.metric}
                    onChange={(e) => {
                      const next = currentCaseStudies.map((item, i) =>
                        i === idx ? { ...item, metric: e.target.value } : item
                      );
                      setCompany((prev) => ({ ...prev, caseStudies: next }));
                    }}
                    placeholder="Hasil / Metrik (mis. 38% lebih cepat)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                  />
                  <textarea
                    rows={2}
                    value={cs.detail}
                    onChange={(e) => {
                      const next = currentCaseStudies.map((item, i) =>
                        i === idx ? { ...item, detail: e.target.value } : item
                      );
                      setCompany((prev) => ({ ...prev, caseStudies: next }));
                    }}
                    placeholder="Ringkasan implementasi proyek"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 5. Tampilan Bagian & Catatan Footer */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              5. Bagian Halaman yang Ditampilkan &amp; Footer
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  { key: 'showServicesSection', label: 'Katalog Layanan Aktif' },
                  { key: 'showPortfolioSection', label: 'Portofolio Implementasi' },
                  { key: 'showVerifySection', label: 'Verifikasi Barcode Publik' },
                  { key: 'showContactSection', label: 'Formulir Konsultasi' },
                ] as const
              ).map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={company[toggle.key] !== false}
                    onChange={(e) =>
                      setCompany((prev) => ({ ...prev, [toggle.key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  <span className="text-xs font-medium text-slate-800">{toggle.label}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Teks Kanan Footer Halaman Depan
              </label>
              <input
                type="text"
                value={company.footerNote ?? 'Portal Internal & Verifikasi Dokumen Resmi'}
                onChange={(e) => setCompany({ ...company, footerNote: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setPreviewWebsiteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye className="w-4 h-4 text-blue-700" />
              <span>Pratinjau Halaman Publik</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveCompany({
                    ...company,
                    pillars: currentPillars,
                    caseStudies: currentCaseStudies,
                  });
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Website Company Profile'}
            </button>
          </div>
        </div>
      )}

      {previewWebsiteOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <LoginView
            previewCompany={{
              ...company,
              pillars: currentPillars,
              caseStudies: currentCaseStudies,
            }}
            onExitPreview={() => setPreviewWebsiteOpen(false)}
            onLogin={async () => ({ ok: false })}
          />
        </div>
      )}
    </div>
  );
};
