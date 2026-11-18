export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  npwp: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  unitPrice: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes: string;
  midtransOrderId: string | null;
  midtransSnapToken: string | null;
  midtransPaymentUrl: string | null;
  midtransPaymentType: string | null;
  midtransTransactionStatus: string | null;
  paidAt: string | null;
  emailSentAt: string | null;
  recurringScheduleId: string | null;
  updatedAt: string;
}

export interface RecurringSchedule {
  id: string;
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  title: string;
  dayOfMonth: number;
  taxRate: number;
  items: InvoiceItem[];
  autoSendEmail: boolean;
  autoCreateMidtrans: boolean;
  active: boolean;
  lastRunMonth: string | null;
  nextRunDate: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  recipientEmail: string;
  subject: string;
  status: 'sent' | 'simulated' | 'failed';
  deliveryMode: string;
  messageId: string | null;
  errorMessage: string | null;
  htmlPreview: string;
  sentAt: string;
}

export interface PaymentNotification {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  message: string;
  status: string;
  amount: number;
  channel: 'midtrans_webhook' | 'email_automation' | 'system';
  read: boolean;
  createdAt: string;
}

export interface MidtransSettingsPublic {
  environment: 'sandbox' | 'production';
  merchantId: string;
  clientKey: string;
  hasServerKey: boolean;
  serverKeyMasked: string;
  enabledPayments: string[];
  autoCreatePaymentLink: boolean;
  webhookUrl: string;
}

export interface SmtpSettingsPublic {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  passwordMasked: string;
  fromName: string;
  fromEmail: string;
  autoMonthlyEnabled: boolean;
}

export interface CompanyProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  npwp: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  logoDataUrl?: string;
}

export interface AppSettingsPublic {
  midtrans: MidtransSettingsPublic;
  smtp: SmtpSettingsPublic;
  company: CompanyProfile;
}

export type EmployeeStatus = 'active' | 'inactive';
export type EmploymentType = 'tetap' | 'kontrak' | 'freelance';
export type PtkpStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3';
export type TerCategory = 'A' | 'B' | 'C';
export type TaxCalculationMethod = 'ter_bulanan' | 'pasal17_desember' | 'manual';

export interface Employee {
  id: string;
  nip: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  employmentType: EmploymentType;
  joinDate: string;
  baseSalary: number;
  fixedAllowance: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  npwp: string;
  bpjsNumber: string;
  ptkpStatus: PtkpStatus;
  bpjsEnrolled: boolean;
  annualLeaveQuota: number;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export type LeaveType = 'tahunan' | 'sakit' | 'melahirkan' | 'penting' | 'tanpa_upah';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  requestNumber: string;
  employeeId: string;
  employeeNip: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  position: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  delegateName: string;
  contactDuringLeave: string;
  status: LeaveStatus;
  hrdNotes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedByUserId: string;
  submittedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveEmployeeOption {
  id: string;
  nip: string;
  name: string;
  email: string;
  department: string;
  position: string;
  annualLeaveQuota: number;
  usedAnnualDays: number;
}

export type PayrollStatus = 'draft' | 'approved' | 'paid';

export interface PayrollRecord {
  id: string;
  slipNumber: string;
  periodMonth: string; // YYYY-MM
  payDate: string; // YYYY-MM-DD
  employeeId: string;
  employeeNip: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  position: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  baseSalary: number;
  allowances: number;
  overtimePay: number;
  bonus: number;
  pph21Deduction: number;
  bpjsDeduction: number;
  otherDeductions: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  ptkpStatus?: PtkpStatus;
  terCategory?: TerCategory;
  pph21Rate?: number;
  pph21TaxableGross?: number;
  bpjsKesEmployee?: number;
  bpjsJhtEmployee?: number;
  bpjsJpEmployee?: number;
  bpjsEmployerTotal?: number;
  taxCalculationMethod?: TaxCalculationMethod;
  status: PayrollStatus;
  notes: string;
  paidAt: string | null;
  emailSentAt: string | null;
  updatedAt: string;
}

export type UserRole = 'admin' | 'manager' | 'hrd' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AccountingEntryType = 'income' | 'expense';
export type AccountingEntryStatus = 'recorded' | 'reconciled';
export type AccountingSourceType = 'manual' | 'invoice' | 'payroll';

export interface AccountingEntry {
  id: string;
  entryNumber: string;
  date: string; // YYYY-MM-DD
  type: AccountingEntryType;
  category: string;
  accountName: string;
  description: string;
  counterparty: string;
  paymentMethod: string;
  amount: number;
  status: AccountingEntryStatus;
  sourceType: AccountingSourceType;
  sourceId: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BootstrapPayload {
  currentUser?: AuthUser;
  clients: Client[];
  products: Product[];
  employees: Employee[];
  payrolls: PayrollRecord[];
  leaveRequests?: LeaveRequest[];
  leaveEmployees?: LeaveEmployeeOption[];
  accountingEntries?: AccountingEntry[];
  invoices: Invoice[];
  schedules: RecurringSchedule[];
  emailLogs: EmailLog[];
  notifications: PaymentNotification[];
  users?: AuthUser[];
  settings: AppSettingsPublic;
  vapidPublicKey: string;
  serverTimestamp: string;
}
