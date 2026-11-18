import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  AccountingEntry,
  AccountingEntryType,
  CompanyProfile,
  Invoice,
  PayrollRecord,
} from '../types';
import {
  ACCOUNTING_ACCOUNTS,
  ACCOUNTING_CATEGORIES,
  ACCOUNTING_STATUS_META,
  ACCOUNTING_TYPE_META,
  exportAccountingCsv,
  formatDateId,
  formatIdr,
  formatMonthId,
} from '../lib/formatters';
import { generateAccountingReportPdf } from '../lib/accountingPdf';

interface AccountingViewProps {
  entries: AccountingEntry[];
  invoices: Invoice[];
  payrolls: PayrollRecord[];
  company: CompanyProfile;
  onAddEntry: () => void;
  onEditEntry: (entry: AccountingEntry) => void;
  onDeleteEntry: (entry: AccountingEntry) => Promise<void>;
  onToggleReconcile: (entry: AccountingEntry) => Promise<void>;
  onSyncOperations: () => Promise<void>;
}

export const AccountingView: React.FC<AccountingViewProps> = ({
  entries,
  invoices,
  payrolls,
  company,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onToggleReconcile,
  onSyncOperations,
}) => {
  const [subView, setSubView] = useState<'ledger' | 'report'>('ledger');
  const [periodFilter, setPeriodFilter] = useState<string>('2026-11');
  const [typeFilter, setTypeFilter] = useState<'all' | AccountingEntryType>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingOps, setSyncingOps] = useState(false);

  const periodEntries = useMemo(() => {
    if (periodFilter === 'all') return entries;
    return entries.filter((e) => (e.date || '').startsWith(periodFilter));
  }, [entries, periodFilter]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodEntries.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (accountFilter !== 'all' && e.accountName !== accountFilter) return false;
      if (!q) return true;
      return (
        e.entryNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.counterparty.toLowerCase().includes(q) ||
        e.accountName.toLowerCase().includes(q)
      );
    });
  }, [periodEntries, typeFilter, accountFilter, searchQuery]);

  // Period metrics (for selected month or all)
  const periodMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let reconciledCount = 0;

    for (const e of periodEntries) {
      if (e.type === 'income') {
        income += e.amount;
        incomeCount += 1;
      } else {
        expense += e.amount;
        expenseCount += 1;
      }
      if (e.status === 'reconciled') reconciledCount += 1;
    }

    const netProfit = income - expense;
    const profitMargin = income > 0 ? Math.round((netProfit / income) * 100) : 0;

    return {
      income,
      expense,
      netProfit,
      profitMargin,
      incomeCount,
      expenseCount,
      reconciledCount,
    };
  }, [periodEntries]);

  // Cumulative cash balance across all recorded entries
  const accountBalances = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; balance: number }>();
    for (const acc of ACCOUNTING_ACCOUNTS) {
      map.set(acc, { income: 0, expense: 0, balance: 0 });
    }
    let totalBalance = 0;
    for (const e of entries) {
      const cur = map.get(e.accountName) || { income: 0, expense: 0, balance: 0 };
      if (e.type === 'income') {
        cur.income += e.amount;
        cur.balance += e.amount;
        totalBalance += e.amount;
      } else {
        cur.expense += e.amount;
        cur.balance -= e.amount;
        totalBalance -= e.amount;
      }
      map.set(e.accountName, cur);
    }
    return {
      totalBalance,
      accounts: Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats })),
    };
  }, [entries]);

  // Category breakdown for Profit & Loss (P&L)
  const profitLossBreakdown = useMemo(() => {
    const incMap = new Map<string, number>();
    const expMap = new Map<string, number>();

    for (const e of periodEntries) {
      if (e.type === 'income') {
        incMap.set(e.category, (incMap.get(e.category) || 0) + e.amount);
      } else {
        expMap.set(e.category, (expMap.get(e.category) || 0) + e.amount);
      }
    }

    return {
      incomeByCategory: Array.from(incMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      expenseByCategory: Array.from(expMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [periodEntries]);

  // Unsynced operational items count (paid invoices / paid payrolls not yet in accounting_entries)
  const unsyncedOpsCount = useMemo(() => {
    const recordedRefs = new Set(
      entries.filter((e) => e.sourceId).map((e) => `${e.sourceType}:${e.sourceId}`)
    );
    const pendingPaidInvoices = invoices.filter(
      (inv) => inv.status === 'paid' && !recordedRefs.has(`invoice:${inv.id}`)
    ).length;
    const pendingPaidPayrolls = payrolls.filter(
      (pay) => pay.status === 'paid' && !recordedRefs.has(`payroll:${pay.id}`)
    ).length;
    return pendingPaidInvoices + pendingPaidPayrolls;
  }, [entries, invoices, payrolls]);

  // Reference receivables & payables from operational tables
  const operationalRef = useMemo(() => {
    const accountsReceivable = invoices
      .filter((i) => i.status === 'pending' || i.status === 'overdue')
      .reduce((acc, i) => acc + i.totalAmount, 0);
    const payrollPayable = payrolls
      .filter((p) => p.status !== 'paid')
      .reduce((acc, p) => acc + p.netPay, 0);
    return { accountsReceivable, payrollPayable };
  }, [invoices, payrolls]);

  const handleSyncClick = async () => {
    setSyncingOps(true);
    try {
      await onSyncOperations();
    } finally {
      setSyncingOps(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Akuntansi &amp; Buku Kas Kantor
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pencatatan kas masuk/keluar, rekonsiliasi saldo bank, dan laporan laba rugi sederhana
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setSubView('ledger')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'ledger'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buku Kas &amp; Transaksi
            </button>
            <button
              type="button"
              onClick={() => setSubView('report')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'report'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laba Rugi &amp; Saldo Akun
            </button>
          </div>

          <button
            type="button"
            disabled={syncingOps}
            onClick={handleSyncClick}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
              unsyncedOpsCount > 0
                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Tarik otomatis faktur lunas dan slip gaji terbayar ke buku kas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOps ? 'animate-spin' : ''}`} />
            <span>
              {syncingOps
                ? 'Menarik Data...'
                : unsyncedOpsCount > 0
                ? `Tarik Faktur & Payroll (${unsyncedOpsCount})`
                : 'Sinkron Faktur & Payroll'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              generateAccountingReportPdf({
                entries: periodEntries,
                company,
                periodLabel: periodFilter,
                totalIncome: periodMetrics.income,
                totalExpense: periodMetrics.expense,
                netProfit: periodMetrics.netProfit,
                totalCashBalance: accountBalances.totalBalance,
                incomeByCategory: profitLossBreakdown.incomeByCategory,
                expenseByCategory: profitLossBreakdown.expenseByCategory,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Unduh PDF</span>
          </button>

          <button
            type="button"
            onClick={onAddEntry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat Transaksi</span>
          </button>
        </div>
      </div>

      {/* KPI Strip (4 Columns, Single-Elevation, Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              Pemasukan ({periodFilter === 'all' ? 'Semua' : formatMonthId(periodFilter)})
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-700">
            {formatIdr(periodMetrics.income)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {periodMetrics.incomeCount} transaksi kas masuk
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              Pengeluaran ({periodFilter === 'all' ? 'Semua' : formatMonthId(periodFilter)})
            </span>
            <ArrowDownRight className="w-4 h-4 text-red-700" />
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-red-700">
            {formatIdr(periodMetrics.expense)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {periodMetrics.expenseCount} transaksi kas keluar
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Laba / Rugi Bersih</span>
            <span
              className={`font-mono text-xs font-semibold ${
                periodMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {periodMetrics.profitMargin}% margin
            </span>
          </div>
          <div
            className={`mt-1.5 text-xl font-bold font-mono tabular-nums ${
              periodMetrics.netProfit >= 0 ? 'text-slate-900' : 'text-red-700'
            }`}
          >
            {formatIdr(periodMetrics.netProfit)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {periodMetrics.reconciledCount} dari {periodEntries.length} terekonsiliasi
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Saldo Kas &amp; Bank Akumulatif</div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatIdr(accountBalances.totalBalance)}
          </div>
          <div className="mt-1 text-xs text-slate-500 truncate">
            Piutang faktur: <span className="font-mono tabular-nums">{formatIdr(operationalRef.accountsReceivable)}</span>
          </div>
        </div>
      </div>

      {/* Period & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Periode
            </button>
            <input
              type="month"
              value={periodFilter === 'all' ? '2026-11' : periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value || 'all')}
              className="rounded-md bg-white px-2.5 py-1 font-mono text-xs text-slate-800 border border-slate-200 focus:border-blue-600 focus:outline-none"
              aria-label="Filter Bulan Akuntansi"
            />
          </div>

          {subView === 'ledger' && (
            <>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'income', label: 'Pemasukan' },
                    { id: 'expense', label: 'Pengeluaran' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      typeFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">Semua Akun Kas &amp; Bank</option>
                {ACCOUNTING_ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {subView === 'ledger' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no. bukti, uraian, vendor..."
                className="w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => exportAccountingCsv(filteredEntries)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-view 1: Buku Kas & Transaksi */}
      {subView === 'ledger' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">No. Bukti &amp; Tanggal</th>
                  <th className="py-3 px-4">Uraian &amp; Pihak Terkait</th>
                  <th className="py-3 px-4">Kategori &amp; Akun</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                      Belum ada catatan transaksi akuntansi untuk filter periode saat ini. Klik{' '}
                      <strong>Catat Transaksi</strong> untuk menambahkan pembukuan baru.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const typeMeta = ACCOUNTING_TYPE_META[entry.type] || ACCOUNTING_TYPE_META.expense;
                    const statusMeta =
                      ACCOUNTING_STATUS_META[entry.status] || ACCOUNTING_STATUS_META.recorded;
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => onEditEntry(entry)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {entry.entryNumber}
                          </div>
                          <div className="text-xs font-mono text-slate-500 mt-0.5">
                            {formatDateId(entry.date)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{entry.description}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {entry.counterparty || 'Internal Kantor'} · {entry.paymentMethod}
                            {entry.sourceType !== 'manual' && (
                              <span>
                                {' '}
                                ·{' '}
                                {entry.sourceType === 'invoice'
                                  ? 'Sinkron Faktur'
                                  : 'Sinkron Payroll'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-medium text-slate-800">{entry.category}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{entry.accountName}</div>
                        </td>
                        <td
                          className="py-3.5 px-4 text-xs whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onToggleReconcile(entry)}
                            className={`inline-flex items-center gap-1.5 font-medium hover:underline ${statusMeta.textClass}`}
                            title="Klik untuk ubah status rekonsiliasi"
                          >
                            {entry.status === 'reconciled' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{statusMeta.label}</span>
                          </button>
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${typeMeta.textClass}`}
                        >
                          {typeMeta.sign} {formatIdr(entry.amount)}
                        </td>
                        <td
                          className="py-3.5 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditEntry(entry)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Ubah Transaksi"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEntry(entry)}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      ) : (
        /* Sub-view 2: Laporan Laba Rugi & Saldo Akun */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Profit & Loss Statement */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Laporan Laba Rugi Sederhana
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periode:{' '}
                  {periodFilter === 'all' ? 'Seluruh Transaksi' : formatMonthId(periodFilter)}
                </p>
              </div>
              <span
                className={`text-sm font-mono tabular-nums font-bold ${
                  periodMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {periodMetrics.netProfit >= 0 ? 'SURPLUS ' : 'DEFISIT '}
                {formatIdr(periodMetrics.netProfit)}
              </span>
            </div>

            <div className="p-5 space-y-5 text-sm">
              {/* Pendapatan */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-2 border-b border-slate-200">
                  <span>PENDAPATAN / KAS MASUK</span>
                  <span>NOMINAL</span>
                </div>
                {profitLossBreakdown.incomeByCategory.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500">
                    Belum ada pemasukan tercatat pada periode ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {profitLossBreakdown.incomeByCategory.map((item) => (
                      <div key={item.category} className="py-2.5 flex items-center justify-between">
                        <span className="text-slate-700">{item.category}</span>
                        <span className="font-mono tabular-nums font-medium text-emerald-700">
                          {formatIdr(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between font-semibold">
                  <span className="text-slate-900">Total Pendapatan</span>
                  <span className="font-mono tabular-nums text-emerald-700">
                    {formatIdr(periodMetrics.income)}
                  </span>
                </div>
              </div>

              {/* Beban Operasional */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-2 border-b border-slate-200">
                  <span>BEBAN &amp; PENGELUARAN OPERASIONAL</span>
                  <span>NOMINAL</span>
                </div>
                {profitLossBreakdown.expenseByCategory.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500">
                    Belum ada pengeluaran tercatat pada periode ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {profitLossBreakdown.expenseByCategory.map((item) => (
                      <div key={item.category} className="py-2.5 flex items-center justify-between">
                        <span className="text-slate-700">{item.category}</span>
                        <span className="font-mono tabular-nums font-medium text-red-700">
                          ({formatIdr(item.amount)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between font-semibold">
                  <span className="text-slate-900">Total Beban Operasional</span>
                  <span className="font-mono tabular-nums text-red-700">
                    ({formatIdr(periodMetrics.expense)})
                  </span>
                </div>
              </div>

              {/* Net Profit Row */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    {periodMetrics.netProfit >= 0
                      ? 'Laba Bersih Operasional'
                      : 'Rugi Bersih Operasional'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Selisih pemasukan dikurangi total beban periode
                  </div>
                </div>
                <span
                  className={`text-lg font-bold font-mono tabular-nums ${
                    periodMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {formatIdr(periodMetrics.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Account Balances & Working Capital Reference */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">
                  Posisi Saldo Kas &amp; Rekening Bank
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Akumulasi seluruh mutasi kas masuk dan keluar
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                {accountBalances.accounts.map((acc) => (
                  <div key={acc.name} className="px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">{acc.name}</span>
                      <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                        {formatIdr(acc.balance)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                      <span>Masuk: +{formatIdr(acc.income)}</span>
                      <span>Keluar: -{formatIdr(acc.expense)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-sm font-semibold">
                <span className="text-slate-900">Total Likuiditas Kas &amp; Bank</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatIdr(accountBalances.totalBalance)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Referensi Piutang &amp; Kewajiban Operasional
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Piutang Usaha (Faktur Pending &amp; Jatuh Tempo)</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-700">
                    {formatIdr(operationalRef.accountsReceivable)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Kewajiban Gaji Belum Cair (Draf &amp; Disetujui)</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatIdr(operationalRef.payrollPayable)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-600">Kategori Beban Terdaftar</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {ACCOUNTING_CATEGORIES.expense.length} pos akun
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
