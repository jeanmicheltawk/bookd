/** Digits, +, (, ) only — for phone / WhatsApp. */
export const PHONE_CHAR_PATTERN = '^[0-9+()]*$';

/** Requires a local part, @, domain, and a dot in the domain. */
export const EMAIL_FORMAT_PATTERN = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';

export interface ContactFieldErrors {
  email?: string;
  phone?: string;
  whatsapp?: string;
}

export const EMAIL_ERROR = 'Email must include @ and .';
export const PHONE_ERROR = 'Only numbers, +, (, and ) allowed';

export function isValidPhoneOrWhatsapp(value: string | null | undefined): boolean {
  const v = String(value ?? '').trim();
  if (!v) return true;
  return /^[0-9+()]+$/.test(v);
}

export function isValidEmailFormat(value: string | null | undefined): boolean {
  const v = String(value ?? '').trim();
  if (!v) return false;
  return v.includes('@') && v.includes('.') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Instant feedback while typing — empty email is not flagged yet. */
export function emailErrorWhileTyping(value: string | null | undefined): string | undefined {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  return isValidEmailFormat(v) ? undefined : EMAIL_ERROR;
}

export function phoneErrorWhileTyping(value: string | null | undefined): string | undefined {
  return isValidPhoneOrWhatsapp(value) ? undefined : PHONE_ERROR;
}

export function getContactFieldErrors(
  email: string,
  phone?: string | null,
  whatsapp?: string | null,
): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  if (!isValidEmailFormat(email)) {
    errors.email = EMAIL_ERROR;
  }
  if (!isValidPhoneOrWhatsapp(phone)) {
    errors.phone = PHONE_ERROR;
  }
  if (!isValidPhoneOrWhatsapp(whatsapp)) {
    errors.whatsapp = PHONE_ERROR;
  }
  return errors;
}

export function hasContactFieldErrors(errors: ContactFieldErrors): boolean {
  return !!(errors.email || errors.phone || errors.whatsapp);
}
