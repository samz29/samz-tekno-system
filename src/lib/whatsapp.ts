/**
 * Normalizes an Indonesian or international phone string into digits-only format
 * suitable for https://wa.me/<digits>.
 * Examples:
 * - "+62 812-3456-7890" -> "6281234567890"
 * - "081234567890"      -> "6281234567890"
 * - "6281234567890"     -> "6281234567890"
 */
export function normalizeWhatsAppNumber(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

export function buildWhatsAppUrl(phoneRaw?: string, message?: string): string {
  const digits = normalizeWhatsAppNumber(phoneRaw);
  if (!digits) return '';
  const cleanMsg = String(message || '').trim();
  if (!cleanMsg) {
    return `https://wa.me/${digits}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(cleanMsg)}`;
}
