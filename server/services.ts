import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createRequire } from 'module';
import type { Response } from 'express';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');
import {
  db,
  getSetting,
  setSetting,
  type MidtransInternalConfig,
  type SmtpInternalConfig,
  type CompanyInternalConfig,
  type VapidConfig,
} from './db.ts';
import type {
  AccountingEntry,
  Invoice,
  InvoiceItem,
  Client,
  Product,
  Employee,
  EmployeeContract,
  GoodsHandover,
  HandoverItem,
  LeaveRequest,
  PayrollRecord,
  PtkpStatus,
  TerCategory,
  TaxCalculationMethod,
  AuthUser,
  RecurringSchedule,
  EmailLog,
  PaymentNotification,
} from '../src/types.ts';
import {
  calculateDecemberPasal17Reconciliation,
  calculateIndonesianPayrollTaxes,
  getTerCategory,
  PTKP_META,
} from '../src/lib/indonesianTax.ts';

// --- SSE Real-Time Broadcast Hub ---
const sseClients = new Set<Response>();

export function registerSseClient(res: Response): void {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
}

export function broadcastEvent(eventName: string, payload: unknown): void {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

// --- Web Push Notification Dispatcher ---
export async function dispatchPushNotification(notification: {
  title: string;
  body: string;
  invoiceId?: string;
  tag?: string;
  url?: string;
}): Promise<{ sent: number; failed: number }> {
  const vapid = getSetting<VapidConfig>('vapid');
  if (!vapid) return { sent: 0, failed: 0 };

  webpush.setVapidDetails(
    'mailto:billing@fakturaflow.id',
    vapid.publicKey,
    vapid.privateKey
  );

  const subs = db.prepare('SELECT endpoint, keys_json FROM push_subscriptions').all() as Array<{
    endpoint: string;
    keys_json: string;
  }>;

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      const keys = JSON.parse(sub.keys_json);
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys,
        },
        JSON.stringify(notification)
      );
      sent += 1;
    } catch (err: unknown) {
      failed += 1;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }

  return { sent, failed };
}

