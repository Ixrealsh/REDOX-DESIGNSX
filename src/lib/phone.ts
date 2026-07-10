/** Normalise a Ghanaian phone number to the MSISDN form the SMS gateway expects: 233XXXXXXXXX. */
export function formatGhanaPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');

  if (digits.startsWith('00233') && digits.length === 14) return digits.slice(2);
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;

  return digits;
}

/**
 * True only for a complete Ghanaian MSISDN. This is the allowlist that keeps a
 * crafted checkout phone number from directing billable SMS to arbitrary numbers.
 */
export function isValidGhanaPhone(msisdn: string): boolean {
  return /^233\d{9}$/.test(msisdn);
}
