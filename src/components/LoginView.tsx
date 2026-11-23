import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Menu,
  Phone,
  QrCode,
  Send,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { CompanyProfile, PublicCompanyProfilePayload } from '../types';
import { formatIdr } from '../lib/formatters';
import heroCorporateImg from '../assets/images/hero_corporate_hq_1795443793076.jpg';
import operationsTeamImg from '../assets/images/bento_operations_team_1795443793200.jpg';
import datacenterDeliveryImg from '../assets/images/portfolio_datacenter_delivery_1795443793245.jpg';

interface LoginViewProps {
  onLogin: (identifier: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  onOpenVerify?: (code?: string) => void;
  previewCompany?: CompanyProfile;
  onExitPreview?: () => void;
}

const DEFAULT_PROFILE: PublicCompanyProfilePayload = {
  company: {
    name: 'PT Nusantara Digital Karya',
    email: 'finance@nusantarakarya.co.id',
    phone: '+62 21 5082 4190',
    address: 'Gedung Treasury Tower Lt. 18, SCBD Lot 28, Jakarta Selatan 12190',
    logoDataUrl: '',
    tagline: 'Solusi Infrastruktur Digital, Sistem Keuangan & Pengadaan Korporasi',
    heroTitle: 'Mitra Strategis Infrastruktur Digital & Tata Kelola Bisnis Modern',
    heroSubtitle:
      'Kami merancang sistem cloud, integrasi pembayaran korporasi, serta penyediaan perangkat keras terkelola dengan standar dokumentasi resmi dan akuntabilitas penuh.',
    heroCtaLabel: 'Masuk Portal Karyawan',
    heroImageDataUrl: '',
    aboutDescription:
      'Berdiri di kawasan bisnis SCBD Jakarta, kami membantu perusahaan skala menengah hingga enterprise menyatukan infrastruktur teknologi, kepatuhan administrasi, serta siklus penagihan dan serah terima aset dalam satu ekosistem terukur.',
    aboutImageDataUrl: '',
    vision:
      'Menjadi mitra teknologi dan operasional terpercaya bagi korporasi Indonesia melalui rekayasa sistem yang transparan, aman, dan berkelanjutan.',
    foundedYear: '2019',
    city: 'Jakarta Selatan',
    portfolioImageDataUrl: '',
    pillars: [
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
    ],
    caseStudies: [
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
    ],
    showServicesSection: true,
    showPortfolioSection: true,
    showVerifySection: true,
    showContactSection: true,
    footerNote: 'Portal Internal & Verifikasi Dokumen Resmi',
  },
  services: [
    {
      id: 'srv-1',
      name: 'Arsitektur Cloud & Keamanan Infrastruktur',
      description: 'Migrasi server, redundansi backup terenkripsi, dan pemeliharaan sistem 24/7.',
      unit: 'Paket/Bulan',
      unitPrice: 15000000,
    },
    {
      id: 'srv-2',
      name: 'Integrasi Sistem Pembayaran & Penagihan Korporasi',
      description: 'Otomatisasi faktur berulang, rekonsiliasi Virtual Account, QRIS, dan laporan kas.',
      unit: 'Implementasi',
      unitPrice: 28500000,
    },
    {
      id: 'srv-3',
      name: 'Pengadaan & Serah Terima Perangkat Keras Enterprise',
      description: 'Penyediaan server rack, switch jaringan, dan workstation dengan BAST resmi.',
      unit: 'Proyek',
      unitPrice: 45000000,
    },
  ],
  highlights: {
    activeServicesCount: 5,
    verifiedClientsCount: 3,
    issuedDocumentsCount: 4,
  },
};

function mergeCompanyWithDefaults(
  raw?: Partial<CompanyProfile> | Partial<PublicCompanyProfilePayload['company']>
): PublicCompanyProfilePayload['company'] {
  const def = DEFAULT_PROFILE.company;
  return {
    name: raw?.name || def.name,
    email: raw?.email || def.email,
    phone: raw?.phone || def.phone,
    address: raw?.address || def.address,
    logoDataUrl: raw?.logoDataUrl || '',
    tagline: raw?.tagline || def.tagline,
    heroTitle: raw?.heroTitle || def.heroTitle,
    heroSubtitle: raw?.heroSubtitle || def.heroSubtitle,
    heroCtaLabel: raw?.heroCtaLabel || def.heroCtaLabel,
    heroImageDataUrl: raw?.heroImageDataUrl || '',
    aboutDescription: raw?.aboutDescription || def.aboutDescription,
    aboutImageDataUrl: raw?.aboutImageDataUrl || '',
    vision: raw?.vision || def.vision,
    foundedYear: raw?.foundedYear || def.foundedYear,
    city: raw?.city || def.city,
    portfolioImageDataUrl: raw?.portfolioImageDataUrl || '',
    pillars:
      Array.isArray(raw?.pillars) && raw.pillars.length > 0 ? raw.pillars : def.pillars,
    caseStudies:
      Array.isArray(raw?.caseStudies) && raw.caseStudies.length > 0
        ? raw.caseStudies
        : def.caseStudies,
    showServicesSection: raw?.showServicesSection !== false,
    showPortfolioSection: raw?.showPortfolioSection !== false,
    showVerifySection: raw?.showVerifySection !== false,
    showContactSection: raw?.showContactSection !== false,
    footerNote: raw?.footerNote || def.footerNote,
  };
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onOpenVerify,
  previewCompany,
  onExitPreview,
}) => {
  const [profile, setProfile] = useState<PublicCompanyProfilePayload>(() => ({
    ...DEFAULT_PROFILE,
    company: previewCompany ? mergeCompanyWithDefaults(previewCompany) : DEFAULT_PROFILE.company,
  }));
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [opsImgFailed, setOpsImgFailed] = useState(false);
  const [deliveryImgFailed, setDeliveryImgFailed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Portal Login Modal state
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline Document Verification quick input
  const [verifyCodeInput, setVerifyCodeInput] = useState('');

  // Public Lead Capture / Contact form
  const [contactFullName, setContactFullName] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSubject, setContactSubject] = useState('Permintaan Penawaran & Konsultasi');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactResult, setContactResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (previewCompany) {
      setProfile((prev) => ({
        ...prev,
        company: mergeCompanyWithDefaults(previewCompany),
      }));
      setHeroImgFailed(false);
      setOpsImgFailed(false);
      setDeliveryImgFailed(false);
      return;
    }

    let active = true;
    fetch('/api/public/company-profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.ok || !data?.company) return;
        setProfile({
          company: mergeCompanyWithDefaults(data.company),
          services:
            Array.isArray(data.services) && data.services.length > 0
              ? data.services
              : DEFAULT_PROFILE.services,
          highlights: data.highlights || DEFAULT_PROFILE.highlights,
        });
      })
      .catch(() => {
        // Keep defaults when offline
      });
    return () => {
      active = false;
    };
  }, [previewCompany]);

  useEffect(() => {
    if (!loginModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLoginModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loginModalOpen]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewCompany) {
      setErrorMsg('Anda sedang berada di mode pratinjau Pengaturan.');
      return;
    }
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

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onOpenVerify) {
      onOpenVerify(verifyCodeInput.trim());
    }
  };

  const handleSelectServiceForInquiry = (serviceName: string) => {
    setContactSubject(`Permintaan Penawaran: ${serviceName}`);
    setContactMessage(
      `Halo tim ${profile.company.name}, kami tertarik berdiskusi mengenai layanan "${serviceName}" untuk kebutuhan perusahaan kami.`
    );
    setContactResult(null);
    const el = document.getElementById('kontak');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewCompany) {
      setContactResult({
        ok: true,
        message: 'Mode pratinjau aktif — formulir siap menerima pertanyaan calon klien di halaman publik.',
      });
      return;
    }
    setContactResult(null);

    if (contactFullName.trim().length < 2 || contactMessage.trim().length < 10) {
      setContactResult({
        ok: false,
        message: 'Nama lengkap dan rincian kebutuhan (min. 10 karakter) wajib diisi.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setContactResult({
        ok: false,
        message: 'Mohon masukkan alamat email kerja yang valid.',
      });
      return;
    }

    setContactSubmitting(true);
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: contactFullName.trim(),
          companyName: contactCompany.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setContactResult({
          ok: false,
          message: data.message || 'Gagal mengirim pesan konsultasi.',
        });
        return;
      }

      setContactResult({
        ok: true,
        message:
          data.message ||
          'Permintaan Anda berhasil dikirim. Tim kami akan menghubungi Anda melalui email atau telepon kerja.',
      });
      setContactFullName('');
      setContactCompany('');
      setContactEmail('');
      setContactPhone('');
      setContactMessage('');
    } catch {
      setContactResult({
        ok: false,
        message: 'Terjadi gangguan jaringan saat mengirim permintaan.',
      });
    } finally {
      setContactSubmitting(false);
    }
  };

  const { company, services, highlights } = profile;
  const heroSrc = company.heroImageDataUrl || heroCorporateImg;
  const opsSrc = company.aboutImageDataUrl || operationsTeamImg;
  const deliverySrc = company.portfolioImageDataUrl || datacenterDeliveryImg;

  const navLinks = [
    { href: '#tentang', label: 'Tentang', visible: true },
    { href: '#layanan', label: 'Layanan', visible: company.showServicesSection },
    { href: '#portofolio', label: 'Portofolio', visible: company.showPortfolioSection },
    { href: '#verifikasi', label: 'Verifikasi', visible: company.showVerifySection },
    { href: '#kontak', label: 'Kontak', visible: company.showContactSection },
  ].filter((item) => item.visible);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {onExitPreview && (
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 text-xs">
          <span>Mode Pratinjau Website Company Profile (berdasarkan perubahan di Pengaturan)</span>
          <button
            type="button"
            onClick={onExitPreview}
            className="rounded-md bg-white px-3 py-1.5 font-medium text-slate-900 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            Kembali ke Pengaturan
          </button>
        </div>
      )}

      {/* Top Navigation Bar — 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#beranda"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 truncate max-w-[220px] sm:max-w-none"
          >
            {company.name}
          </a>

          {/* Zone 2: 4-5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {navLinks.map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                {nav.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: 1 primary CTA + mobile menu toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
              aria-label="Menu navigasi"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (onExitPreview) {
                  onExitPreview();
                } else {
                  setLoginModalOpen(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{onExitPreview ? 'Tutup Pratinjau' : 'Masuk Portal'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <nav className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-2 text-sm font-medium text-slate-700">
            {navLinks.map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                onClick={() => setMobileNavOpen(false)}
                className="py-1.5 hover:text-slate-900"
              >
                {nav.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main>
        {/* 1. Hero Section */}
        <section id="beranda" className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              {/* Hero Left Column */}
              <div className="lg:col-span-6 flex flex-col justify-between gap-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{company.city || 'Jakarta Selatan'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Berdiri {company.foundedYear || '2019'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{company.tagline}</span>
                  </div>

                  <h1 className="mt-4 text-[clamp(2.125rem,3.6vw,3.25rem)] font-bold tracking-tight text-slate-900 leading-[1.12] text-balance">
                    {company.heroTitle}
                  </h1>

                  <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                    {company.heroSubtitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{company.heroCtaLabel || 'Masuk Portal Karyawan'}</span>
                  </button>
                  {company.showContactSection && (
                    <a
                      href="#kontak"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Jadwalkan Konsultasi</span>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                    </a>
                  )}
                </div>
              </div>

              {/* Hero Right Column — Full-Height 16:9 Architectural Photography */}
              <div className="lg:col-span-6">
                <div className="h-72 sm:h-96 lg:h-full min-h-[320px] rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden relative">
                  {!heroImgFailed ? (
                    <img
                      src={heroSrc}
                      alt={`Kantor Pusat ${company.name}`}
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col items-center justify-center p-8 text-center text-slate-200">
                      <Building2 className="w-10 h-10 text-blue-400 mb-3" />
                      <p className="text-sm font-semibold">{company.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{company.city}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Corporate Highlights Strip */}
            <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              <div className="p-5">
                <span className="text-xs text-slate-500 block">Tahun Pendirian</span>
                <span className="mt-1 block text-xl font-bold text-slate-900 tabular-nums">
                  {company.foundedYear || '2019'}
                </span>
              </div>
              <div className="p-5">
                <span className="text-xs text-slate-500 block">Layanan &amp; Solusi Aktif</span>
                <span className="mt-1 block text-xl font-bold text-slate-900 tabular-nums">
                  {highlights.activeServicesCount}+ Modul
                </span>
              </div>
              <div className="p-5">
                <span className="text-xs text-slate-500 block">Klien Korporasi Terdaftar</span>
                <span className="mt-1 block text-xl font-bold text-slate-900 tabular-nums">
                  {highlights.verifiedClientsCount}+ Perusahaan
                </span>
              </div>
              <div className="p-5">
                <span className="text-xs text-slate-500 block">Arsip SK &amp; BAST Terbit</span>
                <span className="mt-1 block text-xl font-bold text-slate-900 tabular-nums">
                  {highlights.issuedDocumentsCount}+ Dokumen
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Tentang Perusahaan & Katalog Layanan (Asymmetric Bento Grid) */}
        <section id="tentang" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-10">
          <div className="max-w-2xl">
            <span className="text-xs font-medium text-blue-700">Tentang &amp; Kapabilitas</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Tata Kelola Teknologi dan Operasional yang Terukur
            </h2>
          </div>

          <div id="layanan" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Asymmetric Left Bento Card */}
            <div
              className={`${
                company.showServicesSection ? 'lg:col-span-7' : 'lg:col-span-12'
              } rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col`}
            >
              <div className="h-64 sm:h-72 bg-slate-100 border-b border-slate-200 overflow-hidden">
                {!opsImgFailed ? (
                  <img
                    src={opsSrc}
                    alt="Tim Teknik dan Operasional Perusahaan"
                    referrerPolicy="no-referrer"
                    onError={() => setOpsImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-300 text-sm">
                    Tim Operasional &amp; Rekayasa {company.name}
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Profil Perusahaan &amp; Komitmen Layanan
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {company.aboutDescription}
                  </p>
                </div>

                <div className="pt-5 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-900 block">Visi Perusahaan</span>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{company.vision}</p>
                </div>
              </div>
            </div>

            {/* Asymmetric Right Bento Card: Live Service Catalog */}
            {company.showServicesSection && (
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Katalog Layanan &amp; Solusi
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Layanan aktif yang dikelola langsung oleh tim profesional kami.
                  </p>

                  <div className="mt-6 divide-y divide-slate-200">
                    {services.slice(0, 4).map((srv, idx) => (
                      <div key={srv.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-900">
                              0{idx + 1}. {srv.name}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {srv.description}
                            </p>
                          </div>
                          {company.showContactSection && (
                            <button
                              type="button"
                              onClick={() => handleSelectServiceForInquiry(srv.name)}
                              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 mt-0.5"
                            >
                              Minta Penawaran
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                          <span>{formatIdr(srv.unitPrice)}</span>
                          <span aria-hidden="true">/</span>
                          <span>{srv.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {company.showContactSection && (
                  <div className="mt-6 pt-5 border-t border-slate-200 flex items-center justify-between gap-4 text-xs text-slate-500">
                    <span>Konsultasi penyesuaian ruang lingkup tersedia</span>
                    <a
                      href="#kontak"
                      className="font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
                    >
                      Hubungi Tim
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Capability Pillars */}
            {company.pillars.map((pillar, idx) => (
              <div
                key={`${pillar.title}-${idx}`}
                className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {String(idx + 1).padStart(2, '0')}. {pillar.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Portofolio & Bukti Dampak */}
        {company.showPortfolioSection && (
          <section id="portofolio" className="bg-white border-y border-slate-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-5">
                  <div className="h-64 sm:h-80 lg:h-full rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden">
                    {!deliveryImgFailed ? (
                      <img
                        src={deliverySrc}
                        alt="Inspeksi Infrastruktur Perangkat Keras dan Serah Terima Aset"
                        referrerPolicy="no-referrer"
                        onError={() => setDeliveryImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-300 text-sm p-6 text-center">
                        Dokumentasi Implementasi Infrastruktur &amp; BAST
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                  <div>
                    <span className="text-xs font-medium text-blue-700">
                      Portofolio Implementasi
                    </span>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                      Rekam Jejak Eksekusi Proyek Korporasi
                    </h2>
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                      Setiap implementasi disertai dokumentasi teknis, uji kelayakan, dan arsip
                      serah terima yang dapat diaudit secara mandiri oleh klien maupun tim internal.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {company.caseStudies.map((cs, idx) => (
                      <div
                        key={`${cs.title}-${idx}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <span className="text-xs text-slate-500 block">{cs.sector}</span>
                          <h3 className="mt-1.5 text-base font-semibold text-slate-900">
                            {cs.title}
                          </h3>
                          <p className="mt-2 text-xs text-slate-600 leading-relaxed">{cs.detail}</p>
                        </div>
                        <div className="pt-3 border-t border-slate-200 text-xs font-semibold text-blue-700 tabular-nums">
                          {cs.metric}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. Verifikasi Dokumen Publik & Form Konsultasi */}
        {(company.showVerifySection || company.showContactSection) && (
          <section id="verifikasi" className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Public Document Barcode Verification & Office Contact */}
              <div
                className={`${
                  company.showContactSection ? 'lg:col-span-5' : 'lg:col-span-12'
                } space-y-6`}
              >
                {company.showVerifySection && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <QrCode className="w-5 h-5 text-blue-700 shrink-0" />
                      <h2 className="text-lg font-semibold text-slate-900">
                        Verifikasi Dokumen Resmi
                      </h2>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Periksa keaslian kontrak kerja (PKWT), Surat Keputusan Pengangkatan (SK), atau
                      Bukti Serah Terima Barang (BAST) yang diterbitkan {company.name}.
                    </p>

                    <form onSubmit={handleVerifySubmit} className="space-y-3">
                      <input
                        type="text"
                        value={verifyCodeInput}
                        onChange={(e) => setVerifyCodeInput(e.target.value)}
                        placeholder="Contoh: FF-BAST-2026-8E4A21C9 atau FF-SK-..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Periksa Keaslian Dokumen</span>
                      </button>
                    </form>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">
                    Kantor Pusat &amp; Kontak
                  </h3>
                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                      <span className="leading-relaxed">{company.address}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="tabular-nums">{company.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{company.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Lead Capture Form (#kontak) */}
              {company.showContactSection && (
                <div
                  id="kontak"
                  className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
                >
                  <h2 className="text-xl font-bold text-slate-900">
                    Hubungi &amp; Konsultasi Proyek
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Kirimkan kebutuhan perusahaan Anda untuk mendapatkan estimasi ruang lingkup dan
                    penawaran resmi.
                  </p>

                  {contactResult && (
                    <div
                      className={`mt-5 rounded-lg border p-3.5 text-xs flex items-start gap-2.5 ${
                        contactResult.ok
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-red-200 bg-red-50 text-red-900'
                      }`}
                    >
                      {contactResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                      )}
                      <span className="leading-relaxed">{contactResult.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleContactSubmit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Nama Lengkap *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactFullName}
                          onChange={(e) => setContactFullName(e.target.value)}
                          placeholder="Contoh: Budi Santoso"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Nama Perusahaan
                        </label>
                        <input
                          type="text"
                          value={contactCompany}
                          onChange={(e) => setContactCompany(e.target.value)}
                          placeholder="PT Mitra Mandiri"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Email Kerja *
                        </label>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="nama@perusahaan.co.id"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Nomor Telepon / WhatsApp
                        </label>
                        <input
                          type="text"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+62 812 0000 0000"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Topik / Subjek
                      </label>
                      <input
                        type="text"
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Rincian Kebutuhan *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Jelaskan layanan, jumlah unit/pengguna, atau jadwal implementasi yang diharapkan..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={contactSubmitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        <Send className="w-4 h-4" />
                        <span>
                          {contactSubmitting
                            ? 'Mengirim Permintaan...'
                            : 'Kirim Permintaan Penawaran'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-md">
            <div className="flex items-center gap-2.5 text-white font-semibold">
              {company.logoDataUrl ? (
                <img
                  src={company.logoDataUrl}
                  alt={company.name}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded bg-white object-contain p-0.5 shrink-0"
                />
              ) : (
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span>{company.name}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {company.address} · {company.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            {navLinks.map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                className="hover:text-white transition-colors whitespace-nowrap"
              >
                {nav.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="text-white font-medium hover:underline whitespace-nowrap"
            >
              Masuk Portal
            </button>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              &copy; {new Date().getFullYear()} {company.name}. Hak cipta dilindungi undang-undang.
            </span>
            <span>{company.footerNote}</span>
          </div>
        </div>
      </footer>

      {/* Portal Login Modal */}
      {loginModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-login-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 id="portal-login-title" className="text-lg font-bold text-slate-900">
                  Masuk ke Portal Perusahaan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{company.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup form masuk"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {errorMsg && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
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
                      autoFocus
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

              {onOpenVerify && (
                <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Perlu cek surat resmi?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginModalOpen(false);
                      onOpenVerify('');
                    }}
                    className="inline-flex items-center gap-1.5 font-medium text-blue-700 hover:underline whitespace-nowrap"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Verifikasi Barcode</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
