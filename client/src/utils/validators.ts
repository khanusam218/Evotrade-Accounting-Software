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
