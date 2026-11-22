import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  Download,
  FileDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  Pencil,
  Play,
  Plus,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  AccountingEntry,
  AppSettingsPublic,
  AuthUser,
  BootstrapPayload,
  Client,
  EmailLog,
  Employee,
  EmployeeContract,
  GoodsHandover,
  Invoice,
  InvoiceStatus,
  LeaveEmployeeOption,
  LeaveRequest,
  PaymentNotification,
  PayrollRecord,
  PayrollStatus,
  Product,
  RecurringSchedule,
} from './types';
import {
  exportInvoicesCsv,
  exportPayrollsCsv,
  formatDateId,
  formatDateTimeId,
  formatIdr,
  formatMonthId,
  INVOICE_STATUS_META,
  PAYROLL_STATUS_META,
} from './lib/formatters';
import { generatePayslipPdf } from './lib/payslipPdf';
import {
  type AppTab,
  ROLE_META,
  canAccessTab,
  getDefaultTabForRole,
  PERMISSIONS,
} from './lib/rbac';
import { PWAInstallButton } from './hooks/usePWAInstall';
import { usePushNotifications } from './hooks/usePushNotifications';
import { InvoiceModal } from './components/InvoiceModal';
import { InvoiceDetailDrawer } from './components/InvoiceDetailDrawer';
import { ScheduleModal } from './components/ScheduleModal';
import { ClientModal } from './components/ClientModal';
import { ProductModal } from './components/ProductModal';
import { EmployeeModal } from './components/EmployeeModal';
import { HandoversView } from './components/HandoversView';
import { HandoverModal } from './components/HandoverModal';
import { HandoverPreviewDrawer } from './components/HandoverPreviewDrawer';
import { ContractsView } from './components/ContractsView';
import { ContractModal } from './components/ContractModal';
import { ContractPreviewDrawer } from './components/ContractPreviewDrawer';
import { ContractVerifyView } from './components/ContractVerifyView';
import { PayrollModal } from './components/PayrollModal';
import { PayrollDetailDrawer } from './components/PayrollDetailDrawer';
import { LeaveModal } from './components/LeaveModal';
import { LeaveDetailDrawer } from './components/LeaveDetailDrawer';
import { LeavesView } from './components/LeavesView';
import { AccountingView } from './components/AccountingView';
import { AccountingModal } from './components/AccountingModal';
import { EmailPreviewModal } from './components/EmailPreviewModal';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { UsersView } from './components/UsersView';

const AUTH_TOKEN_KEY = 'ff_auth_token';
const AUTH_USER_KEY = 'ff_auth_user';

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

