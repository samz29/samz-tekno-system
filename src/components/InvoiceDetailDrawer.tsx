import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  ExternalLink,
  Mail,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import type { CompanyProfile, Invoice, MidtransSettingsPublic } from '../types';
import { formatDateId, formatDateTimeId, formatIdr, INVOICE_STATUS_META } from '../lib/formatters';
import { generateInvoicePdf } from '../lib/invoicePdf';

interface InvoiceDetailDrawerProps {
  invoice: Invoice | null;
  company: CompanyProfile;
  midtransSettings: MidtransSettingsPublic;
  canSendEmail?: boolean;
  canOperateMidtrans?: boolean;
  onClose: () => void;
  onSendEmail: (invoiceId: string) => Promise<void>;
  onCreateMidtransLink: (invoiceId: string) => Promise<{
    ok: boolean;
    snapToken?: string;
    redirectUrl?: string;
    message: string;
  }>;
  onCheckMidtransStatus: (invoiceId: string) => Promise<void>;
  onOpenSnapPopup: (snapToken: string) => void;
}

export const InvoiceDetailDrawer: React.FC<InvoiceDetailDrawerProps> = ({
  invoice,
  company,
  midtransSettings,
  canSendEmail = true,
  canOperateMidtrans = true,
  onClose,
  onSendEmail,
  onCreateMidtransLink,
  onCheckMidtransStatus,
  onOpenSnapPopup,
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  if (!invoice) return null;

  const statusMeta = INVOICE_STATUS_META[invoice.status];

  const handleCreateAndPay = async () => {
    setBusyAction('midtrans_create');
    try {
      if (invoice.midtransSnapToken) {
        onOpenSnapPopup(invoice.midtransSnapToken);
        return;
      }
      const res = await onCreateMidtransLink(invoice.id);
      if (res.ok && res.snapToken) {
        onOpenSnapPopup(res.snapToken);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadPdf = () => {
    setBusyAction('pdf');
    try {
      generateInvoicePdf(invoice, company);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <div className="w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">{invoice.invoiceNumber}</span>
              <span aria-hidden="true">·</span>
              <span className={`font-medium ${statusMeta.textClass}`}>{statusMeta.label}</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mt-0.5">{invoice.clientCompany}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
              title="Unduh Salinan PDF"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              title="Cetak Faktur"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Toolbar */}
          {(canSendEmail || canOperateMidtrans || invoice.midtransPaymentUrl) && (
            <div className="flex flex-wrap items-center gap-2.5 pb-5 border-b border-slate-200">
              {canSendEmail && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={async () => {
                    setBusyAction('email');
                    try {
                      await onSendEmail(invoice.id);
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{busyAction === 'email' ? 'Mengirim...' : 'Kirim Email Faktur'}</span>
                </button>
              )}

              {canOperateMidtrans && invoice.status !== 'paid' && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleCreateAndPay}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>
                    {busyAction === 'midtrans_create'
                      ? 'Membuat Snap...'
                      : invoice.midtransSnapToken
                      ? 'Buka Pembayaran Midtrans'
                      : 'Buat Link Midtrans Snap'}
                  </span>
                </button>
              )}

              {canOperateMidtrans && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={async () => {
                    setBusyAction('poll');
                    try {
                      await onCheckMidtransStatus(invoice.id);
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'poll' ? 'animate-spin' : ''}`} />
                  <span>Cek Status Midtrans</span>
                </button>
              )}

              {invoice.midtransPaymentUrl && (
                <a
                  href={invoice.midtransPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Tautan Bayar</span>
                </a>
              )}
            </div>
          )}

          {/* Midtrans Payment Status Summary */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Integrasi Pembayaran Midtrans ({midtransSettings.environment.toUpperCase()})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Order ID: {invoice.midtransOrderId || 'Belum dibuat'}
                  {invoice.midtransTransactionStatus
                    ? ` · Status Gateway: ${invoice.midtransTransactionStatus.toUpperCase()}`
                    : ''}
                  {invoice.midtransPaymentType
                    ? ` · Kanal: ${invoice.midtransPaymentType.toUpperCase()}`
                    : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Printable Official Invoice Document */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
            <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-start gap-3.5">
                {company.logoDataUrl && (
                  <img
                    src={company.logoDataUrl}
                    alt={company.name}
                    className="h-12 w-12 rounded-lg border border-slate-200 object-contain p-1 bg-white shrink-0"
                  />
                )}
                <div>
                  <p className="text-xs font-medium text-slate-500">Penerbit Faktur</p>
                  <h3 className="text-base font-semibold text-slate-900 mt-1">{company.name}</h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">
                    {company.address}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-1">NPWP: {company.npwp}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-slate-500">Ditagihkan Kepada</p>
                <h4 className="text-base font-semibold text-slate-900 mt-1">
                  {invoice.clientCompany}
                </h4>
                <p className="text-xs text-slate-600 mt-1">{invoice.clientName}</p>
                <p className="text-xs text-slate-600">{invoice.clientEmail}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Tanggal Terbit</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {formatDateId(invoice.issueDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Jatuh Tempo</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {formatDateId(invoice.dueDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Email Terkirim</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {invoice.emailSentAt ? formatDateTimeId(invoice.emailSentAt) : 'Belum dikirim'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Tanggal Lunas</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {invoice.paidAt ? formatDateTimeId(invoice.paidAt) : '—'}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-4">Deskripsi</th>
                    <th className="py-2.5 px-4 text-right">Qty</th>
                    <th className="py-2.5 px-4 text-right">Harga</th>
                    <th className="py-2.5 px-4 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-4 text-slate-900">{item.description}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatIdr(item.unitPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatIdr(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2">
              <div className="text-xs text-slate-600 max-w-sm space-y-1">
                <p className="font-medium text-slate-800">Instruksi Pembayaran & Catatan</p>
                <p>{invoice.notes || 'Terima kasih atas kerja sama bisnis Anda.'}</p>
                <p className="text-slate-500 pt-1">
                  Transfer Manual: {company.bankName} · {company.bankAccountNumber} (a.n.{' '}
                  {company.bankAccountName})
                </p>
              </div>
              <div className="w-full sm:w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatIdr(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>PPN ({invoice.taxRate}%)</span>
                  <span className="font-mono tabular-nums">{formatIdr(invoice.taxAmount)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-base text-slate-900">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{formatIdr(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
