import type { UserRole } from '../types';

export type AppTab =
  | 'overview'
  | 'invoices'
  | 'schedules'
  | 'products'
  | 'clients'
  | 'accounting'
  | 'employees'
  | 'contracts'
  | 'payroll'
  | 'leaves'
  | 'emails'
  | 'users'
  | 'settings';

export const ROLE_META: Record<
  UserRole,
  {
    label: string;
    shortDesc: string;
    textClass: string;
    capabilities: string[];
  }
> = {
  admin: {
    label: 'Administrator',
    shortDesc: 'Akses penuh seluruh modul, akuntansi, API, dan manajemen pengguna',
    textClass: 'text-blue-700',
    capabilities: [
      'Kelola Faktur, Klien, Produk & Jadwal Bulanan',
      'Akuntansi Kantor, Buku Kas & Laporan Laba Rugi',
      'Kelola Data Karyawan, Cuti & Penggajian (Payroll)',
      'Konfigurasi Midtrans API, SMTP, Profil & Hak Akses User',
    ],
  },
  manager: {
    label: 'Manager',
    shortDesc: 'Persetujuan keuangan, akuntansi kantor, penagihan, dan otorisasi gaji',
    textClass: 'text-emerald-700',
    capabilities: [
      'Kelola & Kirim Faktur, Link Midtrans & Jadwal Bulanan',
      'Akuntansi Kantor, Buku Kas, Rekonsiliasi & Laba Rugi',
      'Lihat Data Karyawan, Cuti Tim, Setujui & Bayar Payroll',
      'Pantau Ikhtisar Keuangan & Log Pengiriman Email',
    ],
  },
  hrd: {
    label: 'HRD',
    shortDesc: 'Manajemen data karyawan, persetujuan cuti, dan slip gaji',
    textClass: 'text-amber-700',
    capabilities: [
      'Akses penuh Direktori Karyawan (Tambah, Ubah, Hapus)',
      'Setujui / Tolak Pengajuan Cuti & Kelola Kuota Tahunan',
      'Generate Payroll Bulanan, PPh 21 & Potongan BPJS',
      'Unduh Slip Gaji PDF & Kirim Slip ke Email Karyawan',
    ],
  },
  user: {
    label: 'User / Staf',
    shortDesc: 'Operasional penagihan standar & pengajuan cuti pribadi',
    textClass: 'text-slate-700',
    capabilities: [
      'Lihat Ikhtisar, Faktur, Klien & Katalog Produk',
      'Buat Draf Faktur & Unduh Salinan PDF Faktur',
      'Ajukan Cuti Karyawan & Pantau Status Persetujuan HRD',
      'Tidak memiliki akses Akuntansi, Payroll & Pengaturan API',
    ],
  },
};

const TAB_ROLES: Record<AppTab, UserRole[]> = {
  overview: ['admin', 'manager', 'hrd', 'user'],
  invoices: ['admin', 'manager', 'user'],
  schedules: ['admin', 'manager'],
  products: ['admin', 'manager', 'user'],
  clients: ['admin', 'manager', 'user'],
  accounting: ['admin', 'manager'],
  employees: ['admin', 'manager', 'hrd'],
  contracts: ['admin', 'manager', 'hrd'],
  payroll: ['admin', 'manager', 'hrd'],
  leaves: ['admin', 'manager', 'hrd', 'user'],
  emails: ['admin', 'manager', 'hrd'],
  users: ['admin'],
  settings: ['admin'],
};

export function canAccessTab(role: UserRole, tab: AppTab): boolean {
  return TAB_ROLES[tab]?.includes(role) ?? false;
}

export function getDefaultTabForRole(role: UserRole): AppTab {
  if (role === 'hrd') return 'employees';
  return 'overview';
}

export const PERMISSIONS = {
  canCreateEditInvoice: (role: UserRole) => ['admin', 'manager', 'user'].includes(role),
  canDeleteInvoice: (role: UserRole) => ['admin', 'manager'].includes(role),
  canSendInvoiceEmail: (role: UserRole) => ['admin', 'manager'].includes(role),
  canOperateMidtrans: (role: UserRole) => ['admin', 'manager'].includes(role),
  canManageSchedules: (role: UserRole) => ['admin', 'manager'].includes(role),
  canManageProductsClients: (role: UserRole) => ['admin', 'manager'].includes(role),
  canManageAccounting: (role: UserRole) => ['admin', 'manager'].includes(role),
  canManageEmployees: (role: UserRole) => ['admin', 'hrd'].includes(role),
  canManageContracts: (role: UserRole) => ['admin', 'hrd'].includes(role),
  canManagePayroll: (role: UserRole) => ['admin', 'manager', 'hrd'].includes(role),
  canDeletePayroll: (role: UserRole) => ['admin', 'hrd'].includes(role),
  canSubmitLeave: (role: UserRole) => ['admin', 'manager', 'hrd', 'user'].includes(role),
  canApproveRejectLeave: (role: UserRole) => ['admin', 'hrd'].includes(role),
  canDeleteLeave: (role: UserRole) => ['admin', 'hrd'].includes(role),
  canManageSettings: (role: UserRole) => role === 'admin',
  canManageUsers: (role: UserRole) => role === 'admin',
};
