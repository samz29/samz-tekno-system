import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import {
  db,
  getSetting,
  setSetting,
  hashPassword,
  verifyPassword,
  verifyDatabaseConnection,
  closeDatabase,
  withTransaction,
  generateContractVerificationCode,
  computeContractVerificationHash,
  generateHandoverVerificationCode,
  computeHandoverVerificationHash,
  type MidtransInternalConfig,
  type SmtpInternalConfig,
  type CompanyInternalConfig,
  type VapidConfig,
} from './server/db.ts';
import {
  registerSseClient,
  broadcastEvent,
  createAndBroadcastNotification,
  dispatchPushNotification,
  mapClientRow,
  mapProductRow,
  mapEmployeeRow,
  mapContractRow,
  mapHandoverRow,
  mapLeaveRow,
  mapAccountingRow,
  mapPayrollRow,
  mapInvoiceRow,
  mapScheduleRow,
  mapEmailLogRow,
  mapNotificationRow,
  mapUserRow,
  maskSecret,
  testMidtransCredentials,
  createMidtransSnapForInvoice,
  verifyMidtransSignature,
  applyMidtransPaymentStatus,
  pollMidtransInvoiceStatus,
  sendInvoiceEmail,
  sendPayslipEmail,
  generateMonthlyPayrollForPeriod,
  runMonthlyBillingJob,
} from './server/services.ts';
import type {
  AccountingEntry,
  AppSettingsPublic,
  AuthUser,
  BootstrapPayload,
  Client,
  Product,
  Employee,
  EmployeeContract,
  GoodsHandover,
  HandoverItem,
  LeaveEmployeeOption,
  LeaveRequest,
  PayrollRecord,
  Invoice,
  RecurringSchedule,
  UserRole,
} from './src/types.ts';

type AuthedRequest = express.Request & { user?: AuthUser; sessionToken?: string };

function resolveAppRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const SESSION_COOKIE_NAME = 'ff_session';
const VALID_ROLES: UserRole[] = ['admin', 'manager', 'hrd', 'user'];

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function getSessionToken(req: express.Request): string | null {
  const authHeader = req.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (queryToken) return queryToken;

  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) return cookies[SESSION_COOKIE_NAME];
  return null;
}

function getSessionUser(req: express.Request): { user: AuthUser; token: string } | null {
  const token = getSessionToken(req);
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as (Record<string, unknown> & { session_expires_at?: string }) | undefined;

  if (!row) return null;
  if (!row.session_expires_at || new Date(row.session_expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  if (!Number(row.active)) return null;

  return { user: mapUserRow(row), token };
}

function requireAuth(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const session = getSessionUser(req);
  if (!session) {
    res.status(401).json({
      ok: false,
      message: 'Sesi tidak valid atau telah berakhir. Silakan masuk terlebih dahulu.',
    });
    return;
  }
  req.user = session.user;
  req.sessionToken = session.token;
  next();
}

function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ ok: false, message: 'Autentikasi diperlukan.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        ok: false,
        message: `Akses ditolak. Fitur ini memerlukan hak akses ${allowedRoles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}

function buildPublicSettings(reqHost?: string, reqProtocol?: string): AppSettingsPublic {
  const midtrans = getSetting<MidtransInternalConfig>('midtrans')!;
  const smtp = getSetting<SmtpInternalConfig>('smtp')!;
  const company = getSetting<CompanyInternalConfig>('company')!;

  const isLocalHost = Boolean(
    reqHost && (reqHost.startsWith('localhost') || reqHost.startsWith('127.0.0.1'))
  );
  const proto = reqProtocol || (isLocalHost ? 'http' : 'https');
  const baseUrl =
    process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')
      ? process.env.APP_URL.replace(/\/$/, '')
      : reqHost
      ? `${proto}://${reqHost}`
      : 'http://localhost:3000';

  return {
    midtrans: {
      environment: midtrans.environment,
      merchantId: midtrans.merchantId,
      clientKey: midtrans.clientKey,
      hasServerKey: Boolean(midtrans.serverKey),
      serverKeyMasked: maskSecret(midtrans.serverKey),
      enabledPayments: midtrans.enabledPayments || [],
      autoCreatePaymentLink: midtrans.autoCreatePaymentLink,
      webhookUrl: `${baseUrl}/api/midtrans/webhook`,
    },
    smtp: {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      username: smtp.username,
      hasPassword: Boolean(smtp.password),
      passwordMasked: maskSecret(smtp.password),
      fromName: smtp.fromName,
      fromEmail: smtp.fromEmail,
      autoMonthlyEnabled: smtp.autoMonthlyEnabled,
    },
    company,
  };
}

function getFullBootstrap(reqHost?: string, currentUser?: AuthUser): BootstrapPayload {
  const role: UserRole = currentUser?.role || 'user';
  const canViewBilling = role === 'admin' || role === 'manager' || role === 'user';
  const canViewSchedules = role === 'admin' || role === 'manager';
  const canViewHrPayroll = role === 'admin' || role === 'manager' || role === 'hrd';
  const canViewEmailLogs = role === 'admin' || role === 'manager' || role === 'hrd';
  const canViewUsers = role === 'admin';

  const clients = canViewBilling
    ? (
        db.prepare('SELECT * FROM clients ORDER BY company_name ASC').all() as Array<
          Record<string, unknown>
        >
      ).map(mapClientRow)
    : [];

  const products = canViewBilling
    ? (
        db.prepare('SELECT * FROM products ORDER BY name ASC').all() as Array<
          Record<string, unknown>
        >
      ).map(mapProductRow)
    : [];

  const employees = canViewHrPayroll
    ? (
        db.prepare('SELECT * FROM employees ORDER BY nip ASC').all() as Array<
          Record<string, unknown>
        >
      ).map(mapEmployeeRow)
    : [];

  const contracts = canViewHrPayroll
    ? (
        db
          .prepare('SELECT * FROM employee_contracts ORDER BY signed_date DESC, updated_at DESC')
          .all() as Array<Record<string, unknown>>
      ).map(mapContractRow)
    : [];

  const handovers = (
    db
      .prepare('SELECT * FROM goods_handovers ORDER BY handover_date DESC, updated_at DESC')
      .all() as Array<Record<string, unknown>>
  ).map(mapHandoverRow);

  const payrolls = canViewHrPayroll
    ? (
        db
          .prepare('SELECT * FROM payroll_records ORDER BY period_month DESC, slip_number ASC')
          .all() as Array<Record<string, unknown>>
      ).map(mapPayrollRow)
    : [];

  const invoices = canViewBilling
    ? (
        db.prepare('SELECT * FROM invoices ORDER BY issue_date DESC, updated_at DESC').all() as Array<
          Record<string, unknown>
        >
      ).map(mapInvoiceRow)
    : [];

  const schedules = canViewSchedules
    ? (
        db.prepare('SELECT * FROM recurring_schedules ORDER BY day_of_month ASC').all() as Array<
          Record<string, unknown>
        >
      ).map(mapScheduleRow)
    : [];

  const emailLogs = canViewEmailLogs
    ? (
        db.prepare('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 50').all() as Array<
          Record<string, unknown>
        >
      ).map(mapEmailLogRow)
    : [];

  const notifications = (
    db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all() as Array<
      Record<string, unknown>
    >
  ).map(mapNotificationRow);

  const users = canViewUsers
    ? (
        db.prepare('SELECT * FROM users ORDER BY role ASC, name ASC').all() as Array<
          Record<string, unknown>
        >
      ).map(mapUserRow)
    : undefined;

  const canViewAllLeaves = role === 'admin' || role === 'manager' || role === 'hrd';
  const leaveRequests = canViewAllLeaves
    ? (
        db
          .prepare('SELECT * FROM leave_requests ORDER BY created_at DESC')
          .all() as Array<Record<string, unknown>>
      ).map(mapLeaveRow)
    : currentUser
    ? (
        db
          .prepare(
            `SELECT * FROM leave_requests
             WHERE submitted_by_user_id = ? OR LOWER(employee_email) = LOWER(?)
             ORDER BY created_at DESC`
          )
          .all(currentUser.id, currentUser.email) as Array<Record<string, unknown>>
      ).map(mapLeaveRow)
    : [];

  const currentYearPrefix = `${new Date().getFullYear()}-`;
  const approvedAnnualRows = db
    .prepare(
      `SELECT employee_id, COALESCE(SUM(total_days), 0) AS used_days
       FROM leave_requests
       WHERE status = 'approved' AND leave_type = 'tahunan' AND start_date LIKE ?
       GROUP BY employee_id`
    )
    .all(`${currentYearPrefix}%`) as Array<{ employee_id: string; used_days: number }>;

  const usedDaysMap = new Map<string, number>();
  for (const r of approvedAnnualRows) {
    usedDaysMap.set(r.employee_id, Number(r.used_days || 0));
  }

  const leaveEmployees: LeaveEmployeeOption[] = (
    db
      .prepare(
        "SELECT id, nip, name, email, department, position, annual_leave_quota FROM employees WHERE status = 'active' ORDER BY name ASC"
      )
      .all() as Array<Record<string, unknown>>
  ).map((row) => ({
    id: String(row.id),
    nip: String(row.nip),
    name: String(row.name),
    email: String(row.email),
    department: String(row.department),
    position: String(row.position),
    annualLeaveQuota: Number(row.annual_leave_quota ?? 12),
    usedAnnualDays: usedDaysMap.get(String(row.id)) || 0,
  }));

  const canViewAccounting = role === 'admin' || role === 'manager';
  const accountingEntries = canViewAccounting
    ? (
        db
          .prepare('SELECT * FROM accounting_entries ORDER BY date DESC, created_at DESC')
          .all() as Array<Record<string, unknown>>
      ).map(mapAccountingRow)
    : [];

  const vapid = getSetting<VapidConfig>('vapid')!;

  return {
    currentUser,
    clients,
    products,
    employees,
    contracts,
    handovers,
    payrolls,
    leaveRequests,
    leaveEmployees,
    accountingEntries,
    invoices,
    schedules,
    emailLogs,
    notifications,
    users,
    settings: buildPublicSettings(reqHost),
    vapidPublicKey: vapid.publicKey,
    serverTimestamp: new Date().toISOString(),
  };
}

function upsertClientRecord(client: Client): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO clients (id, name, company_name, email, phone, address, npwp, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       company_name = excluded.company_name,
       email = excluded.email,
       phone = excluded.phone,
       address = excluded.address,
       npwp = excluded.npwp,
       updated_at = excluded.updated_at`
  ).run(
    client.id,
    client.name,
    client.companyName,
    client.email,
    client.phone || '',
    client.address || '',
    client.npwp || '',
    client.createdAt || now,
    client.updatedAt || now
  );
}

function upsertProductRecord(product: Product): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO products (id, sku, name, description, unit, unit_price, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sku = excluded.sku,
       name = excluded.name,
       description = excluded.description,
       unit = excluded.unit,
       unit_price = excluded.unit_price,
       active = excluded.active,
       updated_at = excluded.updated_at`
  ).run(
    product.id,
    product.sku,
    product.name,
    product.description || '',
    product.unit || 'Unit',
    Math.round(product.unitPrice),
    product.active ? 1 : 0,
    product.createdAt || now,
    product.updatedAt || now
  );
}

