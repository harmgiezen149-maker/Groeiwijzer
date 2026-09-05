import { randomBytes, randomUUID } from 'node:crypto';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // zonder 0/O en 1/I

export function newId(): string {
  return randomUUID().replace(/-/g, '');
}

/** Korte code voor een QR-label, bv. "K7F2". */
export function newLabelCode(length = 4): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function newToken(length = 32): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function isLabelCode(value: string): boolean {
  return new RegExp(`^[${ALPHABET}]{4,8}$`).test(value.toUpperCase());
}
