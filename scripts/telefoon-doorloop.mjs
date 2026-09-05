/**
 * Scenario 16 uit de overdracht: de volledige flow op een telefoon van
 * 375 px breed, met één hand.
 *
 *   npm run dev -- -p 3111
 *   npx playwright-core   # of: npm i -D playwright-core
 *   OUT=./schermschoten node scripts/telefoon-doorloop.mjs
 *
 * Het script speelt de flow af en controleert per scherm op horizontaal
 * scrollen, raakvlakken onder 44 px, invoervelden onder 16 px (waardoor iOS
 * inzoomt), JS-fouten en mislukte verzoeken. Het vervangt niet het echte
 * gevoel van bedienen met natte handen; het vangt af wat meetbaar is.
 */
import { chromium } from 'playwright-core';

const B = process.env.BASE ?? 'http://localhost:3111';
const OUT = process.env.OUT ?? '.';
const problemen = [];
let stap = 0;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
});
// iPhone SE: het smalste toestel dat er nog toe doet.
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'nl-NL',
});
const page = await ctx.newPage();

page.on('pageerror', (e) => problemen.push(`JS-fout: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problemen.push(`console: ${m.text().slice(0, 160)}`);
});

async function schermschot(naam) {
  stap++;
  await page.screenshot({ path: `${OUT}/${String(stap).padStart(2, '0')}-${naam}.png` });
}

/** Controles die op elk scherm gelden. */
async function controleer(naam) {
  const bevindingen = await page.evaluate(() => {
    const uit = { overflow: null, kleineRaakvlakken: [], kleineVelden: [], laagContrast: [] };

    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      uit.overflow = `${document.documentElement.scrollWidth} > ${window.innerWidth}`;
    }

    const zichtbaar = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // Raakvlakken: knoppen, links en formulierelementen die je aantikt.
    for (const el of document.querySelectorAll('button, a, input, select, textarea')) {
      if (!zichtbaar(el)) continue;
      const r = el.getBoundingClientRect();
      const type = el.getAttribute('type');
      // Links binnen een lopende tekstregel tellen niet als losse knop.
      const inTekst =
        el.tagName === 'A' &&
        el.parentElement &&
        getComputedStyle(el.parentElement).display.includes('inline') === false &&
        el.closest('p, li, span') !== null &&
        r.height < 30;
      if (inTekst) continue;
      if (type === 'checkbox' || type === 'radio') continue; // eigen minimum
      let hoogte = r.height;
      if (el.classList.contains('bw-pil')) {
        const na = getComputedStyle(el, '::after');
        const inzet = Math.abs(parseFloat(na.top) || 0);
        hoogte += inzet * 2;
      }
      if (hoogte < 43.5 || r.width < 20) {
        uit.kleineRaakvlakken.push(
          `${el.tagName.toLowerCase()}${type ? `[${type}]` : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 32)}" ${Math.round(r.width)}x${Math.round(hoogte)}`,
        );
      }
    }

    // Tekstgrootte in velden: onder 16px zoomt iOS in.
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (!zichtbaar(el)) continue;
      const t = el.getAttribute('type');
      if (t === 'checkbox' || t === 'radio' || t === 'file') continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) uit.kleineVelden.push(`${el.id || el.name || el.tagName} ${fs}px`);
    }

    return uit;
  });

  if (bevindingen.overflow) problemen.push(`${naam}: horizontaal scrollen (${bevindingen.overflow})`);
  for (const r of new Set(bevindingen.kleineRaakvlakken)) problemen.push(`${naam}: klein raakvlak — ${r}`);
  for (const v of new Set(bevindingen.kleineVelden)) problemen.push(`${naam}: veld zoomt in — ${v}`);
}

/** Alles binnen de duimzone? Rechterduim, staand, rechteronderhoek. */
async function duimzone(naam, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return;
  const { height } = page.viewportSize();
  // Ruwe maat: comfortabel bereik is de onderste tweederde van het scherm.
  // Duimbereik van een rechterhand: de rechterhelft en niet vlak bij de rand.
  const { width } = page.viewportSize();
  if (box.x + box.width > width - 4) {
    problemen.push(`${naam}: "${selector}" raakt de rechterrand`);
  }
  if (box.y + box.height > height) {
    problemen.push(`${naam}: "${selector}" valt buiten beeld`);
  }
}

/* ---------------------------------------------------------- de doorloop */

