import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, QrCode } from 'lucide-react';
import { buildVerifyUrl, encodeCode128B } from '../lib/barcode';

interface BarcodeBlockProps {
  verificationCode: string;
  verificationHash: string;
  onOpenVerify?: (code: string) => void;
}

export const BarcodeBlock: React.FC<BarcodeBlockProps> = ({
  verificationCode,
  verificationHash,
  onOpenVerify,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const verifyUrl = useMemo(
    () => buildVerifyUrl(verificationCode),
    [verificationCode]
  );

  const code128 = useMemo(
    () => encodeCode128B(verificationCode),
    [verificationCode]
  );

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(verifyUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl('');
      });
    return () => {
      active = false;
    };
  }, [verifyUrl]);

  const bars = useMemo(() => {
    const rects: Array<{ x: number; width: number }> = [];
    let x = 0;
    for (let i = 0; i < code128.modules.length; i++) {
      const w = code128.modules[i];
      if (i % 2 === 0) {
        rects.push({ x, width: w });
      }
      x += w;
    }
    return rects;
  }, [code128]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      {/* 2D QR Code */}
      <div className="w-24 h-24 rounded-md border border-slate-200 bg-white p-1.5 flex items-center justify-center shrink-0">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt={`QR Verifikasi ${verificationCode}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <QrCode className="w-8 h-8 text-slate-400" />
        )}
      </div>

      {/* Details & 1D Code128B Barcode */}
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <div className="text-xs font-semibold text-slate-900">
            Verifikasi Keaslian Dokumen Digital
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-2">
            <span>Kode: {verificationCode}</span>
            <span aria-hidden="true">·</span>
            <span>SHA-256: {verificationHash || '—'}</span>
          </div>
        </div>

        {/* Vector 1D Code 128B Linear Barcode */}
        <div className="bg-white border border-slate-200 rounded px-2.5 py-1.5 inline-block max-w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${code128.totalWidth} 32`}
            className="h-7 w-48 sm:w-56 text-slate-900"
            role="img"
            aria-label={`Barcode ${verificationCode}`}
            preserveAspectRatio="none"
          >
            {bars.map((b, idx) => (
              <rect
                key={idx}
                x={b.x}
                y={0}
                width={b.width}
                height={32}
                fill="currentColor"
              />
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-700" />
                <span>Tautan Disalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Salin Link Verifikasi</span>
              </>
            )}
          </button>

          {onOpenVerify && (
            <button
              type="button"
              onClick={() => onOpenVerify(verificationCode)}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Uji Verifikasi Barcode</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
