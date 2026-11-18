import React from 'react';
import { X } from 'lucide-react';
import type { EmailLog } from '../types';
import { formatDateTimeId } from '../lib/formatters';

interface EmailPreviewModalProps {
  log: EmailLog | null;
  onClose: () => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({ log, onClose }) => {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{log.subject}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kepada: {log.recipientEmail} · {log.deliveryMode} · {formatDateTimeId(log.sentAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
          <iframe
            title={`Pratinjau Email ${log.invoiceNumber}`}
            srcDoc={log.htmlPreview}
            className="w-full h-[520px] rounded-lg border border-slate-200 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
