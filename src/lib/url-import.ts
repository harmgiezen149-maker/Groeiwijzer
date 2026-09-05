import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
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

/** Haalt een publieke HTML-pagina op en levert de kale tekst. */
export async function fetchPageText(rawUrl: string): Promise<{ text: string; title?: string }> {
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
      headers: { accept: 'text/html', 'user-agent': 'Bloeiwijzer/1.0' },
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
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html')) {
      throw Object.assign(new Error('Dit is geen webpagina met tekst.'), { status: 400 });
    }
    const html = await readLimited(res, MAX_BYTES);
    return { text: stripHtml(html), title: titleOf(html) };
  }

  throw Object.assign(new Error('Te veel doorverwijzingen.'), { status: 400 });
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