function upsertEmployeeRecord(emp: Employee): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO employees
     (id, nip, name, email, phone, department, position, employment_type, join_date, base_salary, fixed_allowance, bank_name, bank_account_number, bank_account_name, npwp, bpjs_number, ptkp_status, bpjs_enrolled, annual_leave_quota, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nip = excluded.nip,
       name = excluded.name,
       email = excluded.email,
       phone = excluded.phone,
       department = excluded.department,
       position = excluded.position,
       employment_type = excluded.employment_type,
       join_date = excluded.join_date,
       base_salary = excluded.base_salary,
       fixed_allowance = excluded.fixed_allowance,
       bank_name = excluded.bank_name,
       bank_account_number = excluded.bank_account_number,
       bank_account_name = excluded.bank_account_name,
       npwp = excluded.npwp,
       bpjs_number = excluded.bpjs_number,
       ptkp_status = excluded.ptkp_status,
       bpjs_enrolled = excluded.bpjs_enrolled,
       annual_leave_quota = excluded.annual_leave_quota,
       status = excluded.status,
       updated_at = excluded.updated_at`
  ).run(
    emp.id,
    emp.nip,
    emp.name,
    emp.email,
    emp.phone || '',
    emp.department,
    emp.position,
    emp.employmentType || 'tetap',
    emp.joinDate || now.slice(0, 10),
    Math.round(emp.baseSalary || 0),
    Math.round(emp.fixedAllowance || 0),
    emp.bankName || '',
    emp.bankAccountNumber || '',
    emp.bankAccountName || emp.name,
    emp.npwp || '',
    emp.bpjsNumber || '',
    emp.ptkpStatus || 'TK/0',
    emp.bpjsEnrolled === false ? 0 : 1,
    Math.max(0, Math.round(emp.annualLeaveQuota ?? 12)),
    emp.status || 'active',
    emp.createdAt || now,
    emp.updatedAt || now
  );
}

function upsertLeaveRecord(leave: LeaveRequest, actorUser?: AuthUser): LeaveRequest {
  const now = new Date().toISOString();
  const empRow = db.prepare('SELECT * FROM employees WHERE id = ?').get(leave.employeeId) as
    | Record<string, unknown>
    | undefined;
  const emp = empRow ? mapEmployeeRow(empRow) : null;

  const isHrdOrAdmin = actorUser ? actorUser.role === 'admin' || actorUser.role === 'hrd' : false;
  const effectiveStatus: LeaveRequest['status'] = isHrdOrAdmin
    ? leave.status || 'pending'
    : 'pending';

  const requestNumber =
    leave.requestNumber ||
    `CUTI-${new Date().toISOString().slice(0, 7)}-${String(
      (db.prepare('SELECT COUNT(*) as c FROM leave_requests').get() as { c: number }).c + 1
    ).padStart(3, '0')}`;

  db.prepare(
    `INSERT INTO leave_requests
     (id, request_number, employee_id, employee_nip, employee_name, employee_email, department, position, leave_type, start_date, end_date, total_days, reason, delegate_name, contact_during_leave, status, hrd_notes, reviewed_by, reviewed_at, submitted_by_user_id, submitted_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       request_number = excluded.request_number,
       employee_id = excluded.employee_id,
       employee_nip = excluded.employee_nip,
       employee_name = excluded.employee_name,
       employee_email = excluded.employee_email,
       department = excluded.department,
       position = excluded.position,
       leave_type = excluded.leave_type,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       total_days = excluded.total_days,
       reason = excluded.reason,
       delegate_name = excluded.delegate_name,
       contact_during_leave = excluded.contact_during_leave,
       status = excluded.status,
       hrd_notes = excluded.hrd_notes,
       reviewed_by = excluded.reviewed_by,
       reviewed_at = excluded.reviewed_at,
       updated_at = excluded.updated_at`
  ).run(
    leave.id,
    requestNumber,
    emp?.id || leave.employeeId,
    emp?.nip || leave.employeeNip,
    emp?.name || leave.employeeName,
    emp?.email || leave.employeeEmail,
    emp?.department || leave.department,
    emp?.position || leave.position,
    leave.leaveType || 'tahunan',
    leave.startDate,
    leave.endDate,
    Math.max(1, Math.round(leave.totalDays || 1)),
    leave.reason || '',
    leave.delegateName || '',
    leave.contactDuringLeave || '',
    effectiveStatus,
    isHrdOrAdmin ? leave.hrdNotes || '' : '',
    isHrdOrAdmin ? leave.reviewedBy || null : null,
    isHrdOrAdmin ? leave.reviewedAt || null : null,
    leave.submittedByUserId || actorUser?.id || '',
    leave.submittedByName || actorUser?.name || '',
    leave.createdAt || now,
    leave.updatedAt || now
  );

  return mapLeaveRow(
    db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leave.id) as Record<string, unknown>
  );
}

function generateAccountingNumber(dateStr: string): string {
  const ym = (dateStr || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const countRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM accounting_entries WHERE entry_number LIKE ?')
    .get(`JUR-${ym}-%`) as { cnt: number };
  const seq = String((countRow?.cnt || 0) + 1).padStart(3, '0');
  return `JUR-${ym}-${seq}`;
}

function upsertAccountingRecord(entry: AccountingEntry, actorName?: string): AccountingEntry {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM accounting_entries WHERE id = ?').get(entry.id) as
    | Record<string, unknown>
    | undefined;
  const entryDate = entry.date || now.slice(0, 10);
  const entryNumber =
    entry.entryNumber ||
    (existing?.entry_number ? String(existing.entry_number) : generateAccountingNumber(entryDate));
  const entryType = entry.type === 'income' ? 'income' : 'expense';
  const status = entry.status === 'reconciled' ? 'reconciled' : 'recorded';

  db.prepare(
    `INSERT INTO accounting_entries
     (id, entry_number, date, type, category, account_name, description, counterparty, payment_method, amount, status, source_type, source_id, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       entry_number = excluded.entry_number,
       date = excluded.date,
       type = excluded.type,
       category = excluded.category,
       account_name = excluded.account_name,
       description = excluded.description,
       counterparty = excluded.counterparty,
       payment_method = excluded.payment_method,
       amount = excluded.amount,
       status = excluded.status,
       notes = excluded.notes,
       updated_at = excluded.updated_at`
  ).run(
    entry.id,
    entryNumber,
    entryDate,
    entryType,
    entry.category || (entryType === 'income' ? 'Pendapatan Lain-lain' : 'Beban Lain-lain'),
    entry.accountName || 'Bank Mandiri Operasional',
    entry.description || '',
    entry.counterparty || '',
    entry.paymentMethod || 'Transfer Bank',
    Math.max(0, Math.round(Number(entry.amount || 0))),
    status,
    entry.sourceType || existing?.source_type || 'manual',
    entry.sourceId ?? (existing?.source_id ? String(existing.source_id) : null),
    entry.notes || '',
    entry.createdBy || (existing?.created_by ? String(existing.created_by) : actorName || 'Sistem'),
    entry.createdAt || (existing?.created_at ? String(existing.created_at) : now),
    now
  );

  return mapAccountingRow(
    db.prepare('SELECT * FROM accounting_entries WHERE id = ?').get(entry.id) as Record<
      string,
      unknown
    >
  );
}

function upsertPayrollRecord(pay: PayrollRecord): void {
  const now = new Date().toISOString();
  const grossPay = Math.round(
    (pay.baseSalary || 0) + (pay.allowances || 0) + (pay.overtimePay || 0) + (pay.bonus || 0)
  );
  const totalDeductions = Math.round(
    (pay.pph21Deduction || 0) + (pay.bpjsDeduction || 0) + (pay.otherDeductions || 0)
  );
  const netPay = Math.max(0, grossPay - totalDeductions);

  db.prepare(
    `INSERT INTO payroll_records
     (id, slip_number, period_month, pay_date, employee_id, employee_nip, employee_name, employee_email, department, position, bank_name, bank_account_number, bank_account_name, base_salary, allowances, overtime_pay, bonus, pph21_deduction, bpjs_deduction, other_deductions, gross_pay, total_deductions, net_pay, ptkp_status, ter_category, pph21_rate, pph21_taxable_gross, bpjs_kes_employee, bpjs_jht_employee, bpjs_jp_employee, bpjs_employer_total, tax_calculation_method, status, notes, paid_at, email_sent_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slip_number = excluded.slip_number,
       period_month = excluded.period_month,
       pay_date = excluded.pay_date,
       employee_id = excluded.employee_id,
       employee_nip = excluded.employee_nip,
       employee_name = excluded.employee_name,
       employee_email = excluded.employee_email,
       department = excluded.department,
       position = excluded.position,
       bank_name = excluded.bank_name,
       bank_account_number = excluded.bank_account_number,
       bank_account_name = excluded.bank_account_name,
       base_salary = excluded.base_salary,
       allowances = excluded.allowances,
       overtime_pay = excluded.overtime_pay,
       bonus = excluded.bonus,
       pph21_deduction = excluded.pph21_deduction,
       bpjs_deduction = excluded.bpjs_deduction,
       other_deductions = excluded.other_deductions,
       gross_pay = excluded.gross_pay,
       total_deductions = excluded.total_deductions,
       net_pay = excluded.net_pay,
       ptkp_status = excluded.ptkp_status,
       ter_category = excluded.ter_category,
       pph21_rate = excluded.pph21_rate,
       pph21_taxable_gross = excluded.pph21_taxable_gross,
       bpjs_kes_employee = excluded.bpjs_kes_employee,
       bpjs_jht_employee = excluded.bpjs_jht_employee,
       bpjs_jp_employee = excluded.bpjs_jp_employee,
       bpjs_employer_total = excluded.bpjs_employer_total,
       tax_calculation_method = excluded.tax_calculation_method,
       status = excluded.status,
       notes = excluded.notes,
       paid_at = COALESCE(excluded.paid_at, payroll_records.paid_at),
       email_sent_at = COALESCE(excluded.email_sent_at, payroll_records.email_sent_at),
       updated_at = excluded.updated_at`
  ).run(
    pay.id,
    pay.slipNumber,
    pay.periodMonth,
    pay.payDate,
    pay.employeeId,
    pay.employeeNip,
    pay.employeeName,
    pay.employeeEmail,
    pay.department,
    pay.position,
    pay.bankName || '',
    pay.bankAccountNumber || '',
    pay.bankAccountName || pay.employeeName,
    Math.round(pay.baseSalary || 0),
    Math.round(pay.allowances || 0),
    Math.round(pay.overtimePay || 0),
    Math.round(pay.bonus || 0),
    Math.round(pay.pph21Deduction || 0),
    Math.round(pay.bpjsDeduction || 0),
    Math.round(pay.otherDeductions || 0),
    grossPay,
    totalDeductions,
    netPay,
    pay.ptkpStatus || 'TK/0',
    pay.terCategory || 'A',
    Number(pay.pph21Rate || 0),
    Math.round(pay.pph21TaxableGross || grossPay),
    Math.round(pay.bpjsKesEmployee || 0),
    Math.round(pay.bpjsJhtEmployee || 0),
    Math.round(pay.bpjsJpEmployee || 0),
    Math.round(pay.bpjsEmployerTotal || 0),
    pay.taxCalculationMethod || 'ter_bulanan',
    pay.status || 'draft',
    pay.notes || '',
    pay.paidAt || null,
    pay.emailSentAt || null,
    pay.updatedAt || now
  );
}

function upsertInvoiceRecord(inv: Invoice): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO invoices
     (id, invoice_number, client_id, client_name, client_company, client_email, issue_date, due_date, status, items_json, subtotal, tax_rate, tax_amount, total_amount, notes, midtrans_order_id, midtrans_snap_token, midtrans_payment_url, midtrans_payment_type, midtrans_transaction_status, paid_at, email_sent_at, recurring_schedule_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       invoice_number = excluded.invoice_number,
       client_id = excluded.client_id,
       client_name = excluded.client_name,
       client_company = excluded.client_company,
       client_email = excluded.client_email,
       issue_date = excluded.issue_date,
       due_date = excluded.due_date,
       status = excluded.status,
       items_json = excluded.items_json,
       subtotal = excluded.subtotal,
       tax_rate = excluded.tax_rate,
       tax_amount = excluded.tax_amount,
       total_amount = excluded.total_amount,
       notes = excluded.notes,
       midtrans_order_id = COALESCE(excluded.midtrans_order_id, invoices.midtrans_order_id),
       midtrans_snap_token = COALESCE(excluded.midtrans_snap_token, invoices.midtrans_snap_token),
       midtrans_payment_url = COALESCE(excluded.midtrans_payment_url, invoices.midtrans_payment_url),
       midtrans_payment_type = COALESCE(excluded.midtrans_payment_type, invoices.midtrans_payment_type),
       midtrans_transaction_status = COALESCE(excluded.midtrans_transaction_status, invoices.midtrans_transaction_status),
       paid_at = COALESCE(excluded.paid_at, invoices.paid_at),
       email_sent_at = COALESCE(excluded.email_sent_at, invoices.email_sent_at),
       recurring_schedule_id = excluded.recurring_schedule_id,
       updated_at = excluded.updated_at`
  ).run(
    inv.id,
    inv.invoiceNumber,
    inv.clientId,
    inv.clientName,
    inv.clientCompany,
    inv.clientEmail,
    inv.issueDate,
    inv.dueDate,
    inv.status,
    JSON.stringify(inv.items || []),
    Math.round(inv.subtotal),
    Number(inv.taxRate ?? 11),
    Math.round(inv.taxAmount),
    Math.round(inv.totalAmount),
    inv.notes || '',
    inv.midtransOrderId || `FF-${inv.invoiceNumber}-${crypto.randomInt(1000, 9999)}`,
    inv.midtransSnapToken || null,
    inv.midtransPaymentUrl || null,
    inv.midtransPaymentType || null,
    inv.midtransTransactionStatus || null,
    inv.paidAt || null,
    inv.emailSentAt || null,
    inv.recurringScheduleId || null,
    inv.updatedAt || now
  );
}

function upsertScheduleRecord(sch: RecurringSchedule): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO recurring_schedules
     (id, client_id, client_name, client_company, client_email, title, day_of_month, tax_rate, items_json, auto_send_email, auto_create_midtrans, active, last_run_month, next_run_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       client_id = excluded.client_id,
       client_name = excluded.client_name,
       client_company = excluded.client_company,
       client_email = excluded.client_email,
       title = excluded.title,
       day_of_month = excluded.day_of_month,
       tax_rate = excluded.tax_rate,
       items_json = excluded.items_json,
       auto_send_email = excluded.auto_send_email,
       auto_create_midtrans = excluded.auto_create_midtrans,
       active = excluded.active,
       last_run_month = COALESCE(excluded.last_run_month, recurring_schedules.last_run_month),
       next_run_date = excluded.next_run_date,
       updated_at = excluded.updated_at`
  ).run(
    sch.id,
    sch.clientId,
    sch.clientName,
    sch.clientCompany,
    sch.clientEmail,
    sch.title,
    sch.dayOfMonth,
    sch.taxRate,
    JSON.stringify(sch.items || []),
    sch.autoSendEmail ? 1 : 0,
    sch.autoCreateMidtrans ? 1 : 0,
    sch.active ? 1 : 0,
    sch.lastRunMonth || null,
    sch.nextRunDate,
    sch.updatedAt || now
  );
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  // Purge expired sessions on startup
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

  // --- Health & Authentication ---
  app.get('/api/health', (_req, res) => {
    const dbHealth = verifyDatabaseConnection();
    if (!dbHealth.ok) {
      res.status(503).json({
        ok: false,
        database: {
          ok: false,
          source: dbHealth.source,
          persistent: dbHealth.persistent,
          error: dbHealth.error || 'Database unavailable',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      ok: true,
      database: {
        ok: true,
        journalMode: dbHealth.journalMode,
        source: dbHealth.source,
        persistent: dbHealth.persistent,
      },
      timestamp: new Date().toISOString(),
    });
  });

  const publicInquiryLimiter = new Map<string, number>();

  app.get('/api/public/company-profile', (_req, res) => {
    const rawCompany = getSetting<CompanyInternalConfig>('company');
    const activeProducts = (
      db
        .prepare(
          'SELECT id, name, description, unit, unit_price FROM products WHERE active = 1 ORDER BY name ASC LIMIT 6'
        )
        .all() as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      unit: String(row.unit || 'Unit'),
      unitPrice: Number(row.unit_price || 0),
    }));

    const clientCount = (
      db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number }
    ).count;
    const contractCount = (
      db
        .prepare("SELECT COUNT(*) as count FROM employee_contracts WHERE status = 'active'")
        .get() as { count: number }
    ).count;
    const handoverCount = (
      db
        .prepare("SELECT COUNT(*) as count FROM goods_handovers WHERE status != 'draft'")
        .get() as { count: number }
    ).count;
    const totalProductCount = (
      db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get() as {
        count: number;
      }
    ).count;

    const defaultPillars = [
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

    const defaultCaseStudies = [
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

    res.json({
      ok: true,
      company: {
        name: rawCompany?.name || 'PT Nusantara Digital Karya',
        email: rawCompany?.email || 'finance@nusantarakarya.co.id',
        phone: rawCompany?.phone || '+62 21 5082 4190',
        address:
          rawCompany?.address ||
          'Gedung Treasury Tower Lt. 18, SCBD Lot 28, Jakarta Selatan 12190',
        logoDataUrl: rawCompany?.logoDataUrl || '',
        tagline:
          rawCompany?.tagline ||
          'Solusi Infrastruktur Digital, Sistem Keuangan & Pengadaan Korporasi',
        heroTitle:
          rawCompany?.heroTitle ||
          'Mitra Strategis Infrastruktur Digital & Tata Kelola Bisnis Modern',
        heroSubtitle:
          rawCompany?.heroSubtitle ||
          'Kami merancang sistem cloud, integrasi pembayaran korporasi, serta penyediaan perangkat keras terkelola dengan standar dokumentasi resmi dan akuntabilitas penuh.',
        heroCtaLabel: rawCompany?.heroCtaLabel || 'Masuk Portal Karyawan',
        heroImageDataUrl: rawCompany?.heroImageDataUrl || '',
        aboutDescription:
          rawCompany?.aboutDescription ||
          'Berdiri di kawasan bisnis SCBD Jakarta, kami membantu perusahaan skala menengah hingga enterprise menyatukan infrastruktur teknologi, kepatuhan administrasi, serta siklus penagihan dan serah terima aset dalam satu ekosistem terukur.',
        aboutImageDataUrl: rawCompany?.aboutImageDataUrl || '',
        vision:
          rawCompany?.vision ||
          'Menjadi mitra teknologi dan operasional terpercaya bagi korporasi Indonesia melalui rekayasa sistem yang transparan, aman, dan berkelanjutan.',
        foundedYear: rawCompany?.foundedYear || '2019',
        city: rawCompany?.city || 'Jakarta Selatan',
        portfolioImageDataUrl: rawCompany?.portfolioImageDataUrl || '',
        pillars:
          Array.isArray(rawCompany?.pillars) && rawCompany.pillars.length > 0
            ? rawCompany.pillars
            : defaultPillars,
        caseStudies:
          Array.isArray(rawCompany?.caseStudies) && rawCompany.caseStudies.length > 0
            ? rawCompany.caseStudies
            : defaultCaseStudies,
        showServicesSection: rawCompany?.showServicesSection !== false,
        showPortfolioSection: rawCompany?.showPortfolioSection !== false,
        showVerifySection: rawCompany?.showVerifySection !== false,
        showContactSection: rawCompany?.showContactSection !== false,
        footerNote: rawCompany?.footerNote || 'Portal Internal & Verifikasi Dokumen Resmi',
        whatsappEnabled: rawCompany?.whatsappEnabled !== false,
        whatsappNumber: rawCompany?.whatsappNumber ?? '+62 811 8842 2019',
        whatsappLabel: rawCompany?.whatsappLabel || 'Konsultasi WhatsApp',
        whatsappGreeting:
          rawCompany?.whatsappGreeting ||
          'Halo! Ada yang bisa kami bantu terkait layanan korporasi, penawaran proyek, atau verifikasi dokumen?',
        whatsappDefaultMessage:
          rawCompany?.whatsappDefaultMessage ||
          'Halo tim, saya ingin berkonsultasi mengenai layanan dan penawaran perusahaan.',
      },
      services: activeProducts,
      highlights: {
        activeServicesCount: totalProductCount,
        verifiedClientsCount: clientCount,
        issuedDocumentsCount: contractCount + handoverCount,
      },
    });
  });

  app.post('/api/public/contact', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const lastTs = publicInquiryLimiter.get(clientIp) || 0;
    const nowMs = Date.now();
    if (nowMs - lastTs < 15_000) {
      res.status(429).json({
        ok: false,
        message: 'Mohon tunggu beberapa detik sebelum mengirim pesan konsultasi kembali.',
      });
      return;
    }

    const fullName = String(req.body?.fullName || '').trim().slice(0, 120);
    const companyName = String(req.body?.companyName || '').trim().slice(0, 160);
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 160);
    const phone = String(req.body?.phone || '').trim().slice(0, 40);
    const subject = String(req.body?.subject || 'Permintaan Penawaran & Konsultasi')
      .trim()
      .slice(0, 160);
    const message = String(req.body?.message || '').trim().slice(0, 2000);

    if (fullName.length < 2 || message.length < 10) {
      res.status(400).json({
        ok: false,
        message: 'Nama lengkap (min. 2 karakter) dan rincian kebutuhan (min. 10 karakter) wajib diisi.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        ok: false,
        message: 'Format alamat email kerja tidak valid.',
      });
      return;
    }

    const id = `inq-${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    db.prepare(
      `INSERT INTO contact_inquiries
       (id, full_name, company_name, email, phone, subject, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, fullName, companyName, email, phone, subject, message, 'new', nowIso);

    publicInquiryLimiter.set(clientIp, nowMs);
    if (publicInquiryLimiter.size > 500) {
      publicInquiryLimiter.clear();
    }

    createAndBroadcastNotification({
      invoiceId: '',
      invoiceNumber: companyName || fullName,
      title: `Permintaan Konsultasi Baru: ${fullName}`,
      message: `${companyName ? `${companyName} · ` : ''}${email} — ${subject}`,
      status: 'unread',
      amount: 0,
      channel: 'system',
    });

    res.json({
      ok: true,
      inquiryId: id,
      message:
        'Terima kasih. Permintaan Anda telah tercatat dan tim kami akan menghubungi Anda melalui email atau telepon kerja.',
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const identifier = String(req.body?.identifier || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      res.status(400).json({ ok: false, message: 'Username/email dan kata sandi wajib diisi.' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1')
      .get(identifier, identifier) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash || ''))) {
      res.status(401).json({ ok: false, message: 'Username/email atau kata sandi salah.' });
      return;
    }

    if (!Number(row.active)) {
      res.status(403).json({
        ok: false,
        message: 'Akun ini dinonaktifkan. Hubungi Administrator untuk mengaktifkan kembali.',
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
      token,
      String(row.id),
      expiresAt,
      now.toISOString()
    );
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(
      now.toISOString(),
      now.toISOString(),
      String(row.id)
    );

    const updatedRow = db.prepare('SELECT * FROM users WHERE id = ?').get(String(row.id)) as Record<
      string,
      unknown
    >;
    const user = mapUserRow(updatedRow);

    const isHttps = req.secure || req.get('x-forwarded-proto') === 'https';
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ ok: true, token, user });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getSessionToken(req);
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const session = getSessionUser(req);
    if (!session) {
      res.status(401).json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: session.user });
  });

  // --- Admin User Management CRUD ---
  app.get('/api/users', requireAuth, requireRole('admin'), (_req, res) => {
    const users = (
      db.prepare('SELECT * FROM users ORDER BY role ASC, name ASC').all() as Array<
        Record<string, unknown>
      >
    ).map(mapUserRow);
    res.json({ ok: true, users });
  });

  app.post('/api/users', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
    const body = req.body as Partial<AuthUser> & { password?: string };
    const username = String(body.username || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const role = (VALID_ROLES.includes(body.role as UserRole) ? body.role : 'user') as UserRole;
    const department = String(body.department || 'Umum').trim() || 'Umum';
    const active = body.active !== false;
    const rawPassword = String(body.password || '');

    if (!username || !name || !email) {
      res.status(400).json({ ok: false, message: 'Nama, username, dan email wajib diisi.' });
      return;
    }

    const existingById = body.id
      ? (db.prepare('SELECT * FROM users WHERE id = ?').get(body.id) as
          | Record<string, unknown>
          | undefined)
      : undefined;

    if (!existingById && rawPassword.length < 6) {
      res
        .status(400)
        .json({ ok: false, message: 'Kata sandi minimal 6 karakter untuk pengguna baru.' });
      return;
    }

    const conflict = db
      .prepare(
        'SELECT id FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND id != ? LIMIT 1'
      )
      .get(username, email, body.id || '') as { id: string } | undefined;
    if (conflict) {
      res.status(409).json({ ok: false, message: 'Username atau email sudah digunakan.' });
      return;
    }

    if (existingById && req.user?.id === existingById.id && (!active || role !== 'admin')) {
      res.status(400).json({
        ok: false,
        message: 'Tidak dapat menonaktifkan atau menurunkan hak akses akun yang sedang Anda gunakan.',
      });
      return;
    }

    const now = new Date().toISOString();
    const id = existingById ? String(existingById.id) : `usr-${crypto.randomUUID().slice(0, 8)}`;
    const passwordHash =
      rawPassword.trim().length > 0
        ? hashPassword(rawPassword.trim())
        : String(existingById?.password_hash || '');

    db.prepare(
      `INSERT INTO users (id, username, name, email, password_hash, role, department, active, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         name = excluded.name,
         email = excluded.email,
         password_hash = excluded.password_hash,
         role = excluded.role,
         department = excluded.department,
         active = excluded.active,
         updated_at = excluded.updated_at`
    ).run(
      id,
      username,
      name,
      email,
      passwordHash,
      role,
      department,
      active ? 1 : 0,
      existingById?.last_login_at || null,
      existingById?.created_at || now,
      now
    );

    if (!active) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }

    const saved = mapUserRow(
      db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>
    );
    res.json({ ok: true, user: saved });
  });

  app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
    if (req.user?.id === req.params.id) {
      res.status(400).json({
        ok: false,
        message: 'Tidak dapat menghapus akun yang sedang digunakan untuk login.',
      });
      return;
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!target) {
      res.status(404).json({ ok: false, message: 'Pengguna tidak ditemukan.' });
      return;
    }
    if (String(target.role) === 'admin') {
      const adminCount = db
        .prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND active = 1")
        .get() as { cnt: number };
      if (adminCount.cnt <= 1) {
        res.status(400).json({
          ok: false,
          message: 'Minimal harus terdapat satu Administrator aktif di sistem.',
        });
        return;
      }
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // --- Bootstrap (Scoped by Authenticated User Role) ---
  app.get('/api/bootstrap', requireAuth, (req: AuthedRequest, res) => {
    res.json(getFullBootstrap(req.get('host'), req.user));
  });

  // --- Server-Sent Events (Real-Time Tracking) ---
  app.get('/api/events', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    registerSseClient(res);
  });

  // --- Clients CRUD ---
  app.post('/api/clients', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    const body = req.body as Client;
    const now = new Date().toISOString();
    const client: Client = {
      ...body,
      id: body.id || `cli-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    upsertClientRecord(client);
    res.json({ ok: true, client });
  });

  app.delete('/api/clients/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // --- Products CRUD ---
  app.post('/api/products', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    const body = req.body as Product;
    const now = new Date().toISOString();
    const product: Product = {
      ...body,
      id: body.id || `prd-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    upsertProductRecord(product);
    const saved = mapProductRow(
      db.prepare('SELECT * FROM products WHERE id = ?').get(product.id) as Record<string, unknown>
    );
    res.json({ ok: true, product: saved });
  });

  app.delete('/api/products/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // --- Employees CRUD ---
  app.post('/api/employees', requireAuth, requireRole('admin', 'hrd'), (req, res) => {
    const body = req.body as Employee;
    const now = new Date().toISOString();
    const emp: Employee = {
      ...body,
      id: body.id || `emp-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    upsertEmployeeRecord(emp);
    const saved = mapEmployeeRow(
      db.prepare('SELECT * FROM employees WHERE id = ?').get(emp.id) as Record<string, unknown>
    );
    res.json({ ok: true, employee: saved });
  });

  app.delete('/api/employees/:id', requireAuth, requireRole('admin', 'hrd'), (req, res) => {
    db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // --- Employee Contracts (PKWT & SK Pengangkatan) ---
  const verifyContractCodeHandler = (
    req: express.Request,
    res: express.Response
  ): void => {
    const rawCode = String(
      req.params.code || (typeof req.query.code === 'string' ? req.query.code : '') || ''
    ).trim();
    const verifiedAt = new Date().toISOString();

    if (!rawCode) {
      res.status(400).json({
        ok: false,
        valid: false,
        message: 'Kode verifikasi barcode atau nomor surat wajib diisi.',
        verifiedAt,
      });
      return;
    }

    const row = db
      .prepare(
        `SELECT * FROM employee_contracts
         WHERE UPPER(verification_code) = UPPER(?) OR UPPER(contract_number) = UPPER(?)
         LIMIT 1`
      )
      .get(rawCode, rawCode) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({
        ok: false,
        valid: false,
        message: `Dokumen dengan kode "${rawCode}" tidak ditemukan dalam arsip resmi sistem.`,
        verifiedAt,
      });
      return;
    }

    const contract = mapContractRow(row);
    const expectedHash = computeContractVerificationHash({
      verificationCode: contract.verificationCode,
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      employeeNip: contract.employeeNip,
      employeeName: contract.employeeName,
      department: contract.department,
      position: contract.position,
      startDate: contract.startDate,
      endDate: contract.endDate,
      signedDate: contract.signedDate,
      signerName: contract.signerName,
    });

    const hashMatches = Boolean(contract.verificationHash && contract.verificationHash === expectedHash);
    const isActive = contract.status === 'active';
    const valid = hashMatches && isActive;
    const company = getSetting<CompanyInternalConfig>('company');

    let message = 'Dokumen asli terverifikasi sah dan berstatus aktif berlaku.';
    if (!hashMatches) {
      message = 'Sidik jari integritas dokumen tidak cocok dengan catatan sistem.';
    } else if (contract.status === 'expired') {
      message = 'Dokumen asli terverifikasi, namun masa berlaku kontrak telah berakhir.';
    } else if (contract.status === 'terminated') {
      message = 'Dokumen asli terverifikasi, namun perjanjian telah dihentikan.';
    } else if (contract.status === 'draft') {
      message = 'Dokumen masih berstatus draf dan belum disahkan aktif.';
    }

    res.json({
      ok: true,
      valid,
      message,
      contract: {
        verificationCode: contract.verificationCode,
        verificationHash: contract.verificationHash,
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
        status: contract.status,
        employeeName: contract.employeeName,
        employeeNip: contract.employeeNip,
        department: contract.department,
        position: contract.position,
        workLocation: contract.workLocation,
        startDate: contract.startDate,
        endDate: contract.endDate,
        signedDate: contract.signedDate,
        city: contract.city,
        signerName: contract.signerName,
        signerTitle: contract.signerTitle,
        companyName: company?.name || 'Perusahaan',
        companyEmail: company?.email || '',
      },
      verifiedAt,
    });
  };

  app.get('/api/contracts/verify', verifyContractCodeHandler);
  app.get('/api/contracts/verify/:code', verifyContractCodeHandler);

  app.get('/api/contracts', requireAuth, requireRole('admin', 'manager', 'hrd'), (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM employee_contracts ORDER BY signed_date DESC, updated_at DESC')
      .all() as Array<Record<string, unknown>>;
    res.json({ ok: true, contracts: rows.map(mapContractRow) });
  });

  app.post(
    '/api/contracts',
    requireAuth,
    requireRole('admin', 'hrd'),
    (req: AuthedRequest, res) => {
      const body = req.body as Partial<EmployeeContract> & { syncEmployeeType?: boolean };
      const contractType = body.contractType === 'sk_pengangkatan' ? 'sk_pengangkatan' : 'pkwt';
      const employeeId = String(body.employeeId || '').trim();
      const contractNumber = String(body.contractNumber || '').trim();
      const startDate = String(body.startDate || '').trim();
      const endDate = body.endDate ? String(body.endDate).trim() : null;
      const signedDate = String(body.signedDate || '').trim() || new Date().toISOString().slice(0, 10);

      if (!employeeId || !contractNumber || !startDate) {
        res.status(400).json({
          ok: false,
          message: 'Karyawan, nomor surat, dan tanggal mulai berlaku wajib diisi.',
        });
        return;
      }

      if (contractType === 'pkwt') {
        if (!endDate) {
          res.status(400).json({
            ok: false,
            message: 'Tanggal berakhir kontrak wajib diisi untuk dokumen PKWT.',
          });
          return;
        }
        if (endDate < startDate) {
          res.status(400).json({
            ok: false,
            message: 'Tanggal berakhir kontrak tidak boleh lebih awal dari tanggal mulai.',
          });
          return;
        }
      }

      const empRow = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as
        | Record<string, unknown>
        | undefined;
      if (!empRow) {
        res.status(404).json({ ok: false, message: 'Data karyawan tidak ditemukan.' });
        return;
      }

      const now = new Date().toISOString();
      const id = String(body.id || `ctr-${crypto.randomUUID().slice(0, 8)}`);

      const duplicate = db
        .prepare('SELECT id FROM employee_contracts WHERE LOWER(contract_number) = LOWER(?) AND id != ?')
        .get(contractNumber, id) as { id: string } | undefined;
      if (duplicate) {
        res.status(409).json({
          ok: false,
          message: `Nomor surat "${contractNumber}" sudah terdaftar. Gunakan nomor surat yang berbeda.`,
        });
        return;
      }

      let durationMonths: number | null =
        body.durationMonths !== null && body.durationMonths !== undefined
          ? Math.max(1, Math.round(Number(body.durationMonths)))
          : null;
      if (contractType === 'pkwt' && !durationMonths && endDate) {
        const s = new Date(`${startDate}T00:00:00`);
        const e = new Date(`${endDate}T00:00:00`);
        const diff =
          (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + (e.getDate() >= s.getDate() ? 0 : -1);
        durationMonths = Math.max(1, diff || 1);
      }
      if (contractType === 'sk_pengangkatan') {
        durationMonths = null;
      }

      const status: EmployeeContract['status'] =
        body.status === 'draft' ||
        body.status === 'active' ||
        body.status === 'expired' ||
        body.status === 'terminated'
          ? body.status
          : 'active';

      const probationMonths =
        contractType === 'sk_pengangkatan'
          ? Math.max(0, Math.min(3, Math.round(Number(body.probationMonths || 0))))
          : 0;

      const baseSalary = Math.max(0, Math.round(Number(body.baseSalary ?? empRow.base_salary ?? 0)));
      const fixedAllowance = Math.max(
        0,
        Math.round(Number(body.fixedAllowance ?? empRow.fixed_allowance ?? 0))
      );

      let updatedEmployee: Employee | undefined;

      const existingRow = db
        .prepare('SELECT verification_code FROM employee_contracts WHERE id = ?')
        .get(id) as { verification_code?: string } | undefined;

      const resolvedEmployeeName = String(body.employeeName || empRow.name).trim();
      const resolvedDepartment = String(body.department || empRow.department).trim();
      const resolvedPosition = String(body.position || empRow.position).trim();
      const resolvedSignerName = String(body.signerName || req.user?.name || 'Direktur Utama').trim();
      const resolvedEndDate = contractType === 'pkwt' ? endDate : null;

      const verificationCode =
        existingRow?.verification_code?.trim() ||
        (body.verificationCode ? String(body.verificationCode).trim().toUpperCase() : '') ||
        generateContractVerificationCode(contractType, signedDate);

      const verificationHash = computeContractVerificationHash({
        verificationCode,
        contractNumber,
        contractType,
        employeeNip: String(empRow.nip),
        employeeName: resolvedEmployeeName,
        department: resolvedDepartment,
        position: resolvedPosition,
        startDate,
        endDate: resolvedEndDate,
        signedDate,
        signerName: resolvedSignerName,
      });

      withTransaction(() => {
        db.prepare(
          `INSERT INTO employee_contracts
           (id, contract_number, contract_type, employee_id, employee_nip, employee_name, employee_email, employee_nik, employee_address, department, position, work_location, start_date, end_date, duration_months, probation_months, base_salary, fixed_allowance, working_hours, signer_name, signer_title, signed_date, city, custom_clauses, status, verification_code, verification_hash, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             contract_number = excluded.contract_number,
             contract_type = excluded.contract_type,
             employee_id = excluded.employee_id,
             employee_nip = excluded.employee_nip,
             employee_name = excluded.employee_name,
             employee_email = excluded.employee_email,
             employee_nik = excluded.employee_nik,
             employee_address = excluded.employee_address,
             department = excluded.department,
             position = excluded.position,
             work_location = excluded.work_location,
             start_date = excluded.start_date,
             end_date = excluded.end_date,
             duration_months = excluded.duration_months,
             probation_months = excluded.probation_months,
             base_salary = excluded.base_salary,
             fixed_allowance = excluded.fixed_allowance,
             working_hours = excluded.working_hours,
             signer_name = excluded.signer_name,
             signer_title = excluded.signer_title,
             signed_date = excluded.signed_date,
             city = excluded.city,
             custom_clauses = excluded.custom_clauses,
             status = excluded.status,
             verification_code = excluded.verification_code,
             verification_hash = excluded.verification_hash,
             updated_at = excluded.updated_at`
        ).run(
          id,
          contractNumber,
          contractType,
          employeeId,
          String(empRow.nip),
          resolvedEmployeeName,
          String(body.employeeEmail || empRow.email || '').trim(),
          String(body.employeeNik || '').trim(),
          String(body.employeeAddress || '').trim(),
          resolvedDepartment,
          resolvedPosition,
          String(body.workLocation || 'Kantor Pusat Jakarta').trim(),
          startDate,
          resolvedEndDate,
          durationMonths,
          probationMonths,
          baseSalary,
          fixedAllowance,
          String(body.workingHours || 'Senin – Jumat, 09.00 – 17.00 WIB').trim(),
          resolvedSignerName,
          String(body.signerTitle || 'Direktur Utama').trim(),
          signedDate,
          String(body.city || 'Jakarta').trim(),
          String(body.customClauses || '').trim(),
          status,
          verificationCode,
          verificationHash,
          req.user?.name || 'HRD',
          body.createdAt || now,
          now
        );

        if (body.syncEmployeeType && status === 'active') {
          const nextEmploymentType = contractType === 'sk_pengangkatan' ? 'tetap' : 'kontrak';
          db.prepare(
            `UPDATE employees
             SET employment_type = ?, department = ?, position = ?, base_salary = ?, fixed_allowance = ?, updated_at = ?
             WHERE id = ?`
          ).run(
            nextEmploymentType,
            String(body.department || empRow.department).trim(),
            String(body.position || empRow.position).trim(),
            baseSalary,
            fixedAllowance,
            now,
            employeeId
          );
          const refreshedEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as
            | Record<string, unknown>
            | undefined;
          if (refreshedEmp) {
            updatedEmployee = mapEmployeeRow(refreshedEmp);
          }
        }
      });

      const savedRow = db
        .prepare('SELECT * FROM employee_contracts WHERE id = ?')
        .get(id) as Record<string, unknown>;
      const contract = mapContractRow(savedRow);
      broadcastEvent('contract_updated', { contract, employee: updatedEmployee });
      res.json({ ok: true, contract, employee: updatedEmployee });
    }
  );

  app.delete('/api/contracts/:id', requireAuth, requireRole('admin', 'hrd'), (req, res) => {
    db.prepare('DELETE FROM employee_contracts WHERE id = ?').run(req.params.id);
    broadcastEvent('contract_deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  // --- Bukti Serah Terima Barang (BAST) & Unified Document Barcode Verification ---
  const buildHandoverVerifyPayload = (
    row: Record<string, unknown>,
    verifiedAt: string
  ) => {
    const handover = mapHandoverRow(row);
    const expectedHash = computeHandoverVerificationHash({
      verificationCode: handover.verificationCode,
      handoverNumber: handover.handoverNumber,
      handoverType: handover.handoverType,
      handoverDate: handover.handoverDate,
      senderName: handover.senderName,
      recipientName: handover.recipientName,
      items: handover.items,
    });
    const hashMatches = Boolean(handover.verificationHash && handover.verificationHash === expectedHash);
    const valid = hashMatches && handover.status !== 'draft';
    const company = getSetting<CompanyInternalConfig>('company');

    let message = 'Bukti Serah Terima Barang asli terverifikasi sah dan telah diterima.';
    if (!hashMatches) {
      message = 'Sidik jari integritas dokumen BAST tidak cocok dengan catatan sistem.';
    } else if (handover.status === 'draft') {
      message = 'Dokumen BAST masih berstatus draf dan belum diserahkan resmi.';
    } else if (handover.status === 'handed_over') {
      message = 'Dokumen BAST asli terverifikasi sah dan berstatus sedang diserahkan / dalam pengiriman.';
    }

    return {
      ok: true,
      valid,
      documentCategory: 'handover' as const,
      message,
      handover: {
        verificationCode: handover.verificationCode,
        verificationHash: handover.verificationHash,
        handoverNumber: handover.handoverNumber,
        handoverType: handover.handoverType,
        status: handover.status,
        handoverDate: handover.handoverDate,
        city: handover.city,
        location: handover.location,
        referenceNumber: handover.referenceNumber,
        senderName: handover.senderName,
        senderTitle: handover.senderTitle,
        recipientName: handover.recipientName,
        recipientCompany: handover.recipientCompany,
        recipientIdentity: handover.recipientIdentity,
        itemCount: handover.items.length,
        items: handover.items,
        receivedAt: handover.receivedAt,
        companyName: company?.name || 'Perusahaan',
        companyEmail: company?.email || '',
      },
      verifiedAt,
    };
  };

  const verifyHandoverCodeHandler = (req: express.Request, res: express.Response): void => {
    const rawCode = String(
      req.params.code || (typeof req.query.code === 'string' ? req.query.code : '') || ''
    ).trim();
    const verifiedAt = new Date().toISOString();

    if (!rawCode) {
      res.status(400).json({
        ok: false,
        valid: false,
        message: 'Kode verifikasi barcode atau nomor BAST wajib diisi.',
        verifiedAt,
      });
      return;
    }

    const row = db
      .prepare(
        `SELECT * FROM goods_handovers
         WHERE UPPER(verification_code) = UPPER(?) OR UPPER(handover_number) = UPPER(?)
         LIMIT 1`
      )
      .get(rawCode, rawCode) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({
        ok: false,
        valid: false,
        message: `Bukti Serah Terima Barang dengan kode "${rawCode}" tidak ditemukan dalam arsip resmi sistem.`,
        verifiedAt,
      });
      return;
    }

    res.json(buildHandoverVerifyPayload(row, verifiedAt));
  };

  const verifyAnyDocumentHandler = (req: express.Request, res: express.Response): void => {
    const rawCode = String(
      req.params.code || (typeof req.query.code === 'string' ? req.query.code : '') || ''
    ).trim();
    const verifiedAt = new Date().toISOString();

    if (!rawCode) {
      res.status(400).json({
        ok: false,
        valid: false,
        message: 'Kode verifikasi barcode atau nomor dokumen resmi wajib diisi.',
        verifiedAt,
      });
      return;
    }

    const contractRow = db
      .prepare(
        `SELECT * FROM employee_contracts
         WHERE UPPER(verification_code) = UPPER(?) OR UPPER(contract_number) = UPPER(?)
         LIMIT 1`
      )
      .get(rawCode, rawCode) as Record<string, unknown> | undefined;

    if (contractRow) {
      const contract = mapContractRow(contractRow);
      const expectedHash = computeContractVerificationHash({
        verificationCode: contract.verificationCode,
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
        employeeNip: contract.employeeNip,
        employeeName: contract.employeeName,
        department: contract.department,
        position: contract.position,
        startDate: contract.startDate,
        endDate: contract.endDate,
        signedDate: contract.signedDate,
        signerName: contract.signerName,
      });
      const hashMatches = Boolean(contract.verificationHash && contract.verificationHash === expectedHash);
      const valid = hashMatches && contract.status === 'active';
      const company = getSetting<CompanyInternalConfig>('company');

      let message = 'Dokumen asli terverifikasi sah dan berstatus aktif berlaku.';
      if (!hashMatches) {
        message = 'Sidik jari integritas dokumen tidak cocok dengan catatan sistem.';
      } else if (contract.status === 'expired') {
        message = 'Dokumen asli terverifikasi, namun masa berlaku kontrak telah berakhir.';
      } else if (contract.status === 'terminated') {
        message = 'Dokumen asli terverifikasi, namun perjanjian telah dihentikan.';
      } else if (contract.status === 'draft') {
        message = 'Dokumen masih berstatus draf dan belum disahkan aktif.';
      }

      res.json({
        ok: true,
        valid,
        documentCategory: 'contract',
        message,
        contract: {
          verificationCode: contract.verificationCode,
          verificationHash: contract.verificationHash,
          contractNumber: contract.contractNumber,
          contractType: contract.contractType,
          status: contract.status,
          employeeName: contract.employeeName,
          employeeNip: contract.employeeNip,
          department: contract.department,
          position: contract.position,
          workLocation: contract.workLocation,
          startDate: contract.startDate,
          endDate: contract.endDate,
          signedDate: contract.signedDate,
          city: contract.city,
          signerName: contract.signerName,
          signerTitle: contract.signerTitle,
          companyName: company?.name || 'Perusahaan',
          companyEmail: company?.email || '',
        },
        verifiedAt,
      });
      return;
    }

    const handoverRow = db
      .prepare(
        `SELECT * FROM goods_handovers
         WHERE UPPER(verification_code) = UPPER(?) OR UPPER(handover_number) = UPPER(?)
         LIMIT 1`
      )
      .get(rawCode, rawCode) as Record<string, unknown> | undefined;

    if (handoverRow) {
      res.json(buildHandoverVerifyPayload(handoverRow, verifiedAt));
      return;
    }

    res.status(404).json({
      ok: false,
      valid: false,
      message: `Dokumen dengan kode "${rawCode}" tidak ditemukan dalam arsip resmi sistem.`,
      verifiedAt,
    });
  };

  app.get('/api/handovers/verify', verifyHandoverCodeHandler);
  app.get('/api/handovers/verify/:code', verifyHandoverCodeHandler);
  app.get('/api/documents/verify', verifyAnyDocumentHandler);
  app.get('/api/documents/verify/:code', verifyAnyDocumentHandler);

  app.get('/api/handovers', requireAuth, (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM goods_handovers ORDER BY handover_date DESC, updated_at DESC')
      .all() as Array<Record<string, unknown>>;
    res.json({ ok: true, handovers: rows.map(mapHandoverRow) });
  });

  app.post('/api/handovers', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as Partial<GoodsHandover>;
    const handoverType: GoodsHandover['handoverType'] =
      body.handoverType === 'employee_asset' ? 'employee_asset' : 'client_delivery';
    const handoverNumber = String(body.handoverNumber || '').trim();
    const handoverDate = String(body.handoverDate || '').trim() || new Date().toISOString().slice(0, 10);
    const senderName = String(body.senderName || req.user?.name || '').trim();
    const recipientName = String(body.recipientName || '').trim();

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const normalizedItems: HandoverItem[] = rawItems
      .map((it, idx) => ({
        id: String(it.id || `bi-${crypto.randomUUID().slice(0, 6)}-${idx}`),
        name: String(it.name || '').trim(),
        specification: String(it.specification || '').trim(),
        serialNumber: String(it.serialNumber || '').trim(),
        quantity: Math.max(1, Number(it.quantity || 1)),
        unit: String(it.unit || 'Unit').trim() || 'Unit',
        condition: String(it.condition || 'Baik / Baru').trim() || 'Baik / Baru',
        notes: String(it.notes || '').trim(),
      }))
      .filter((it) => it.name.length > 0);

    if (!handoverNumber || !senderName || !recipientName) {
      res.status(400).json({
        ok: false,
        message: 'Nomor BAST, nama penyerah (Pihak Pertama), dan nama penerima (Pihak Kedua) wajib diisi.',
      });
      return;
    }

    if (normalizedItems.length === 0) {
      res.status(400).json({
        ok: false,
        message: 'Minimal harus terdapat satu baris barang yang diserahterimakan.',
      });
      return;
    }

    const now = new Date().toISOString();
    const id = String(body.id || `bast-${crypto.randomUUID().slice(0, 8)}`);

    const duplicate = db
      .prepare('SELECT id FROM goods_handovers WHERE LOWER(handover_number) = LOWER(?) AND id != ?')
      .get(handoverNumber, id) as { id: string } | undefined;
    if (duplicate) {
      res.status(409).json({
        ok: false,
        message: `Nomor BAST "${handoverNumber}" sudah terdaftar. Gunakan nomor dokumen yang berbeda.`,
      });
      return;
    }

    const existingRow = db
      .prepare('SELECT verification_code, received_at FROM goods_handovers WHERE id = ?')
      .get(id) as { verification_code?: string; received_at?: string | null } | undefined;

    const status: GoodsHandover['status'] =
      body.status === 'draft' || body.status === 'handed_over' || body.status === 'received'
        ? body.status
        : 'handed_over';

    const referenceType: GoodsHandover['referenceType'] =
      body.referenceType === 'invoice' || body.referenceType === 'employee'
        ? body.referenceType
        : 'manual';

    const receivedAt =
      status === 'received'
        ? body.receivedAt || existingRow?.received_at || now
        : null;

    const verificationCode =
      existingRow?.verification_code?.trim() ||
      (body.verificationCode ? String(body.verificationCode).trim().toUpperCase() : '') ||
      generateHandoverVerificationCode(handoverDate);

    const verificationHash = computeHandoverVerificationHash({
      verificationCode,
      handoverNumber,
      handoverType,
      handoverDate,
      senderName,
      recipientName,
      items: normalizedItems,
    });

    db.prepare(
      `INSERT INTO goods_handovers
       (id, handover_number, handover_type, status, handover_date, city, location, reference_type, reference_id, reference_number, sender_name, sender_title, recipient_name, recipient_company, recipient_identity, recipient_phone, recipient_address, items_json, notes, received_at, verification_code, verification_hash, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         handover_number = excluded.handover_number,
         handover_type = excluded.handover_type,
         status = excluded.status,
         handover_date = excluded.handover_date,
         city = excluded.city,
         location = excluded.location,
         reference_type = excluded.reference_type,
         reference_id = excluded.reference_id,
         reference_number = excluded.reference_number,
         sender_name = excluded.sender_name,
         sender_title = excluded.sender_title,
         recipient_name = excluded.recipient_name,
         recipient_company = excluded.recipient_company,
         recipient_identity = excluded.recipient_identity,
         recipient_phone = excluded.recipient_phone,
         recipient_address = excluded.recipient_address,
         items_json = excluded.items_json,
         notes = excluded.notes,
         received_at = excluded.received_at,
         verification_code = excluded.verification_code,
         verification_hash = excluded.verification_hash,
         updated_at = excluded.updated_at`
    ).run(
      id,
      handoverNumber,
      handoverType,
      status,
      handoverDate,
      String(body.city || 'Jakarta').trim() || 'Jakarta',
      String(body.location || '').trim(),
      referenceType,
      body.referenceId ? String(body.referenceId).trim() : null,
      String(body.referenceNumber || '').trim(),
      senderName,
      String(body.senderTitle || 'Operasional & Logistik').trim(),
      recipientName,
      String(body.recipientCompany || '').trim(),
      String(body.recipientIdentity || '').trim(),
      String(body.recipientPhone || '').trim(),
      String(body.recipientAddress || '').trim(),
      JSON.stringify(normalizedItems),
      String(body.notes || '').trim(),
      receivedAt,
      verificationCode,
      verificationHash,
      req.user?.name || 'Sistem',
      body.createdAt || now,
      now
    );

    const saved = mapHandoverRow(
      db.prepare('SELECT * FROM goods_handovers WHERE id = ?').get(id) as Record<string, unknown>
    );
    broadcastEvent('handover_updated', { handover: saved });
    res.json({ ok: true, handover: saved });
  });

  app.post('/api/handovers/:id/mark-received', requireAuth, (req, res) => {
    const existing = db
      .prepare('SELECT * FROM goods_handovers WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ ok: false, message: 'Dokumen BAST tidak ditemukan.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE goods_handovers
       SET status = 'received', received_at = COALESCE(received_at, ?), updated_at = ?
       WHERE id = ?`
    ).run(now, now, req.params.id);

    const updated = mapHandoverRow(
      db.prepare('SELECT * FROM goods_handovers WHERE id = ?').get(req.params.id) as Record<string, unknown>
    );
    broadcastEvent('handover_updated', { handover: updated });
    res.json({ ok: true, handover: updated });
  });

  app.delete(
    '/api/handovers/:id',
    requireAuth,
    requireRole('admin', 'manager', 'hrd'),
    (req, res) => {
      db.prepare('DELETE FROM goods_handovers WHERE id = ?').run(req.params.id);
      broadcastEvent('handover_deleted', { id: req.params.id });
      res.json({ ok: true });
    }
  );

  // --- Employee Leave Requests & HRD Approval Workflow ---
  app.post(
    '/api/leaves',
    requireAuth,
    requireRole('admin', 'manager', 'hrd', 'user'),
    (req: AuthedRequest, res) => {
      const body = req.body as LeaveRequest;
      if (!body.employeeId || !body.startDate || !body.endDate) {
        res.status(400).json({
          ok: false,
          message: 'Karyawan, tanggal mulai, dan tanggal selesai cuti wajib diisi.',
        });
        return;
      }

      const empRow = db.prepare('SELECT * FROM employees WHERE id = ?').get(body.employeeId) as
        | Record<string, unknown>
        | undefined;
      if (!empRow) {
        res.status(404).json({
          ok: false,
          message: 'Data karyawan tidak ditemukan. Pilih karyawan yang terdaftar.',
        });
        return;
      }

      const existing = body.id
        ? (db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(body.id) as
            | Record<string, unknown>
            | undefined)
        : undefined;

      if (
        existing &&
        req.user!.role !== 'admin' &&
        req.user!.role !== 'hrd' &&
        String(existing.submitted_by_user_id) !== req.user!.id
      ) {
        res.status(403).json({
          ok: false,
          message: 'Anda hanya dapat mengubah pengajuan cuti yang Anda kirimkan.',
        });
        return;
      }

      const now = new Date().toISOString();
      const leaveInput: LeaveRequest = {
        ...body,
        id: body.id || `lv-${crypto.randomUUID().slice(0, 8)}`,
        submittedByUserId: String(existing?.submitted_by_user_id || req.user!.id),
        submittedByName: String(existing?.submitted_by_name || req.user!.name),
        createdAt: String(existing?.created_at || body.createdAt || now),
        updatedAt: now,
      };

      const saved = upsertLeaveRecord(leaveInput, req.user);
      broadcastEvent(existing ? 'leave:updated' : 'leave:created', saved);

      if (!existing && saved.status === 'pending') {
        createAndBroadcastNotification({
          invoiceId: saved.id,
          invoiceNumber: saved.requestNumber,
          title: `Pengajuan Cuti Baru: ${saved.employeeName}`,
          message: `${saved.requestNumber} (${saved.totalDays} hari kerja, ${saved.startDate} s.d. ${saved.endDate}) menunggu persetujuan HRD.`,
          status: 'pending',
          amount: 0,
          channel: 'system',
        });
      }

      res.json({ ok: true, leave: saved });
    }
  );

  app.post(
    '/api/leaves/:id/decision',
    requireAuth,
    requireRole('admin', 'hrd'),
    (req: AuthedRequest, res) => {
      const existing = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id) as
        | Record<string, unknown>
        | undefined;
      if (!existing) {
        res.status(404).json({ ok: false, message: 'Pengajuan cuti tidak ditemukan.' });
        return;
      }

      const decision = req.body?.decision === 'approved' ? 'approved' : req.body?.decision === 'rejected' ? 'rejected' : null;
      if (!decision) {
        res.status(400).json({ ok: false, message: 'Keputusan HRD harus berupa approved atau rejected.' });
        return;
      }

      const hrdNotes = String(req.body?.hrdNotes || '').trim();
      const now = new Date().toISOString();

      db.prepare(
        `UPDATE leave_requests
         SET status = ?, hrd_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(decision, hrdNotes, req.user!.name, now, now, req.params.id);

      const saved = mapLeaveRow(
        db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id) as Record<
          string,
          unknown
        >
      );

      broadcastEvent('leave:updated', saved);
      createAndBroadcastNotification({
        invoiceId: saved.id,
        invoiceNumber: saved.requestNumber,
        title:
          decision === 'approved'
            ? `Cuti Disetujui HRD: ${saved.employeeName}`
            : `Cuti Ditolak HRD: ${saved.employeeName}`,
        message: `${saved.requestNumber} (${saved.startDate} s.d. ${saved.endDate}) ${
          decision === 'approved' ? 'disetujui' : 'ditolak'
        } oleh ${req.user!.name}.${hrdNotes ? ` Catatan: ${hrdNotes}` : ''}`,
        status: decision === 'approved' ? 'paid' : 'overdue',
        amount: 0,
        channel: 'system',
      });

      res.json({ ok: true, leave: saved });
    }
  );

  app.post('/api/leaves/:id/cancel', requireAuth, (req: AuthedRequest, res) => {
    const existing = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ ok: false, message: 'Pengajuan cuti tidak ditemukan.' });
      return;
    }

    const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'hrd';
    const isOwner =
      String(existing.submitted_by_user_id) === req.user!.id ||
      String(existing.employee_email).toLowerCase() === req.user!.email.toLowerCase();
    if (!isPrivileged && !isOwner) {
      res.status(403).json({
        ok: false,
        message: 'Anda tidak memiliki izin membatalkan pengajuan cuti ini.',
      });
      return;
    }

    if (String(existing.status) !== 'pending') {
      res.status(400).json({
        ok: false,
        message: 'Hanya pengajuan berstatus menunggu yang dapat dibatalkan.',
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE leave_requests SET status = 'cancelled', updated_at = ? WHERE id = ?"
    ).run(now, req.params.id);

    const saved = mapLeaveRow(
      db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id) as Record<
        string,
        unknown
      >
    );
    broadcastEvent('leave:updated', saved);
    res.json({ ok: true, leave: saved });
  });

  app.delete('/api/leaves/:id', requireAuth, requireRole('admin', 'hrd'), (req, res) => {
    db.prepare('DELETE FROM leave_requests WHERE id = ?').run(req.params.id);
    broadcastEvent('leave:deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  // --- Simple Office Accounting (Buku Kas & Laba Rugi) ---
  app.get('/api/accounting', requireAuth, requireRole('admin', 'manager'), (_req, res) => {
    const entries = (
      db
        .prepare('SELECT * FROM accounting_entries ORDER BY date DESC, created_at DESC')
        .all() as Array<Record<string, unknown>>
    ).map(mapAccountingRow);
    res.json({ ok: true, entries });
  });

  app.post('/api/accounting', requireAuth, requireRole('admin', 'manager'), (req: AuthedRequest, res) => {
    const body = req.body as Partial<AccountingEntry>;
    if (!body.description?.trim() || !body.date || !body.amount || Number(body.amount) <= 0) {
      res.status(400).json({
        ok: false,
        message: 'Tanggal, uraian transaksi, dan nominal lebih dari Rp 0 wajib diisi.',
      });
      return;
    }

    const existing = body.id
      ? db.prepare('SELECT id FROM accounting_entries WHERE id = ?').get(body.id)
      : undefined;

    const now = new Date().toISOString();
    const entryInput: AccountingEntry = {
      id: body.id || `acc-${crypto.randomUUID().slice(0, 8)}`,
      entryNumber: body.entryNumber || '',
      date: body.date,
      type: body.type === 'income' ? 'income' : 'expense',
      category: body.category || 'Beban Lain-lain',
      accountName: body.accountName || 'Bank Mandiri Operasional',
      description: body.description.trim(),
      counterparty: String(body.counterparty || '').trim(),
      paymentMethod: body.paymentMethod || 'Transfer Bank',
      amount: Math.round(Number(body.amount)),
      status: body.status === 'reconciled' ? 'reconciled' : 'recorded',
      sourceType: body.sourceType || 'manual',
      sourceId: body.sourceId || null,
      notes: String(body.notes || '').trim(),
      createdBy: body.createdBy || req.user!.name,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const saved = upsertAccountingRecord(entryInput, req.user!.name);
    broadcastEvent(existing ? 'accounting:updated' : 'accounting:created', saved);
    res.json({ ok: true, entry: saved });
  });

  app.post(
    '/api/accounting/:id/reconcile',
    requireAuth,
    requireRole('admin', 'manager'),
    (req, res) => {
      const existing = db
        .prepare('SELECT * FROM accounting_entries WHERE id = ?')
        .get(req.params.id) as Record<string, unknown> | undefined;
      if (!existing) {
        res.status(404).json({ ok: false, message: 'Catatan akuntansi tidak ditemukan.' });
        return;
      }
      const nextStatus = existing.status === 'reconciled' ? 'recorded' : 'reconciled';
      const now = new Date().toISOString();
      db.prepare('UPDATE accounting_entries SET status = ?, updated_at = ? WHERE id = ?').run(
        nextStatus,
        now,
        req.params.id
      );
      const saved = mapAccountingRow(
        db.prepare('SELECT * FROM accounting_entries WHERE id = ?').get(req.params.id) as Record<
          string,
          unknown
        >
      );
      broadcastEvent('accounting:updated', saved);
      res.json({ ok: true, entry: saved });
    }
  );

  app.post(
    '/api/accounting/sync-operations',
    requireAuth,
    requireRole('admin', 'manager'),
    (req: AuthedRequest, res) => {
      const paidInvoices = db
        .prepare("SELECT * FROM invoices WHERE status = 'paid'")
        .all() as Array<Record<string, unknown>>;
      const paidPayrolls = db
        .prepare("SELECT * FROM payroll_records WHERE status = 'paid'")
        .all() as Array<Record<string, unknown>>;

      const existingRefs = new Set(
        (
          db
            .prepare("SELECT source_type, source_id FROM accounting_entries WHERE source_id IS NOT NULL")
            .all() as Array<{ source_type: string; source_id: string }>
        ).map((r) => `${r.source_type}:${r.source_id}`)
      );

      let createdCount = 0;
      let skippedCount = 0;
      const createdEntries: AccountingEntry[] = [];
      const now = new Date().toISOString();

      for (const invRow of paidInvoices) {
        const inv = mapInvoiceRow(invRow);
        if (existingRefs.has(`invoice:${inv.id}`)) {
          skippedCount += 1;
          continue;
        }
        const txDate = (inv.paidAt || inv.issueDate || now).slice(0, 10);
        const saved = upsertAccountingRecord(
          {
            id: `acc-${crypto.randomUUID().slice(0, 8)}`,
            entryNumber: '',
            date: txDate,
            type: 'income',
            category: 'Penjualan & Tagihan Klien',
            accountName: inv.midtransOrderId ? 'Bank BCA / Midtrans' : 'Bank Mandiri Operasional',
            description: `Pelunasan Faktur ${inv.invoiceNumber}`,
            counterparty: inv.clientCompany,
            paymentMethod: inv.midtransPaymentType ? `Midtrans (${inv.midtransPaymentType})` : 'Transfer Bank',
            amount: inv.totalAmount,
            status: 'reconciled',
            sourceType: 'invoice',
            sourceId: inv.id,
            notes: `Disinkronkan otomatis dari faktur lunas ${inv.invoiceNumber}.`,
            createdBy: req.user!.name,
            createdAt: now,
            updatedAt: now,
          },
          req.user!.name
        );
        existingRefs.add(`invoice:${inv.id}`);
        createdEntries.push(saved);
        broadcastEvent('accounting:created', saved);
        createdCount += 1;
      }

      for (const payRow of paidPayrolls) {
        const pay = mapPayrollRow(payRow);
        if (existingRefs.has(`payroll:${pay.id}`)) {
          skippedCount += 1;
          continue;
        }
        const txDate = (pay.paidAt || pay.payDate || now).slice(0, 10);
        const saved = upsertAccountingRecord(
          {
            id: `acc-${crypto.randomUUID().slice(0, 8)}`,
            entryNumber: '',
            date: txDate,
            type: 'expense',
            category: 'Gaji & Tunjangan Karyawan',
            accountName: 'Bank Mandiri Operasional',
            description: `Pembayaran Gaji ${pay.slipNumber} (${pay.periodMonth})`,
            counterparty: `${pay.employeeName} (${pay.department})`,
            paymentMethod: 'Transfer Bank',
            amount: pay.netPay,
            status: 'reconciled',
            sourceType: 'payroll',
            sourceId: pay.id,
            notes: `Disinkronkan otomatis dari slip gaji ${pay.slipNumber}.`,
            createdBy: req.user!.name,
            createdAt: now,
            updatedAt: now,
          },
          req.user!.name
        );
        existingRefs.add(`payroll:${pay.id}`);
        createdEntries.push(saved);
        broadcastEvent('accounting:created', saved);
        createdCount += 1;
      }

      const allEntries = (
        db
          .prepare('SELECT * FROM accounting_entries ORDER BY date DESC, created_at DESC')
          .all() as Array<Record<string, unknown>>
      ).map(mapAccountingRow);

      res.json({
        ok: true,
        createdCount,
        skippedCount,
        createdEntries,
        entries: allEntries,
        message:
          createdCount > 0
            ? `${createdCount} transaksi dari Faktur Lunas & Payroll berhasil dibukukan ke jurnal kas.`
            : 'Seluruh faktur lunas dan slip gaji terbayar sudah tercatat di buku kas.',
      });
    }
  );

  app.delete('/api/accounting/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    db.prepare('DELETE FROM accounting_entries WHERE id = ?').run(req.params.id);
    broadcastEvent('accounting:deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  // --- Payroll Records CRUD, Batch Generation, Payment & Email ---
  app.post('/api/payrolls', requireAuth, requireRole('admin', 'manager', 'hrd'), (req, res) => {
    const body = req.body as PayrollRecord;
    const now = new Date().toISOString();
    const pay: PayrollRecord = {
      ...body,
      id: body.id || `pay-${crypto.randomUUID().slice(0, 8)}`,
      updatedAt: now,
    };
    upsertPayrollRecord(pay);
    const saved = mapPayrollRow(
      db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(pay.id) as Record<
        string,
        unknown
      >
    );
    broadcastEvent('payroll:updated', saved);
    res.json({ ok: true, payroll: saved });
  });

  app.delete('/api/payrolls/:id', requireAuth, requireRole('admin', 'hrd'), (req, res) => {
    db.prepare('DELETE FROM payroll_records WHERE id = ?').run(req.params.id);
    broadcastEvent('payroll:deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  app.post(
    '/api/payrolls/generate-monthly',
    requireAuth,
    requireRole('admin', 'manager', 'hrd'),
    (req, res) => {
      const now = new Date();
      const periodMonth = String(req.body?.periodMonth || now.toISOString().slice(0, 7));
      const payDate = String(req.body?.payDate || `${periodMonth}-25`);
      const result = generateMonthlyPayrollForPeriod({ periodMonth, payDate });
      res.json({
        ok: true,
        ...result,
        message:
          result.createdCount > 0
            ? `${result.createdCount} slip gaji periode ${periodMonth} berhasil digenerate (${result.skippedCount} sudah ada).`
            : `Seluruh karyawan aktif sudah memiliki slip gaji untuk periode ${periodMonth}.`,
      });
    }
  );

  app.post(
    '/api/payrolls/:id/mark-paid',
    requireAuth,
    requireRole('admin', 'manager', 'hrd'),
    (req, res) => {
      const existing = db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(req.params.id) as
        | Record<string, unknown>
        | undefined;
      if (!existing) {
        res.status(404).json({ ok: false, message: 'Slip gaji tidak ditemukan.' });
        return;
      }
      const now = new Date().toISOString();
      db.prepare(
        "UPDATE payroll_records SET status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE id = ?"
      ).run(now, now, req.params.id);

      const saved = mapPayrollRow(
        db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(req.params.id) as Record<
          string,
          unknown
        >
      );
      broadcastEvent('payroll:updated', saved);
      createAndBroadcastNotification({
        invoiceId: saved.id,
        invoiceNumber: saved.slipNumber,
        title: `Gaji Dibayarkan: ${saved.employeeName}`,
        message: `Slip ${saved.slipNumber} (${saved.periodMonth}) telah ditandai dibayar ke ${saved.bankName || 'rekening karyawan'}.`,
        status: 'paid',
        amount: saved.netPay,
        channel: 'system',
      });

      res.json({ ok: true, payroll: saved });
    }
  );

  app.post(
    '/api/payrolls/:id/send-email',
    requireAuth,
    requireRole('admin', 'manager', 'hrd'),
    async (req, res) => {
      try {
        const result = await sendPayslipEmail(req.params.id);
        res.json(result);
      } catch (err) {
        res.status(404).json({
          ok: false,
          message: err instanceof Error ? err.message : 'Gagal mengirim slip gaji.',
        });
      }
    }
  );

  // --- Invoices CRUD & Email Dispatch ---
  app.post('/api/invoices', requireAuth, requireRole('admin', 'manager', 'user'), (req, res) => {
    const body = req.body as Invoice;
    const now = new Date().toISOString();
    const invoice: Invoice = {
      ...body,
      id: body.id || `inv-${crypto.randomUUID().slice(0, 8)}`,
      updatedAt: now,
    };
    upsertInvoiceRecord(invoice);
    const saved = mapInvoiceRow(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id) as Record<string, unknown>
    );
    broadcastEvent('invoice:created', saved);
    res.json({ ok: true, invoice: saved });
  });

  app.put('/api/invoices/:id', requireAuth, requireRole('admin', 'manager', 'user'), (req, res) => {
    const body = req.body as Invoice;
    const now = new Date().toISOString();
    upsertInvoiceRecord({ ...body, id: req.params.id, updatedAt: now });
    const saved = mapInvoiceRow(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as Record<
        string,
        unknown
      >
    );
    broadcastEvent('invoice:updated', saved);
    res.json({ ok: true, invoice: saved });
  });

  app.delete('/api/invoices/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    broadcastEvent('invoice:deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  app.post(
    '/api/invoices/:id/send-email',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req, res) => {
      try {
        const result = await sendInvoiceEmail(req.params.id);
        res.json(result);
      } catch (err) {
        res.status(404).json({
          ok: false,
          message: err instanceof Error ? err.message : 'Gagal mengirim faktur.',
        });
      }
    }
  );

  // --- Recurring Monthly Schedules ---
  app.post('/api/schedules', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    const body = req.body as RecurringSchedule;
    const now = new Date().toISOString();
    const sch: RecurringSchedule = {
      ...body,
      id: body.id || `sch-${crypto.randomUUID().slice(0, 8)}`,
      updatedAt: now,
    };
    upsertScheduleRecord(sch);
    res.json({ ok: true, schedule: sch });
  });

  app.delete('/api/schedules/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
    db.prepare('DELETE FROM recurring_schedules WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post(
    '/api/schedules/run-monthly',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req, res) => {
      const forceAllActive = Boolean(req.body?.forceAllActive ?? true);
      const result = await runMonthlyBillingJob({ forceAllActive });
      res.json({
        ok: true,
        ...result,
        message:
          result.processedCount > 0
            ? `${result.processedCount} faktur bulanan berhasil diterbitkan dan diproses pengirimannya.`
            : 'Tidak ada jadwal aktif yang perlu diproses saat ini.',
      });
    }
  );

  // --- Midtrans API Endpoints ---
  app.post(
    '/api/midtrans/create-transaction/:invoiceId',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req, res) => {
      const result = await createMidtransSnapForInvoice(req.params.invoiceId);
      res.status(result.ok ? 200 : 400).json(result);
    }
  );

  app.get(
    '/api/midtrans/status/:invoiceId',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req, res) => {
      const result = await pollMidtransInvoiceStatus(req.params.invoiceId);
      res.json(result);
    }
  );

  app.post('/api/midtrans/test', requireAuth, requireRole('admin'), async (req, res) => {
    const existing = getSetting<MidtransInternalConfig>('midtrans')!;
    const incoming = req.body as Partial<MidtransInternalConfig>;
    const testCfg: MidtransInternalConfig = {
      ...existing,
      environment: incoming.environment || existing.environment,
      merchantId: incoming.merchantId ?? existing.merchantId,
      clientKey: incoming.clientKey ?? existing.clientKey,
      serverKey: incoming.serverKey ? incoming.serverKey : existing.serverKey,
    };
    const result = await testMidtransCredentials(testCfg);
    res.json(result);
  });

  // Official Midtrans HTTP Webhook Receiver (Public with mandatory SHA-512 signature check)
  app.post('/api/midtrans/webhook', (req, res) => {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      payment_type,
      fraud_status,
    } = req.body as Record<string, string>;

    const midtrans = getSetting<MidtransInternalConfig>('midtrans');
    if (!midtrans?.serverKey) {
      res.status(503).json({
        ok: false,
        message: 'Midtrans Server Key belum dikonfigurasi pada server.',
      });
      return;
    }

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      res.status(400).json({
        ok: false,
        message: 'Payload webhook Midtrans tidak lengkap.',
      });
      return;
    }

    const valid = verifyMidtransSignature({
      orderId: String(order_id),
      statusCode: String(status_code),
      grossAmount: String(gross_amount),
      signatureKey: String(signature_key),
      serverKey: midtrans.serverKey,
    });
    if (!valid) {
      res.status(403).json({ ok: false, message: 'Invalid Midtrans signature key.' });
      return;
    }

    const updated = applyMidtransPaymentStatus({
      orderId: order_id,
      transactionStatus: transaction_status || 'pending',
      paymentType: payment_type,
      fraudStatus: fraud_status,
      source: 'webhook',
    });

    if (!updated) {
      res.status(404).json({ ok: false, message: 'Order ID tidak ditemukan.' });
      return;
    }

    res.json({ ok: true, invoice: updated });
  });

  // --- Settings Configuration (Admin Only) ---
  app.put('/api/settings/midtrans', requireAuth, requireRole('admin'), (req, res) => {
    const existing = getSetting<MidtransInternalConfig>('midtrans')!;
    const body = req.body as Partial<MidtransInternalConfig>;
    const updated: MidtransInternalConfig = {
      environment: body.environment === 'production' ? 'production' : 'sandbox',
      merchantId: body.merchantId ?? existing.merchantId,
      clientKey: body.clientKey ?? existing.clientKey,
      serverKey: body.serverKey && body.serverKey.trim() ? body.serverKey.trim() : existing.serverKey,
      enabledPayments: Array.isArray(body.enabledPayments)
        ? body.enabledPayments
        : existing.enabledPayments,
      autoCreatePaymentLink:
        typeof body.autoCreatePaymentLink === 'boolean'
          ? body.autoCreatePaymentLink
          : existing.autoCreatePaymentLink,
    };
    setSetting('midtrans', updated);
    res.json({ ok: true, settings: buildPublicSettings(req.get('host')) });
  });

  app.put('/api/settings/smtp', requireAuth, requireRole('admin'), (req, res) => {
    const existing = getSetting<SmtpInternalConfig>('smtp')!;
    const body = req.body as Partial<SmtpInternalConfig>;
    const updated: SmtpInternalConfig = {
      host: body.host ?? existing.host,
      port: Number(body.port ?? existing.port),
      secure: typeof body.secure === 'boolean' ? body.secure : existing.secure,
      username: body.username ?? existing.username,
      password: body.password && body.password.trim() ? body.password.trim() : existing.password,
      fromName: body.fromName ?? existing.fromName,
      fromEmail: body.fromEmail ?? existing.fromEmail,
      autoMonthlyEnabled:
        typeof body.autoMonthlyEnabled === 'boolean'
          ? body.autoMonthlyEnabled
          : existing.autoMonthlyEnabled,
    };
    setSetting('smtp', updated);
    res.json({ ok: true, settings: buildPublicSettings(req.get('host')) });
  });

  app.post('/api/smtp/test', requireAuth, requireRole('admin'), async (req, res) => {
    const existing = getSetting<SmtpInternalConfig>('smtp')!;
    const body = req.body as Partial<SmtpInternalConfig>;
    const host = body.host ?? existing.host;
    const port = Number(body.port ?? existing.port);
    const secure = typeof body.secure === 'boolean' ? body.secure : existing.secure;
    const user = body.username ?? existing.username;
    const pass = body.password && body.password.trim() ? body.password.trim() : existing.password;

    if (!host || !user || !pass) {
      res.json({
        ok: false,
        message: 'Host, Username, dan Password SMTP wajib diisi untuk menguji koneksi.',
      });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      await transporter.verify();
      res.json({ ok: true, message: `Koneksi SMTP ke ${host}:${port} berhasil diverifikasi.` });
    } catch (err) {
      res.json({
        ok: false,
        message: `Verifikasi SMTP gagal: ${err instanceof Error ? err.message : 'Error'}`,
      });
    }
  });

  app.put('/api/settings/company', requireAuth, requireRole('admin'), (req, res) => {
    const existing = getSetting<CompanyInternalConfig>('company')!;
    const body = req.body as Partial<CompanyInternalConfig>;
    const pickText = (val: unknown, fallback: string, maxLen = 500) =>
      typeof val === 'string' ? val.trim().slice(0, maxLen) : fallback;
    const pickImage = (val: unknown, fallback: string, maxLen = 700_000) => {
      if (typeof val !== 'string') return fallback;
      const trimmed = val.trim();
      if (trimmed === '') return '';
      if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
        return trimmed.slice(0, maxLen);
      }
      return fallback;
    };

    const sanitizedPillars = Array.isArray(body.pillars)
      ? body.pillars
          .slice(0, 6)
          .map((p) => ({
            title: String(p?.title || '').trim().slice(0, 140),
            description: String(p?.description || '').trim().slice(0, 500),
          }))
          .filter((p) => p.title.length > 0)
      : existing.pillars || [];

    const sanitizedCaseStudies = Array.isArray(body.caseStudies)
      ? body.caseStudies
          .slice(0, 6)
          .map((cs) => ({
            sector: String(cs?.sector || '').trim().slice(0, 100),
            title: String(cs?.title || '').trim().slice(0, 160),
            metric: String(cs?.metric || '').trim().slice(0, 120),
            detail: String(cs?.detail || '').trim().slice(0, 500),
          }))
          .filter((cs) => cs.title.length > 0)
      : existing.caseStudies || [];

    const updated: CompanyInternalConfig = {
      name: pickText(body.name, existing.name, 160) || existing.name,
      email: pickText(body.email, existing.email, 160),
      phone: pickText(body.phone, existing.phone, 60),
      address: pickText(body.address, existing.address, 300),
      npwp: pickText(body.npwp, existing.npwp, 60),
      bankName: pickText(body.bankName, existing.bankName, 120),
      bankAccountNumber: pickText(body.bankAccountNumber, existing.bankAccountNumber, 80),
      bankAccountName: pickText(body.bankAccountName, existing.bankAccountName, 160),
      logoDataUrl: pickImage(body.logoDataUrl, existing.logoDataUrl || '', 512_000),
      tagline: pickText(body.tagline, existing.tagline || '', 240),
      heroTitle: pickText(body.heroTitle, existing.heroTitle || '', 240),
      heroSubtitle: pickText(body.heroSubtitle, existing.heroSubtitle || '', 600),
      heroCtaLabel: pickText(body.heroCtaLabel, existing.heroCtaLabel || 'Masuk Portal Karyawan', 60),
      heroImageDataUrl: pickImage(body.heroImageDataUrl, existing.heroImageDataUrl || ''),
      aboutDescription: pickText(body.aboutDescription, existing.aboutDescription || '', 1200),
      aboutImageDataUrl: pickImage(body.aboutImageDataUrl, existing.aboutImageDataUrl || ''),
      vision: pickText(body.vision, existing.vision || '', 600),
      foundedYear: pickText(body.foundedYear, existing.foundedYear || '2019', 16),
      city: pickText(body.city, existing.city || 'Jakarta Selatan', 100),
      portfolioImageDataUrl: pickImage(
        body.portfolioImageDataUrl,
        existing.portfolioImageDataUrl || ''
      ),
      pillars: sanitizedPillars,
      caseStudies: sanitizedCaseStudies,
      showServicesSection:
        typeof body.showServicesSection === 'boolean'
          ? body.showServicesSection
          : existing.showServicesSection !== false,
      showPortfolioSection:
        typeof body.showPortfolioSection === 'boolean'
          ? body.showPortfolioSection
          : existing.showPortfolioSection !== false,
      showVerifySection:
        typeof body.showVerifySection === 'boolean'
          ? body.showVerifySection
          : existing.showVerifySection !== false,
      showContactSection:
        typeof body.showContactSection === 'boolean'
          ? body.showContactSection
          : existing.showContactSection !== false,
      footerNote: pickText(
        body.footerNote,
        existing.footerNote || 'Portal Internal & Verifikasi Dokumen Resmi',
        160
      ),
      whatsappEnabled:
        typeof body.whatsappEnabled === 'boolean'
          ? body.whatsappEnabled
          : existing.whatsappEnabled !== false,
      whatsappNumber: pickText(
        body.whatsappNumber,
        existing.whatsappNumber ?? '+62 811 8842 2019',
        40
      ),
      whatsappLabel: pickText(
        body.whatsappLabel,
        existing.whatsappLabel || 'Konsultasi WhatsApp',
        80
      ),
      whatsappGreeting: pickText(
        body.whatsappGreeting,
        existing.whatsappGreeting ||
          'Halo! Ada yang bisa kami bantu terkait layanan korporasi, penawaran proyek, atau verifikasi dokumen?',
        500
      ),
      whatsappDefaultMessage: pickText(
        body.whatsappDefaultMessage,
        existing.whatsappDefaultMessage ||
          'Halo tim, saya ingin berkonsultasi mengenai layanan dan penawaran perusahaan.',
        400
      ),
    };

    setSetting('company', updated);
    res.json({ ok: true, settings: buildPublicSettings(req.get('host')) });
  });

  // --- Web Push Subscriptions & Notifications ---
  app.get('/api/push/vapid-public-key', requireAuth, (_req, res) => {
    const vapid = getSetting<VapidConfig>('vapid')!;
    res.json({ publicKey: vapid.publicKey });
  });

  app.post('/api/push/subscribe', requireAuth, (req, res) => {
    const sub = req.body as { endpoint?: string; keys?: Record<string, string> };
    if (!sub?.endpoint || !sub?.keys) {
      res.status(400).json({ ok: false, message: 'Subscription object tidak valid.' });
      return;
    }
    db.prepare(
      `INSERT INTO push_subscriptions (endpoint, keys_json, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET keys_json = excluded.keys_json`
    ).run(sub.endpoint, JSON.stringify(sub.keys), new Date().toISOString());

    res.json({ ok: true });
  });

  app.post('/api/push/test', requireAuth, requireRole('admin'), async (_req, res) => {
    const notif = createAndBroadcastNotification({
      invoiceId: '',
      invoiceNumber: 'SYSTEM',
      title: 'Uji Notifikasi Push FakturaFlow',
      message:
        'Pelacakan pembayaran real-time aktif. Anda akan menerima notifikasi instan setiap kali webhook Midtrans masuk.',
      status: 'pending',
      amount: 0,
      channel: 'system',
    });
    const pushStats = await dispatchPushNotification({
      title: notif.title,
      body: notif.message,
      tag: 'fakturaflow-test',
    });
    res.json({ ok: true, notification: notif, pushStats });
  });

  app.post('/api/notifications/mark-read', requireAuth, (_req, res) => {
    db.prepare('UPDATE notifications SET read = 1').run();
    res.json({ ok: true });
  });

  // --- Automated Daily Cron Check at 08:00 WIB (01:00 UTC) ---
  cron.schedule('0 1 * * *', async () => {
    const smtp = getSetting<SmtpInternalConfig>('smtp');
    if (smtp?.autoMonthlyEnabled) {
      await runMonthlyBillingJob({ forceAllActive: false });
    }
  });

  // Return clean JSON 404 for unknown API endpoints
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, message: 'Endpoint API tidak ditemukan.' });
  });

  // Global error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('Unhandled server error:', err);
      if (res.headersSent) return;
      res.status(500).json({
        ok: false,
        message:
          process.env.NODE_ENV === 'production'
            ? 'Terjadi kesalahan internal server.'
            : err.message || 'Terjadi kesalahan internal server.',
      });
    }
  );

  // --- Vite Dev Middleware / Production Static Serving ---
  const appRoot = resolveAppRoot();
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: appRoot,
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document
      .querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]')
      .forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay {}