export function createAndBroadcastNotification(params: {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  message: string;
  status: string;
  amount: number;
  channel: PaymentNotification['channel'];
}): PaymentNotification {
  const notif: PaymentNotification = {
    id: `notif-${crypto.randomUUID().slice(0, 8)}`,
    invoiceId: params.invoiceId,
    invoiceNumber: params.invoiceNumber,
    title: params.title,
    message: params.message,
    status: params.status,
    amount: params.amount,
    channel: params.channel,
    read: false,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO notifications (id, invoice_id, invoice_number, title, message, status, amount, channel, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    notif.id,
    notif.invoiceId,
    notif.invoiceNumber,
    notif.title,
    notif.message,
    notif.status,
    notif.amount,
    notif.channel,
    0,
    notif.createdAt
  );

  broadcastEvent('notification:new', notif);
  void dispatchPushNotification({
    title: notif.title,
    body: notif.message,
    invoiceId: notif.invoiceId,
    tag: `inv-${notif.invoiceId}`,
    url: '/',
  });

  return notif;
}

// --- Row Mappers ---
export function mapClientRow(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    name: String(row.name),
    companyName: String(row.company_name),
    email: String(row.email),
    phone: String(row.phone || ''),
    address: String(row.address || ''),
    npwp: String(row.npwp || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapProductRow(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    description: String(row.description || ''),
    unit: String(row.unit || 'Unit'),
    unitPrice: Number(row.unit_price),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapEmployeeRow(row: Record<string, unknown>): Employee {
  const rawPtkp = String(row.ptkp_status || 'TK/0') as PtkpStatus;
  const ptkpStatus: PtkpStatus = rawPtkp in PTKP_META ? rawPtkp : 'TK/0';
  return {
    id: String(row.id),
    nip: String(row.nip),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone || ''),
    department: String(row.department),
    position: String(row.position),
    employmentType: String(row.employment_type || 'tetap') as Employee['employmentType'],
    joinDate: String(row.join_date),
    baseSalary: Number(row.base_salary),
    fixedAllowance: Number(row.fixed_allowance || 0),
    bankName: String(row.bank_name || ''),
    bankAccountNumber: String(row.bank_account_number || ''),
    bankAccountName: String(row.bank_account_name || ''),
    npwp: String(row.npwp || ''),
    bpjsNumber: String(row.bpjs_number || ''),
    ptkpStatus,
    bpjsEnrolled: row.bpjs_enrolled === undefined || row.bpjs_enrolled === null ? true : Boolean(row.bpjs_enrolled),
    annualLeaveQuota: Number(row.annual_leave_quota ?? 12),
    status: String(row.status || 'active') as Employee['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapLeaveRow(row: Record<string, unknown>): LeaveRequest {
  return {
    id: String(row.id),
    requestNumber: String(row.request_number),
    employeeId: String(row.employee_id),
    employeeNip: String(row.employee_nip),
    employeeName: String(row.employee_name),
    employeeEmail: String(row.employee_email),
    department: String(row.department),
    position: String(row.position),
    leaveType: String(row.leave_type || 'tahunan') as LeaveRequest['leaveType'],
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    totalDays: Number(row.total_days || 1),
    reason: String(row.reason || ''),
    delegateName: String(row.delegate_name || ''),
    contactDuringLeave: String(row.contact_during_leave || ''),
    status: String(row.status || 'pending') as LeaveRequest['status'],
    hrdNotes: String(row.hrd_notes || ''),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    submittedByUserId: String(row.submitted_by_user_id || ''),
    submittedByName: String(row.submitted_by_name || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapAccountingRow(row: Record<string, unknown>): AccountingEntry {
  return {
    id: String(row.id),
    entryNumber: String(row.entry_number),
    date: String(row.date),
    type: String(row.type || 'expense') as AccountingEntry['type'],
    category: String(row.category || 'Beban Lain-lain'),
    accountName: String(row.account_name || 'Bank Mandiri Operasional'),
    description: String(row.description || ''),
    counterparty: String(row.counterparty || ''),
    paymentMethod: String(row.payment_method || 'Transfer Bank'),
    amount: Number(row.amount || 0),
    status: String(row.status || 'recorded') as AccountingEntry['status'],
    sourceType: String(row.source_type || 'manual') as AccountingEntry['sourceType'],
    sourceId: row.source_id ? String(row.source_id) : null,
    notes: String(row.notes || ''),
    createdBy: String(row.created_by || 'Sistem'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapPayrollRow(row: Record<string, unknown>): PayrollRecord {
  const rawPtkp = String(row.ptkp_status || 'TK/0') as PtkpStatus;
  const ptkpStatus: PtkpStatus = rawPtkp in PTKP_META ? rawPtkp : 'TK/0';
  const rawTer = String(row.ter_category || getTerCategory(ptkpStatus)) as TerCategory;
  const terCategory: TerCategory = rawTer === 'A' || rawTer === 'B' || rawTer === 'C' ? rawTer : 'A';

  return {
    id: String(row.id),
    slipNumber: String(row.slip_number),
    periodMonth: String(row.period_month),
    payDate: String(row.pay_date),
    employeeId: String(row.employee_id),
    employeeNip: String(row.employee_nip),
    employeeName: String(row.employee_name),
    employeeEmail: String(row.employee_email),
    department: String(row.department),
    position: String(row.position),
    bankName: String(row.bank_name || ''),
    bankAccountNumber: String(row.bank_account_number || ''),
    bankAccountName: String(row.bank_account_name || ''),
    baseSalary: Number(row.base_salary),
    allowances: Number(row.allowances || 0),
    overtimePay: Number(row.overtime_pay || 0),
    bonus: Number(row.bonus || 0),
    pph21Deduction: Number(row.pph21_deduction || 0),
    bpjsDeduction: Number(row.bpjs_deduction || 0),
    otherDeductions: Number(row.other_deductions || 0),
    grossPay: Number(row.gross_pay),
    totalDeductions: Number(row.total_deductions),
    netPay: Number(row.net_pay),
    ptkpStatus,
    terCategory,
    pph21Rate: Number(row.pph21_rate || 0),
    pph21TaxableGross: Number(row.pph21_taxable_gross || 0),
    bpjsKesEmployee: Number(row.bpjs_kes_employee || 0),
    bpjsJhtEmployee: Number(row.bpjs_jht_employee || 0),
    bpjsJpEmployee: Number(row.bpjs_jp_employee || 0),
    bpjsEmployerTotal: Number(row.bpjs_employer_total || 0),
    taxCalculationMethod: String(
      row.tax_calculation_method || 'ter_bulanan'
    ) as TaxCalculationMethod,
    status: String(row.status || 'draft') as PayrollRecord['status'],
    notes: String(row.notes || ''),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    emailSentAt: row.email_sent_at ? String(row.email_sent_at) : null,
    updatedAt: String(row.updated_at),
  };
}

export function mapUserRow(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role || 'user') as AuthUser['role'],
    department: String(row.department || 'Umum'),
    active: Boolean(row.active),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapContractRow(row: Record<string, unknown>): EmployeeContract {
  return {
    id: String(row.id),
    contractNumber: String(row.contract_number),
    contractType: (String(row.contract_type) === 'sk_pengangkatan'
      ? 'sk_pengangkatan'
      : 'pkwt') as EmployeeContract['contractType'],
    employeeId: String(row.employee_id),
    employeeNip: String(row.employee_nip),
    employeeName: String(row.employee_name),
    employeeEmail: String(row.employee_email || ''),
    employeeNik: String(row.employee_nik || ''),
    employeeAddress: String(row.employee_address || ''),
    department: String(row.department),
    position: String(row.position),
    workLocation: String(row.work_location || 'Kantor Pusat'),
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    durationMonths:
      row.duration_months !== null && row.duration_months !== undefined
        ? Number(row.duration_months)
        : null,
    probationMonths: Number(row.probation_months || 0),
    baseSalary: Number(row.base_salary || 0),
    fixedAllowance: Number(row.fixed_allowance || 0),
    workingHours: String(row.working_hours || 'Senin – Jumat, 09.00 – 17.00 WIB'),
    signerName: String(row.signer_name || ''),
    signerTitle: String(row.signer_title || 'Direktur Utama'),
    signedDate: String(row.signed_date),
    city: String(row.city || 'Jakarta'),
    customClauses: String(row.custom_clauses || ''),
    status: String(row.status || 'active') as EmployeeContract['status'],
    verificationCode: String(row.verification_code || ''),
    verificationHash: String(row.verification_hash || ''),
    createdBy: String(row.created_by || 'Sistem'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapHandoverRow(row: Record<string, unknown>): GoodsHandover {
  let items: HandoverItem[] = [];
  try {
    const parsed = JSON.parse(String(row.items_json || '[]'));
    if (Array.isArray(parsed)) items = parsed as HandoverItem[];
  } catch {
    items = [];
  }

  return {
    id: String(row.id),
    handoverNumber: String(row.handover_number),
    handoverType: (String(row.handover_type) === 'employee_asset'
      ? 'employee_asset'
      : 'client_delivery') as GoodsHandover['handoverType'],
    status: (['draft', 'handed_over', 'received'].includes(String(row.status))
      ? String(row.status)
      : 'handed_over') as GoodsHandover['status'],
    handoverDate: String(row.handover_date),
    city: String(row.city || 'Jakarta'),
    location: String(row.location || ''),
    referenceType: (['invoice', 'employee', 'manual'].includes(String(row.reference_type))
      ? String(row.reference_type)
      : 'manual') as GoodsHandover['referenceType'],
    referenceId: row.reference_id ? String(row.reference_id) : null,
    referenceNumber: String(row.reference_number || ''),
    senderName: String(row.sender_name || ''),
    senderTitle: String(row.sender_title || ''),
    recipientName: String(row.recipient_name || ''),
    recipientCompany: String(row.recipient_company || ''),
    recipientIdentity: String(row.recipient_identity || ''),
    recipientPhone: String(row.recipient_phone || ''),
    recipientAddress: String(row.recipient_address || ''),
    items,
    notes: String(row.notes || ''),
    receivedAt: row.received_at ? String(row.received_at) : null,
    verificationCode: String(row.verification_code || ''),
    verificationHash: String(row.verification_hash || ''),
    createdBy: String(row.created_by || 'Sistem'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number),
    clientId: String(row.client_id),
    clientName: String(row.client_name),
    clientCompany: String(row.client_company),
    clientEmail: String(row.client_email),
    issueDate: String(row.issue_date),
    dueDate: String(row.due_date),
    status: String(row.status) as Invoice['status'],
    items: JSON.parse(String(row.items_json || '[]')) as InvoiceItem[],
    subtotal: Number(row.subtotal),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    notes: String(row.notes || ''),
    midtransOrderId: row.midtrans_order_id ? String(row.midtrans_order_id) : null,
    midtransSnapToken: row.midtrans_snap_token ? String(row.midtrans_snap_token) : null,
    midtransPaymentUrl: row.midtrans_payment_url ? String(row.midtrans_payment_url) : null,
    midtransPaymentType: row.midtrans_payment_type ? String(row.midtrans_payment_type) : null,
    midtransTransactionStatus: row.midtrans_transaction_status
      ? String(row.midtrans_transaction_status)
      : null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    emailSentAt: row.email_sent_at ? String(row.email_sent_at) : null,
    recurringScheduleId: row.recurring_schedule_id ? String(row.recurring_schedule_id) : null,
    updatedAt: String(row.updated_at),
  };
}

export function mapScheduleRow(row: Record<string, unknown>): RecurringSchedule {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    clientName: String(row.client_name),
    clientCompany: String(row.client_company),
    clientEmail: String(row.client_email),
    title: String(row.title),
    dayOfMonth: Number(row.day_of_month),
    taxRate: Number(row.tax_rate),
    items: JSON.parse(String(row.items_json || '[]')) as InvoiceItem[],
    autoSendEmail: Boolean(row.auto_send_email),
    autoCreateMidtrans: Boolean(row.auto_create_midtrans),
    active: Boolean(row.active),
    lastRunMonth: row.last_run_month ? String(row.last_run_month) : null,
    nextRunDate: String(row.next_run_date),
    updatedAt: String(row.updated_at),
  };
}

export function mapEmailLogRow(row: Record<string, unknown>): EmailLog {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    invoiceNumber: String(row.invoice_number),
    recipientEmail: String(row.recipient_email),
    subject: String(row.subject),
    status: String(row.status) as EmailLog['status'],
    deliveryMode: String(row.delivery_mode),
    messageId: row.message_id ? String(row.message_id) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    htmlPreview: String(row.html_preview),
    sentAt: String(row.sent_at),
  };
}

export function mapNotificationRow(row: Record<string, unknown>): PaymentNotification {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    invoiceNumber: String(row.invoice_number),
    title: String(row.title),
    message: String(row.message),
    status: String(row.status),
    amount: Number(row.amount),
    channel: String(row.channel) as PaymentNotification['channel'],
    read: Boolean(row.read),
    createdAt: String(row.created_at),
  };
}

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 6)}••••••••${secret.slice(-4)}`;
}

// --- Midtrans REST API Integration ---
function getMidtransUrls(env: 'sandbox' | 'production') {
  if (env === 'production') {
    return {
      snapUrl: 'https://app.midtrans.com/snap/v1/transactions',
      coreApiUrl: 'https://api.midtrans.com/v2',
    };
  }
  return {
    snapUrl: 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    coreApiUrl: 'https://api.sandbox.midtrans.com/v2',
  };
}

export async function testMidtransCredentials(config: MidtransInternalConfig): Promise<{
  ok: boolean;
  message: string;
  environment: string;
}> {
  if (!config.serverKey || !config.clientKey) {
    return {
      ok: false,
      message: 'Server Key dan Client Key Midtrans wajib diisi sebelum menguji koneksi.',
      environment: config.environment,
    };
  }

  const { coreApiUrl } = getMidtransUrls(config.environment);
  const auth = Buffer.from(`${config.serverKey}:`).toString('base64');

  try {
    const response = await fetch(`${coreApiUrl}/FF-HEALTHCHECK-PROBE/status`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });
    const data = (await response.json()) as { status_code?: string; status_message?: string };
    // Midtrans returns 404 status_code ("Transaction doesn't exist.") when auth succeeds for an unknown order_id
    if (response.status === 401 || data.status_code === '401') {
      return {
        ok: false,
        message: 'Server Key tidak valid atau ditolak oleh Midtrans (HTTP 401).',
        environment: config.environment,
      };
    }
    return {
      ok: true,
      message: `Koneksi Midtrans ${config.environment.toUpperCase()} terverifikasi (${data.status_message || 'Auth OK'}).`,
      environment: config.environment,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Gagal menghubungi endpoint Midtrans: ${err instanceof Error ? err.message : 'Network error'}`,
      environment: config.environment,
    };
  }
}

export async function createMidtransSnapForInvoice(invoiceId: string): Promise<{
  ok: boolean;
  snapToken?: string;
  redirectUrl?: string;
  orderId?: string;
  mode: 'live_api' | 'unconfigured';
  message: string;
}> {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return { ok: false, mode: 'unconfigured', message: 'Faktur tidak ditemukan.' };
  }
  const invoice = mapInvoiceRow(row);
  const config = getSetting<MidtransInternalConfig>('midtrans');

  if (!config || !config.serverKey) {
    return {
      ok: false,
      mode: 'unconfigured',
      message:
        'Server Key Midtrans belum dikonfigurasi di Pengaturan Dashboard. Silakan isi kredensial Midtrans Sandbox/Production Anda.',
    };
  }

  const orderId =
    invoice.midtransOrderId ||
    `FF-${invoice.invoiceNumber}-${crypto.randomInt(1000, 9999)}`;
  const { snapUrl } = getMidtransUrls(config.environment);
  const auth = Buffer.from(`${config.serverKey}:`).toString('base64');

  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(invoice.totalAmount),
    },
    customer_details: {
      first_name: invoice.clientName,
      email: invoice.clientEmail,
    },
    item_details: [
      ...invoice.items.map((item, idx) => ({
        id: item.id || `item-${idx + 1}`,
        price: Math.round(item.unitPrice),
        quantity: Math.round(item.quantity),
        name: item.description.slice(0, 50),
      })),
      ...(invoice.taxAmount > 0
        ? [
            {
              id: 'PPN',
              price: Math.round(invoice.taxAmount),
              quantity: 1,
              name: `PPN ${invoice.taxRate}%`,
            },
          ]
        : []),
    ],
    enabled_payments: config.enabledPayments?.length ? config.enabledPayments : undefined,
  };

  try {
    const response = await fetch(snapUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
    };

    if (!response.ok || !data.token) {
      return {
        ok: false,
        mode: 'live_api',
        message: data.error_messages?.join(', ') || `Midtrans Snap Error (${response.status})`,
      };
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE invoices
       SET midtrans_order_id = ?, midtrans_snap_token = ?, midtrans_payment_url = ?, midtrans_transaction_status = COALESCE(midtrans_transaction_status, 'pending'), updated_at = ?
       WHERE id = ?`
    ).run(orderId, data.token, data.redirect_url || null, now, invoice.id);

    const updated = mapInvoiceRow(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id) as Record<string, unknown>
    );
    broadcastEvent('invoice:updated', updated);

    return {
      ok: true,
      snapToken: data.token,
      redirectUrl: data.redirect_url,
      orderId,
      mode: 'live_api',
      message: 'Tautan pembayaran Midtrans Snap berhasil dibuat.',
    };
  } catch (err) {
    return {
      ok: false,
      mode: 'live_api',
      message: `Koneksi ke Midtrans gagal: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
  serverKey: string;
}): boolean {
  const raw = `${params.orderId}${params.statusCode}${params.grossAmount}${params.serverKey}`;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(String(params.signatureKey || '').toLowerCase(), 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function applyMidtransPaymentStatus(params: {
  orderId?: string;
  invoiceId?: string;
  transactionStatus: string;
  paymentType?: string;
  fraudStatus?: string;
  source: 'webhook' | 'api_poll';
}): Invoice | null {
  let row: Record<string, unknown> | undefined;
  if (params.invoiceId) {
    row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(params.invoiceId) as
      | Record<string, unknown>
      | undefined;
  } else if (params.orderId) {
    row = db
      .prepare('SELECT * FROM invoices WHERE midtrans_order_id = ?')
      .get(params.orderId) as Record<string, unknown> | undefined;
  }

  if (!row) return null;
  const current = mapInvoiceRow(row);
  const now = new Date().toISOString();

  let nextStatus: Invoice['status'] = current.status;
  let paidAt = current.paidAt;

  const tx = params.transactionStatus.toLowerCase();
  if (tx === 'settlement' || (tx === 'capture' && params.fraudStatus !== 'challenge')) {
    nextStatus = 'paid';
    paidAt = paidAt || now;
  } else if (tx === 'pending') {
    nextStatus = 'pending';
  } else if (tx === 'expire') {
    nextStatus = 'overdue';
  } else if (tx === 'cancel' || tx === 'deny') {
    nextStatus = 'cancelled';
  }

  db.prepare(
    `UPDATE invoices
     SET status = ?, midtrans_transaction_status = ?, midtrans_payment_type = COALESCE(?, midtrans_payment_type), paid_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(nextStatus, tx, params.paymentType || null, paidAt, now, current.id);

  const updated = mapInvoiceRow(
    db.prepare('SELECT * FROM invoices WHERE id = ?').get(current.id) as Record<string, unknown>
  );

  broadcastEvent('invoice:updated', updated);

  const statusLabel =
    nextStatus === 'paid'
      ? 'Lunas (Settlement)'
      : nextStatus === 'pending'
      ? 'Menunggu Pembayaran'
      : nextStatus === 'overdue'
      ? 'Kedaluwarsa / Jatuh Tempo'
      : 'Dibatalkan';

  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(updated.totalAmount);

  createAndBroadcastNotification({
    invoiceId: updated.id,
    invoiceNumber: updated.invoiceNumber,
    title:
      nextStatus === 'paid'
        ? `Pembayaran Lunas: ${updated.invoiceNumber}`
        : `Status Pembayaran: ${updated.invoiceNumber}`,
    message: `${updated.clientCompany} — ${statusLabel} (${formattedAmount})${
      params.paymentType ? ` via ${params.paymentType.toUpperCase()}` : ''
    }.`,
    status: nextStatus,
    amount: updated.totalAmount,
    channel: 'midtrans_webhook',
  });

  return updated;
}

export async function pollMidtransInvoiceStatus(invoiceId: string): Promise<{
  ok: boolean;
  invoice?: Invoice;
  message: string;
}> {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { ok: false, message: 'Faktur tidak ditemukan.' };

  const invoice = mapInvoiceRow(row);
  if (!invoice.midtransOrderId) {
    return {
      ok: false,
      invoice,
      message: 'Faktur ini belum memiliki Order ID Midtrans.',
    };
  }

  const config = getSetting<MidtransInternalConfig>('midtrans');
  if (!config || !config.serverKey) {
    return {
      ok: false,
      invoice,
      message: 'Server Key Midtrans belum dikonfigurasi di dashboard.',
    };
  }

  const { coreApiUrl } = getMidtransUrls(config.environment);
  const auth = Buffer.from(`${config.serverKey}:`).toString('base64');

  try {
    const res = await fetch(`${coreApiUrl}/${encodeURIComponent(invoice.midtransOrderId)}/status`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });
    const data = (await res.json()) as {
      status_code?: string;
      status_message?: string;
      transaction_status?: string;
      payment_type?: string;
      fraud_status?: string;
    };

    if (!data.transaction_status) {
      return {
        ok: false,
        invoice,
        message: data.status_message || 'Transaksi belum tercatat di Midtrans.',
      };
    }

    const updated = applyMidtransPaymentStatus({
      invoiceId: invoice.id,
      transactionStatus: data.transaction_status,
      paymentType: data.payment_type,
      fraudStatus: data.fraud_status,
      source: 'api_poll',
    });

    return {
      ok: true,
      invoice: updated || invoice,
      message: `Status Midtrans tersinkron: ${data.transaction_status.toUpperCase()}.`,
    };
  } catch (err) {
    return {
      ok: false,
      invoice,
      message: `Gagal memeriksa status Midtrans: ${err instanceof Error ? err.message : 'Network error'}`,
    };
  }
}

// --- Email Invoice Template & Nodemailer Dispatcher ---
function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildInvoiceEmailHtml(invoice: Invoice, company: CompanyInternalConfig): string {
  const rowsHtml = invoice.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${item.description}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px; text-align: right;">${item.quantity}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px; text-align: right;">${formatIdr(item.unitPrice)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${formatIdr(item.total)}</td>
      </tr>`
    )
    .join('');

  const payButtonHtml = invoice.midtransPaymentUrl
    ? `<div style="margin: 28px 0;">
        <a href="${invoice.midtransPaymentUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 14px;">
          Bayar Online via Midtrans
        </a>
      </div>`
    : '';

  const logoHtml = company.logoDataUrl
    ? `<img src="${company.logoDataUrl}" alt="${company.name}" style="max-height:44px; max-width:160px; object-fit:contain; margin-bottom:10px; display:block; background:#ffffff; padding:4px 8px; border-radius:4px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<body style="margin:0; padding:0; background-color:#f8fafc; font-family: 'Segoe UI', Arial, sans-serif;">
  <div style="max-width:640px; margin:32px auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
    <div style="background:#0f172a; color:#ffffff; padding:28px 32px;">
      ${logoHtml}
      <div style="font-size:12px; color:#94a3b8; letter-spacing:0.06em; text-transform:uppercase;">Faktur Resmi Perusahaan</div>
      <h1 style="margin:6px 0 0; font-size:22px; font-weight:700;">${company.name}</h1>
      <p style="margin:6px 0 0; font-size:13px; color:#cbd5e1;">${company.address} · NPWP ${company.npwp}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px; font-size:15px; color:#0f172a;">Yth. <strong>${invoice.clientName}</strong> (${invoice.clientCompany}),</p>
      <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#475569;">
        Terlampir rincian tagihan untuk faktur nomor <strong>${invoice.invoiceNumber}</strong> yang diterbitkan pada ${invoice.issueDate} dengan tanggal jatuh tempo <strong>${invoice.dueDate}</strong>.
      </p>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px; text-align:left; font-size:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Deskripsi Layanan</th>
            <th style="padding:10px 16px; text-align:right; font-size:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Qty</th>
            <th style="padding:10px 16px; text-align:right; font-size:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Harga</th>
            <th style="padding:10px 16px; text-align:right; font-size:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div style="margin-top:20px; text-align:right;">
        <div style="font-size:13px; color:#64748b; margin-bottom:6px;">Subtotal: <strong style="color:#0f172a;">${formatIdr(invoice.subtotal)}</strong></div>
        <div style="font-size:13px; color:#64748b; margin-bottom:10px;">PPN (${invoice.taxRate}%): <strong style="color:#0f172a;">${formatIdr(invoice.taxAmount)}</strong></div>
        <div style="font-size:18px; color:#0f172a; font-weight:700;">Total Tagihan: ${formatIdr(invoice.totalAmount)}</div>
      </div>
      ${payButtonHtml}
      <div style="margin-top:24px; padding:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; color:#475569;">
        <strong>Transfer Bank Manual:</strong><br/>
        ${company.bankName} — No. Rek <strong>${company.bankAccountNumber}</strong> a.n. ${company.bankAccountName}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendInvoiceEmail(invoiceId: string): Promise<{
  ok: boolean;
  log: EmailLog;
  message: string;
}> {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error('Faktur tidak ditemukan');
  }

  let invoice = mapInvoiceRow(row);
  const company = getSetting<CompanyInternalConfig>('company')!;
  const smtp = getSetting<SmtpInternalConfig>('smtp')!;
  const midtrans = getSetting<MidtransInternalConfig>('midtrans');

  if (
    midtrans?.autoCreatePaymentLink &&
    midtrans?.serverKey &&
    !invoice.midtransPaymentUrl &&
    invoice.status !== 'paid'
  ) {
    await createMidtransSnapForInvoice(invoice.id);
    invoice = mapInvoiceRow(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id) as Record<string, unknown>
    );
  }

  const subject = `Tagihan ${invoice.invoiceNumber} — ${company.name} (Jatuh Tempo ${invoice.dueDate})`;
  const htmlPreview = buildInvoiceEmailHtml(invoice, company);
  const now = new Date().toISOString();

  let status: EmailLog['status'] = 'simulated';
  let deliveryMode = 'Preview HTML Lokal (SMTP belum dikonfigurasi)';
  let messageId: string | null = `preview-${crypto.randomUUID().slice(0, 8)}@fakturaflow.local`;
  let errorMessage: string | null = null;

  if (smtp.host && smtp.username && smtp.password) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.username,
          pass: smtp.password,
        },
      });
      const info = await transporter.sendMail({
        from: `"${smtp.fromName || company.name}" <${smtp.fromEmail || smtp.username}>`,
        to: invoice.clientEmail,
        subject,
        html: htmlPreview,
      });
      status = 'sent';
      deliveryMode = `SMTP (${smtp.host}:${smtp.port})`;
      messageId = info.messageId;
    } catch (err) {
      status = 'failed';
      deliveryMode = `SMTP Error (${smtp.host})`;
      errorMessage = err instanceof Error ? err.message : 'SMTP delivery failed';
    }
  }

  const log: EmailLog = {
    id: `eml-${crypto.randomUUID().slice(0, 8)}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    recipientEmail: invoice.clientEmail,
    subject,
    status,
    deliveryMode,
    messageId,
    errorMessage,
    htmlPreview,
    sentAt: now,
  };

  db.prepare(
    `INSERT INTO email_logs (id, invoice_id, invoice_number, recipient_email, subject, status, delivery_mode, message_id, error_message, html_preview, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    log.id,
    log.invoiceId,
    log.invoiceNumber,
    log.recipientEmail,
    log.subject,
    log.status,
    log.deliveryMode,
    log.messageId,
    log.errorMessage,
    log.htmlPreview,
    log.sentAt
  );

  if (status !== 'failed') {
    const nextInvStatus = invoice.status === 'draft' ? 'pending' : invoice.status;
    db.prepare('UPDATE invoices SET email_sent_at = ?, status = ?, updated_at = ? WHERE id = ?').run(
      now,
      nextInvStatus,
      now,
      invoice.id
    );
    const updated = mapInvoiceRow(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id) as Record<string, unknown>
    );
    broadcastEvent('invoice:updated', updated);
  }

  broadcastEvent('email:logged', log);

  return {
    ok: status !== 'failed',
    log,
    message:
      status === 'sent'
        ? `Email faktur berhasil dikirim ke ${invoice.clientEmail} melalui SMTP.`
        : status === 'simulated'
        ? `Faktur digenerate & dicatat ke log pengiriman (Mode Preview Lokal — isi kredensial SMTP di Pengaturan untuk pengiriman email langsung).`
        : `Pengiriman SMTP gagal: ${errorMessage}`,
  };
}

// --- Automated Monthly Billing Engine ---
function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateNextInvoiceNumber(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const countRow = db
    .prepare('SELECT COUNT(*) as c FROM invoices WHERE invoice_number LIKE ?')
    .get(`INV-${ym}-%`) as { c: number };
  const seq = String((countRow?.c || 0) + 1).padStart(3, '0');
  return `INV-${ym}-${seq}`;
}

export async function runMonthlyBillingJob(options?: { forceAllActive?: boolean }): Promise<{
  processedCount: number;
  createdInvoices: Invoice[];
  emailLogs: EmailLog[];
}> {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const todayDay = now.getDate();

  const rows = db
    .prepare('SELECT * FROM recurring_schedules WHERE active = 1')
    .all() as Array<Record<string, unknown>>;

  const createdInvoices: Invoice[] = [];
  const emailLogs: EmailLog[] = [];

  for (const r of rows) {
    const schedule = mapScheduleRow(r);
    const alreadyRunThisMonth = schedule.lastRunMonth === currentMonth;

    if (!options?.forceAllActive) {
      if (alreadyRunThisMonth || schedule.dayOfMonth !== todayDay) {
        continue;
      }
    } else if (alreadyRunThisMonth && !options.forceAllActive) {
      continue;
    }

    const subtotal = schedule.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const taxAmount = Math.round((subtotal * schedule.taxRate) / 100);
    const totalAmount = subtotal + taxAmount;
    const issueDate = formatDateYmd(now);
    const due = new Date(now);
    due.setDate(due.getDate() + 14);
    const dueDate = formatDateYmd(due);

    const invoiceId = `inv-${crypto.randomUUID().slice(0, 8)}`;
    const invoiceNumber = generateNextInvoiceNumber();
    const orderId = `FF-${invoiceNumber}-${crypto.randomInt(1000, 9999)}`;
    const timestamp = now.toISOString();

    db.prepare(
      `INSERT INTO invoices
       (id, invoice_number, client_id, client_name, client_company, client_email, issue_date, due_date, status, items_json, subtotal, tax_rate, tax_amount, total_amount, notes, midtrans_order_id, recurring_schedule_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invoiceId,
      invoiceNumber,
      schedule.clientId,
      schedule.clientName,
      schedule.clientCompany,
      schedule.clientEmail,
      issueDate,
      dueDate,
      'pending',
      JSON.stringify(schedule.items),
      subtotal,
      schedule.taxRate,
      taxAmount,
      totalAmount,
      `Tagihan otomatis bulanan: ${schedule.title}`,
      orderId,
      schedule.id,
      timestamp
    );

    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, schedule.dayOfMonth);
    db.prepare(
      'UPDATE recurring_schedules SET last_run_month = ?, next_run_date = ?, updated_at = ? WHERE id = ?'
    ).run(currentMonth, formatDateYmd(nextMonthDate), timestamp, schedule.id);

    if (schedule.autoCreateMidtrans) {
      await createMidtransSnapForInvoice(invoiceId);
    }

    if (schedule.autoSendEmail) {
      const res = await sendInvoiceEmail(invoiceId);
      emailLogs.push(res.log);
    }

    const created = mapInvoiceRow(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as Record<string, unknown>
    );
    createdInvoices.push(created);
    broadcastEvent('invoice:created', created);

    createAndBroadcastNotification({
      invoiceId: created.id,
      invoiceNumber: created.invoiceNumber,
      title: `Faktur Bulanan Terbit: ${created.invoiceNumber}`,
      message: `Tagihan otomatis dikirim ke ${created.clientCompany} (${created.clientEmail}) senilai ${formatIdr(created.totalAmount)}.`,
      status: created.status,
      amount: created.totalAmount,
      channel: 'email_automation',
    });
  }

  return {
    processedCount: createdInvoices.length,
    createdInvoices,
    emailLogs,
  };
}

// --- Payroll & Payslip Services ---
export function buildPayslipEmailHtml(
  payroll: PayrollRecord,
  company: CompanyInternalConfig
): string {
  const logoHtml = company.logoDataUrl
    ? `<img src="${company.logoDataUrl}" alt="${company.name}" style="max-height:44px; max-width:160px; object-fit:contain; margin-bottom:10px; display:block; background:#ffffff; padding:4px 8px; border-radius:4px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<body style="margin:0; padding:0; background-color:#f8fafc; font-family: 'Segoe UI', Arial, sans-serif;">
  <div style="max-width:640px; margin:32px auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
    <div style="background:#0f172a; color:#ffffff; padding:28px 32px;">
      ${logoHtml}
      <div style="font-size:12px; color:#94a3b8; letter-spacing:0.06em; text-transform:uppercase;">Slip Gaji Resmi Karyawan</div>
      <h1 style="margin:6px 0 0; font-size:22px; font-weight:700;">${company.name}</h1>
      <p style="margin:6px 0 0; font-size:13px; color:#cbd5e1;">Periode ${payroll.periodMonth} · No. Slip ${payroll.slipNumber}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px; font-size:15px; color:#0f172a;">Yth. <strong>${payroll.employeeName}</strong> (${payroll.employeeNip}),</p>
      <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#475569;">
        Berikut rincian pembayaran gaji Anda untuk periode <strong>${payroll.periodMonth}</strong> (${payroll.position} — ${payroll.department}), dijadwalkan pada tanggal <strong>${payroll.payDate}</strong>.
      </p>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; margin-bottom:20px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px; text-align:left; font-size:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Komponen</th>
            <th style="padding:10px 16px; text-align:right; font-size:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Nominal</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px;">Gaji Pokok</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px;">${formatIdr(payroll.baseSalary)}</td></tr>
          <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px;">Tunjangan Tetap</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px;">${formatIdr(payroll.allowances)}</td></tr>
          <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px;">Upah Lembur</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px;">${formatIdr(payroll.overtimePay)}</td></tr>
          <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px;">Bonus / Insentif</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px;">${formatIdr(payroll.bonus)}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px; font-weight:600;">Total Bruto</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px; font-weight:600;">${formatIdr(payroll.grossPay)}</td></tr>
          <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px; color:#b91c1c;">Potongan PPh 21 ${payroll.ptkpStatus ? `(${payroll.ptkpStatus} · TER ${payroll.terCategory || 'A'}${payroll.pph21Rate ? ` ${payroll.pph21Rate}%` : ''})` : ''}</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px; color:#b91c1c;">-${formatIdr(payroll.pph21Deduction)}</td></tr>
          ${
            (payroll.bpjsKesEmployee || 0) + (payroll.bpjsJhtEmployee || 0) + (payroll.bpjsJpEmployee || 0) > 0
              ? `<tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#b91c1c;">BPJS Kesehatan (1%)</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:13px; color:#b91c1c;">-${formatIdr(payroll.bpjsKesEmployee || 0)}</td></tr>
                 <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#b91c1c;">BPJS TK — JHT (2%)</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:13px; color:#b91c1c;">-${formatIdr(payroll.bpjsJhtEmployee || 0)}</td></tr>
                 <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#b91c1c;">BPJS TK — Jaminan Pensiun (1%)</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:13px; color:#b91c1c;">-${formatIdr(payroll.bpjsJpEmployee || 0)}</td></tr>`
              : `<tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px; color:#b91c1c;">Potongan BPJS</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px; color:#b91c1c;">-${formatIdr(payroll.bpjsDeduction)}</td></tr>`
          }
          <tr><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:14px; color:#b91c1c;">Potongan Lainnya</td><td style="padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:right; font-size:14px; color:#b91c1c;">-${formatIdr(payroll.otherDeductions)}</td></tr>
        </tbody>
      </table>
      <div style="padding:18px 20px; background:#0f172a; color:#ffffff; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; color:#cbd5e1;">Take Home Pay (Gaji Bersih)</span>
        <strong style="font-size:20px;">${formatIdr(payroll.netPay)}</strong>
      </div>
      <div style="margin-top:20px; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; color:#475569;">
        <strong>Rekening Tujuan Transfer:</strong><br/>
        ${payroll.bankName || 'Bank Terdaftar'} — ${payroll.bankAccountNumber || '—'} a.n. ${payroll.bankAccountName || payroll.employeeName}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendPayslipEmail(payrollId: string): Promise<{
  ok: boolean;
  log: EmailLog;
  payroll: PayrollRecord;
  message: string;
}> {
  const row = db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(payrollId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error('Data slip gaji tidak ditemukan.');
  }

  let payroll = mapPayrollRow(row);
  const company = getSetting<CompanyInternalConfig>('company')!;
  const smtp = getSetting<SmtpInternalConfig>('smtp')!;

  const subject = `Slip Gaji ${payroll.periodMonth} (${payroll.slipNumber}) — ${company.name}`;
  const htmlPreview = buildPayslipEmailHtml(payroll, company);
  const now = new Date().toISOString();

  let status: EmailLog['status'] = 'simulated';
  let deliveryMode = 'Preview HTML Lokal (SMTP belum dikonfigurasi)';
  let messageId: string | null = `payslip-${crypto.randomUUID().slice(0, 8)}@fakturaflow.local`;
  let errorMessage: string | null = null;

  if (smtp.host && smtp.username && smtp.password) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.username,
          pass: smtp.password,
        },
      });
      const info = await transporter.sendMail({
        from: `"${smtp.fromName || company.name}" <${smtp.fromEmail || smtp.username}>`,
        to: payroll.employeeEmail,
        subject,
        html: htmlPreview,
      });
      status = 'sent';
      deliveryMode = `SMTP (${smtp.host}:${smtp.port})`;
      messageId = info.messageId;
    } catch (err) {
      status = 'failed';
      deliveryMode = `SMTP Error (${smtp.host})`;
      errorMessage = err instanceof Error ? err.message : 'SMTP delivery failed';
    }
  }

  const log: EmailLog = {
    id: `eml-${crypto.randomUUID().slice(0, 8)}`,
    invoiceId: payroll.id,
    invoiceNumber: payroll.slipNumber,
    recipientEmail: payroll.employeeEmail,
    subject,
    status,
    deliveryMode,
    messageId,
    errorMessage,
    htmlPreview,
    sentAt: now,
  };

  db.prepare(
    `INSERT INTO email_logs (id, invoice_id, invoice_number, recipient_email, subject, status, delivery_mode, message_id, error_message, html_preview, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    log.id,
    log.invoiceId,
    log.invoiceNumber,
    log.recipientEmail,
    log.subject,
    log.status,
    log.deliveryMode,
    log.messageId,
    log.errorMessage,
    log.htmlPreview,
    log.sentAt
  );

  if (status !== 'failed') {
    db.prepare('UPDATE payroll_records SET email_sent_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      payroll.id
    );
    payroll = mapPayrollRow(
      db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(payroll.id) as Record<
        string,
        unknown
      >
    );
    broadcastEvent('payroll:updated', payroll);
  }

  broadcastEvent('email:logged', log);

  return {
    ok: status !== 'failed',
    log,
    payroll,
    message:
      status === 'sent'
        ? `Slip gaji berhasil dikirim ke ${payroll.employeeEmail} melalui SMTP.`
        : status === 'simulated'
        ? `Slip gaji digenerate & dicatat ke Log Email (Mode Preview Lokal).`
        : `Pengiriman SMTP gagal: ${errorMessage}`,
  };
}

export function generateMonthlyPayrollForPeriod(params: {
  periodMonth: string;
  payDate: string;
}): {
  createdCount: number;
  skippedCount: number;
  createdPayrolls: PayrollRecord[];
} {
  const activeEmployees = (
    db.prepare("SELECT * FROM employees WHERE status = 'active' ORDER BY nip ASC").all() as Array<
      Record<string, unknown>
    >
  ).map(mapEmployeeRow);

  const existingForPeriod = new Set(
    (
      db
        .prepare('SELECT employee_id FROM payroll_records WHERE period_month = ?')
        .all(params.periodMonth) as Array<{ employee_id: string }>
    ).map((r) => r.employee_id)
  );

  const existingSlipCount = (
    db
      .prepare('SELECT COUNT(*) as c FROM payroll_records WHERE period_month = ?')
      .get(params.periodMonth) as { c: number }
  ).c;

  let seq = existingSlipCount;
  const createdPayrolls: PayrollRecord[] = [];
  let skippedCount = 0;
  const now = new Date().toISOString();

  const isDecember = params.periodMonth.endsWith('-12');
  const yearPrefix = params.periodMonth.slice(0, 4);

  for (const emp of activeEmployees) {
    if (existingForPeriod.has(emp.id)) {
      skippedCount += 1;
      continue;
    }

    seq += 1;
    const slipNumber = `PAY-${params.periodMonth}-${String(seq).padStart(3, '0')}`;
    const taxCalc = calculateIndonesianPayrollTaxes({
      baseSalary: emp.baseSalary,
      allowances: emp.fixedAllowance,
      overtimePay: 0,
      bonus: 0,
      ptkpStatus: emp.ptkpStatus,
      bpjsEnrolled: emp.bpjsEnrolled,
    });

    let pph21Deduction = taxCalc.pph21Deduction;
    let taxCalculationMethod: TaxCalculationMethod = 'ter_bulanan';
    let noteSummary = `Payroll otomatis ${params.periodMonth} (PPh 21 TER ${taxCalc.terCategory} · PTKP ${taxCalc.ptkpStatus} · Tarif ${taxCalc.pph21Rate}%)`;

    if (isDecember) {
      const priorRows = db
        .prepare(
          `SELECT period_month, gross_pay, pph21_taxable_gross, pph21_deduction, bpjs_jht_employee, bpjs_jp_employee, bpjs_deduction
           FROM payroll_records
           WHERE employee_id = ? AND period_month LIKE ? AND period_month < ?`
        )
        .all(emp.id, `${yearPrefix}-%`, params.periodMonth) as Array<Record<string, unknown>>;

      if (priorRows.length > 0) {
        const priorTaxableGrossTotal = priorRows.reduce(
          (sum, r) => sum + Number(r.pph21_taxable_gross || r.gross_pay || 0),
          0
        );
        const priorEmployeeRetirementContribTotal = priorRows.reduce(
          (sum, r) =>
            sum +
            Number(r.bpjs_jht_employee || 0) +
            Number(r.bpjs_jp_employee || 0),
          0
        );
        const priorPph21WithheldTotal = priorRows.reduce(
          (sum, r) => sum + Number(r.pph21_deduction || 0),
          0
        );

        const rec = calculateDecemberPasal17Reconciliation({
          ptkpStatus: emp.ptkpStatus,
          priorMonthsCount: priorRows.length,
          priorTaxableGrossTotal,
          priorEmployeeRetirementContribTotal,
          priorPph21WithheldTotal,
          decemberTaxableGross: taxCalc.pph21TaxableGross,
          decemberEmployeeRetirementContrib: taxCalc.bpjsJhtEmployee + taxCalc.bpjsJpEmployee,
        });
        pph21Deduction = rec.decemberPph21;
        taxCalculationMethod = 'pasal17_desember';
        noteSummary = `Payroll Desember ${yearPrefix} (Rekonsiliasi Pasal 17 UU HPP · PTKP ${taxCalc.ptkpStatus} · ${rec.monthsWorked} bln)`;
      }
    }

    const grossPay = taxCalc.grossCashPay;
    const bpjsDeduction = taxCalc.bpjsDeduction;
    const totalDeductions = bpjsDeduction + pph21Deduction;
    const netPay = Math.max(0, grossPay - totalDeductions);
    const id = `pay-${crypto.randomUUID().slice(0, 8)}`;

    db.prepare(
      `INSERT INTO payroll_records
       (id, slip_number, period_month, pay_date, employee_id, employee_nip, employee_name, employee_email, department, position, bank_name, bank_account_number, bank_account_name, base_salary, allowances, overtime_pay, bonus, pph21_deduction, bpjs_deduction, other_deductions, gross_pay, total_deductions, net_pay, ptkp_status, ter_category, pph21_rate, pph21_taxable_gross, bpjs_kes_employee, bpjs_jht_employee, bpjs_jp_employee, bpjs_employer_total, tax_calculation_method, status, notes, paid_at, email_sent_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      slipNumber,
      params.periodMonth,
      params.payDate,
      emp.id,
      emp.nip,
      emp.name,
      emp.email,
      emp.department,
      emp.position,
      emp.bankName,
      emp.bankAccountNumber,
      emp.bankAccountName || emp.name,
      emp.baseSalary,
      emp.fixedAllowance,
      0,
      0,
      pph21Deduction,
      bpjsDeduction,
      0,
      grossPay,
      totalDeductions,
      netPay,
      taxCalc.ptkpStatus,
      taxCalc.terCategory,
      taxCalc.pph21Rate,
      taxCalc.pph21TaxableGross,
      taxCalc.bpjsKesEmployee,
      taxCalc.bpjsJhtEmployee,
      taxCalc.bpjsJpEmployee,
      taxCalc.bpjsEmployerTotal,
      taxCalculationMethod,
      'draft',
      noteSummary,
      null,
      null,
      now
    );

    const created = mapPayrollRow(
      db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(id) as Record<string, unknown>
    );
    createdPayrolls.push(created);
    broadcastEvent('payroll:created', created);
  }

  return {
    createdCount: createdPayrolls.length,
    skippedCount,
    createdPayrolls,
  };
}
