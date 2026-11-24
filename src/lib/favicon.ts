const SAFE_DATA_IMAGE_RE = /^data:(image\/(?:png|jpeg|jpg|webp));base64,[A-Za-z0-9+/=]+$/;

/**
 * Synchronizes browser tab favicon & Apple touch icon with the company's uploaded logo.
 * Falls back to the default obsidian-and-gold FakturaFlow icons when no custom logo is set.
 */
export function syncDocumentFavicon(logoDataUrl?: string): void {
  if (typeof document === 'undefined' || !document.head) return;

  const trimmed = String(logoDataUrl || '').trim();
  const match = SAFE_DATA_IMAGE_RE.exec(trimmed);

  // Remove previously injected dynamic icon links
  document.head
    .querySelectorAll('link[data-ff-managed-icon="true"]')
    .forEach((node) => node.remove());

  const existingIcons = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    )
  );

  if (match) {
    const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    existingIcons.forEach((link) => {
      link.setAttribute('href', trimmed);
      if (link.rel === 'icon') {
        link.setAttribute('type', mimeType);
      } else {
        link.removeAttribute('type');
      }
      link.removeAttribute('sizes');
    });
    return;
  }

  // Fallback to server dynamic/static default logo endpoint
  const fallbackHref = '/api/public/company-logo';
  existingIcons.forEach((link) => {
    link.setAttribute('href', fallbackHref);
    if (link.rel === 'icon') {
      link.setAttribute('type', 'image/png');
    } else {
      link.removeAttribute('type');
    }
    link.removeAttribute('sizes');
  });
}