const DEFAULT_SETTINGS: AppSettingsPublic = {
  midtrans: {
    environment: 'sandbox',
    merchantId: '',
    clientKey: '',
    hasServerKey: false,
    serverKeyMasked: '',
    enabledPayments: ['qris', 'gopay', 'bca_va', 'bni_va', 'bri_va'],
    autoCreatePaymentLink: true,
    webhookUrl: '',
  },
  smtp: {
    host: '',
    port: 587,
    secure: false,
    username: '',
    hasPassword: false,
    passwordMasked: '',
    fromName: 'FakturaFlow Billing',
    fromEmail: 'billing@nusantarakarya.co.id',
    autoMonthlyEnabled: true,
  },
  company: {
    name: 'PT Nusantara Digital Karya',
    email: 'finance@nusantarakarya.co.id',
    phone: '+62 21 5082 4190',
    address: 'Gedung Treasury Tower Lt. 18, Jakarta Selatan',
    npwp: '01.842.910.4-012.000',
    bankName: 'Bank Mandiri',
    bankAccountNumber: '102-000-8841-920',
    bankAccountName: 'PT Nusantara Digital Karya',
  },
};

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_KEY) : null
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(AUTH_USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthUser;
      if (!parsed || typeof parsed !== 'object' || !(parsed.role in ROLE_META)) {
        window.localStorage.removeItem(AUTH_USER_KEY);
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        return null;
      }
      return parsed;
    } catch {
      window.localStorage.removeItem(AUTH_USER_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
  });
  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.localStorage.getItem(AUTH_TOKEN_KEY) && window.localStorage.getItem(AUTH_USER_KEY)
    );
  });

  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Domain State
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [handovers, setHandovers] = useState<GoodsHandover[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveEmployees, setLeaveEmployees] = useState<LeaveEmployeeOption[]>([]);
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [settings, setSettings] = useState<AppSettingsPublic>(DEFAULT_SETTINGS);
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [loading, setLoading] = useState(true);

  // UI & Filter State
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('all');
  const [payrollPeriodFilter, setPayrollPeriodFilter] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [payrollStatusFilter, setPayrollStatusFilter] = useState<'all' | PayrollStatus>('all');
  const [payrollSearch, setPayrollSearch] = useState('');
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);

  // Modals & Drawers
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringSchedule | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<EmployeeContract | null>(null);
  const [contractPreselectedEmpId, setContractPreselectedEmpId] = useState<string | undefined>(undefined);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [editingHandover, setEditingHandover] = useState<GoodsHandover | null>(null);
  const [selectedHandoverId, setSelectedHandoverId] = useState<string | null>(null);
  const [publicVerifyCode, setPublicVerifyCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.has('verify') ? params.get('verify') || '' : null;
  });
  const [verifyModalCode, setVerifyModalCode] = useState<string | null>(null);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [leavePreselectedEmpId, setLeavePreselectedEmpId] = useState<string | null>(null);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [accountingModalOpen, setAccountingModalOpen] = useState(false);
  const [editingAccounting, setEditingAccounting] = useState<AccountingEntry | null>(null);
  const [previewEmailLog, setPreviewEmailLog] = useState<EmailLog | null>(null);
  const [runningMonthly, setRunningMonthly] = useState(false);

  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const clearAuthSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.localStorage.removeItem(AUTH_USER_KEY);
    }
    setAuthToken(null);
    setCurrentUser(null);
    setUsers([]);
    setSelectedInvoiceId(null);
    setSelectedContractId(null);
    setSelectedPayrollId(null);
    setSelectedLeaveId(null);
  }, []);

  const apiFetch = useCallback(
    async (input: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers || {});
      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401 && !input.includes('/api/auth/login')) {
        clearAuthSession();
        showToast('Sesi login telah berakhir. Silakan masuk kembali.', 'error');
      }
      return res;
    },
    [authToken, clearAuthSession, showToast]
  );

  const {
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    subscribe: subscribePush,
    showForegroundNotification,
  } = usePushNotifications(vapidPublicKey, authToken);

  // Verify stored token on startup
  useEffect(() => {
    if (!authToken) {
      setAuthChecking(false);
      return;
    }
    let cancelled = false;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          clearAuthSession();
          return;
        }
        const data = (await res.json()) as { authenticated: boolean; user: AuthUser | null };
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
          setActiveTab((prev) =>
            canAccessTab(data.user!.role, prev) ? prev : getDefaultTabForRole(data.user!.role)
          );
        } else {
          clearAuthSession();
        }
      })
      .catch(() => {
        // Ignore transient startup network error
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, clearAuthSession]);

  // Keep activeTab valid whenever role changes
  useEffect(() => {
    if (currentUser && !canAccessTab(currentUser.role, activeTab)) {
      setActiveTab(getDefaultTabForRole(currentUser.role));
    }
  }, [currentUser, activeTab]);

  const currentUserId = currentUser?.id ?? null;

  // Load initial state directly from server
  const fetchBootstrap = useCallback(
    async (showSpinner = false) => {
      if (!authToken) {
        setLoading(false);
        return;
      }
      if (showSpinner) {
        setLoading(true);
      }
      try {
        const res = await apiFetch('/api/bootstrap');
        if (!res.ok) throw new Error('Bootstrap fetch failed');
        const data = (await res.json()) as BootstrapPayload;

        if (data.currentUser) {
          const nextUser = data.currentUser;
          setCurrentUser((prev) => {
            if (
              prev &&
              prev.id === nextUser.id &&
              prev.username === nextUser.username &&
              prev.name === nextUser.name &&
              prev.email === nextUser.email &&
              prev.role === nextUser.role &&
              prev.department === nextUser.department &&
              prev.active === nextUser.active
            ) {
              return prev;
            }
            return nextUser;
          });
          window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
        }
        if (data.users) {
          setUsers(data.users);
        } else {
          setUsers([]);
        }

        setClients(data.clients);
        setProducts(data.products);
        setEmployees(data.employees);
        setContracts(data.contracts || []);
        setHandovers(data.handovers || []);
        setPayrolls(data.payrolls);
        setLeaveRequests(data.leaveRequests || []);
        setLeaveEmployees(data.leaveEmployees || []);
        setAccountingEntries(data.accountingEntries || []);
        setInvoices(data.invoices);
        setSchedules(data.schedules);
        setEmailLogs(data.emailLogs);
        setNotifications(data.notifications);
        setSettings(data.settings);
        setVapidPublicKey(data.vapidPublicKey);
      } catch {
        showToast('Gagal memuat data terbaru dari server.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [authToken, apiFetch, showToast]
  );

  useEffect(() => {
    if (currentUserId && authToken && !authChecking) {
      void fetchBootstrap(true);
    }
  }, [currentUserId, authToken, authChecking, fetchBootstrap]);

  const handleLogin = useCallback(
    async (identifier: string, password: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          token?: string;
          user?: AuthUser;
          message?: string;
        };
        if (!res.ok || !data.ok || !data.token || !data.user) {
          return { ok: false, message: data.message || 'Gagal melakukan autentikasi.' };
        }
        window.localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        setAuthToken(data.token);
        setCurrentUser(data.user);
        setActiveTab(getDefaultTabForRole(data.user.role));
        showToast(
          `Selamat datang, ${data.user.name} (${(ROLE_META[data.user.role] || ROLE_META.user).label}).`,
          'success'
        );
        return { ok: true };
      } catch {
        return { ok: false, message: 'Tidak dapat terhubung ke server autentikasi.' };
      }
    },
    [showToast]
  );

  const handleLogout = useCallback(async () => {
    try {
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {
      // ignore network error on logout
    } finally {
      clearAuthSession();
      showToast('Anda telah keluar dari sesi.', 'info');
    }
  }, [authToken, clearAuthSession, showToast]);

  // Real-time SSE Payment Tracking
  useEffect(() => {
    if (!currentUserId || !authToken) return;

    const evtSource = new EventSource(`/api/events?token=${encodeURIComponent(authToken)}`);

    const safeParse = <T,>(e: Event): T | null => {
      try {
        return JSON.parse((e as MessageEvent).data) as T;
      } catch {
        return null;
      }
    };

    evtSource.addEventListener('invoice:updated', (e) => {
      const updated = safeParse<Invoice>(e);
      if (updated) setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
    });

    evtSource.addEventListener('invoice:created', (e) => {
      const created = safeParse<Invoice>(e);
      if (created) setInvoices((prev) => (prev.some((i) => i.id === created.id) ? prev : [created, ...prev]));
    });

    evtSource.addEventListener('invoice:deleted', (e) => {
      const payload = safeParse<{ id: string }>(e);
      if (payload?.id) setInvoices((prev) => prev.filter((inv) => inv.id !== payload.id));
    });

    evtSource.addEventListener('payroll:created', (e) => {
      const created = safeParse<PayrollRecord>(e);
      if (created) setPayrolls((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
    });

    evtSource.addEventListener('payroll:updated', (e) => {
      const updated = safeParse<PayrollRecord>(e);
      if (updated) {
        setPayrolls((prev) =>
          prev.some((p) => p.id === updated.id)
            ? prev.map((p) => (p.id === updated.id ? updated : p))
            : [updated, ...prev]
        );
      }
    });

    evtSource.addEventListener('payroll:deleted', (e) => {
      const payload = safeParse<{ id: string }>(e);
      if (payload?.id) setPayrolls((prev) => prev.filter((p) => p.id !== payload.id));
    });

    evtSource.addEventListener('contract_updated', (e) => {
      const payload = safeParse<{ contract?: EmployeeContract; employee?: Employee }>(e);
      if (payload?.contract) {
        const ctr = payload.contract;
        setContracts((prev) =>
          prev.some((c) => c.id === ctr.id)
            ? prev.map((c) => (c.id === ctr.id ? ctr : c))
            : [ctr, ...prev]
        );
      }
      if (payload?.employee) {
        const emp = payload.employee;
        setEmployees((prev) => prev.map((item) => (item.id === emp.id ? emp : item)));
      }
    });

    evtSource.addEventListener('contract_deleted', (e) => {
      const payload = safeParse<{ id: string }>(e);
      if (payload?.id) setContracts((prev) => prev.filter((c) => c.id !== payload.id));
    });

    evtSource.addEventListener('handover_updated', (e) => {
      const payload = safeParse<{ handover?: GoodsHandover }>(e);
      if (payload?.handover) {
        const updated = payload.handover;
        setHandovers((prev) =>
          prev.some((h) => h.id === updated.id)
            ? prev.map((h) => (h.id === updated.id ? updated : h))
            : [updated, ...prev]
        );
      }
    });

    evtSource.addEventListener('handover_deleted', (e) => {
      const payload = safeParse<{ id: string }>(e);
      if (payload?.id) setHandovers((prev) => prev.filter((h) => h.id !== payload.id));
    });

    evtSource.addEventListener('leave:created', (e) => {
      const created = safeParse<LeaveRequest>(e);
      if (created) setLeaveRequests((prev) => (prev.some((l) => l.id === created.id) ? prev : [created, ...prev]));
    });

    evtSource.addEventListener('leave:updated', (e) => {
      const updated = safeParse<LeaveRequest>(e);
      if (updated) {
        setLeaveRequests((prev) =>
          prev.some((l) => l.id === updated.id)
            ? prev.map((l) => (l.id === updated.id ? updated : l))
            : [updated, ...prev]
        );
      }
    });

    evtSource.addEventListener('leave:deleted', (e) => {
      const payload = safeParse<{ id: string }>(e);
      if (payload?.id) setLeaveRequests((prev) => prev.filter((l) => l.id !== payload.id));
    });

    evtSource.addEventListener('accounting:created', (e) => {
      const created = safeParse<AccountingEntry>(e);
      if (created) {
        setAccountingEntries((prev) =>
          prev.some((a) => a.id === created.id) ? prev : [created, ...prev]
        );
      }
    });

    evtSource.addEventListener('accounting:updated', (e) => {
      const updated = safeParse<AccountingEntry>(e);
      if (updated) {
        setAccountingEntries((prev) =>
          prev.some((a) => a.id === updated.id)
            ? prev.map((a) => (a.id === updated.id ? updated : a))
            : [updated, ...prev]
        );
      }
    });

    evtSource.addEventListener('accounting:deleted', (e) => {
      const payload = safeParse<{ id: string }>(e);
      if (payload?.id) setAccountingEntries((prev) => prev.filter((a) => a.id !== payload.id));
    });

    evtSource.addEventListener('email:logged', (e) => {
      const log = safeParse<EmailLog>(e);
      if (log) setEmailLogs((prev) => (prev.some((l) => l.id === log.id) ? prev : [log, ...prev]));
    });

    evtSource.addEventListener('notification:new', (e) => {
      const notif = safeParse<PaymentNotification>(e);
      if (!notif) return;
      setNotifications((prev) => (prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]));
      showToast(`${notif.title}: ${notif.message}`, notif.status === 'paid' ? 'success' : 'info');
      showForegroundNotification(notif.title, notif.message);
    });

    return () => {
      evtSource.close();
    };
  }, [currentUserId, authToken, showToast, showForegroundNotification]);

  // Listen to Service Worker push notification clicks
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION_CLICKED' && event.data?.invoiceId) {
        setActiveTab('invoices');
        setSelectedInvoiceId(event.data.invoiceId);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // --- CRUD Handlers ---
  const handleSaveInvoice = async (invoice: Invoice, sendAfterSave: boolean) => {
    const res = await apiFetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice),
    });
    const data = (await res.json()) as { ok: boolean; invoice: Invoice; message?: string };
    if (data.ok) {
      setInvoices((prev) => {
        const exists = prev.some((i) => i.id === data.invoice.id);
        return exists
          ? prev.map((i) => (i.id === data.invoice.id ? data.invoice : i))
          : [data.invoice, ...prev];
      });
      if (sendAfterSave) {
        await handleSendInvoiceEmail(data.invoice.id);
      } else {
        showToast(`Faktur ${data.invoice.invoiceNumber} berhasil disimpan.`, 'success');
      }
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const res = await apiFetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus faktur.', 'error');
      return;
    }
    setInvoices((prev) => prev.filter((i) => i.id !== invoice.id));
    showToast(`Faktur ${invoice.invoiceNumber} dihapus.`, 'info');
  };

  const handleSendInvoiceEmail = async (invoiceId: string) => {
    const res = await apiFetch(`/api/invoices/${invoiceId}/send-email`, { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; message: string; log?: EmailLog };
    showToast(data.message, data.ok ? 'success' : 'error');
    if (data.log) {
      setEmailLogs((prev) => (prev.some((l) => l.id === data.log!.id) ? prev : [data.log!, ...prev]));
    }
  };

  const handleCreateMidtransLink = async (invoiceId: string) => {
    const res = await apiFetch(`/api/midtrans/create-transaction/${invoiceId}`, { method: 'POST' });
    const data = (await res.json()) as {
      ok: boolean;
      snapToken?: string;
      redirectUrl?: string;
      message: string;
    };
    showToast(data.message, data.ok ? 'success' : 'error');
    return data;
  };

  const handleCheckMidtransStatus = async (invoiceId: string) => {
    const res = await apiFetch(`/api/midtrans/status/${invoiceId}`);
    const data = (await res.json()) as { ok: boolean; invoice?: Invoice; message: string };
    showToast(data.message, data.ok ? 'success' : 'info');
    if (data.invoice) {
      setInvoices((prev) => prev.map((i) => (i.id === data.invoice!.id ? data.invoice! : i)));
    }
  };

  const handleOpenSnapPopup = (snapToken: string) => {
    const clientKey = settings.midtrans.clientKey;
    if (!clientKey) {
      showToast('Client Key Midtrans belum diisi di Pengaturan API.', 'error');
      return;
    }

    const scriptSrc =
      settings.midtrans.environment === 'production'
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';

    const launch = () => {
      if (window.snap) {
        window.snap.pay(snapToken, {
          onSuccess: () => showToast('Pembayaran Midtrans berhasil diselesaikan.', 'success'),
          onPending: () => showToast('Pembayaran sedang menunggu penyelesaian.', 'info'),
          onError: () => showToast('Terjadi kesalahan pada proses pembayaran Midtrans.', 'error'),
        });
      }
    };

    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
    if (existingScript && window.snap) {
      launch();
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.setAttribute('data-client-key', clientKey);
    script.onload = launch;
    document.body.appendChild(script);
  };

  const handleSaveSchedule = async (schedule: RecurringSchedule) => {
    const res = await apiFetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
    const data = (await res.json()) as { ok: boolean; schedule: RecurringSchedule; message?: string };
    if (data.ok) {
      setSchedules((prev) => {
        const exists = prev.some((s) => s.id === data.schedule.id);
        return exists
          ? prev.map((s) => (s.id === data.schedule.id ? data.schedule : s))
          : [data.schedule, ...prev];
      });
      showToast(`Jadwal bulanan "${data.schedule.title}" disimpan.`, 'success');
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleRunMonthlyDispatch = async () => {
    setRunningMonthly(true);
    try {
      const res = await apiFetch('/api/schedules/run-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceAllActive: true }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message: string;
        createdInvoices: Invoice[];
        emailLogs: EmailLog[];
      };
      showToast(data.message, data.ok ? 'success' : 'error');
      await fetchBootstrap();
    } finally {
      setRunningMonthly(false);
    }
  };

  const handleSaveClient = async (client: Client) => {
    const res = await apiFetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    });
    const data = (await res.json()) as { ok: boolean; client: Client; message?: string };
    if (data.ok) {
      setClients((prev) => {
        const exists = prev.some((c) => c.id === data.client.id);
        return exists
          ? prev.map((c) => (c.id === data.client.id ? data.client : c))
          : [data.client, ...prev];
      });
      showToast(`Klien ${data.client.companyName} disimpan.`, 'success');
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleDeleteClient = async (client: Client) => {
    const res = await apiFetch(`/api/clients/${client.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus klien.', 'error');
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== client.id));
    showToast(`Klien ${client.companyName} dihapus.`, 'info');
  };

  const handleSaveProduct = async (product: Product) => {
    const res = await apiFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    const data = (await res.json()) as { ok: boolean; product: Product; message?: string };
    if (data.ok) {
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === data.product.id);
        return exists
          ? prev.map((p) => (p.id === data.product.id ? data.product : p))
          : [data.product, ...prev];
      });
      showToast(`Produk "${data.product.name}" disimpan.`, 'success');
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const res = await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus produk.', 'error');
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    showToast(`Produk "${product.name}" dihapus.`, 'info');
  };

  // --- Employees & Payroll Handlers ---
  const handleSaveEmployee = async (emp: Employee) => {
    const res = await apiFetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emp),
    });
    const data = (await res.json()) as { ok: boolean; employee: Employee; message?: string };
    if (data.ok) {
      setEmployees((prev) => {
        const exists = prev.some((e) => e.id === data.employee.id);
        return exists
          ? prev.map((e) => (e.id === data.employee.id ? data.employee : e))
          : [...prev, data.employee];
      });
      showToast(`Data karyawan ${data.employee.name} disimpan.`, 'success');
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    const res = await apiFetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus karyawan.', 'error');
      return;
    }
    setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    showToast(`Karyawan ${emp.name} dihapus.`, 'info');
  };

  const handleSaveContract = async (
    payload: Partial<EmployeeContract> & { syncEmployeeType?: boolean }
  ) => {
    const res = await apiFetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      ok: boolean;
      contract?: EmployeeContract;
      employee?: Employee;
      message?: string;
    };
    if (data.ok && data.contract) {
      const saved = data.contract;
      setContracts((prev) =>
        prev.some((c) => c.id === saved.id)
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [saved, ...prev]
      );
      if (data.employee) {
        const updatedEmp = data.employee;
        setEmployees((prev) =>
          prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e))
        );
      }
      showToast(
        `${saved.contractType === 'pkwt' ? 'Surat PKWT' : 'SK Pengangkatan'} ${saved.contractNumber} disimpan.`,
        'success'
      );
    } else {
      showToast(data.message || 'Gagal menyimpan dokumen kontrak/SK.', 'error');
      throw new Error(data.message || 'Save contract failed');
    }
  };

  const handleDeleteContract = async (ctr: EmployeeContract) => {
    const res = await apiFetch(`/api/contracts/${ctr.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus dokumen kontrak.', 'error');
      return;
    }
    setContracts((prev) => prev.filter((c) => c.id !== ctr.id));
    if (selectedContractId === ctr.id) {
      setSelectedContractId(null);
    }
    showToast(`Dokumen ${ctr.contractNumber} dihapus.`, 'info');
  };

  const handleSaveHandover = async (payload: Partial<GoodsHandover>) => {
    const res = await apiFetch('/api/handovers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      ok: boolean;
      handover?: GoodsHandover;
      message?: string;
    };
    if (data.ok && data.handover) {
      const saved = data.handover;
      setHandovers((prev) =>
        prev.some((h) => h.id === saved.id)
          ? prev.map((h) => (h.id === saved.id ? saved : h))
          : [saved, ...prev]
      );
      showToast(`BAST ${saved.handoverNumber} berhasil disimpan.`, 'success');
    } else {
      showToast(data.message || 'Gagal menyimpan dokumen serah terima barang.', 'error');
      throw new Error(data.message || 'Save handover failed');
    }
  };

  const handleMarkHandoverReceived = async (h: GoodsHandover) => {
    const res = await apiFetch(`/api/handovers/${h.id}/mark-received`, {
      method: 'POST',
    });
    const data = (await res.json()) as {
      ok: boolean;
      handover?: GoodsHandover;
      message?: string;
    };
    if (data.ok && data.handover) {
      const saved = data.handover;
      setHandovers((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      showToast(`BAST ${saved.handoverNumber} dikonfirmasi diterima sah.`, 'success');
    } else {
      showToast(data.message || 'Gagal memperbarui status BAST.', 'error');
    }
  };

  const handleDeleteHandover = async (h: GoodsHandover) => {
    const res = await apiFetch(`/api/handovers/${h.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus dokumen BAST.', 'error');
      return;
    }
    setHandovers((prev) => prev.filter((item) => item.id !== h.id));
    if (selectedHandoverId === h.id) {
      setSelectedHandoverId(null);
    }
    showToast(`Dokumen ${h.handoverNumber} dihapus.`, 'info');
  };

  const handleSavePayroll = async (pay: PayrollRecord) => {
    const res = await apiFetch('/api/payrolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pay),
    });
    const data = (await res.json()) as { ok: boolean; payroll: PayrollRecord; message?: string };
    if (data.ok) {
      setPayrolls((prev) => {
        const exists = prev.some((p) => p.id === data.payroll.id);
        return exists
          ? prev.map((p) => (p.id === data.payroll.id ? data.payroll : p))
          : [data.payroll, ...prev];
      });
      showToast(`Slip gaji ${data.payroll.slipNumber} disimpan.`, 'success');
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleDeletePayroll = async (pay: PayrollRecord) => {
    const res = await apiFetch(`/api/payrolls/${pay.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus slip gaji.', 'error');
      return;
    }
    setPayrolls((prev) => prev.filter((p) => p.id !== pay.id));
    showToast(`Slip gaji ${pay.slipNumber} dihapus.`, 'info');
  };

  const handleGenerateMonthlyPayroll = async () => {
    setGeneratingPayroll(true);
    try {
      const periodMonth = payrollPeriodFilter || new Date().toISOString().slice(0, 7);
      const res = await apiFetch('/api/payrolls/generate-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodMonth,
          payDate: `${periodMonth}-25`,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message: string;
        createdPayrolls?: PayrollRecord[];
      };
      showToast(data.message, data.createdPayrolls?.length ? 'success' : 'info');
      if (data.createdPayrolls?.length) {
        setPayrolls((prev) => [...data.createdPayrolls!, ...prev]);
      }
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const handleMarkPayrollPaid = async (payrollId: string) => {
    const res = await apiFetch(`/api/payrolls/${payrollId}/mark-paid`, { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; payroll?: PayrollRecord; message?: string };
    if (data.ok && data.payroll) {
      setPayrolls((prev) => prev.map((p) => (p.id === data.payroll!.id ? data.payroll! : p)));
      showToast(`Slip ${data.payroll.slipNumber} ditandai sudah dibayar.`, 'success');
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleSendPayrollEmail = async (payrollId: string) => {
    const res = await apiFetch(`/api/payrolls/${payrollId}/send-email`, { method: 'POST' });
    const data = (await res.json()) as {
      ok: boolean;
      message: string;
      log?: EmailLog;
      payroll?: PayrollRecord;
    };
    showToast(data.message, data.ok ? 'success' : 'error');
    if (data.log) {
      setEmailLogs((prev) => (prev.some((l) => l.id === data.log!.id) ? prev : [data.log!, ...prev]));
    }
    if (data.payroll) {
      setPayrolls((prev) => prev.map((p) => (p.id === data.payroll!.id ? data.payroll! : p)));
    }
  };

  const handleSaveUser = async (
    payload: Partial<AuthUser> & { password?: string }
  ): Promise<{ ok: boolean; message?: string }> => {
    const res = await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; user?: AuthUser; message?: string };
    if (!res.ok || !data.ok || !data.user) {
      return { ok: false, message: data.message || 'Gagal menyimpan pengguna.' };
    }
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === data.user!.id);
      return exists ? prev.map((u) => (u.id === data.user!.id ? data.user! : u)) : [...prev, data.user!];
    });
    showToast(`Akun ${data.user.name} (@${data.user.username}) berhasil disimpan.`, 'success');
    return { ok: true };
  };

  const handleDeleteUser = async (
    targetUser: AuthUser
  ): Promise<{ ok: boolean; message?: string }> => {
    const res = await apiFetch(`/api/users/${targetUser.id}`, { method: 'DELETE' });
    const data = (await res.json()) as { ok: boolean; message?: string };
    if (!res.ok || !data.ok) {
      showToast(data.message || 'Gagal menghapus pengguna.', 'error');
      return { ok: false, message: data.message };
    }
    setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    showToast(`Pengguna @${targetUser.username} dihapus.`, 'info');
    return { ok: true };
  };

  // --- Leave Requests & HRD Approval Handlers ---
  const handleSaveLeave = async (leave: LeaveRequest) => {
    const res = await apiFetch('/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leave),
    });
    const data = (await res.json()) as { ok: boolean; leave?: LeaveRequest; message?: string };
    if (res.ok && data.ok && data.leave) {
      setLeaveRequests((prev) => {
        const exists = prev.some((l) => l.id === data.leave!.id);
        return exists
          ? prev.map((l) => (l.id === data.leave!.id ? data.leave! : l))
          : [data.leave!, ...prev];
      });
      showToast(
        `Pengajuan cuti ${data.leave.requestNumber} dikirim untuk tinjauan HRD.`,
        'success'
      );
    } else {
      showToast(data.message || 'Gagal menyimpan pengajuan cuti.', 'error');
    }
  };

  const handleDecideLeave = async (
    leaveId: string,
    decision: 'approved' | 'rejected',
    hrdNotes: string
  ) => {
    const res = await apiFetch(`/api/leaves/${leaveId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, hrdNotes }),
    });
    const data = (await res.json()) as { ok: boolean; leave?: LeaveRequest; message?: string };
    if (res.ok && data.ok && data.leave) {
      setLeaveRequests((prev) => prev.map((l) => (l.id === data.leave!.id ? data.leave! : l)));
      showToast(
        decision === 'approved'
          ? `Pengajuan ${data.leave.requestNumber} disetujui oleh HRD.`
          : `Pengajuan ${data.leave.requestNumber} ditolak oleh HRD.`,
        decision === 'approved' ? 'success' : 'info'
      );
    } else {
      showToast(data.message || 'Gagal memproses keputusan HRD.', 'error');
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    const res = await apiFetch(`/api/leaves/${leaveId}/cancel`, { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; leave?: LeaveRequest; message?: string };
    if (res.ok && data.ok && data.leave) {
      setLeaveRequests((prev) => prev.map((l) => (l.id === data.leave!.id ? data.leave! : l)));
      showToast(`Pengajuan ${data.leave.requestNumber} dibatalkan.`, 'info');
    } else {
      showToast(data.message || 'Gagal membatalkan pengajuan cuti.', 'error');
    }
  };

  const handleDeleteLeave = async (leave: LeaveRequest) => {
    const res = await apiFetch(`/api/leaves/${leave.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus pengajuan cuti.', 'error');
      return;
    }
    setLeaveRequests((prev) => prev.filter((l) => l.id !== leave.id));
    showToast(`Pengajuan cuti ${leave.requestNumber} dihapus.`, 'info');
  };

  // --- Simple Office Accounting Handlers ---
  const handleSaveAccounting = async (entry: AccountingEntry) => {
    const res = await apiFetch('/api/accounting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = (await res.json()) as {
      ok: boolean;
      entry?: AccountingEntry;
      message?: string;
    };
    if (!res.ok || !data.ok || !data.entry) {
      throw new Error(data.message || 'Gagal menyimpan transaksi akuntansi.');
    }
    setAccountingEntries((prev) => {
      const exists = prev.some((a) => a.id === data.entry!.id);
      return exists
        ? prev.map((a) => (a.id === data.entry!.id ? data.entry! : a))
        : [data.entry!, ...prev];
    });
    showToast(`Jurnal ${data.entry.entryNumber} berhasil disimpan.`, 'success');
  };

  const handleToggleAccountingReconcile = async (entry: AccountingEntry) => {
    const res = await apiFetch(`/api/accounting/${entry.id}/reconcile`, { method: 'POST' });
    const data = (await res.json()) as {
      ok: boolean;
      entry?: AccountingEntry;
      message?: string;
    };
    if (res.ok && data.ok && data.entry) {
      setAccountingEntries((prev) =>
        prev.map((a) => (a.id === data.entry!.id ? data.entry! : a))
      );
      showToast(
        data.entry.status === 'reconciled'
          ? `Jurnal ${data.entry.entryNumber} ditandai terekonsiliasi.`
          : `Jurnal ${data.entry.entryNumber} dikembalikan ke status tercatat.`,
        'success'
      );
    } else if (data.message) {
      showToast(data.message, 'error');
    }
  };

  const handleDeleteAccounting = async (entry: AccountingEntry) => {
    const res = await apiFetch(`/api/accounting/${entry.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      showToast(err.message || 'Gagal menghapus transaksi akuntansi.', 'error');
      return;
    }
    setAccountingEntries((prev) => prev.filter((a) => a.id !== entry.id));
    showToast(`Jurnal ${entry.entryNumber} dihapus.`, 'info');
  };

  const handleSyncAccountingOperations = async () => {
    const res = await apiFetch('/api/accounting/sync-operations', { method: 'POST' });
    const data = (await res.json()) as {
      ok: boolean;
      createdCount?: number;
      entries?: AccountingEntry[];
      message?: string;
    };
    if (res.ok && data.ok) {
      if (data.entries) setAccountingEntries(data.entries);
      showToast(
        data.message || 'Sinkronisasi transaksi operasional selesai.',
        data.createdCount ? 'success' : 'info'
      );
    } else {
      showToast(data.message || 'Gagal menarik data faktur & payroll.', 'error');
    }
  };

  // --- Computed Metrics & Filtering ---
  const metrics = useMemo(() => {
    const paidTotal = invoices
      .filter((i) => i.status === 'paid')
      .reduce((acc, i) => acc + i.totalAmount, 0);
    const pendingTotal = invoices
      .filter((i) => i.status === 'pending')
      .reduce((acc, i) => acc + i.totalAmount, 0);
    const overdueTotal = invoices
      .filter((i) => i.status === 'overdue')
      .reduce((acc, i) => acc + i.totalAmount, 0);
    const activeSchedules = schedules.filter((s) => s.active).length;

    return {
      paidTotal,
      pendingTotal,
      overdueTotal,
      activeSchedules,
      paidCount: invoices.filter((i) => i.status === 'paid').length,
      pendingCount: invoices.filter((i) => i.status === 'pending').length,
      overdueCount: invoices.filter((i) => i.status === 'overdue').length,
    };
  }, [invoices, schedules]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.clientCompany.toLowerCase().includes(q) ||
          inv.clientName.toLowerCase().includes(q) ||
          inv.clientEmail.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const employeeDepartments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department))).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (empDeptFilter !== 'all' && emp.department !== empDeptFilter) return false;
      if (empSearch.trim()) {
        const q = empSearch.toLowerCase();
        return (
          emp.nip.toLowerCase().includes(q) ||
          emp.name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.position.toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, empDeptFilter, empSearch]);

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((pay) => {
      if (payrollPeriodFilter && pay.periodMonth !== payrollPeriodFilter) return false;
      if (payrollStatusFilter !== 'all' && pay.status !== payrollStatusFilter) return false;
      if (payrollSearch.trim()) {
        const q = payrollSearch.toLowerCase();
        return (
          pay.slipNumber.toLowerCase().includes(q) ||
          pay.employeeName.toLowerCase().includes(q) ||
          pay.employeeNip.toLowerCase().includes(q) ||
          pay.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payrolls, payrollPeriodFilter, payrollStatusFilter, payrollSearch]);

  const payrollSummary = useMemo(() => {
    const periodRows = payrolls.filter((p) =>
      payrollPeriodFilter ? p.periodMonth === payrollPeriodFilter : true
    );
    const totalGross = periodRows.reduce((acc, p) => acc + p.grossPay, 0);
    const totalDeductions = periodRows.reduce((acc, p) => acc + p.totalDeductions, 0);
    const totalNet = periodRows.reduce((acc, p) => acc + p.netPay, 0);
    const paidCount = periodRows.filter((p) => p.status === 'paid').length;
    return {
      totalGross,
      totalDeductions,
      totalNet,
      paidCount,
      totalCount: periodRows.length,
    };
  }, [payrolls, payrollPeriodFilter]);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  );

  const selectedPayroll = useMemo(
    () => payrolls.find((p) => p.id === selectedPayrollId) || null,
    [payrolls, selectedPayrollId]
  );

  const effectiveLeaveEmployees = useMemo<LeaveEmployeeOption[]>(() => {
    const currentYear = String(new Date().getFullYear());
    const usedByEmp = new Map<string, number>();
    for (const lv of leaveRequests) {
      if (
        lv.status === 'approved' &&
        lv.leaveType === 'tahunan' &&
        lv.startDate.startsWith(currentYear)
      ) {
        usedByEmp.set(lv.employeeId, (usedByEmp.get(lv.employeeId) || 0) + lv.totalDays);
      }
    }

    if (employees.length > 0) {
      return employees
        .filter((e) => e.status === 'active')
        .map((e) => ({
          id: e.id,
          nip: e.nip,
          name: e.name,
          email: e.email,
          department: e.department,
          position: e.position,
          annualLeaveQuota: e.annualLeaveQuota ?? 12,
          usedAnnualDays: usedByEmp.get(e.id) || 0,
        }));
    }

    return leaveEmployees;
  }, [employees, leaveEmployees, leaveRequests]);

  const selectedLeave = useMemo(
    () => leaveRequests.find((l) => l.id === selectedLeaveId) || null,
    [leaveRequests, selectedLeaveId]
  );

  const pendingLeaveCount = useMemo(
    () => leaveRequests.filter((l) => l.status === 'pending').length,
    [leaveRequests]
  );

  const tabLabels: Record<AppTab, string> = {
    overview: 'Ikhtisar Keuangan & Operasional',
    invoices: 'Faktur & Tagihan',
    schedules: 'Jadwal Email Bulanan',
    products: 'Katalog Produk & Layanan',
    clients: 'Daftar Klien',
    handovers: 'Bukti Serah Terima Barang (BAST)',
    accounting: 'Akuntansi & Buku Kas Kantor',
    employees: 'Data Karyawan',
    contracts: 'Kontrak Kerja (PKWT) & SK Pengangkatan',
    payroll: 'Penggajian & Slip Gaji',
    leaves: 'Cuti Karyawan & Persetujuan HRD',
    emails: 'Log Pengiriman Email',
    users: 'Hak Akses & Manajemen User',
    settings: 'Pengaturan Perusahaan & API',
  };

  const renderStatusText = (status: InvoiceStatus) => {
    const meta = INVOICE_STATUS_META[status] || INVOICE_STATUS_META.draft;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.textClass}`}>
        {status === 'paid' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
        {status === 'pending' && <Clock className="w-3.5 h-3.5 shrink-0" />}
        {status === 'overdue' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
        <span>{meta.label}</span>
      </span>
    );
  };

  if (publicVerifyCode !== null) {
    return (
      <ContractVerifyView
        initialCode={publicVerifyCode}
        standalone={true}
        onBack={() => {
          setPublicVerifyCode(null);
          if (typeof window !== 'undefined' && window.location.search.includes('verify=')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('verify');
            window.history.replaceState({}, '', url.toString());
          }
        }}
      />
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-sm text-slate-600">
        Memverifikasi sesi pengguna...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        onLogin={handleLogin}
        onOpenVerify={() => setPublicVerifyCode('')}
      />
    );
  }

  const userRole = currentUser.role in ROLE_META ? currentUser.role : 'user';
  const navItems: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }> = (
    [
      { id: 'overview', label: 'Ikhtisar', icon: LayoutDashboard },
      { id: 'invoices', label: 'Faktur & Tagihan', icon: FileText },
      { id: 'schedules', label: 'Jadwal Bulanan', icon: CalendarClock },
      { id: 'products', label: 'Produk & Layanan', icon: Package },
      { id: 'clients', label: 'Daftar Klien', icon: Users },
      { id: 'handovers', label: 'Serah Terima (BAST)', icon: ClipboardCheck },
      { id: 'accounting', label: 'Akuntansi Kantor', icon: BookOpen },
      { id: 'employees', label: 'Data Karyawan', icon: UserCheck },
      { id: 'contracts', label: 'Kontrak & SK', icon: ScrollText },
      { id: 'leaves', label: 'Cuti Karyawan', icon: CalendarDays },
      { id: 'payroll', label: 'Penggajian', icon: Banknote },
      { id: 'emails', label: 'Log Email', icon: Mail },
      { id: 'users', label: 'Hak Akses & User', icon: ShieldCheck },
      { id: 'settings', label: 'Pengaturan', icon: Settings },
    ] as const
  ).filter((item) => canAccessTab(userRole, item.id));

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (260px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab(getDefaultTabForRole(userRole))}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            FakturaFlow
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active User Role & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
              <div className="text-[11px] text-blue-400 font-medium truncate">
                {ROLE_META[userRole].label} · @{currentUser.username}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
              title="Keluar dari Sesi"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Three-Zone Contract) */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">
                {(ROLE_META[userRole] || ROLE_META.user).label}
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {tabLabels[activeTab] || 'FakturaFlow'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Real-Time Push Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={async () => {
                  setNotifPopoverOpen((prev) => !prev);
                  if (!notifPopoverOpen && unreadNotifCount > 0) {
                    await apiFetch('/api/notifications/mark-read', { method: 'POST' });
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  }
                }}
                className="relative rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 transition-colors"
                aria-label="Notifikasi Pembayaran"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold text-white font-mono">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <span className="text-xs font-semibold text-slate-900">
                      Pelacakan Status Real-Time
                    </span>
                    {!isPushSubscribed && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await subscribePush();
                          showToast(res.message, res.ok ? 'success' : 'error');
                        }}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                      >
                        Aktifkan Push
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Belum ada aktivitas notifikasi terbaru.
                      </div>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifPopoverOpen(false);
                            if (canAccessTab(userRole, 'invoices') && invoices.some((i) => i.id === n.invoiceId)) {
                              setSelectedInvoiceId(n.invoiceId);
                            } else if (canAccessTab(userRole, 'payroll') && payrolls.some((p) => p.id === n.invoiceId)) {
                              setSelectedPayrollId(n.invoiceId);
                            } else if (canAccessTab(userRole, 'leaves') && leaveRequests.some((l) => l.id === n.invoiceId)) {
                              setActiveTab('leaves');
                              setSelectedLeaveId(n.invoiceId);
                            }
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-900 truncate">{n.title}</span>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">
                              {formatDateTimeId(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Primary CTA based on Role */}
            {PERMISSIONS.canCreateEditInvoice(userRole) ? (
              <button
                type="button"
                onClick={() => {
                  setEditingInvoice(null);
                  setInvoiceModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Faktur</span>
              </button>
            ) : (
              PERMISSIONS.canManageEmployees(userRole) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmployee(null);
                    setEmployeeModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Karyawan</span>
                </button>
              )
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {/* TAB 1: IKHTISAR (ROLE-AWARE OVERVIEW) */}
              {activeTab === 'overview' && userRole === 'hrd' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">Karyawan Aktif</span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {employees.filter((e) => e.status === 'active').length} Orang
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {employeeDepartments.length} divisi perusahaan
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">
                        Total Take Home Pay ({formatMonthId(payrollPeriodFilter)})
                      </span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {formatIdr(payrollSummary.totalNet)}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {payrollSummary.totalCount} slip gaji periode ini
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">
                        Potongan PPh 21 &amp; BPJS
                      </span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-700">
                        {formatIdr(payrollSummary.totalDeductions)}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">Terhitung otomatis di slip</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">
                        Menunggu Persetujuan Cuti
                      </span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
                        {pendingLeaveCount} Pengajuan
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('leaves')}
                        className="mt-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                      >
                        Tinjau Pengajuan Cuti →
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          Daftar Slip Gaji Terbaru
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Klik baris untuk melihat rincian, mengunduh PDF, atau mengirim email slip.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('payroll')}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                      >
                        Buka Penggajian
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-2.5 px-4">No. Slip &amp; Karyawan</th>
                            <th className="py-2.5 px-4">Periode</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-right">Take Home Pay</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {payrolls.slice(0, 6).map((pay) => (
                            <tr
                              key={pay.id}
                              onClick={() => setSelectedPayrollId(pay.id)}
                              className="hover:bg-slate-50 cursor-pointer"
                            >
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{pay.employeeName}</div>
                                <div className="text-xs text-slate-500 font-mono">
                                  {pay.slipNumber} · {pay.department}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600">
                                {formatMonthId(pay.periodMonth)}
                              </td>
                              <td className="py-3 px-4 text-xs">
                                <span
                                  className={`font-medium ${PAYROLL_STATUS_META[pay.status].textClass}`}
                                >
                                  {PAYROLL_STATUS_META[pay.status].label}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                                {formatIdr(pay.netPay)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'overview' && userRole !== 'hrd' && (
                <div className="space-y-6">
                  {/* 4-Column Flat KPI Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">
                        Total Pendapatan Lunas
                      </span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {formatIdr(metrics.paidTotal)}
                      </div>
                      <p className="mt-1.5 text-xs text-emerald-700">
                        {metrics.paidCount} faktur diselesaikan
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">
                        Menunggu Pembayaran
                      </span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {formatIdr(metrics.pendingTotal)}
                      </div>
                      <p className="mt-1.5 text-xs text-amber-700">
                        {metrics.pendingCount} faktur aktif Midtrans
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">Faktur Jatuh Tempo</span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {formatIdr(metrics.overdueTotal)}
                      </div>
                      <p className="mt-1.5 text-xs text-red-700">
                        {metrics.overdueCount} perlu tindak lanjut
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <span className="text-xs font-medium text-slate-500">
                        Jadwal Email Bulanan
                      </span>
                      <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {metrics.activeSchedules} Kontrak
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Otomatis terbit &amp; terkirim tiap bulan
                      </p>
                    </div>
                  </div>

                  {/* Main Split: Recent Invoices Table + Real-Time Payment Feed */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
                    <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white flex flex-col">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            Faktur Perusahaan Terbaru
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Klik baris faktur untuk melihat rincian dan mengunduh PDF.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('invoices')}
                          className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                        >
                          Lihat Semua
                        </button>
                      </div>

                      <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                              <th className="py-2.5 px-4">Faktur &amp; Klien</th>
                              <th className="py-2.5 px-4">Jatuh Tempo</th>
                              <th className="py-2.5 px-4">Status</th>
                              <th className="py-2.5 px-4 text-right">Total Tagihan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-sm">
                            {invoices.slice(0, 6).map((inv) => (
                              <tr
                                key={inv.id}
                                onClick={() => setSelectedInvoiceId(inv.id)}
                                className="hover:bg-slate-50 cursor-pointer transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <div className="font-medium text-slate-900">
                                    {inv.clientCompany}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                                    {inv.invoiceNumber} · {inv.clientEmail}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                                  {formatDateId(inv.dueDate)}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {renderStatusText(inv.status)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                                  {formatIdr(inv.totalAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Real-Time Payment Status & Push Console */}
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            Aktivitas Pembayaran Real-Time
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Webhook Midtrans &amp; notifikasi push
                          </p>
                        </div>
                        {!isPushSubscribed && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await subscribePush();
                              showToast(res.message, res.ok ? 'success' : 'error');
                            }}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 whitespace-nowrap shrink-0"
                          >
                            Aktifkan Push
                          </button>
                        )}
                      </div>

                      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[380px]">
                        {notifications.slice(0, 6).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (invoices.some((i) => i.id === n.invoiceId)) {
                                setSelectedInvoiceId(n.invoiceId);
                              }
                            }}
                            className="px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {n.title}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                                {formatDateId(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {n.message}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-xl flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600">
                          Gateway Midtrans:{' '}
                          <strong className="text-slate-900">
                            {settings.midtrans.hasServerKey
                              ? `Terhubung (${settings.midtrans.environment})`
                              : 'Belum dikonfigurasi'}
                          </strong>
                        </span>
                        {PERMISSIONS.canManageSettings(userRole) && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('settings')}
                            className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                          >
                            Atur API
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FAKTUR & TAGIHAN */}
              {activeTab === 'invoices' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
                      {(
                        [
                          { id: 'all', label: 'Semua' },
                          { id: 'pending', label: 'Menunggu' },
                          { id: 'paid', label: 'Lunas' },
                          { id: 'overdue', label: 'Jatuh Tempo' },
                          { id: 'draft', label: 'Draf' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStatusFilter(tab.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            statusFilter === tab.id
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nomor faktur atau klien..."
                          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => exportInvoicesCsv(filteredInvoices)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Ekspor CSV</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">Nomor Faktur</th>
                            <th className="py-3 px-4">Klien</th>
                            <th className="py-3 px-4">Terbit / Jatuh Tempo</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Total Tagihan</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                                Tidak ada faktur yang sesuai dengan filter saat ini.
                              </td>
                            </tr>
                          ) : (
                            filteredInvoices.map((inv) => (
                              <tr
                                key={inv.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceId(inv.id)}
                                    className="hover:text-blue-700 hover:underline text-left"
                                  >
                                    {inv.invoiceNumber}
                                  </button>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-slate-900">
                                    {inv.clientCompany}
                                  </div>
                                  <div className="text-xs text-slate-500">{inv.clientEmail}</div>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                                  <span>{formatDateId(inv.issueDate)}</span>
                                  <span className="mx-1.5 text-slate-300">/</span>
                                  <span>{formatDateId(inv.dueDate)}</span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  {renderStatusText(inv.status)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                                  {formatIdr(inv.totalAmount)}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedInvoiceId(inv.id)}
                                      className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      Detail / Bayar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingInvoice(inv);
                                        setInvoiceModalOpen(true);
                                      }}
                                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                      title="Ubah Faktur"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteInvoice(inv)}
                                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                      title="Hapus Faktur"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: JADWAL PENGIRIMAN BULANAN */}
              {activeTab === 'schedules' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-slate-900">
                        Otomatisasi Penagihan &amp; Email Bulanan
                      </h1>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Faktur diterbitkan otomatis setiap bulan sesuai tanggal tagih dan dikirim
                        melalui email beserta tautan Midtrans.
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={runningMonthly}
                        onClick={handleRunMonthlyDispatch}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {runningMonthly
                            ? 'Mengirim Faktur Bulanan...'
                            : 'Jalankan Pengiriman Bulanan Sekarang'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSchedule(null);
                          setScheduleModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Jadwal</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">Kontrak &amp; Klien</th>
                            <th className="py-3 px-4">Jadwal Bulanan</th>
                            <th className="py-3 px-4">Otomatisasi</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Nilai Tagihan (+PPN)</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {schedules.map((sch) => {
                            const sub = sch.items.reduce(
                              (acc, it) => acc + it.quantity * it.unitPrice,
                              0
                            );
                            const tot = sub + Math.round((sub * sch.taxRate) / 100);
                            return (
                              <tr key={sch.id} className="hover:bg-slate-50">
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-slate-900">{sch.title}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {sch.clientCompany} · {sch.clientEmail}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                                  Setiap tanggal <strong className="font-mono">{sch.dayOfMonth}</strong>
                                  <span className="block text-slate-500 mt-0.5">
                                    Terakhir: {sch.lastRunMonth || 'Belum pernah'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600">
                                  <span>{sch.autoSendEmail ? 'Auto Email' : 'Manual Email'}</span>
                                  <span className="mx-1.5">·</span>
                                  <span>
                                    {sch.autoCreateMidtrans ? 'Auto Midtrans' : 'Tanpa Link'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                                  <span
                                    className={
                                      sch.active
                                        ? 'font-medium text-emerald-700'
                                        : 'font-medium text-slate-500'
                                    }
                                  >
                                    {sch.active ? 'Aktif' : 'Dijeda'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                                  {formatIdr(tot)}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSchedule(sch);
                                      setScheduleModalOpen(true);
                                    }}
                                    className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                  >
                                    Ubah
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: KATALOG PRODUK & LAYANAN */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-slate-900">
                        Katalog Produk &amp; Layanan
                      </h1>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Tambahkan item produk atau layanan standar agar bisa dipilih langsung saat
                        membuat faktur maupun jadwal bulanan.
                      </p>
                    </div>
                    {PERMISSIONS.canManageProductsClients(userRole) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(null);
                          setProductModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Produk</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">SKU</th>
                            <th className="py-3 px-4">Nama Produk / Layanan</th>
                            <th className="py-3 px-4">Satuan</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Harga Satuan</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {products.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                                Belum ada produk di katalog. Klik &quot;Tambah Produk&quot; untuk
                                menambahkan item pertama.
                              </td>
                            </tr>
                          ) : (
                            products.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                                  {p.sku}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-slate-900">{p.name}</div>
                                  {p.description && (
                                    <div className="text-xs text-slate-500 mt-0.5 max-w-md truncate">
                                      {p.description}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                                  {p.unit}
                                </td>
                                <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                                  <span
                                    className={
                                      p.active
                                        ? 'font-medium text-emerald-700'
                                        : 'font-medium text-slate-500'
                                    }
                                  >
                                    {p.active ? 'Aktif' : 'Nonaktif'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                                  {formatIdr(p.unitPrice)}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  {PERMISSIONS.canManageProductsClients(userRole) ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingProduct(p);
                                          setProductModalOpen(true);
                                        }}
                                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                      >
                                        Ubah
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProduct(p)}
                                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                        title="Hapus Produk"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">Lihat saja</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: DAFTAR KLIEN */}
              {activeTab === 'clients' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-slate-900">
                        Direktori Klien Perusahaan
                      </h1>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Kelola kontak PIC, email penagihan otomatis, dan NPWP klien B2B.
                      </p>
                    </div>
                    {PERMISSIONS.canManageProductsClients(userRole) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClient(null);
                          setClientModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Klien</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">Perusahaan &amp; PIC</th>
                            <th className="py-3 px-4">Email Penagihan</th>
                            <th className="py-3 px-4">NPWP</th>
                            <th className="py-3 px-4 text-right">Total Faktur</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {clients.map((c) => {
                            const count = invoices.filter((i) => i.clientId === c.id).length;
                            return (
                              <tr key={c.id} className="hover:bg-slate-50">
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-slate-900">{c.companyName}</div>
                                  <div className="text-xs text-slate-500">
                                    {c.name} · {c.phone || '—'}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-700">{c.email}</td>
                                <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                                  {c.npwp || '—'}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                                  {count}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  {PERMISSIONS.canManageProductsClients(userRole) ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingClient(c);
                                          setClientModalOpen(true);
                                        }}
                                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                      >
                                        Ubah
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteClient(c)}
                                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                        title="Hapus Klien"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">Lihat saja</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: BUKTI SERAH TERIMA BARANG (BAST) */}
              {activeTab === 'handovers' && canAccessTab(userRole, 'handovers') && (
                <HandoversView
                  handovers={handovers}
                  company={settings.company}
                  canManage={PERMISSIONS.canManageHandovers(userRole)}
                  canDelete={PERMISSIONS.canDeleteHandovers(userRole)}
                  onOpenCreate={() => {
                    setEditingHandover(null);
                    setHandoverModalOpen(true);
                  }}
                  onEditHandover={(h) => {
                    setEditingHandover(h);
                    setHandoverModalOpen(true);
                  }}
                  onSelectHandover={(h) => setSelectedHandoverId(h.id)}
                  onMarkReceived={handleMarkHandoverReceived}
                  onDeleteHandover={handleDeleteHandover}
                  onOpenVerify={(code) => setVerifyModalCode(code ?? '')}
                />
              )}

              {/* TAB: AKUNTANSI KANTOR SEDERHANA */}
              {activeTab === 'accounting' && PERMISSIONS.canManageAccounting(userRole) && (
                <AccountingView
                  entries={accountingEntries}
                  invoices={invoices}
                  payrolls={payrolls}
                  company={settings.company}
                  onAddEntry={() => {
                    setEditingAccounting(null);
                    setAccountingModalOpen(true);
                  }}
                  onEditEntry={(entry) => {
                    setEditingAccounting(entry);
                    setAccountingModalOpen(true);
                  }}
                  onDeleteEntry={handleDeleteAccounting}
                  onToggleReconcile={handleToggleAccountingReconcile}
                  onSyncOperations={handleSyncAccountingOperations}
                />
              )}

              {/* TAB 6: DATA KARYAWAN */}
              {activeTab === 'employees' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-slate-900">
                        Direktori Karyawan Perusahaan
                      </h1>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Kelola identitas kepegawaian, jabatan, komponen gaji pokok, tunjangan, dan
                        rekening payroll karyawan.
                      </p>
                    </div>
                    {PERMISSIONS.canManageEmployees(userRole) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmployee(null);
                          setEmployeeModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Karyawan</span>
                      </button>
                    )}
                  </div>

                  {/* Employee KPI Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">Karyawan Aktif</span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                        {employees.filter((e) => e.status === 'active').length} Orang
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">
                        Total Beban Gaji &amp; Tunjangan / Bln
                      </span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                        {formatIdr(
                          employees
                            .filter((e) => e.status === 'active')
                            .reduce((acc, e) => acc + e.baseSalary + e.fixedAllowance, 0)
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">Departemen</span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                        {employeeDepartments.length} Divisi
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">Karyawan Tetap</span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                        {employees.filter((e) => e.employmentType === 'tetap' && e.status === 'active').length}{' '}
                        PKWTT
                      </div>
                    </div>
                  </div>

                  {/* Filter Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={empDeptFilter}
                        onChange={(e) => setEmpDeptFilter(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="all">Semua Departemen</option>
                        {employeeDepartments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        placeholder="Cari NIP, nama, jabatan..."
                        className="w-64 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">NIP &amp; Karyawan</th>
                            <th className="py-3 px-4">Departemen &amp; Jabatan</th>
                            <th className="py-3 px-4">Rekening Payroll</th>
                            <th className="py-3 px-4">Sisa Cuti Tahunan</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Gaji Pokok + Tunjangan</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                                Belum ada data karyawan yang sesuai filter.
                              </td>
                            </tr>
                          ) : (
                            filteredEmployees.map((emp) => {
                              const empLeaveOption = effectiveLeaveEmployees.find(
                                (le) => le.id === emp.id
                              );
                              const quota = emp.annualLeaveQuota ?? 12;
                              const usedDays = empLeaveOption?.usedAnnualDays || 0;
                              const remainingLeave = Math.max(0, quota - usedDays);

                              return (
                                <tr key={emp.id} className="hover:bg-slate-50">
                                  <td className="py-3.5 px-4">
                                    <div className="font-medium text-slate-900">{emp.name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                      {emp.nip} · {emp.email}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="text-xs font-medium text-slate-800">
                                      {emp.position}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {emp.department} ·{' '}
                                      {emp.employmentType === 'tetap'
                                        ? 'Tetap'
                                        : emp.employmentType === 'kontrak'
                                        ? 'Kontrak'
                                        : 'Lepas'}{' '}
                                      · <span className="font-mono text-slate-700">{emp.ptkpStatus || 'TK/0'}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="text-xs text-slate-800">
                                      {emp.bankName || '—'}
                                    </div>
                                    <div className="font-mono text-xs text-slate-500 mt-0.5">
                                      {emp.bankAccountNumber || '—'}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <div
                                      className={`font-mono text-xs font-semibold tabular-nums ${
                                        remainingLeave > 0 ? 'text-emerald-700' : 'text-red-700'
                                      }`}
                                    >
                                      {remainingLeave} / {quota} Hari
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Terpakai {usedDays} hari
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                                    <span
                                      className={
                                        emp.status === 'active'
                                          ? 'font-medium text-emerald-700'
                                          : 'font-medium text-slate-500'
                                      }
                                    >
                                      {emp.status === 'active' ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <div className="font-mono tabular-nums font-medium text-slate-900">
                                      {formatIdr(emp.baseSalary + emp.fixedAllowance)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono">
                                      Pokok {formatIdr(emp.baseSalary)}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      {emp.status === 'active' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingLeave(null);
                                            setLeavePreselectedEmpId(emp.id);
                                            setLeaveModalOpen(true);
                                          }}
                                          className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                        >
                                          Ajukan Cuti
                                        </button>
                                      )}
                                      {PERMISSIONS.canManageContracts(userRole) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingContract(null);
                                            setContractPreselectedEmpId(emp.id);
                                            setContractModalOpen(true);
                                          }}
                                          className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                          Buat PKWT/SK
                                        </button>
                                      )}
                                      {PERMISSIONS.canManageEmployees(userRole) && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingEmployee(emp);
                                              setEmployeeModalOpen(true);
                                            }}
                                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                          >
                                            Ubah
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteEmployee(emp)}
                                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                            title="Hapus Karyawan"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6A2: SURAT KONTRAK KERJA (PKWT) & SK PENGANGKATAN */}
              {activeTab === 'contracts' && canAccessTab(userRole, 'contracts') && (
                <ContractsView
                  contracts={contracts}
                  company={settings.company}
                  canManage={PERMISSIONS.canManageContracts(userRole)}
                  onOpenCreate={() => {
                    setEditingContract(null);
                    setContractPreselectedEmpId(undefined);
                    setContractModalOpen(true);
                  }}
                  onEditContract={(ctr) => {
                    setEditingContract(ctr);
                    setContractPreselectedEmpId(undefined);
                    setContractModalOpen(true);
                  }}
                  onSelectContract={(ctr) => setSelectedContractId(ctr.id)}
                  onDeleteContract={handleDeleteContract}
                  onOpenVerify={(code) => setVerifyModalCode(code ?? '')}
                />
              )}

              {/* TAB 6B: CUTI KARYAWAN & PERSETUJUAN HRD */}
              {activeTab === 'leaves' && canAccessTab(userRole, 'leaves') && (
                <LeavesView
                  leaveRequests={leaveRequests}
                  leaveEmployees={effectiveLeaveEmployees}
                  canApproveReject={PERMISSIONS.canApproveRejectLeave(userRole)}
                  canDelete={PERMISSIONS.canDeleteLeave(userRole)}
                  canSubmitLeave={PERMISSIONS.canSubmitLeave(userRole)}
                  onOpenCreate={(empId) => {
                    setEditingLeave(null);
                    setLeavePreselectedEmpId(empId || null);
                    setLeaveModalOpen(true);
                  }}
                  onSelectLeave={(id) => setSelectedLeaveId(id)}
                  onQuickDecision={handleDecideLeave}
                  onDeleteLeave={handleDeleteLeave}
                />
              )}

              {/* TAB 7: PENGGAJIAN & SLIP GAJI */}
              {activeTab === 'payroll' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-slate-900">
                        Penggajian Bulanan &amp; Slip Gaji (Payroll)
                      </h1>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Generate slip gaji bulanan otomatis, hitung PPh 21 &amp; BPJS, unduh Slip
                        PDF, serta kirim rincian gaji via email karyawan.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={generatingPayroll}
                        onClick={handleGenerateMonthlyPayroll}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>
                          {generatingPayroll
                            ? 'Memproses...'
                            : `Generate Payroll ${formatMonthId(payrollPeriodFilter)}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPayroll(null);
                          setPayrollModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buat Slip Manual</span>
                      </button>
                    </div>
                  </div>

                  {/* Payroll Summary Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">
                        Total Gaji Bruto ({formatMonthId(payrollPeriodFilter)})
                      </span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                        {formatIdr(payrollSummary.totalGross)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">
                        Total Potongan (PPh 21 &amp; BPJS)
                      </span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-red-700">
                        -{formatIdr(payrollSummary.totalDeductions)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">
                        Total Take Home Pay (Bersih)
                      </span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                        {formatIdr(payrollSummary.totalNet)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-medium text-slate-500">Status Pencairan</span>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-700">
                        {payrollSummary.paidCount} / {payrollSummary.totalCount} Slip Lunas
                      </div>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="month"
                        value={payrollPeriodFilter}
                        onChange={(e) => setPayrollPeriodFilter(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                        {(
                          [
                            { id: 'all', label: 'Semua' },
                            { id: 'draft', label: 'Draf' },
                            { id: 'approved', label: 'Disetujui' },
                            { id: 'paid', label: 'Dibayar' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setPayrollStatusFilter(tab.id)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              payrollStatusFilter === tab.id
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={payrollSearch}
                          onChange={(e) => setPayrollSearch(e.target.value)}
                          placeholder="Cari no. slip atau karyawan..."
                          className="w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => exportPayrollsCsv(filteredPayrolls)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Ekspor CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Payroll Table */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">No. Slip</th>
                            <th className="py-3 px-4">Karyawan &amp; Jabatan</th>
                            <th className="py-3 px-4 text-right">Bruto</th>
                            <th className="py-3 px-4 text-right">Potongan</th>
                            <th className="py-3 px-4 text-right">Gaji Bersih (THP)</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredPayrolls.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                                Belum ada slip gaji untuk periode {formatMonthId(payrollPeriodFilter)}.
                                Klik <strong>Generate Payroll</strong> di atas untuk membuat otomatis
                                bagi seluruh karyawan aktif.
                              </td>
                            </tr>
                          ) : (
                            filteredPayrolls.map((pay) => {
                              const stMeta = PAYROLL_STATUS_META[pay.status] || PAYROLL_STATUS_META.draft;
                              return (
                                <tr
                                  key={pay.id}
                                  onClick={() => setSelectedPayrollId(pay.id)}
                                  className="hover:bg-slate-50 cursor-pointer"
                                >
                                  <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                                    {pay.slipNumber}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="font-medium text-slate-900">{pay.employeeName}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {pay.employeeNip} · {pay.position} ({pay.department})
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                                    {formatIdr(pay.grossPay)}
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-red-700 whitespace-nowrap">
                                    -{formatIdr(pay.totalDeductions)}
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                    {formatIdr(pay.netPay)}
                                  </td>
                                  <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                                    <span className={`font-medium ${stMeta.textClass}`}>
                                      {stMeta.label}
                                    </span>
                                  </td>
                                  <td
                                    className="py-3.5 px-4 text-right whitespace-nowrap"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => generatePayslipPdf(pay, settings.company)}
                                        className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                                        title="Unduh Slip Gaji PDF"
                                      >
                                        <FileDown className="w-3.5 h-3.5" />
                                        <span>PDF</span>
                                      </button>
                                      {pay.status !== 'paid' && (
                                        <button
                                          type="button"
                                          onClick={() => handleMarkPayrollPaid(pay.id)}
                                          className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                                        >
                                          Bayar
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPayroll(pay);
                                          setPayrollModalOpen(true);
                                        }}
                                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                        title="Ubah Slip"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: LOG PENGIRIMAN EMAIL */}
              {activeTab === 'emails' && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                      Riwayat Pengiriman Email Faktur
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Audit pengiriman faktur bulanan otomatis maupun manual lengkap dengan
                      pratinjau HTML yang diterima klien.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">Waktu Kirim</th>
                            <th className="py-3 px-4">Faktur &amp; Penerima</th>
                            <th className="py-3 px-4">Kanal Pengiriman</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Pratinjau</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {emailLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-sm text-slate-500">
                                Belum ada log pengiriman email. Kirim faktur atau jalankan jadwal
                                bulanan untuk melihat hasilnya di sini.
                              </td>
                            </tr>
                          ) : (
                            emailLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                                  {formatDateTimeId(log.sentAt)}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-slate-900">{log.subject}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    Kepada: {log.recipientEmail}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600">
                                  {log.deliveryMode}
                                </td>
                                <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                                  <span
                                    className={
                                      log.status === 'failed'
                                        ? 'font-medium text-red-700'
                                        : 'font-medium text-emerald-700'
                                    }
                                  >
                                    {log.status === 'sent'
                                      ? 'Terkirim SMTP'
                                      : log.status === 'simulated'
                                      ? 'Terkirim (Preview Lokal)'
                                      : 'Gagal'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewEmailLog(log)}
                                    className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                  >
                                    Lihat Email
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: MANAJEMEN PENGGUNA & HAK AKSES (ADMIN ONLY) */}
              {activeTab === 'users' && PERMISSIONS.canManageUsers(userRole) && (
                <UsersView
                  users={users}
                  currentUser={currentUser}
                  onSaveUser={handleSaveUser}
                  onDeleteUser={handleDeleteUser}
                />
              )}

              {/* TAB 10: PENGATURAN API & MIDTRANS (ADMIN ONLY) */}
              {activeTab === 'settings' && PERMISSIONS.canManageSettings(userRole) && (
                <SettingsView
                  settings={settings}
                  pushPermission={pushPermission}
                  isPushSubscribed={isPushSubscribed}
                  onEnablePush={async () => {
                    const res = await subscribePush();
                    showToast(res.message, res.ok ? 'success' : 'error');
                  }}
                  onTestPush={async () => {
                    const res = await apiFetch('/api/push/test', { method: 'POST' });
                    if (res.ok) {
                      showToast('Notifikasi uji coba dikirim ke seluruh perangkat aktif.', 'success');
                    }
                  }}
                  onSaveMidtrans={async (payload) => {
                    const res = await apiFetch('/api/settings/midtrans', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = (await res.json()) as {
                      ok: boolean;
                      settings: AppSettingsPublic;
                    };
                    if (data.ok) {
                      setSettings(data.settings);
                      showToast('Konfigurasi Midtrans API diperbarui.', 'success');
                    }
                  }}
                  onTestMidtrans={async (payload) => {
                    const res = await apiFetch('/api/midtrans/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    return (await res.json()) as { ok: boolean; message: string };
                  }}
                  onSaveSmtp={async (payload) => {
                    const res = await apiFetch('/api/settings/smtp', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = (await res.json()) as {
                      ok: boolean;
                      settings: AppSettingsPublic;
                    };
                    if (data.ok) {
                      setSettings(data.settings);
                      showToast('Pengaturan Email SMTP berhasil disimpan.', 'success');
                    }
                  }}
                  onTestSmtp={async (payload) => {
                    const res = await apiFetch('/api/smtp/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    return (await res.json()) as { ok: boolean; message: string };
                  }}
                  onSaveCompany={async (payload) => {
                    const res = await apiFetch('/api/settings/company', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = (await res.json()) as {
                      ok: boolean;
                      settings: AppSettingsPublic;
                    };
                    if (data.ok) {
                      setSettings(data.settings);
                      showToast('Profil perusahaan berhasil diperbarui.', 'success');
                    }
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <InvoiceModal
        open={invoiceModalOpen}
        clients={clients}
        products={products}
        initialInvoice={editingInvoice}
        existingCount={invoices.length}
        canSendEmail={PERMISSIONS.canSendInvoiceEmail(userRole)}
        onClose={() => setInvoiceModalOpen(false)}
        onSave={handleSaveInvoice}
      />

      <InvoiceDetailDrawer
        invoice={selectedInvoice}
        company={settings.company}
        midtransSettings={settings.midtrans}
        canSendEmail={PERMISSIONS.canSendInvoiceEmail(userRole)}
        canOperateMidtrans={PERMISSIONS.canOperateMidtrans(userRole)}
        onClose={() => setSelectedInvoiceId(null)}
        onSendEmail={handleSendInvoiceEmail}
        onCreateMidtransLink={handleCreateMidtransLink}
        onCheckMidtransStatus={handleCheckMidtransStatus}
        onOpenSnapPopup={handleOpenSnapPopup}
      />

      <ScheduleModal
        open={scheduleModalOpen}
        clients={clients}
        products={products}
        initialSchedule={editingSchedule}
        onClose={() => setScheduleModalOpen(false)}
        onSave={handleSaveSchedule}
      />

      <ClientModal
        open={clientModalOpen}
        initialClient={editingClient}
        onClose={() => setClientModalOpen(false)}
        onSave={handleSaveClient}
      />

      <ProductModal
        open={productModalOpen}
        initialProduct={editingProduct}
        onClose={() => setProductModalOpen(false)}
        onSave={handleSaveProduct}
      />

      <EmployeeModal
        open={employeeModalOpen}
        initialEmployee={editingEmployee}
        existingCount={employees.length}
        onClose={() => setEmployeeModalOpen(false)}
        onSave={handleSaveEmployee}
      />

      <ContractModal
        open={contractModalOpen}
        initialContract={editingContract}
        preselectedEmployeeId={contractPreselectedEmpId}
        employees={employees}
        existingContracts={contracts}
        defaultSignerName={currentUser.name}
        onClose={() => setContractModalOpen(false)}
        onSave={handleSaveContract}
      />

      <ContractPreviewDrawer
        contract={contracts.find((c) => c.id === selectedContractId) || null}
        company={settings.company}
        canManage={PERMISSIONS.canManageContracts(userRole)}
        onClose={() => setSelectedContractId(null)}
        onEdit={(ctr) => {
          setSelectedContractId(null);
          setEditingContract(ctr);
          setContractPreselectedEmpId(undefined);
          setContractModalOpen(true);
        }}
        onDelete={handleDeleteContract}
        onOpenVerify={(code) => setVerifyModalCode(code)}
      />

      <HandoverModal
        open={handoverModalOpen}
        initialHandover={editingHandover}
        clients={clients}
        invoices={invoices}
        products={products}
        employees={employees}
        existingHandovers={handovers}
        defaultSenderName={currentUser.name}
        onClose={() => setHandoverModalOpen(false)}
        onSave={handleSaveHandover}
      />

      <HandoverPreviewDrawer
        handover={handovers.find((h) => h.id === selectedHandoverId) || null}
        company={settings.company}
        canManage={PERMISSIONS.canManageHandovers(userRole)}
        canDelete={PERMISSIONS.canDeleteHandovers(userRole)}
        onClose={() => setSelectedHandoverId(null)}
        onEdit={(h) => {
          setSelectedHandoverId(null);
          setEditingHandover(h);
          setHandoverModalOpen(true);
        }}
        onMarkReceived={handleMarkHandoverReceived}
        onDelete={handleDeleteHandover}
        onOpenVerify={(code) => setVerifyModalCode(code)}
      />

      {verifyModalCode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl">
            <ContractVerifyView
              initialCode={verifyModalCode}
              standalone={false}
              onBack={() => setVerifyModalCode(null)}
            />
          </div>
        </div>
      )}

      <PayrollModal
        open={payrollModalOpen}
        employees={employees}
        initialPayroll={editingPayroll}
        defaultPeriodMonth={payrollPeriodFilter}
        existingCount={payrolls.length}
        onClose={() => setPayrollModalOpen(false)}
        onSave={handleSavePayroll}
      />

      <PayrollDetailDrawer
        payroll={selectedPayroll}
        company={settings.company}
        canDelete={PERMISSIONS.canDeletePayroll(userRole)}
        onClose={() => setSelectedPayrollId(null)}
        onEdit={(pay) => {
          setEditingPayroll(pay);
          setPayrollModalOpen(true);
        }}
        onDelete={handleDeletePayroll}
        onMarkPaid={handleMarkPayrollPaid}
        onSendEmail={handleSendPayrollEmail}
      />

      <LeaveModal
        open={leaveModalOpen}
        employees={effectiveLeaveEmployees}
        initialLeave={editingLeave}
        preselectedEmployeeId={leavePreselectedEmpId}
        existingCount={leaveRequests.length}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        onClose={() => setLeaveModalOpen(false)}
        onSave={handleSaveLeave}
      />

      <LeaveDetailDrawer
        leave={selectedLeave}
        employeeOption={
          selectedLeave
            ? effectiveLeaveEmployees.find((e) => e.id === selectedLeave.employeeId) || null
            : null
        }
        canApproveReject={PERMISSIONS.canApproveRejectLeave(userRole)}
        canDelete={PERMISSIONS.canDeleteLeave(userRole)}
        canEdit={Boolean(
          selectedLeave &&
            (PERMISSIONS.canApproveRejectLeave(userRole) ||
              selectedLeave.submittedByUserId === currentUser.id)
        )}
        canCancel={Boolean(
          selectedLeave &&
            (PERMISSIONS.canApproveRejectLeave(userRole) ||
              selectedLeave.submittedByUserId === currentUser.id ||
              selectedLeave.employeeEmail.toLowerCase() === currentUser.email.toLowerCase())
        )}
        onClose={() => setSelectedLeaveId(null)}
        onEdit={(lv) => {
          setEditingLeave(lv);
          setLeaveModalOpen(true);
        }}
        onDecide={handleDecideLeave}
        onCancel={handleCancelLeave}
        onDelete={handleDeleteLeave}
      />

      <EmailPreviewModal log={previewEmailLog} onClose={() => setPreviewEmailLog(null)} />

      <AccountingModal
        isOpen={accountingModalOpen}
        entry={editingAccounting}
        onClose={() => setAccountingModalOpen(false)}
        onSave={handleSaveAccounting}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-md rounded-xl border px-4 py-3 text-sm shadow-lg flex items-center gap-3 ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-950'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0 opacity-70" />
          <span className="flex-1 text-xs font-medium leading-relaxed">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
