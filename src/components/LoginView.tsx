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
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '../lib/whatsapp';
import heroCorporateImg from '../assets/images/hero_corporate_hq_1795443793076.jpg';
import operationsTeamImg from '../assets/images/bento_operations_team_1795443793200.jpg';
import datacenterDeliveryImg from '../assets/images/portfolio_datacenter_delivery_1795443793245.jpg';

const WhatsAppGlyph: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.08c-.24.68-1.42 1.3-1.97 1.38-.51.07-1.15.1-1.85-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.91-4.29-5.06-4.49-.15-.2-1.21-1.61-1.21-3.07 0-1.46.76-2.18 1.03-2.48.27-.3.59-.38.79-.38.2 0 .39.01.56.01.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.18-.31.39-.45.52-.15.15-.3.31-.13.61.18.3.79 1.3 1.7 2.11 1.17 1.04 2.15 1.37 2.45 1.52.3.15.47.12.65-.07.18-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.02.97.3.15.49.22.56.34.07.12.07.7-.17 1.38z" />
  </svg>
);

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
    whatsappEnabled: true,
    whatsappNumber: '+62 811 8842 2019',
    whatsappLabel: 'Konsultasi WhatsApp',
    whatsappGreeting:
      'Halo! Ada yang bisa kami bantu terkait layanan korporasi, penawaran proyek, atau verifikasi dokumen?',
    whatsappDefaultMessage:
      'Halo tim, saya ingin berkonsultasi mengenai layanan dan penawaran perusahaan.',
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
    whatsappEnabled: raw?.whatsappEnabled !== false,
    whatsappNumber: raw?.whatsappNumber ?? def.whatsappNumber,
    whatsappLabel: raw?.whatsappLabel || def.whatsappLabel,
    whatsappGreeting: raw?.whatsappGreeting || def.whatsappGreeting,
    whatsappDefaultMessage: raw?.whatsappDefaultMessage || def.whatsappDefaultMessage,
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

  // WhatsApp Floating Chat Balloon state
  const [waOpen, setWaOpen] = useState(false);
  const [waDraftMessage, setWaDraftMessage] = useState(
    () =>
      previewCompany?.whatsappDefaultMessage ||
      DEFAULT_PROFILE.company.whatsappDefaultMessage
  );

  useEffect(() => {
    if (previewCompany) {
      const merged = mergeCompanyWithDefaults(previewCompany);
      setProfile((prev) => ({
        ...prev,
        company: merged,
      }));
      setWaDraftMessage(merged.whatsappDefaultMessage);
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
        const merged = mergeCompanyWithDefaults(data.company);
        setProfile({
          company: merged,
          services:
            Array.isArray(data.services) && data.services.length > 0
              ? data.services
              : DEFAULT_PROFILE.services,
          highlights: data.highlights || DEFAULT_PROFILE.highlights,
        });
        setWaDraftMessage(merged.whatsappDefaultMessage);
      })
      .catch(() => {
        // Keep defaults when offline
      });
    return () => {
      active = false;
    };
  }, [previewCompany]);

  useEffect(() => {
    if (!loginModalOpen && !waOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLoginModalOpen(false);
        setWaOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loginModalOpen, waOpen]);

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
        message:
          'Mode pratinjau aktif — formulir siap menerima pertanyaan calon klien di halaman publik.',
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
  const waDigits = normalizeWhatsAppNumber(company.whatsappNumber || company.phone);
  const showWhatsAppBalloon = company.whatsappEnabled && waDigits.length >= 8;
  const waDirectUrl = buildWhatsAppUrl(
    company.whatsappNumber || company.phone,
    waDraftMessage || company.whatsappDefaultMessage
  );

  const navLinks = [
    { href: '#tentang', label: 'Tentang', visible: true },
    { href: '#layanan', label: 'Layanan', visible: company.showServicesSection },
    { href: '#portofolio', label: 'Portofolio', visible: company.showPortfolioSection },
    { href: '#verifikasi', label: 'Verifikasi', visible: company.showVerifySection },
    { href: '#kontak', label: 'Kontak', visible: company.showContactSection },
  ].filter((item) => item.visible);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {onExitPreview && (
        <div className="bg-[#D4AF37] text-zinc-950 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 text-xs font-medium">
          <span>Mode Pratinjau Website Company Profile (berdasarkan perubahan di Pengaturan)</span>
          <button
            type="button"
            onClick={onExitPreview}
            className="rounded-md bg-zinc-950 px-3 py-1.5 font-medium text-[#E5C158] hover:bg-zinc-900 whitespace-nowrap shrink-0"
          >
            Kembali ke Pengaturan
          </button>
        </div>
      )}

      {/* Top Navigation Bar — 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#beranda"
            className="text-base sm:text-lg font-bold tracking-tight text-zinc-50 hover:text-[#E5C158] transition-colors whitespace-nowrap shrink-0 truncate max-w-[220px] sm:max-w-none"
          >
            {company.name}
          </a>

          {/* Zone 2: 4-5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            {navLinks.map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                className="hover:text-[#E5C158] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
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
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-zinc-800 p-2 text-zinc-200 hover:bg-zinc-900"
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
              className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{onExitPreview ? 'Tutup Pratinjau' : 'Masuk Portal'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <nav className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 flex flex-col gap-2 text-sm font-medium text-zinc-300">
            {navLinks.map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                onClick={() => setMobileNavOpen(false)}
                className="py-1.5 hover:text-[#E5C158]"
              >
                {nav.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main>
        {/* 1. Hero Section */}
        <section id="beranda" className="bg-zinc-950 border-b border-zinc-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              {/* Hero Left Column */}
              <div className="lg:col-span-6 flex flex-col justify-between gap-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span className="text-[#E5C158] font-medium">
                      {company.city || 'Jakarta Selatan'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Berdiri {company.foundedYear || '2019'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{company.tagline}</span>
                  </div>

                  <h1 className="mt-4 text-[clamp(2.125rem,3.6vw,3.25rem)] font-bold tracking-tight text-zinc-50 leading-[1.12] text-balance">
                    {company.heroTitle}
                  </h1>

                  <p className="mt-5 text-base text-zinc-300 leading-relaxed max-w-xl tracking-[0.01em]">
                    {company.heroSubtitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{company.heroCtaLabel || 'Masuk Portal Karyawan'}</span>
                  </button>
                  {company.showContactSection && (
                    <a
                      href="#kontak"
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-100 hover:border-[#D4AF37]/60 hover:text-[#E5C158] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Jadwalkan Konsultasi</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Hero Right Column — Full-Height 16:9 Architectural Photography */}
              <div className="lg:col-span-6">
                <div className="h-72 sm:h-96 lg:h-full min-h-[320px] rounded-2xl border border-[#D4AF37]/30 bg-zinc-900 overflow-hidden relative">
                  {!heroImgFailed ? (
                    <img
                      src={heroSrc}
                      alt={`Kantor Pusat ${company.name}`}
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#1f1909] flex flex-col items-center justify-center p-8 text-center text-zinc-200">
                      <Building2 className="w-10 h-10 text-[#E5C158] mb-3" />
                      <p className="text-sm font-semibold">{company.name}</p>
                      <p className="text-xs text-zinc-400 mt-1">{company.city}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Corporate Highlights Strip */}
            <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/70 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
              <div className="p-5">
                <span className="text-xs text-zinc-400 block">Tahun Pendirian</span>
                <span className="mt-1 block text-xl font-bold text-[#E5C158] tabular-nums">
                  {company.foundedYear || '2019'}
                </span>
              </div>
              <div className="p-5">
                <span className="text-xs text-zinc-400 block">Layanan &amp; Solusi Aktif</span>
                <span className="mt-1 block text-xl font-bold text-[#E5C158] tabular-nums">
                  {highlights.activeServicesCount}+ Modul
                </span>
              </div>
              <div className="p-5">
                <span className="text-xs text-zinc-400 block">Klien Korporasi Terdaftar</span>
                <span className="mt-1 block text-xl font-bold text-[#E5C158] tabular-nums">
                  {highlights.verifiedClientsCount}+ Perusahaan
                </span>
              </div>
              <div className="p-5">
                <span className="text-xs text-zinc-400 block">Arsip SK &amp; BAST Terbit</span>
                <span className="mt-1 block text-xl font-bold text-[#E5C158] tabular-nums">
                  {highlights.issuedDocumentsCount}+ Dokumen
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Tentang Perusahaan & Katalog Layanan (Asymmetric Bento Grid) */}
        <section id="tentang" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-10">
          <div className="max-w-2xl">
            <span className="text-xs font-medium text-[#E5C158]">Tentang &amp; Kapabilitas</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 text-balance">
              Tata Kelola Teknologi dan Operasional yang Terukur
            </h2>
          </div>

          <div id="layanan" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Asymmetric Left Bento Card */}
            <div
              className={`${
                company.showServicesSection ? 'lg:col-span-7' : 'lg:col-span-12'
              } rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden flex flex-col`}
            >
              <div className="h-64 sm:h-72 bg-zinc-900 border-b border-zinc-800 overflow-hidden">
                {!opsImgFailed ? (
                  <img
                    src={opsSrc}
                    alt="Tim Teknik dan Operasional Perusahaan"
                    referrerPolicy="no-referrer"
                    onError={() => setOpsImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-300 text-sm">
                    Tim Operasional &amp; Rekayasa {company.name}
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-50">
                    Profil Perusahaan &amp; Komitmen Layanan
                  </h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {company.aboutDescription}
                  </p>
                </div>

                <div className="pt-5 border-t border-zinc-800">
                  <span className="text-xs font-semibold text-[#E5C158] block">
                    Visi Perusahaan
                  </span>
                  <p className="mt-1.5 text-sm text-zinc-300 leading-relaxed">{company.vision}</p>
                </div>
              </div>
            </div>

            {/* Asymmetric Right Bento Card: Live Service Catalog */}
            {company.showServicesSection && (
              <div className="lg:col-span-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-50">
                    Katalog Layanan &amp; Solusi
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Layanan aktif yang dikelola langsung oleh tim profesional kami.
                  </p>

                  <div className="mt-6 divide-y divide-zinc-800">
                    {services.slice(0, 4).map((srv, idx) => (
                      <div key={srv.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-zinc-100">
                              0{idx + 1}. {srv.name}
                            </h4>
                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                              {srv.description}
                            </p>
                          </div>
                          {company.showContactSection && (
                            <button
                              type="button"
                              onClick={() => handleSelectServiceForInquiry(srv.name)}
                              className="text-xs font-medium text-[#E5C158] hover:underline whitespace-nowrap shrink-0 mt-0.5"
                            >
                              Minta Penawaran
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-[#D4AF37] font-mono tabular-nums">
                          <span>{formatIdr(srv.unitPrice)}</span>
                          <span aria-hidden="true">/</span>
                          <span>{srv.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {company.showContactSection && (
                  <div className="mt-6 pt-5 border-t border-zinc-800 flex items-center justify-between gap-4 text-xs text-zinc-400">
                    <span>Konsultasi penyesuaian ruang lingkup tersedia</span>
                    <a
                      href="#kontak"
                      className="font-medium text-[#E5C158] hover:underline whitespace-nowrap shrink-0"
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
                className="lg:col-span-6 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7"
              >
                <h3 className="text-base font-semibold text-zinc-50">
                  <span className="text-[#E5C158] mr-1.5 font-mono">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Portofolio & Bukti Dampak */}
        {company.showPortfolioSection && (
          <section id="portofolio" className="bg-[#0D0D10] border-y border-zinc-800">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-5">
                  <div className="h-64 sm:h-80 lg:h-full rounded-2xl border border-[#D4AF37]/30 bg-zinc-900 overflow-hidden">
                    {!deliveryImgFailed ? (
                      <img
                        src={deliverySrc}
                        alt="Inspeksi Infrastruktur Perangkat Keras dan Serah Terima Aset"
                        referrerPolicy="no-referrer"
                        onError={() => setDeliveryImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-300 text-sm p-6 text-center">
                        Dokumentasi Implementasi Infrastruktur &amp; BAST
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                  <div>
                    <span className="text-xs font-medium text-[#E5C158]">
                      Portofolio Implementasi
                    </span>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 text-balance">
                      Rekam Jejak Eksekusi Proyek Korporasi
                    </h2>
                    <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
                      Setiap implementasi disertai dokumentasi teknis, uji kelayakan, dan arsip
                      serah terima yang dapat diaudit secara mandiri oleh klien maupun tim internal.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {company.caseStudies.map((cs, idx) => (
                      <div
                        key={`${cs.title}-${idx}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <span className="text-xs text-zinc-400 block">{cs.sector}</span>
                          <h3 className="mt-1.5 text-base font-semibold text-zinc-50">
                            {cs.title}
                          </h3>
                          <p className="mt-2 text-xs text-zinc-300 leading-relaxed">{cs.detail}</p>
                        </div>
                        <div className="pt-3 border-t border-zinc-800 text-xs font-semibold text-[#E5C158] tabular-nums">
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
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <QrCode className="w-5 h-5 text-[#E5C158] shrink-0" />
                      <h2 className="text-lg font-semibold text-zinc-50">
                        Verifikasi Dokumen Resmi
                      </h2>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Periksa keaslian kontrak kerja (PKWT), Surat Keputusan Pengangkatan (SK), atau
                      Bukti Serah Terima Barang (BAST) yang diterbitkan {company.name}.
                    </p>

                    <form onSubmit={handleVerifySubmit} className="space-y-3">
                      <input
                        type="text"
                        value={verifyCodeInput}
                        onChange={(e) => setVerifyCodeInput(e.target.value)}
                        placeholder="Contoh: FF-BAST-2026-8E4A21C9 atau FF-SK-..."
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#D4AF37]/60 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-[#E5C158] hover:bg-[#D4AF37] hover:text-zinc-950 transition-colors whitespace-nowrap"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Periksa Keaslian Dokumen</span>
                      </button>
                    </form>
                  </div>
                )}

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7 space-y-4">
                  <h3 className="text-base font-semibold text-zinc-50">
                    Kantor Pusat &amp; Kontak
                  </h3>
                  <div className="space-y-3 text-sm text-zinc-300">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#E5C158] shrink-0 mt-1" />
                      <span className="leading-relaxed">{company.address}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-[#E5C158] shrink-0" />
                      <span className="tabular-nums">{company.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-[#E5C158] shrink-0" />
                      <span>{company.email}</span>
                    </div>
                    {showWhatsAppBalloon && (
                      <div className="flex items-center gap-3 pt-1">
                        <WhatsAppGlyph className="w-4 h-4 text-[#25D366] shrink-0" />
                        <a
                          href={buildWhatsAppUrl(
                            company.whatsappNumber || company.phone,
                            company.whatsappDefaultMessage
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#E5C158] hover:underline font-medium tabular-nums"
                        >
                          WhatsApp: {company.whatsappNumber || company.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Lead Capture Form (#kontak) */}
              {company.showContactSection && (
                <div
                  id="kontak"
                  className="lg:col-span-7 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8"
                >
                  <h2 className="text-xl font-bold text-zinc-50">
                    Hubungi &amp; Konsultasi Proyek
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Kirimkan kebutuhan perusahaan Anda untuk mendapatkan estimasi ruang lingkup dan
                    penawaran resmi.
                  </p>

                  {contactResult && (
                    <div
                      className={`mt-5 rounded-lg border p-3.5 text-xs flex items-start gap-2.5 ${
                        contactResult.ok
                          ? 'border-emerald-700/60 bg-emerald-950/60 text-emerald-200'
                          : 'border-red-700/60 bg-red-950/60 text-red-200'
                      }`}
                    >
                      {contactResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <span className="leading-relaxed">{contactResult.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleContactSubmit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          Nama Lengkap *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactFullName}
                          onChange={(e) => setContactFullName(e.target.value)}
                          placeholder="Contoh: Budi Santoso"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          Nama Perusahaan
                        </label>
                        <input
                          type="text"
                          value={contactCompany}
                          onChange={(e) => setContactCompany(e.target.value)}
                          placeholder="PT Mitra Mandiri"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          Email Kerja *
                        </label>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="nama@perusahaan.co.id"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          Nomor Telepon / WhatsApp
                        </label>
                        <input
                          type="text"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+62 812 0000 0000"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Topik / Subjek
                      </label>
                      <input
                        type="text"
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Rincian Kebutuhan *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Jelaskan layanan, jumlah unit/pengguna, atau jadwal implementasi yang diharapkan..."
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={contactSubmitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors whitespace-nowrap"
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
      <footer className="bg-[#050507] text-zinc-300 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-md">
            <div className="flex items-center gap-2.5 text-zinc-50 font-semibold">
              {company.logoDataUrl ? (
                <img
                  src={company.logoDataUrl}
                  alt={company.name}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded bg-zinc-900 border border-[#D4AF37]/40 object-contain p-0.5 shrink-0"
                />
              ) : (
                <ShieldCheck className="w-4 h-4 text-[#E5C158] shrink-0" />
              )}
              <span>{company.name}</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {company.address} · {company.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-400">
            {navLinks.map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                className="hover:text-[#E5C158] transition-colors whitespace-nowrap"
              >
                {nav.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="text-[#E5C158] font-semibold hover:underline whitespace-nowrap"
            >
              Masuk Portal
            </button>
          </div>
        </div>
        <div className="border-t border-zinc-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2">
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
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-login-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/40 bg-zinc-900 shadow-2xl overflow-hidden text-zinc-100">
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between gap-4">
              <div>
                <h2 id="portal-login-title" className="text-lg font-bold text-zinc-50">
                  Masuk ke Portal Perusahaan
                </h2>
                <p className="text-xs text-[#E5C158] mt-0.5">{company.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Tutup form masuk"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {errorMsg && (
                <div className="mb-4 rounded-lg border border-red-700/60 bg-red-950/60 p-3 text-xs text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Username atau Email Perusahaan
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="nama.pengguna@perusahaan.co.id"
                      autoComplete="username"
                      autoFocus
                      required
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#E5C158]"
                      aria-label="Tampilkan kata sandi"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{submitting ? 'Memverifikasi Sesi...' : 'Masuk ke Dashboard'}</span>
                </button>
              </form>

              {onOpenVerify && (
                <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>Perlu cek surat resmi?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginModalOpen(false);
                      onOpenVerify('');
                    }}
                    className="inline-flex items-center gap-1.5 font-medium text-[#E5C158] hover:underline whitespace-nowrap"
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
      {/* Floating WhatsApp Chat Balloon */}
      {showWhatsAppBalloon && (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
          {waOpen && (
            <div
              role="dialog"
              aria-label="Chat WhatsApp Perusahaan"
              className="w-[310px] sm:w-[345px] rounded-2xl border border-[#D4AF37]/40 bg-zinc-900 text-zinc-100 shadow-2xl overflow-hidden"
            >
              <div className="px-4 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#25D366] text-zinc-950 flex items-center justify-center shrink-0">
                    <WhatsAppGlyph className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-50 truncate">
                      {company.whatsappLabel || 'Konsultasi WhatsApp'}
                    </div>
                    <div className="text-[11px] text-[#E5C158] truncate">
                      {company.name} · Respon Cepat
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWaOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 shrink-0"
                  aria-label="Tutup jendela chat WhatsApp"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 bg-[#0D0D10]">
                <div className="rounded-xl rounded-tl-xs border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-200 leading-relaxed">
                  {company.whatsappGreeting}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Minta Penawaran Layanan',
                    'Jadwalkan Konsultasi',
                    'Cek Dokumen BAST / SK',
                  ].map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() =>
                        setWaDraftMessage(
                          `Halo tim ${company.name}, saya ingin ${topic.toLowerCase()}.`
                        )
                      }
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-[#D4AF37]/60 hover:text-[#E5C158] transition-colors whitespace-nowrap"
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="wa-draft-input" className="sr-only">
                    Pesan WhatsApp
                  </label>
                  <textarea
                    id="wa-draft-input"
                    rows={3}
                    value={waDraftMessage}
                    onChange={(e) => setWaDraftMessage(e.target.value)}
                    placeholder="Tulis pertanyaan Anda di sini..."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <a
                  href={waDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-[#2be06f] transition-colors whitespace-nowrap"
                >
                  <WhatsAppGlyph className="w-4 h-4" />
                  <span>Mulai Chat di WhatsApp</span>
                </a>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setWaOpen((prev) => !prev)}
            aria-expanded={waOpen}
            aria-label={company.whatsappLabel || 'Buka Chat WhatsApp'}
            className="inline-flex items-center gap-2.5 rounded-full border border-[#D4AF37]/60 bg-zinc-950 px-4 py-3 text-xs font-semibold text-zinc-50 shadow-2xl hover:border-[#E5C158] hover:bg-zinc-900 transition-transform duration-150 active:scale-95"
          >
            <span className="w-7 h-7 rounded-full bg-[#25D366] text-zinc-950 flex items-center justify-center shrink-0">
              {waOpen ? <X className="w-4 h-4" /> : <WhatsAppGlyph className="w-4 h-4" />}
            </span>
            <span className="hidden sm:inline whitespace-nowrap pr-1 text-[#E5C158]">
              {company.whatsappLabel || 'Chat WhatsApp'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
