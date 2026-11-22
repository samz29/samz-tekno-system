import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calculator,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Lock,
  LogIn,
  QrCode,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

interface LoginViewProps {
  onLogin: (identifier: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  onOpenVerify?: () => void;
}

const PLATFORM_PILLARS = [
  {
    icon: FileText,
    title: 'Penagihan & Faktur Otomatis',
    desc: 'Faktur bulanan berulang, ekspor PDF resmi, serta pengiriman email SMTP terjadwal.',
  },
  {
    icon: CreditCard,
    title: 'Integrasi Midtrans Real-Time',
    desc: 'Pembayaran QRIS & Virtual Account terverifikasi webhook dengan notifikasi push.',
  },
  {
    icon: BookOpen,
    title: 'Akuntansi & Buku Kas Kantor',
    desc: 'Pencatatan kas masuk/keluar, rekonsiliasi saldo, dan ringkasan laba rugi bulanan.',
  },
  {
    icon: Calculator,
    title: 'Penggajian PPh 21 TER & BPJS',
    desc: 'Perhitungan pajak sesuai PP 58/2023, BPJS Kesehatan & Ketenagakerjaan, serta manajemen cuti.',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onOpenVerify }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg('Username atau email dan kata sandi wajib diisi.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await onLogin(identifier.trim(), password);
      if (!res.ok) {
        setErrorMsg(res.message || 'Gagal masuk ke sistem.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        {/* Left Brand & Platform Overview Panel */}
        <div className="lg:col-span-6 bg-slate-900 text-slate-100 p-7 sm:p-9 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 text-white">
              <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0" />
              <span className="text-xl font-bold tracking-tight">FakturaFlow</span>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Platform Keuangan, Akuntansi Kantor, Faktur Midtrans, dan Penggajian Perusahaan
            </p>

            <div className="mt-8 space-y-3">
              {PLATFORM_PILLARS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex items-start gap-3"
                  >
                    <div className="rounded-lg bg-slate-800/90 p-2 text-blue-400 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-semibold text-white">{item.title}</h2>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            Akses sistem dilindungi autentikasi berbasis peran (RBAC) dengan sesi terenkripsi.
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-center">
          <div className="max-w-sm w-full mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Masuk ke Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Masukkan kredensial akun perusahaan Anda untuk melanjutkan.
            </p>

            {errorMsg && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Username atau Email Perusahaan
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="nama.pengguna@perusahaan.co.id"
                    autoComplete="username"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Tampilkan kata sandi"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>{submitting ? 'Memverifikasi Sesi...' : 'Masuk ke Dashboard'}</span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 space-y-3 text-xs text-slate-500 leading-relaxed">
              <p>
                Hubungi Administrator perusahaan apabila Anda memerlukan pembuatan akun baru atau
                pemulihan kata sandi.
              </p>
              {onOpenVerify && (
                <button
                  type="button"
                  onClick={onOpenVerify}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-blue-700" />
                  <span>Verifikasi Keaslian Surat (PKWT / SK)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
