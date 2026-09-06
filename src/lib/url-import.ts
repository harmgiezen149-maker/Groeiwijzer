import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_AFBEELDING_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** Blokkeert adressen in privé-ranges, om SSRF te voorkomen (§13). */
export function isPrivateAddress(host: string): boolean {
  const versie = isIP(host);
  if (versie === 4) {
    const [a, b] = host.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (versie === 6) {
    const laag = host.toLowerCase();
    if (laag === '::1' || laag === '::') return true;
    if (laag.startsWith('fc') || laag.startsWith('fd')) return true;
    if (laag.startsWith('fe80')) return true;
    if (laag.startsWith('::ffff:')) return isPrivateAddress(laag.slice(7));
    return false;
  }
  const naam = host.toLowerCase();
  return naam === 'localhost' || naam.endsWith('.localhost') || naam.endsWith('.internal');
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isPrivateAddress(hostname)) {
    throw Object.assign(new Error('Dit adres kan niet opgehaald worden.'), { status: 400 });
  }
  if (isIP(hostname)) return;
  const adressen = await lookup(hostname, { all: true });
  if (adressen.some((a) => isPrivateAddress(a.address))) {
    throw Object.assign(new Error('Dit adres kan niet opgehaald worden.'), { status: 400 });
  }
}

/**
 * Haalt een adres op met alle controles van §13: alleen http en https, geen
 * privé-adressen, hooguit drie doorverwijzingen en een tijdslimiet. Geeft de
 * uiteindelijke response terug, samen met het adres waar hij vandaan komt.
 */
async function veiligeFetch(
  rawUrl: string,
  accept: string,
): Promise<{ res: Response; url: URL }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('Dat is geen geldig webadres.'), { status: 400 });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Object.assign(new Error('Alleen http en https.'), { status: 400 });
  }

  let huidig = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(huidig.hostname);
    const res = await fetch(huidig, {
      redirect: 'manual',
      headers: { accept, 'user-agent': 'Bloeiwijzer/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const locatie = res.headers.get('location');
      if (!locatie) break;
      huidig = new URL(locatie, huidig);
      continue;
    }
    if (!res.ok) {
      throw Object.assign(new Error(`De pagina gaf een fout (${res.status}).`), { status: 400 });
    }
    return { res, url: huidig };
  }

  throw Object.assign(new Error('Te veel doorverwijzingen.'), { status: 400 });
}

export interface PaginaInhoud {
  text: string;
  title?: string;
  /** Het adres van de foto op de pagina, als die er is. */
  imageUrl?: string;
}

/** Haalt een publieke HTML-pagina op en levert de kale tekst en de foto. */
export async function fetchPageText(rawUrl: string): Promise<PaginaInhoud> {
  const { res, url } = await veiligeFetch(rawUrl, 'text/html');
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) {
    throw Object.assign(new Error('Dit is geen webpagina met tekst.'), { status: 400 });
  }
  const html = await readLimited(res, MAX_BYTES);
  return { text: stripHtml(html), title: titleOf(html), imageUrl: imageOf(html, url) };
}

/**
 * Haalt de foto van een productpagina op. Werpt niet: lukt het niet, dan gaat
 * de import gewoon door zonder foto.
 */
export async function fetchPageImage(rawUrl: string): Promise<Uint8Array | null> {
  try {
    const { res } = await veiligeFetch(rawUrl, 'image/*');
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return null;
    const bytes = await readLimitedBytes(res, MAX_AFBEELDING_BYTES);
    return bytes && bytes.byteLength > 0 ? bytes : null;
  } catch (error) {
    console.warn('[bloeiwijzer] foto van de pagina ophalen mislukt', error);
    return null;
  }
}

/**
 * Het adres van de foto op de pagina. Webwinkels zetten die in og:image; is
 * die er niet, dan de eerste afbeelding die geen logo of pictogram lijkt.
 */
export function imageOf(html: string, base: URL | string): string | undefined {
  const meta =
    html.match(
      /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>/i,
    )?.[0];
  const kandidaat =
    meta?.match(/content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    eersteAfbeelding(html);
  if (!kandidaat) return undefined;
  try {
    const adres = new URL(kandidaat.trim(), base);
    return adres.protocol === 'http:' || adres.protocol === 'https:' ? adres.toString() : undefined;
  } catch {
    return undefined;
  }
}

const GEEN_FOTO = /(logo|icon|sprite|avatar|placeholder|pixel|badge|banner)/i;

function eersteAfbeelding(html: string): string | undefined {
  for (const treffer of html.matchAll(/<img[^>]+>/gi)) {
    const tag = treffer[0];
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (!src || src.startsWith('data:')) continue;
    if (GEEN_FOTO.test(src) || GEEN_FOTO.test(tag.match(/alt=["']([^"']*)["']/i)?.[1] ?? '')) {
      continue;
    }
    if (/\.svg(\?|$)/i.test(src)) continue;
    return src;
  }
  return undefined;
}

async function readLimited(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const delen: Uint8Array[] = [];
  let totaal = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totaal += value.byteLength;
    if (totaal > max) {
      await reader.cancel();
      break;
    }
    delen.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(delen.map((d) => Buffer.from(d))));
}

async function readLimitedBytes(res: Response, max: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const delen: Uint8Array[] = [];
  let totaal = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totaal += value.byteLength;
    // Groter dan de limiet: helemaal niet gebruiken, geen half bestand.
    if (totaal > max) {
      await reader.cancel();
      return null;
    }
    delen.push(value);
  }
  return new Uint8Array(Buffer.concat(delen.map((d) => Buffer.from(d))));
}

export function titleOf(html: string): string | undefined {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
