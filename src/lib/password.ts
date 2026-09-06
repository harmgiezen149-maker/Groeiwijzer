import 'server-only';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { MINIMALE_LENGTE } from './password-regels';

const scrypt = promisify(scryptCallback) as (
  wachtwoord: string,
  zout: Buffer,
  lengte: number,
  opties: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Wachtwoorden gaan door scrypt: traag te raden, geen extra afhankelijkheid.
 * De parameters staan in de opgeslagen waarde, zodat ze later te verzwaren
 * zijn zonder bestaande wachtwoorden ongeldig te maken.
 */
const N = 16384;
const R = 8;
const P = 1;
const LENGTE = 32;
const MAXMEM = 64 * 1024 * 1024;

export { MINIMALE_LENGTE } from './password-regels';

export async function hashPassword(wachtwoord: string): Promise<string> {
  const zout = randomBytes(16);
  const sleutel = await scrypt(wachtwoord.normalize('NFKC'), zout, LENGTE, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, zout.toString('base64'), sleutel.toString('base64')].join('$');
}

export async function verifyPassword(wachtwoord: string, opgeslagen: string): Promise<boolean> {
  const delen = opgeslagen.split('$');
  if (delen.length !== 6 || delen[0] !== 'scrypt') return false;
  const [, n, r, p, zout64, sleutel64] = delen;
  try {
    const zout = Buffer.from(zout64, 'base64');
    const verwacht = Buffer.from(sleutel64, 'base64');
    const sleutel = await scrypt(wachtwoord.normalize('NFKC'), zout, verwacht.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });
    // Vergelijken op vaste tijd: de duur mag niets over het wachtwoord zeggen.
    return sleutel.length === verwacht.length && timingSafeEqual(sleutel, verwacht);
  } catch {
    return false;
  }
}

/**
 * Wat er mis is met een gekozen wachtwoord, of null als het deugt. Lengte doet
 * meer dan hoofdletters en tekens; daarom één duidelijke eis.
 */
export function wachtwoordProbleem(wachtwoord: string, email?: string): string | null {
  const w = wachtwoord.normalize('NFKC');
  if (w.length < MINIMALE_LENGTE) {
    return `Kies een wachtwoord van minstens ${MINIMALE_LENGTE} tekens.`;
  }
  if (w.length > 200) return 'Dat wachtwoord is te lang.';
  if (w.trim().length === 0) return 'Een wachtwoord van spaties telt niet.';
  const laag = w.toLowerCase();
  const naam = email?.split('@')[0]?.toLowerCase();
  if (naam && naam.length >= 4 && laag.includes(naam)) {
    return 'Kies iets anders dan je e-mailadres.';
  }
  if (['wachtwoord', 'password', '1234567890', 'bloeiwijzer'].some((v) => laag.includes(v))) {
    return 'Dat wachtwoord is te makkelijk te raden.';
  }
  return null;
}