`);
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(appRoot, 'dist');
    const distIndex = path.join(distDir, 'index.html');
    let backgroundBuildError: string | null = null;

    if (!fs.existsSync(distIndex)) {
      console.log('dist/index.html belum tersedia. Menyiapkan Vite production build di latar belakang...');
      void (async () => {
        try {
          const { build: buildVite } = await import('vite');
          await buildVite({ root: appRoot });
          console.log('Vite production build selesai.');
        } catch (err) {
          backgroundBuildError = err instanceof Error ? err.message : 'Build gagal';
          console.error('Background Vite build failed:', err);
        }
      })();
    }

    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use('/assets', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });

    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (base === 'index.html' || base === 'sw.js' || base === 'manifest.webmanifest') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          }
        },
      })
    );

    app.get('*', (req, res) => {
      if (/\.(js|mjs|ts|tsx|css|map|png|jpg|jpeg|webp|svg|ico|woff|woff2|webmanifest|json)$/i.test(req.path)) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      if (!fs.existsSync(distIndex)) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).type('text/html').send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="refresh" content="3" />
  <title>Menyiapkan FakturaFlow...</title>
</head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a;">
  <div style="text-align:center;padding:24px;max-width:420px;">
    <h1 style="font-size:18px;margin:0 0 8px;">Menyiapkan Aplikasi...</h1>
    <p style="font-size:14px;color:#475569;margin:0;">${backgroundBuildError ? `Terjadi kendala build: ${backgroundBuildError}` : 'Halaman akan termuat otomatis dalam beberapa detik.'}</p>
  </div>
</body>
</html>`);
        return;
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(distIndex);
    });
  }

  const resolvePort = (): number | string => {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--port' && args[i + 1]) {
        const parsed = Number(args[i + 1]);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      } else if (args[i].startsWith('--port=')) {
        const parsed = Number(args[i].slice('--port='.length));
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    }
    const rawEnvPort = process.env.PORT;
    if (rawEnvPort && Number.isNaN(Number(rawEnvPort))) {
      return rawEnvPort;
    }
    const envPort = Number(rawEnvPort || 0);
    const nginxPort = Number(process.env.NGINX_PORT || 0);
    if (envPort > 0 && envPort !== nginxPort) {
      return envPort;
    }
    const defaultPort = Number(process.env.DEFAULT_APP_PORT || 3000);
    return Number.isFinite(defaultPort) && defaultPort > 0 ? defaultPort : 3000;
  };

  const PORT = resolvePort();
  httpServer.on('error', (err) => {
    console.error(`Failed to start server on port ${PORT}:`, err);
    process.exit(1);
  });
  if (typeof PORT === 'string') {
    httpServer.listen(PORT, () => {
      console.log(`FakturaFlow Enterprise server listening on ${PORT}`);
    });
  } else {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`FakturaFlow Enterprise server running on http://localhost:${PORT}`);
    });
  }

  let shuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, closing HTTP server and SQLite connection...`);
    httpServer.close(() => {
      closeDatabase();
      process.exit(0);
    });
    setTimeout(() => {
      closeDatabase();
      process.exit(0);
    }, 5000).unref();
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
