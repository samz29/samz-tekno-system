import express from 'express';
import crypto from 'crypto';
import http from 'http';
import path from 'path';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import {
  db,
  getSetting,
  setSetting,
  hashPassword,
  verifyPassword,
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
  LeaveEmployeeOption,
  LeaveRequest,
  PayrollRecord,
  Invoice,
  RecurringSchedule,
  UserRole,
} from './src/types.ts';

type AuthedRequest = express.Request & { user?: AuthUser; sessionToken?: string };

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
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  // Purge expired sessions on startup
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

  // --- Health & Authentication ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
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
    setSetting('company', { ...existing, ...body });
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
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
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
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const resolvePort = (): number => {
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
    const envPort = Number(process.env.PORT || 0);
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
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FakturaFlow Enterprise server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
