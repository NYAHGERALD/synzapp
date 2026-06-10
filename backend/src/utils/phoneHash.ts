import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { normalizeE164Phone } from './phone.js';

export function hashPhoneNumber(phoneNumber: string): string {
  const normalizedPhone = normalizeE164Phone(phoneNumber);

  return createHmac('sha256', env.phoneHashSecret)
    .update(normalizedPhone)
    .digest('hex');
}