// 1. inloggen als nieuwe gebruiker: lege tuin, dus ook de lege staat
const adres = `tel-${Date.now()}@voorbeeld.nl`;
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await controleer('login');
await schermschot('login');
await page.fill('#email', adres);
await page.locator('form button').click();
await page.waitForURL(`${B}/`, { timeout: 45000 });
await page.waitForLoadState('networkidle');

// 2. lege staat
await controleer('lege staat');
await schermschot('lege-staat');

// 3. plant toevoegen — zelf invullen
await page.getByRole('link', { name: /Zelf invullen/ }).click();
await page.waitForURL(/planten\/nieuw/, { timeout: 30000 });
await page.waitForLoadState('networkidle');
await controleer('nieuw (invoer)');
await schermschot('nieuw-invoer');

await page.selectOption('#locatie', { index: 1 });
await page.fill('#naam', 'Hortensia');
await page.selectOption('#categorie1', 'struik');
await duimzone('nieuw', 'button:has-text("Onderhoud voorstellen")');
// Geen AI-sleutel in deze omgeving, dus de handmatige weg:
await page.getByRole('button', { name: 'Overslaan en zelf invullen' }).click();
await page.waitForTimeout(500);
await controleer('nieuw (bevestigen)');
await schermschot('nieuw-bevestigen');

// 4. een taak toevoegen
await page.getByRole('button', { name: /Taken bekijken en bewerken/ }).click();
await page.getByRole('button', { name: 'Taak toevoegen' }).click();
await page.waitForTimeout(300);
await page.getByLabel('Titel').fill('Uitgebloeide bloemen wegknippen');
await page.getByLabel('Uitleg').fill('Knip de oude bloemhoofden weg tot boven het eerste knoppenpaar.');
const nu = new Date();
await page.getByLabel('Van').selectOption(String(nu.getMonth() + 1));
await page.getByLabel('Tot en met').selectOption(String(nu.getMonth() + 1));
await controleer('taakeditor');
await schermschot('taakeditor');

await page.getByRole('button', { name: /^Opslaan als/ }).click();
await page.waitForURL(/planten\/[0-9a-f]{8}/, { timeout: 30000 });
await page.waitForLoadState('networkidle');
await controleer('plantpagina');
await schermschot('plantpagina');

// 5. terug naar vandaag en afvinken met één tik
await page.getByRole('link', { name: 'vandaag' }).click();
await page.waitForURL(`${B}/`, { timeout: 30000 });
await page.waitForLoadState('networkidle');
await controleer('vandaag');
await schermschot('vandaag');

const vink = page.locator('button[aria-label*="afvinken"]').first();
await duimzone('vandaag', 'button[aria-label*="afvinken"]');
await vink.tap();
await page.waitForTimeout(1200);
await schermschot('afgevinkt');
const gedaan = await page.getByRole('button', { name: 'Ongedaan' }).count();
if (gedaan === 0) problemen.push('vandaag: na afvinken geen "Ongedaan" zichtbaar');

// 6. ongedaan maken, daarna overslaan met reden
await page.getByRole('button', { name: 'Ongedaan' }).first().tap();
await page.waitForTimeout(1200);
await page.locator('button[aria-expanded]').first().tap();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Overslaan' }).first().tap();
await page.waitForTimeout(500);
await controleer('overslaan');
await schermschot('overslaan');
await page.getByRole('button', { name: 'Geen tijd' }).tap();
await page.locator('dialog button:has-text("Overslaan")').tap();
await page.waitForTimeout(1200);
await schermschot('overgeslagen');

// 7. de overige schermen
for (const [naam, label] of [
  ['planten', 'planten'],
  ['agenda', 'agenda'],
  ['locaties', 'locaties'],
  ['instellingen', 'instellingen'],
]) {
  await page.getByRole('link', { name: label, exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await controleer(naam);
  await schermschot(naam);
}

// 8. een dag kiezen in de agenda
await page.getByRole('link', { name: 'agenda', exact: true }).click();
await page.waitForLoadState('networkidle');
const dag = page.locator('a.bw-dag').nth(10);
if (await dag.count()) {
  await dag.tap();
  await page.waitForTimeout(900);
  await controleer('agenda (dag gekozen)');
  await schermschot('agenda-dag');
}

await browser.close();

console.log(problemen.length ? '--- bevindingen ---' : '--- geen bevindingen ---');
for (const p of [...new Set(problemen)]) console.log('•', p);
process.exit(problemen.length ? 1 : 0);
