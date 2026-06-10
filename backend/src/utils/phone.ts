export function normalizeE164Phone(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();

  if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
    throw new Error('Phone number must be E.164 formatted.');
  }

  return trimmed;
}

export function getPhoneDigits(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

export function maskPhoneNumber(phoneNumber?: string | null): string {
  const digits = getPhoneDigits(phoneNumber || '');
  const lastFourDigits = digits.slice(-4);

  return lastFourDigits ? `*****${lastFourDigits}` : '*****';
}

export function getPhoneLast4(phoneNumber?: string | null): string {
  return getPhoneDigits(phoneNumber || '').slice(-4);
}

export function formatPhoneNumber(phoneNumber: string): string {
  const normalizedPhone = normalizeE164Phone(phoneNumber);
  const digits = getPhoneDigits(normalizedPhone);

  if (digits.startsWith('1') && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  if (digits.startsWith('44')) {
    const nationalNumber = digits.slice(2);

    if (nationalNumber.length === 10 && nationalNumber.startsWith('7')) {
      return `+44 ${nationalNumber.slice(0, 4)} ${nationalNumber.slice(4, 7)} ${nationalNumber.slice(7)}`;
    }

    if (nationalNumber.length === 10) {
      return `+44 ${nationalNumber.slice(0, 2)} ${nationalNumber.slice(2, 6)} ${nationalNumber.slice(6)}`;
    }
  }

  if (digits.startsWith('52') && digits.length === 12) {
    return `+52 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }

  return normalizedPhone.replace(/^(\+\d{1,3})(\d+)$/, (_match, countryCode: string, nationalNumber: string) =>
    `${countryCode} ${nationalNumber.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`
  );
}
