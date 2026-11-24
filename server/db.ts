import crypto from 'crypto';
import { createRequire } from 'module';
import {
  db,
  getDb,
  dbPath,
  dataDir,
  withTransaction,
  verifyDatabaseConnection,
  closeDatabase,
} from '../src/lib/db.ts';

export {
  db,
  getDb,
  dbPath,
  dataDir,
  withTransaction,
  verifyDatabaseConnection,
  closeDatabase,
};

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    npwp TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_company TEXT NOT NULL,
    client_email TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL,
    items_json TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 11,
    tax_amount INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    midtrans_order_id TEXT,
    midtrans_snap_token TEXT,
    midtrans_payment_url TEXT,
    midtrans_payment_type TEXT,
    midtrans_transaction_status TEXT,
    paid_at TEXT,
    email_sent_at TEXT,
    recurring_schedule_id TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recurring_schedules (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_company TEXT NOT NULL,
    client_email TEXT NOT NULL,
    title TEXT NOT NULL,
    day_of_month INTEGER NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 11,
    items_json TEXT NOT NULL,
    auto_send_email INTEGER NOT NULL DEFAULT 1,
    auto_create_midtrans INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    last_run_month TEXT,
    next_run_date TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    delivery_mode TEXT NOT NULL,
    message_id TEXT,
    error_message TEXT,
    html_preview TEXT NOT NULL,
    sent_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    channel TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    keys_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_operations (
    operation_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    checksum TEXT NOT NULL,
    processed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'Unit',
    unit_price INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    nip TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    employment_type TEXT NOT NULL DEFAULT 'tetap',
    join_date TEXT NOT NULL,
    base_salary INTEGER NOT NULL,
    fixed_allowance INTEGER NOT NULL DEFAULT 0,
    bank_name TEXT NOT NULL DEFAULT '',
    bank_account_number TEXT NOT NULL DEFAULT '',
    bank_account_name TEXT NOT NULL DEFAULT '',
    npwp TEXT NOT NULL DEFAULT '',
    bpjs_number TEXT NOT NULL DEFAULT '',
    ptkp_status TEXT NOT NULL DEFAULT 'TK/0',
    bpjs_enrolled INTEGER NOT NULL DEFAULT 1,
    annual_leave_quota INTEGER NOT NULL DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payroll_records (
    id TEXT PRIMARY KEY,
    slip_number TEXT NOT NULL UNIQUE,
    period_month TEXT NOT NULL,
    pay_date TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    bank_name TEXT NOT NULL DEFAULT '',
    bank_account_number TEXT NOT NULL DEFAULT '',
    bank_account_name TEXT NOT NULL DEFAULT '',
    base_salary INTEGER NOT NULL,
    allowances INTEGER NOT NULL DEFAULT 0,
    overtime_pay INTEGER NOT NULL DEFAULT 0,
    bonus INTEGER NOT NULL DEFAULT 0,
    pph21_deduction INTEGER NOT NULL DEFAULT 0,
    bpjs_deduction INTEGER NOT NULL DEFAULT 0,
    other_deductions INTEGER NOT NULL DEFAULT 0,
    gross_pay INTEGER NOT NULL,
    total_deductions INTEGER NOT NULL,
    net_pay INTEGER NOT NULL,
    ptkp_status TEXT NOT NULL DEFAULT 'TK/0',
    ter_category TEXT NOT NULL DEFAULT 'A',
    pph21_rate REAL NOT NULL DEFAULT 0,
    pph21_taxable_gross INTEGER NOT NULL DEFAULT 0,
    bpjs_kes_employee INTEGER NOT NULL DEFAULT 0,
    bpjs_jht_employee INTEGER NOT NULL DEFAULT 0,
    bpjs_jp_employee INTEGER NOT NULL DEFAULT 0,
    bpjs_employer_total INTEGER NOT NULL DEFAULT 0,
    tax_calculation_method TEXT NOT NULL DEFAULT 'ter_bulanan',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT NOT NULL DEFAULT '',
    paid_at TEXT,
    email_sent_at TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    department TEXT NOT NULL DEFAULT 'Umum',
    active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    request_number TEXT NOT NULL UNIQUE,
    employee_id TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'tahunan',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 1,
    reason TEXT NOT NULL DEFAULT '',
    delegate_name TEXT NOT NULL DEFAULT '',
    contact_during_leave TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    hrd_notes TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT,
    reviewed_at TEXT,
    submitted_by_user_id TEXT NOT NULL DEFAULT '',
    submitted_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounting_entries (
    id TEXT PRIMARY KEY,
    entry_number TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    account_name TEXT NOT NULL,
    description TEXT NOT NULL,
    counterparty TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT 'Transfer Bank',
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'recorded',
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT 'Sistem',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employee_contracts (
    id TEXT PRIMARY KEY,
    contract_number TEXT NOT NULL UNIQUE,
    contract_type TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_email TEXT NOT NULL DEFAULT '',
    employee_nik TEXT NOT NULL DEFAULT '',
    employee_address TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    work_location TEXT NOT NULL DEFAULT 'Kantor Pusat Jakarta',
    start_date TEXT NOT NULL,
    end_date TEXT,
    duration_months INTEGER,
    probation_months INTEGER NOT NULL DEFAULT 0,
    base_salary INTEGER NOT NULL DEFAULT 0,
    fixed_allowance INTEGER NOT NULL DEFAULT 0,
    working_hours TEXT NOT NULL DEFAULT 'Senin – Jumat, 09.00 – 17.00 WIB',
    signer_name TEXT NOT NULL DEFAULT '',
    signer_title TEXT NOT NULL DEFAULT 'Direktur Utama',
    signed_date TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Jakarta',
    custom_clauses TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    verification_code TEXT NOT NULL DEFAULT '',
    verification_hash TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT 'Sistem',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goods_handovers (
    id TEXT PRIMARY KEY,
    handover_number TEXT NOT NULL UNIQUE,
    handover_type TEXT NOT NULL DEFAULT 'client_delivery',
    status TEXT NOT NULL DEFAULT 'handed_over',
    handover_date TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Jakarta',
    location TEXT NOT NULL DEFAULT '',
    reference_type TEXT NOT NULL DEFAULT 'manual',
    reference_id TEXT,
    reference_number TEXT NOT NULL DEFAULT '',
    sender_name TEXT NOT NULL DEFAULT '',
    sender_title TEXT NOT NULL DEFAULT '',
    recipient_name TEXT NOT NULL DEFAULT '',
    recipient_company TEXT NOT NULL DEFAULT '',
    recipient_identity TEXT NOT NULL DEFAULT '',
    recipient_phone TEXT NOT NULL DEFAULT '',
    recipient_address TEXT NOT NULL DEFAULT '',
    items_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    received_at TEXT,
    verification_code TEXT NOT NULL DEFAULT '',
    verification_hash TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT 'Sistem',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contact_inquiries (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    company_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );
`);

// Safe migrations for existing databases
try {
  const empCols = db.prepare('PRAGMA table_info(employees)').all() as Array<{ name: string }>;
  if (!empCols.some((c) => c.name === 'annual_leave_quota')) {
    db.exec('ALTER TABLE employees ADD COLUMN annual_leave_quota INTEGER NOT NULL DEFAULT 12');
  }
  if (!empCols.some((c) => c.name === 'ptkp_status')) {
    db.exec("ALTER TABLE employees ADD COLUMN ptkp_status TEXT NOT NULL DEFAULT 'TK/0'");
  }
  if (!empCols.some((c) => c.name === 'bpjs_enrolled')) {
    db.exec('ALTER TABLE employees ADD COLUMN bpjs_enrolled INTEGER NOT NULL DEFAULT 1');
  }

  const payCols = db.prepare('PRAGMA table_info(payroll_records)').all() as Array<{ name: string }>;
  const payrollAlterStatements: Array<[string, string]> = [
    ['ptkp_status', "ALTER TABLE payroll_records ADD COLUMN ptkp_status TEXT NOT NULL DEFAULT 'TK/0'"],
    ['ter_category', "ALTER TABLE payroll_records ADD COLUMN ter_category TEXT NOT NULL DEFAULT 'A'"],
    ['pph21_rate', 'ALTER TABLE payroll_records ADD COLUMN pph21_rate REAL NOT NULL DEFAULT 0'],
    ['pph21_taxable_gross', 'ALTER TABLE payroll_records ADD COLUMN pph21_taxable_gross INTEGER NOT NULL DEFAULT 0'],
    ['bpjs_kes_employee', 'ALTER TABLE payroll_records ADD COLUMN bpjs_kes_employee INTEGER NOT NULL DEFAULT 0'],
    ['bpjs_jht_employee', 'ALTER TABLE payroll_records ADD COLUMN bpjs_jht_employee INTEGER NOT NULL DEFAULT 0'],
    ['bpjs_jp_employee', 'ALTER TABLE payroll_records ADD COLUMN bpjs_jp_employee INTEGER NOT NULL DEFAULT 0'],
    ['bpjs_employer_total', 'ALTER TABLE payroll_records ADD COLUMN bpjs_employer_total INTEGER NOT NULL DEFAULT 0'],
    ['tax_calculation_method', "ALTER TABLE payroll_records ADD COLUMN tax_calculation_method TEXT NOT NULL DEFAULT 'ter_bulanan'"],
  ];
  for (const [col, sql] of payrollAlterStatements) {
    if (!payCols.some((c) => c.name === col)) {
      db.exec(sql);
    }
  }

  const contractCols = db
    .prepare('PRAGMA table_info(employee_contracts)')
    .all() as Array<{ name: string }>;
  if (!contractCols.some((c) => c.name === 'verification_code')) {
    db.exec(
      "ALTER TABLE employee_contracts ADD COLUMN verification_code TEXT NOT NULL DEFAULT ''"
    );
  }
  if (!contractCols.some((c) => c.name === 'verification_hash')) {
    db.exec(
      "ALTER TABLE employee_contracts ADD COLUMN verification_hash TEXT NOT NULL DEFAULT ''"
    );
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_contracts_verification_code ON employee_contracts(verification_code) WHERE verification_code != ''"
  );
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_goods_handovers_verification_code ON goods_handovers(verification_code) WHERE verification_code != ''"
  );
} catch {
  // ignore if tables freshly created
}

export function generateContractVerificationCode(
  contractType: string,
  signedDate?: string
): string {
  const year = (signedDate || new Date().toISOString().slice(0, 10)).slice(0, 4);
  const typePrefix = contractType === 'sk_pengangkatan' ? 'SK' : 'PKWT';
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `FF-${typePrefix}-${year}-${rand}`;
}

export function computeContractVerificationHash(input: {
  verificationCode: string;
  contractNumber: string;
  contractType: string;
  employeeNip: string;
  employeeName: string;
  department: string;
  position: string;
  startDate: string;
  endDate: string | null;
  signedDate: string;
  signerName: string;
}): string {
  const canonical = [
    input.verificationCode.trim().toUpperCase(),
    input.contractNumber.trim(),
    input.contractType.trim(),
    input.employeeNip.trim(),
    input.employeeName.trim(),
    input.department.trim(),
    input.position.trim(),
    input.startDate.trim(),
    input.endDate ? input.endDate.trim() : 'PKWTT',
    input.signedDate.trim(),
    input.signerName.trim(),
  ].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16).toUpperCase();
}

export function generateHandoverVerificationCode(handoverDate?: string): string {
  const year = (handoverDate || new Date().toISOString().slice(0, 10)).slice(0, 4);
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `FF-BAST-${year}-${rand}`;
}

export function computeHandoverVerificationHash(input: {
  verificationCode: string;
  handoverNumber: string;
  handoverType: string;
  handoverDate: string;
  senderName: string;
  recipientName: string;
  items: Array<{
    name: string;
    serialNumber?: string;
    quantity: number;
    unit: string;
    condition?: string;
  }>;
}): string {
  const itemsCanonical = input.items
    .map(
      (it) =>
        `${it.name.trim()}:${(it.serialNumber || '').trim()}:${Number(it.quantity || 0)}:${it.unit.trim()}:${(it.condition || '').trim()}`
    )
    .join(';');
  const canonical = [
    input.verificationCode.trim().toUpperCase(),
    input.handoverNumber.trim(),
    input.handoverType.trim(),
    input.handoverDate.trim(),
    input.senderName.trim(),
    input.recipientName.trim(),
    itemsCanonical,
  ].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16).toUpperCase();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export interface MidtransInternalConfig {
  environment: 'sandbox' | 'production';
  merchantId: string;
  clientKey: string;
  serverKey: string;
  enabledPayments: string[];
  autoCreatePaymentLink: boolean;
}

export interface SmtpInternalConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  autoMonthlyEnabled: boolean;
}

export interface CompanyInternalConfig {
  name: string;
  email: string;
  phone: string;
  address: string;
  npwp: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  logoDataUrl?: string;
  tagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  aboutDescription?: string;
  vision?: string;
  foundedYear?: string;
  city?: string;
  heroCtaLabel?: string;
  heroImageDataUrl?: string;
  aboutImageDataUrl?: string;
  portfolioImageDataUrl?: string;
  pillars?: Array<{ title: string; description: string }>;
  caseStudies?: Array<{ sector: string; title: string; metric: string; detail: string }>;
  showServicesSection?: boolean;
  showPortfolioSection?: boolean;
  showVerifySection?: boolean;
  showContactSection?: boolean;
  footerNote?: string;
  whatsappEnabled?: boolean;
  whatsappNumber?: string;
  whatsappLabel?: string;
  whatsappGreeting?: string;
  whatsappDefaultMessage?: string;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
}

export function getSetting<T>(key: string): T | null {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
    | { value_json: string }
    | undefined;
  if (!row) return null;
  return JSON.parse(row.value_json) as T;
}

export function setSetting<T>(key: string, value: T): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value), now);
}

export function ensureInitialData(): void {
  const now = new Date().toISOString();

  if (!getSetting<VapidConfig>('vapid')) {
    const keys = webpush.generateVAPIDKeys();
    setSetting<VapidConfig>('vapid', {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    });
  }

  if (!getSetting<MidtransInternalConfig>('midtrans')) {
    setSetting<MidtransInternalConfig>('midtrans', {
      environment: 'sandbox',
      merchantId: process.env.MIDTRANS_MERCHANT_ID || '',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
      serverKey: process.env.MIDTRANS_SERVER_KEY || '',
      enabledPayments: [
        'qris',
        'gopay',
        'bca_va',
        'bni_va',
        'bri_va',
        'permata_va',
        'other_va',
        'credit_card',
      ],
      autoCreatePaymentLink: true,
    });
  }

  if (!getSetting<SmtpInternalConfig>('smtp')) {
    setSetting<SmtpInternalConfig>('smtp', {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      username: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASS || '',
      fromName: 'FakturaFlow Billing',
      fromEmail: 'billing@nusantarakarya.co.id',
      autoMonthlyEnabled: true,
    });
  }

  if (!getSetting<CompanyInternalConfig>('company')) {
    setSetting<CompanyInternalConfig>('company', {
      name: 'PT Nusantara Digital Karya',
      email: 'finance@nusantarakarya.co.id',
      phone: '+62 21 5082 4190',
      address: 'Gedung Treasury Tower Lt. 18, SCBD Lot 28, Jakarta Selatan 12190',
      npwp: '01.842.910.4-012.000',
      bankName: 'Bank Mandiri (Cabang SCBD)',
      bankAccountNumber: '102-000-8841-920',
      bankAccountName: 'PT Nusantara Digital Karya',
      logoDataUrl: '',
      tagline: 'Solusi Infrastruktur Digital, Sistem Keuangan & Pengadaan Korporasi',
      heroTitle: 'Mitra Strategis Infrastruktur Digital & Tata Kelola Bisnis Modern',
      heroSubtitle:
        'Kami merancang sistem cloud, integrasi pembayaran korporasi, serta penyediaan perangkat keras terkelola dengan standar dokumentasi resmi dan akuntabilitas penuh.',
      aboutDescription:
        'Berdiri di kawasan bisnis SCBD Jakarta, kami membantu perusahaan skala menengah hingga enterprise menyatukan infrastruktur teknologi, kepatuhan administrasi, serta siklus penagihan dan serah terima aset dalam satu ekosistem terukur.',
      vision:
        'Menjadi mitra teknologi dan operasional terpercaya bagi korporasi Indonesia melalui rekayasa sistem yang transparan, aman, dan berkelanjutan.',
      foundedYear: '2019',
      city: 'Jakarta Selatan',
      heroCtaLabel: 'Masuk Portal Karyawan',
      heroImageDataUrl: '',
      aboutImageDataUrl: '',
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
    });
  }

  const shouldSeedSampleData =
    process.env.NODE_ENV !== 'production' || process.env.SEED_SAMPLE_DATA === 'true';

  const clientCount = (db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number }).count;
  if (shouldSeedSampleData && clientCount === 0) {
    const insertClient = db.prepare(
      `INSERT INTO clients (id, name, company_name, email, phone, address, npwp, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seedClients = [
      [
        'cli-001',
        'Budi Santoso',
        'PT Mitra Logistik Nusantara',
        'finance@mitralogistik.co.id',
        '+62 811 9281 440',
        'Jl. Jend. Sudirman Kav. 52, Jakarta Selatan',
        '02.410.551.8-021.000',
      ],
      [
        'cli-002',
        'Siti Rahmawati',
        'PT Sinar Retail Indonesia',
        'ap@sinarretail.id',
        '+62 812 8821 301',
        'Jl. HR Rasuna Said Blok X-5, Kuningan, Jakarta',
        '03.112.849.2-014.000',
      ],
      [
        'cli-003',
        'Hendra Wijaya',
        'CV Karya Cipta Teknologi',
        'billing@karyacipta.tech',
        '+62 818 7732 109',
        'Jl. Dago Pakar Raya No. 14, Bandung',
        '09.662.104.7-423.000',
      ],
      [
        'cli-004',
        'Dewi Lestari',
        'PT Graha Medika Utama',
        'akuntansi@grahamedika.co.id',
        '+62 813 4401 992',
        'Jl. Diponegoro No. 88, Surabaya',
        '01.994.312.5-601.000',
      ],
    ];

    for (const c of seedClients) {
      insertClient.run(...c, now, now);
    }

    const insertSchedule = db.prepare(
      `INSERT INTO recurring_schedules
       (id, client_id, client_name, client_company, client_email, title, day_of_month, tax_rate, items_json, auto_send_email, auto_create_midtrans, active, last_run_month, next_run_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertSchedule.run(
      'sch-001',
      'cli-001',
      'Budi Santoso',
      'PT Mitra Logistik Nusantara',
      'finance@mitralogistik.co.id',
      'Langganan ERP & Cloud Fleet Bulanan',
      1,
      11,
      JSON.stringify([
        {
          id: 'item-1',
          description: 'Lisensi Platform Manajemen Armada Enterprise (50 User)',
          quantity: 1,
          unitPrice: 12500000,
          total: 12500000,
        },
        {
          id: 'item-2',
          description: 'Dukungan SLA 24/7 & Dedicated Cloud Node',
          quantity: 1,
          unitPrice: 3500000,
          total: 3500000,
        },
      ]),
      1,
      1,
      1,
      '2026-10',
      '2026-12-01',
      now
    );

    insertSchedule.run(
      'sch-002',
      'cli-002',
      'Siti Rahmawati',
      'PT Sinar Retail Indonesia',
      'ap@sinarretail.id',
      'Layanan Integrasi POS & Sinkronisasi Gudang',
      15,
      11,
      JSON.stringify([
        {
          id: 'item-1',
          description: 'Konektor API Omnichannel (12 Cabang)',
          quantity: 12,
          unitPrice: 750000,
          total: 9000000,
        },
      ]),
      1,
      1,
      1,
      '2026-10',
      '2026-11-15',
      now
    );

    insertSchedule.run(
      'sch-003',
      'cli-004',
      'Dewi Lestari',
      'PT Graha Medika Utama',
      'akuntansi@grahamedika.co.id',
      'Pemeliharaan Portal Pasien & Backup Terenkripsi',
      20,
      11,
      JSON.stringify([
        {
          id: 'item-1',
          description: 'Managed Hosting Kesehatan ISO-27001',
          quantity: 1,
          unitPrice: 8500000,
          total: 8500000,
        },
      ]),
      1,
      1,
      1,
      '2026-10',
      '2026-11-20',
      now
    );

    const insertInvoice = db.prepare(
      `INSERT INTO invoices
       (id, invoice_number, client_id, client_name, client_company, client_email, issue_date, due_date, status, items_json, subtotal, tax_rate, tax_amount, total_amount, notes, midtrans_order_id, midtrans_snap_token, midtrans_payment_url, midtrans_payment_type, midtrans_transaction_status, paid_at, email_sent_at, recurring_schedule_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertInvoice.run(
      'inv-001',
      'INV-2026-11-001',
      'cli-001',
      'Budi Santoso',
      'PT Mitra Logistik Nusantara',
      'finance@mitralogistik.co.id',
      '2026-11-01',
      '2026-11-15',
      'paid',
      JSON.stringify([
        {
          id: 'it-1',
          description: 'Lisensi Platform Manajemen Armada Enterprise (50 User)',
          quantity: 1,
          unitPrice: 12500000,
          total: 12500000,
        },
        {
          id: 'it-2',
          description: 'Dukungan SLA 24/7 & Dedicated Cloud Node',
          quantity: 1,
          unitPrice: 3500000,
          total: 3500000,
        },
      ]),
      16000000,
      11,
      1760000,
      17760000,
      'Pembayaran tagihan berulang periode November 2026.',
      'FF-INV-2026-11-001-8812',
      null,
      null,
      'bca_va',
      'settlement',
      '2026-11-03T09:14:22.000Z',
      '2026-11-01T08:00:12.000Z',
      'sch-001',
      now
    );

    insertInvoice.run(
      'inv-002',
      'INV-2026-11-002',
      'cli-002',
      'Siti Rahmawati',
      'PT Sinar Retail Indonesia',
      'ap@sinarretail.id',
      '2026-11-05',
      '2026-11-20',
      'pending',
      JSON.stringify([
        {
          id: 'it-1',
          description: 'Konektor API Omnichannel (12 Cabang)',
          quantity: 12,
          unitPrice: 750000,
          total: 9000000,
        },
      ]),
      9000000,
      11,
      990000,
      9990000,
      'Mohon selesaikan pembayaran sebelum tanggal jatuh tempo melalui tautan Midtrans.',
      'FF-INV-2026-11-002-4410',
      null,
      null,
      'qris',
      'pending',
      null,
      '2026-11-05T08:01:05.000Z',
      'sch-002',
      now
    );

    insertInvoice.run(
      'inv-003',
      'INV-2026-10-014',
      'cli-003',
      'Hendra Wijaya',
      'CV Karya Cipta Teknologi',
      'billing@karyacipta.tech',
      '2026-10-12',
      '2026-10-27',
      'overdue',
      JSON.stringify([
        {
          id: 'it-1',
          description: 'Audit Keamanan Infrastruktur & Penetration Testing',
          quantity: 1,
          unitPrice: 14500000,
          total: 14500000,
        },
      ]),
      14500000,
      11,
      1595000,
      16095000,
      'Pengingat tagihan melewati tanggal jatuh tempo.',
      'FF-INV-2026-10-014-3192',
      null,
      null,
      null,
      'expire',
      null,
      '2026-10-12T08:05:00.000Z',
      null,
      now
    );

    insertInvoice.run(
      'inv-004',
      'INV-2026-11-003',
      'cli-004',
      'Dewi Lestari',
      'PT Graha Medika Utama',
      'akuntansi@grahamedika.co.id',
      '2026-11-10',
      '2026-11-25',
      'pending',
      JSON.stringify([
        {
          id: 'it-1',
          description: 'Managed Hosting Kesehatan ISO-27001',
          quantity: 1,
          unitPrice: 8500000,
          total: 8500000,
        },
        {
          id: 'it-2',
          description: 'Replika Backup Lintas Zona (500 GB)',
          quantity: 1,
          unitPrice: 2000000,
          total: 2000000,
        },
      ]),
      10500000,
      11,
      1155000,
      11655000,
      'Tagihan layanan hosting & keamanan data November 2026.',
      'FF-INV-2026-11-003-9901',
      null,
      null,
      null,
      'pending',
      null,
      '2026-11-10T08:00:44.000Z',
      'sch-003',
      now
    );

    insertInvoice.run(
      'inv-005',
      'INV-2026-10-011',
      'cli-002',
      'Siti Rahmawati',
      'PT Sinar Retail Indonesia',
      'ap@sinarretail.id',
      '2026-10-15',
      '2026-10-30',
      'paid',
      JSON.stringify([
        {
          id: 'it-1',
          description: 'Konektor API Omnichannel (12 Cabang)',
          quantity: 12,
          unitPrice: 750000,
          total: 9000000,
        },
      ]),
      9000000,
      11,
      990000,
      9990000,
      'Lunas via Virtual Account BNI.',
      'FF-INV-2026-10-011-7721',
      null,
      null,
      'bni_va',
      'settlement',
      '2026-10-18T11:32:10.000Z',
      '2026-10-15T08:00:18.000Z',
      'sch-002',
      now
    );

    const insertNotif = db.prepare(
      `INSERT INTO notifications (id, invoice_id, invoice_number, title, message, status, amount, channel, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertNotif.run(
      'notif-001',
      'inv-001',
      'INV-2026-11-001',
      'Pembayaran Diterima (Midtrans)',
      'PT Mitra Logistik Nusantara melunasi INV-2026-11-001 sebesar Rp 17.760.000 melalui BCA Virtual Account.',
      'paid',
      17760000,
      'midtrans_webhook',
      0,
      '2026-11-03T09:14:22.000Z'
    );
    insertNotif.run(
      'notif-002',
      'inv-003',
      'INV-2026-10-014',
      'Faktur Melewati Jatuh Tempo',
      'INV-2026-10-014 untuk CV Karya Cipta Teknologi (Rp 16.095.000) berstatus jatuh tempo.',
      'overdue',
      16095000,
      'system',
      0,
      '2026-10-28T08:00:00.000Z'
    );
  }

  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (shouldSeedSampleData && productCount === 0) {
    const insertProduct = db.prepare(
      `INSERT INTO products (id, sku, name, description, unit, unit_price, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const seedProducts = [
      [
        'prd-001',
        'PRD-ERP-50',
        'Lisensi Platform Manajemen Armada Enterprise (50 User)',
        'Akses penuh modul operasional, pelacakan armada real-time, dan pelaporan eksekutif.',
        'Bulan',
        12500000,
        1,
      ],
      [
        'prd-002',
        'SVC-SLA-24',
        'Dukungan SLA 24/7 & Dedicated Cloud Node',
        'Server terdedikasi dengan jaminan uptime 99.9% dan dukungan teknis prioritas.',
        'Bulan',
        3500000,
        1,
      ],
      [
        'prd-003',
        'PRD-POS-API',
        'Konektor API Omnichannel POS Cabang',
        'Sinkronisasi stok dan transaksi POS multi-cabang secara otomatis.',
        'Cabang',
        750000,
        1,
      ],
      [
        'prd-004',
        'SVC-HOST-ISO',
        'Managed Hosting Kesehatan ISO-27001',
        'Infrastruktur cloud terenkripsi sesuai standar keamanan data medis.',
        'Bulan',
        8500000,
        1,
      ],
      [
        'prd-005',
        'SVC-SEC-AUDIT',
        'Audit Keamanan Infrastruktur & Penetration Testing',
        'Pengujian kerentanan menyeluruh dan laporan rekomendasi perbaikan.',
        'Paket',
        14500000,
        1,
      ],
    ];
    for (const p of seedProducts) {
      insertProduct.run(...p, now, now);
    }
  }

  const empCount = (db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number }).count;
  if (shouldSeedSampleData && empCount === 0) {
    const insertEmp = db.prepare(
      `INSERT INTO employees
       (id, nip, name, email, phone, department, position, employment_type, join_date, base_salary, fixed_allowance, bank_name, bank_account_number, bank_account_name, npwp, bpjs_number, ptkp_status, bpjs_enrolled, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seedEmployees = [
      [
        'emp-001',
        'EMP-2023-001',
        'Rizky Pratama',
        'rizky.pratama@nusantarakarya.co.id',
        '+62 812 9100 3311',
        'Engineering',
        'Lead Full-Stack Architect',
        'tetap',
        '2023-03-01',
        18500000,
        3500000,
        'Bank Mandiri',
        '102-000-4412-880',
        'Rizky Pratama',
        '42.190.881.2-012.000',
        '0001884210091',
        'K/1',
        1,
        'active',
      ],
      [
        'emp-002',
        'EMP-2023-004',
        'Anisa Maharani',
        'anisa.maharani@nusantarakarya.co.id',
        '+62 813 8842 1190',
        'Keuangan & Akuntansi',
        'Finance & Tax Manager',
        'tetap',
        '2023-06-15',
        15000000,
        2500000,
        'Bank BCA',
        '522-091-8821',
        'Anisa Maharani',
        '51.334.910.1-014.000',
        '0001993102214',
        'K/0',
        1,
        'active',
      ],
      [
        'emp-003',
        'EMP-2024-011',
        'Dimas Kusuma',
        'dimas.kusuma@nusantarakarya.co.id',
        '+62 811 7721 660',
        'Operasional & SLA',
        'Cloud Infrastructure Engineer',
        'tetap',
        '2024-02-01',
        13000000,
        2000000,
        'Bank BNI',
        '088-219-4401',
        'Dimas Kusuma',
        '77.412.009.4-021.000',
        '0002014491102',
        'TK/0',
        1,
        'active',
      ],
      [
        'emp-004',
        'EMP-2025-019',
        'Nadia Putri Wijaya',
        'nadia.wijaya@nusantarakarya.co.id',
        '+62 817 5541 209',
        'Sales & Kemitraan',
        'Enterprise Account Executive',
        'kontrak',
        '2025-01-10',
        10500000,
        2000000,
        'Bank BCA',
        '883-012-7745',
        'Nadia Putri Wijaya',
        '89.110.234.5-015.000',
        '0002190031128',
        'TK/0',
        1,
        'active',
      ],
    ];

    for (const emp of seedEmployees) {
      insertEmp.run(...emp, now, now);
    }

    const insertPayroll = db.prepare(
      `INSERT INTO payroll_records
       (id, slip_number, period_month, pay_date, employee_id, employee_nip, employee_name, employee_email, department, position, bank_name, bank_account_number, bank_account_name, base_salary, allowances, overtime_pay, bonus, pph21_deduction, bpjs_deduction, other_deductions, gross_pay, total_deductions, net_pay, status, notes, paid_at, email_sent_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertPayroll.run(
      'pay-001',
      'PAY-2026-11-001',
      '2026-11',
      '2026-11-25',
      'emp-001',
      'EMP-2023-001',
      'Rizky Pratama',
      'rizky.pratama@nusantarakarya.co.id',
      'Engineering',
      'Lead Full-Stack Architect',
      'Bank Mandiri',
      '102-000-4412-880',
      'Rizky Pratama',
      18500000,
      3500000,
      750000,
      0,
      1150000,
      660000,
      0,
      22750000,
      1810000,
      20940000,
      'paid',
      'Gaji & tunjangan periode November 2026.',
      '2026-11-25T09:00:00.000Z',
      '2026-11-25T09:05:00.000Z',
      now
    );

    insertPayroll.run(
      'pay-002',
      'PAY-2026-11-002',
      '2026-11',
      '2026-11-25',
      'emp-002',
      'EMP-2023-004',
      'Anisa Maharani',
      'anisa.maharani@nusantarakarya.co.id',
      'Keuangan & Akuntansi',
      'Finance & Tax Manager',
      'Bank BCA',
      '522-091-8821',
      'Anisa Maharani',
      15000000,
      2500000,
      0,
      1000000,
      825000,
      525000,
      0,
      18500000,
      1350000,
      17150000,
      'paid',
      'Termasuk bonus tutup buku Q3.',
      '2026-11-25T09:00:00.000Z',
      '2026-11-25T09:05:00.000Z',
      now
    );

    insertPayroll.run(
      'pay-003',
      'PAY-2026-11-003',
      '2026-11',
      '2026-11-25',
      'emp-003',
      'EMP-2024-011',
      'Dimas Kusuma',
      'dimas.kusuma@nusantarakarya.co.id',
      'Operasional & SLA',
      'Cloud Infrastructure Engineer',
      'Bank BNI',
      '088-219-4401',
      'Dimas Kusuma',
      13000000,
      2000000,
      500000,
      0,
      580000,
      450000,
      0,
      15500000,
      1030000,
      14470000,
      'approved',
      'Menunggu jadwal transfer massal HR.',
      null,
      null,
      now
    );

    insertPayroll.run(
      'pay-004',
      'PAY-2026-11-004',
      '2026-11',
      '2026-11-25',
      'emp-004',
      'EMP-2025-019',
      'Nadia Putri Wijaya',
      'nadia.wijaya@nusantarakarya.co.id',
      'Sales & Kemitraan',
      'Enterprise Account Executive',
      'Bank BCA',
      '883-012-7745',
      'Nadia Putri Wijaya',
      10500000,
      2000000,
      0,
      1500000,
      490000,
      375000,
      0,
      14000000,
      865000,
      13135000,
      'draft',
      'Termasuk komisi klien baru PT Graha Medika Utama.',
      null,
      null,
      now
    );
  }

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
    const insertUser = db.prepare(
      `INSERT INTO users
       (id, username, name, email, password_hash, role, department, active, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const initialAdminPass = process.env.INITIAL_ADMIN_PASSWORD || 'Password123!';
    const defaultPasswordHash = hashPassword(initialAdminPass);
    const seedUsers = [
      [
        'usr-admin',
        'admin',
        'Administrator',
        'admin@nusantarakarya.co.id',
        defaultPasswordHash,
        'admin',
        'Direksi & IT',
        1,
        null,
      ],
      ...(shouldSeedSampleData
        ? [
            [
              'usr-manager',
              'manager',
              'Anisa Maharani',
              'manager@nusantarakarya.co.id',
              defaultPasswordHash,
              'manager',
              'Keuangan & Akuntansi',
              1,
              null,
            ],
            [
              'usr-hrd',
              'hrd',
              'Ratna Sari Dewi',
              'hrd@nusantarakarya.co.id',
              defaultPasswordHash,
              'hrd',
              'Human Resources (HRD)',
              1,
              null,
            ],
            [
              'usr-staff',
              'user',
              'Andi Firmansyah',
              'user@nusantarakarya.co.id',
              defaultPasswordHash,
              'user',
              'Operasional Billing',
              1,
              null,
            ],
          ]
        : []),
    ];

    for (const u of seedUsers) {
      insertUser.run(...u, now, now);
    }
  }

  const leaveCount = (db.prepare('SELECT COUNT(*) as count FROM leave_requests').get() as { count: number }).count;
  if (shouldSeedSampleData && leaveCount === 0) {
    const insertLeave = db.prepare(
      `INSERT INTO leave_requests
       (id, request_number, employee_id, employee_nip, employee_name, employee_email, department, position, leave_type, start_date, end_date, total_days, reason, delegate_name, contact_during_leave, status, hrd_notes, reviewed_by, reviewed_at, submitted_by_user_id, submitted_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seedLeaves = [
      [
        'lv-001',
        'CUTI-2026-11-001',
        'emp-001',
        'EMP-2023-001',
        'Rizky Pratama',
        'rizky.pratama@nusantarakarya.co.id',
        'Engineering',
        'Lead Full-Stack Architect',
        'tahunan',
        '2026-11-02',
        '2026-11-04',
        3,
        'Cuti tahunan keluarga ke Yogyakarta setelah rilis platform Q4.',
        'Dimas Kusuma',
        '+62 812 9100 3311',
        'approved',
        'Disetujui HRD. Handover deployment sudah diserahkan ke tim Infrastruktur.',
        'Ratna Sari Dewi',
        '2026-10-29T10:15:00.000Z',
        'usr-admin',
        'Bambang Wibowo',
        '2026-10-28T08:30:00.000Z',
        '2026-10-29T10:15:00.000Z',
      ],
      [
        'lv-002',
        'CUTI-2026-11-002',
        'emp-003',
        'EMP-2024-011',
        'Dimas Kusuma',
        'dimas.kusuma@nusantarakarya.co.id',
        'Operasional & SLA',
        'Cloud Infrastructure Engineer',
        'tahunan',
        '2026-11-23',
        '2026-11-25',
        3,
        'Mengurus keperluan keluarga di Bandung.',
        'Rizky Pratama',
        '+62 811 7721 660',
        'pending',
        '',
        null,
        null,
        'usr-staff',
        'Andi Firmansyah',
        '2026-11-12T09:10:00.000Z',
        '2026-11-12T09:10:00.000Z',
      ],
      [
        'lv-003',
        'CUTI-2026-11-003',
        'emp-004',
        'EMP-2025-019',
        'Nadia Putri Wijaya',
        'nadia.wijaya@nusantarakarya.co.id',
        'Sales & Kemitraan',
        'Enterprise Account Executive',
        'sakit',
        '2026-11-16',
        '2026-11-17',
        2,
        'Istirahat medis sesuai rekomendasi dokter (surat dokter terlampir ke HRD).',
        'Anisa Maharani',
        '+62 817 5541 209',
        'pending',
        '',
        null,
        null,
        'usr-staff',
        'Andi Firmansyah',
        '2026-11-15T07:45:00.000Z',
        '2026-11-15T07:45:00.000Z',
      ],
      [
        'lv-004',
        'CUTI-2026-10-009',
        'emp-002',
        'EMP-2023-004',
        'Anisa Maharani',
        'anisa.maharani@nusantarakarya.co.id',
        'Keuangan & Akuntansi',
        'Finance & Tax Manager',
        'penting',
        '2026-10-29',
        '2026-10-30',
        2,
        'Pengajuan izin acara keluarga di akhir bulan.',
        'Ratna Sari Dewi',
        '+62 813 8842 1190',
        'rejected',
        'Mohon dijadwalkan ulang setelah tutup buku bulanan selesai pada tanggal 2 bulan depan.',
        'Ratna Sari Dewi',
        '2026-10-27T14:20:00.000Z',
        'usr-manager',
        'Anisa Maharani',
        '2026-10-26T11:00:00.000Z',
        '2026-10-27T14:20:00.000Z',
      ],
    ];

    for (const lv of seedLeaves) {
      insertLeave.run(...lv);
    }
  }

  const accountingCount = (
    db.prepare('SELECT COUNT(*) as count FROM accounting_entries').get() as { count: number }
  ).count;
  if (shouldSeedSampleData && accountingCount === 0) {
    const insertAcc = db.prepare(
      `INSERT INTO accounting_entries
       (id, entry_number, date, type, category, account_name, description, counterparty, payment_method, amount, status, source_type, source_id, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seedEntries = [
      [
        'acc-001',
        'JUR-2026-10-001',
        '2026-10-01',
        'income',
        'Penambahan Modal / Kas',
        'Bank Mandiri Operasional',
        'Saldo Awal Kas Operasional Perusahaan Kuartal IV 2026',
        'PT Nusantara Digital Karya',
        'Transfer Bank',
        75000000,
        'reconciled',
        'manual',
        null,
        'Saldo pembukaan rekening giro operasional SCBD.',
        'Bambang Wibowo',
        '2026-10-01T08:00:00.000Z',
        '2026-10-01T08:00:00.000Z',
      ],
      [
        'acc-002',
        'JUR-2026-10-002',
        '2026-10-18',
        'income',
        'Penjualan & Tagihan Klien',
        'Bank BCA / Midtrans',
        'Pelunasan Faktur INV-2026-10-011 (Integrasi POS 12 Cabang)',
        'PT Sinar Retail Indonesia',
        'QRIS / Virtual Account',
        9990000,
        'reconciled',
        'invoice',
        'inv-005',
        'Otomatis tercatat dari pelunasan Midtrans BNI VA.',
        'Sistem FakturaFlow',
        '2026-10-18T11:32:10.000Z',
        '2026-10-18T11:32:10.000Z',
      ],
      [
        'acc-003',
        'JUR-2026-10-003',
        '2026-10-25',
        'expense',
        'Sewa & Utilitas Kantor',
        'Bank Mandiri Operasional',
        'Pembayaran Sewa Ruang Kantor Treasury Tower & Listrik Okt 2026',
        'Pengelola Gedung SCBD Lot 28',
        'Transfer Bank',
        14500000,
        'reconciled',
        'manual',
        null,
        'Invoice gedung #SCBD-2026-10.',
        'Anisa Maharani',
        '2026-10-25T10:00:00.000Z',
        '2026-10-25T10:00:00.000Z',
      ],
      [
        'acc-004',
        'JUR-2026-11-001',
        '2026-11-03',
        'income',
        'Penjualan & Tagihan Klien',
        'Bank BCA / Midtrans',
        'Pelunasan Faktur INV-2026-11-001 (Lisensi ERP & Cloud Node)',
        'PT Mitra Logistik Nusantara',
        'QRIS / Virtual Account',
        17760000,
        'reconciled',
        'invoice',
        'inv-001',
        'Settlement otomatis BCA Virtual Account.',
        'Sistem FakturaFlow',
        '2026-11-03T09:14:22.000Z',
        '2026-11-03T09:14:22.000Z',
      ],
      [
        'acc-005',
        'JUR-2026-11-002',
        '2026-11-05',
        'expense',
        'Infrastruktur Cloud & Software',
        'Bank Mandiri Operasional',
        'Tagihan Cloud Server, Database Cluster & Domain SSL Nov 2026',
        'Cloud Infrastructure Partner',
        'Auto-Debit',
        4250000,
        'reconciled',
        'manual',
        null,
        'Biaya infrastruktur produksi SLA 99.9%.',
        'Bambang Wibowo',
        '2026-11-05T07:30:00.000Z',
        '2026-11-05T07:30:00.000Z',
      ],
      [
        'acc-006',
        'JUR-2026-11-003',
        '2026-11-08',
        'expense',
        'Operasional & Perlengkapan (ATK)',
        'Kas Kecil Kantor (Petty Cash)',
        'Pembelian Kertas Invoice, Tinta Printer & Perlengkapan Rapat',
        'Toko ATK Mitra Kantor',
        'Tunai Kas Kecil',
        1350000,
        'recorded',
        'manual',
        null,
        'Nota pembelian kas kecil #PC-1108.',
        'Andi Firmansyah',
        '2026-11-08T14:15:00.000Z',
        '2026-11-08T14:15:00.000Z',
      ],
      [
        'acc-007',
        'JUR-2026-11-004',
        '2026-11-10',
        'expense',
        'Pajak & BPJS Perusahaan',
        'Bank Mandiri Operasional',
        'Setoran PPN Masa & Iuran BPJS Ketenagakerjaan Perusahaan',
        'Kas Negara / BPJS',
        'Transfer Bank',
        3850000,
        'reconciled',
        'manual',
        null,
        'NTPN terverifikasi DJP Online.',
        'Anisa Maharani',
        '2026-11-10T11:00:00.000Z',
        '2026-11-10T11:00:00.000Z',
      ],
      [
        'acc-008',
        'JUR-2026-11-005',
        '2026-11-12',
        'income',
        'Pendapatan Jasa & Konsultasi',
        'Bank Mandiri Operasional',
        'Termin Konsultasi Implementasi Keamanan Jaringan',
        'PT Graha Medika Utama',
        'Transfer Bank',
        12000000,
        'recorded',
        'manual',
        null,
        'Transfer langsung ke rekening Bank Mandiri SCBD.',
        'Anisa Maharani',
        '2026-11-12T15:40:00.000Z',
        '2026-11-12T15:40:00.000Z',
      ],
    ];

    for (const acc of seedEntries) {
      insertAcc.run(...acc);
    }
  }

  const contractCount = (
    db.prepare('SELECT COUNT(*) as count FROM employee_contracts').get() as { count: number }
  ).count;
  if (shouldSeedSampleData && contractCount === 0) {
    const insertContract = db.prepare(
      `INSERT INTO employee_contracts
       (id, contract_number, contract_type, employee_id, employee_nip, employee_name, employee_email, employee_nik, employee_address, department, position, work_location, start_date, end_date, duration_months, probation_months, base_salary, fixed_allowance, working_hours, signer_name, signer_title, signed_date, city, custom_clauses, status, verification_code, verification_hash, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seedContracts = [
      {
        id: 'ctr-001',
        contractNumber: 'SK/HRD/2023/001',
        contractType: 'sk_pengangkatan',
        employeeId: 'emp-001',
        employeeNip: 'EMP-2023-001',
        employeeName: 'Rizky Pratama',
        employeeEmail: 'rizky.pratama@nusantarakarya.co.id',
        employeeNik: '3174011504920004',
        employeeAddress: 'Jl. Kemang Timur No. 42, Jakarta Selatan',
        department: 'Engineering',
        position: 'Lead Full-Stack Architect',
        workLocation: 'Kantor Pusat Jakarta (Hybrid)',
        startDate: '2023-06-01',
        endDate: null as string | null,
        durationMonths: null as number | null,
        probationMonths: 0,
        baseSalary: 18500000,
        fixedAllowance: 3500000,
        workingHours: 'Senin – Jumat, 09.00 – 17.00 WIB',
        signerName: 'Bambang Wibowo',
        signerTitle: 'Direktur Utama',
        signedDate: '2023-05-25',
        city: 'Jakarta',
        customClauses:
          'Karyawan berhak atas fasilitas asuransi kesehatan tambahan serta tunjangan perangkat kerja sesuai kebijakan Divisi Engineering.',
        status: 'active',
        verificationCode: 'FF-SK-2023-7A9C4E12',
        createdBy: 'Administrator',
      },
      {
        id: 'ctr-002',
        contractNumber: 'PKWT/HRD/2026/001',
        contractType: 'pkwt',
        employeeId: 'emp-003',
        employeeNip: 'EMP-2024-011',
        employeeName: 'Dimas Kusuma',
        employeeEmail: 'dimas.kusuma@nusantarakarya.co.id',
        employeeNik: '3173052208950002',
        employeeAddress: 'Jl. Tebet Barat Dalam VIII No. 14, Jakarta Selatan',
        department: 'Operasional & SLA',
        position: 'Cloud Infrastructure Engineer',
        workLocation: 'Kantor Pusat Jakarta (SCBD)',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        durationMonths: 12,
        probationMonths: 0,
        baseSalary: 13000000,
        fixedAllowance: 2000000,
        workingHours: 'Senin – Jumat, 09.00 – 17.00 WIB (Rotasi On-Call SLA)',
        signerName: 'Siti Rahmawati',
        signerTitle: 'Head of HR & People Operations',
        signedDate: '2025-12-20',
        city: 'Jakarta',
        customClauses:
          'Termasuk kesediaan rotasi jadwal pemeliharaan server produksi di luar jam operasional dengan kompensasi lembur sesuai ketentuan perusahaan.',
        status: 'active',
        verificationCode: 'FF-PKWT-2026-3D8B1F09',
        createdBy: 'Siti Rahmawati',
      },
    ];

    for (const ctr of seedContracts) {
      const hash = computeContractVerificationHash({
        verificationCode: ctr.verificationCode,
        contractNumber: ctr.contractNumber,
        contractType: ctr.contractType,
        employeeNip: ctr.employeeNip,
        employeeName: ctr.employeeName,
        department: ctr.department,
        position: ctr.position,
        startDate: ctr.startDate,
        endDate: ctr.endDate,
        signedDate: ctr.signedDate,
        signerName: ctr.signerName,
      });
      insertContract.run(
        ctr.id,
        ctr.contractNumber,
        ctr.contractType,
        ctr.employeeId,
        ctr.employeeNip,
        ctr.employeeName,
        ctr.employeeEmail,
        ctr.employeeNik,
        ctr.employeeAddress,
        ctr.department,
        ctr.position,
        ctr.workLocation,
        ctr.startDate,
        ctr.endDate,
        ctr.durationMonths,
        ctr.probationMonths,
        ctr.baseSalary,
        ctr.fixedAllowance,
        ctr.workingHours,
        ctr.signerName,
        ctr.signerTitle,
        ctr.signedDate,
        ctr.city,
        ctr.customClauses,
        ctr.status,
        ctr.verificationCode,
        hash,
        ctr.createdBy,
        now,
        now
      );
    }
  }

  // Backfill verification_code & verification_hash for any existing contracts without them
  const missingVerifyRows = db
    .prepare(
      "SELECT * FROM employee_contracts WHERE verification_code = '' OR verification_hash = ''"
    )
    .all() as Array<Record<string, unknown>>;
  if (missingVerifyRows.length > 0) {
    const updateVerify = db.prepare(
      'UPDATE employee_contracts SET verification_code = ?, verification_hash = ? WHERE id = ?'
    );
    for (const row of missingVerifyRows) {
      const code =
        String(row.verification_code || '').trim() ||
        generateContractVerificationCode(
          String(row.contract_type || 'pkwt'),
          String(row.signed_date || '')
        );
      const hash = computeContractVerificationHash({
        verificationCode: code,
        contractNumber: String(row.contract_number || ''),
        contractType: String(row.contract_type || 'pkwt'),
        employeeNip: String(row.employee_nip || ''),
        employeeName: String(row.employee_name || ''),
        department: String(row.department || ''),
        position: String(row.position || ''),
        startDate: String(row.start_date || ''),
        endDate: row.end_date ? String(row.end_date) : null,
        signedDate: String(row.signed_date || ''),
        signerName: String(row.signer_name || ''),
      });
      updateVerify.run(code, hash, String(row.id));
    }
  }

  const handoverCount = (
    db.prepare('SELECT COUNT(*) as count FROM goods_handovers').get() as { count: number }
  ).count;
  if (shouldSeedSampleData && handoverCount === 0) {
    const insertHandover = db.prepare(
      `INSERT INTO goods_handovers
       (id, handover_number, handover_type, status, handover_date, city, location, reference_type, reference_id, reference_number, sender_name, sender_title, recipient_name, recipient_company, recipient_identity, recipient_phone, recipient_address, items_json, notes, received_at, verification_code, verification_hash, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seedHandovers = [
      {
        id: 'bast-001',
        handoverNumber: 'BAST/OUT/2026/001',
        handoverType: 'client_delivery',
        status: 'received',
        handoverDate: '2026-11-10',
        city: 'Jakarta',
        location: 'Kantor PT Sinar Mas Digital, Thamrin',
        referenceType: 'invoice',
        referenceId: 'inv-101',
        referenceNumber: 'INV-2026-101',
        senderName: 'Anisa Maharani',
        senderTitle: 'Operasional & Delivery Lead',
        recipientName: 'Bapak Hendra Wijaya',
        recipientCompany: 'PT Sinar Mas Digital',
        recipientIdentity: 'IT Procurement Manager',
        recipientPhone: '+62 811-9023-4410',
        recipientAddress: 'Jl. M.H. Thamrin No. 51, Jakarta Pusat',
        items: [
          {
            id: 'bi-001',
            name: 'Server Rack Appliance Dell PowerEdge R350',
            specification: 'Intel Xeon E-2336, 32GB ECC RAM, 2x 960GB SSD RAID1',
            serialNumber: 'SN-DL350-99281A',
            quantity: 2,
            unit: 'Unit',
            condition: 'Baik / Baru',
            notes: 'Segel garansi resmi 3 tahun lengkap dengan rail kit',
          },
          {
            id: 'bi-002',
            name: 'Managed Gigabit Switch 24-Port PoE+',
            specification: 'Layer 2/3, 4x SFP+ Uplink',
            serialNumber: 'SN-SW24-44190B',
            quantity: 1,
            unit: 'Unit',
            condition: 'Baik / Baru',
            notes: 'Termasuk kabel power & modul SFP',
          },
        ],
        notes: 'Seluruh unit telah dilakukan uji nyala (burn-in test) dan diterima dalam kondisi lengkap tanpa cacat fisik.',
        receivedAt: '2026-11-10T14:30:00.000Z',
        verificationCode: 'FF-BAST-2026-8E4A21C9',
        createdBy: 'Administrator',
      },
      {
        id: 'bast-002',
        handoverNumber: 'BAST/INV/2026/001',
        handoverType: 'employee_asset',
        status: 'received',
        handoverDate: '2026-11-12',
        city: 'Jakarta',
        location: 'Kantor Pusat Jakarta (SCBD)',
        referenceType: 'employee',
        referenceId: 'emp-001',
        referenceNumber: 'EMP-2023-001',
        senderName: 'Siti Rahmawati',
        senderTitle: 'Head of HR & General Affairs',
        recipientName: 'Rizky Pratama',
        recipientCompany: 'Engineering — Lead Full-Stack Architect',
        recipientIdentity: 'NIP: EMP-2023-001',
        recipientPhone: '+62 812-8801-3342',
        recipientAddress: 'Jl. Kemang Timur No. 42, Jakarta Selatan',
        items: [
          {
            id: 'bi-003',
            name: 'MacBook Pro 14" M3 Pro Work Device',
            specification: '18GB Unified Memory / 512GB SSD / Space Black',
            serialNumber: 'C02YM4K9JGH5',
            quantity: 1,
            unit: 'Unit',
            condition: 'Baik / Baru',
            notes: 'Beserta adaptor 70W USB-C, kabel MagSafe 3 & tas laptop',
          },
          {
            id: 'bi-004',
            name: 'Kartu Akses Gedung & Security YubiKey 5C',
            specification: 'RFID Access Card + Hardware 2FA Token',
            serialNumber: 'YK5C-229104',
            quantity: 1,
            unit: 'Set',
            condition: 'Tersegel / Lengkap',
            notes: 'Wajib dikembalikan apabila masa kerja berakhir',
          },
        ],
        notes: 'Penerima bertanggung jawab menjaga keamanan fisik serta kerahasiaan data perangkat inventaris perusahaan.',
        receivedAt: '2026-11-12T10:15:00.000Z',
        verificationCode: 'FF-BAST-2026-5C19D4F2',
        createdBy: 'Siti Rahmawati',
      },
    ];

    for (const h of seedHandovers) {
      const hash = computeHandoverVerificationHash({
        verificationCode: h.verificationCode,
        handoverNumber: h.handoverNumber,
        handoverType: h.handoverType,
        handoverDate: h.handoverDate,
        senderName: h.senderName,
        recipientName: h.recipientName,
        items: h.items,
      });
      insertHandover.run(
        h.id,
        h.handoverNumber,
        h.handoverType,
        h.status,
        h.handoverDate,
        h.city,
        h.location,
        h.referenceType,
        h.referenceId,
        h.referenceNumber,
        h.senderName,
        h.senderTitle,
        h.recipientName,
        h.recipientCompany,
        h.recipientIdentity,
        h.recipientPhone,
        h.recipientAddress,
        JSON.stringify(h.items),
        h.notes,
        h.receivedAt,
        h.verificationCode,
        hash,
        h.createdBy,
        now,
        now
      );
    }
  }
}

ensureInitialData();
