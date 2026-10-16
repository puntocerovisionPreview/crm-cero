// Utilities for direct client contacts (WhatsApp & Phone calls)

export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function formatWhatsAppUrl(phone: string, text?: string): string {
  const clean = cleanPhoneNumber(phone).replace(/^\+/, '');
  const encodedText = text ? encodeURIComponent(text) : '';
  return `https://wa.me/${clean}${encodedText ? `?text=${encodedText}` : ''}`;
}

export function formatTelUrl(phone: string): string {
  const clean = cleanPhoneNumber(phone);
  return `tel:${clean}`;
}

/**
 * Extract phone number from notes or text if present (e.g. "+54 9 11 1234-5678" or "1134567890")
 */
export function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  if (match && match[0].replace(/\D/g, '').length >= 8) {
    return match[0].trim();
  }
  return null;
}
