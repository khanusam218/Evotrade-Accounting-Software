// Shared field-level validation patterns used across forms (contacts, employees, company setup, etc.)

export const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ZIP_RE   = /^[A-Za-z0-9\- ]{3,10}$/;
export const NTN_RE   = /^\d{7}-?\d?$/;
export const CNIC_RE  = /^\d{5}-?\d{7}-?\d$/;

export function validatePhone(value: string): string {
  const v = value.trim();
  return v && !PHONE_RE.test(v) ? 'Enter a valid phone number.' : '';
}

export function validateEmail(value: string): string {
  const v = value.trim();
  return v && !EMAIL_RE.test(v) ? 'Enter a valid email address.' : '';
}

export function validateZip(value: string): string {
  const v = value.trim();
  return v && !ZIP_RE.test(v) ? 'Enter a valid zip/postal code.' : '';
}

export function validateNTN(value: string): string {
  const v = value.trim();
  return v && !NTN_RE.test(v) ? 'NTN must be 7 digits (optionally with a check digit), e.g. 1234567-8.' : '';
}

export function validateCNIC(value: string): string {
  const v = value.trim();
  return v && !CNIC_RE.test(v) ? 'CNIC must be 13 digits, e.g. 12345-1234567-1.' : '';
}

// Generic "name" field guard — required, letters only (spaces and a small set
// of common business-name punctuation allowed), no digits anywhere.
export const NAME_RE = /^[A-Za-z][A-Za-z\s.,'&()-]*$/;
export function validateName(value: string, label = 'Name'): string {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (/\d/.test(v)) return `${label} cannot contain numbers.`;
  if (!NAME_RE.test(v)) return `${label} can only contain letters (spaces, ., ,, ', &, - and () are allowed).`;
  return '';
}

// Item/product-style "name" guard — required, must contain at least one
// letter, but (unlike validateName) numbers are allowed: product names
// routinely include model numbers, sizes, or wattages (e.g. "LED Bulb 12W").
export function validateItemName(value: string, label = 'Name'): string {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (!/[A-Za-z]/.test(v)) return `${label} must contain at least one letter.`;
  return '';
}

export function validatePositive(value: number, label = 'Value'): string {
  return value < 0 ? `${label} cannot be negative.` : '';
}

export function validatePercent(value: number, label = 'Percentage'): string {
  return value < 0 || value > 100 ? `${label} must be between 0 and 100.` : '';
}
