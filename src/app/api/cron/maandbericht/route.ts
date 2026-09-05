import { withCron } from '@/lib/cron';
import { listAllGardens, listMembers, setMeta } from '@/lib/garden';
import { agendaForMonth, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { appUrl, button, escapeHtml, mailLayout, sendMail } from '@/lib/mail';
import { MONTH_NAMES, parseYmd, todayInAmsterdam } from '@/lib/dates';
import type { AgendaRow } from '@/lib/dto';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_REGELS = 15;

/** De 1e van de maand, 06:00 UTC — 08:00 in de zomer, 07:00 in de winter. */
export const GET = withCron(async () => {
  const vandaag = todayInAmsterdam();
  const { year, month } = parseYmd(vandaag);
  const gardens = await listAllGardens();
  const verslag: Record<string, unknown>[] = [];

  for (const garden of gardens) {
    await ensureGenerated(garden.id, year);
    const rijen = await toRows(garden.id, await agendaForMonth(garden.id, year, month));
    const leden = (await listMembers(garden.id)).filter((lid) => lid.notify.email && lid.user?.email);
    const adressen = leden.map((lid) => lid.user!.email);

    if (adressen.length === 0) {
      verslag.push({ tuin: garden.name, verstuurd: false, reden: 'geen ontvangers' });
      continue;
    }

    const resultaat = await sendMail({
      to: adressen,
      subject: onderwerp(garden.name, month, rijen.length),
      text: alsTekst(garden.name, month, rijen),
      html: alsHtml(garden.name, month, rijen),
    });
    await setMeta(garden.id, { lastMonthlyMail: new Date().toISOString() });
    verslag.push({ tuin: garden.name, ontvangers: adressen.length, taken: rijen.length, ...resultaat });
  }

  return { maand: MONTH_NAMES[month - 1], jaar: year, verslag };
});

function onderwerp(tuin: string, maand: number, aantal: number): string {
  const naam = MONTH_NAMES[maand - 1];
  if (aantal === 0) return `${tuin}: niets te doen in ${naam}`;
  return `${tuin}: ${aantal} ${aantal === 1 ? 'taak' : 'taken'} in ${naam}`;
}

function groepeer(rijen: AgendaRow[]): { locatie: string; taken: AgendaRow[] }[] {
  const map = new Map<string, AgendaRow[]>();
  for (const rij of rijen) {
    map.set(rij.locationName, [...(map.get(rij.locationName) ?? []), rij]);
  }
  return [...map.entries()]
    .map(([locatie, taken]) => ({ locatie, taken }))
    .sort((a, b) => a.locatie.localeCompare(b.locatie, 'nl'));
}

function alsTekst(tuin: string, maand: number, rijen: AgendaRow[]): string {
  const naam = MONTH_NAMES[maand - 1];
  if (rijen.length === 0) return `${tuin} — ${naam}\n\nGeen open taken deze maand.\n\n${appUrl('/')}`;
  const regels: string[] = [`${tuin} — ${naam}`, ''];
  let geteld = 0;
  for (const groep of groepeer(rijen)) {
    if (geteld >= MAX_REGELS) break;
    regels.push(`${groep.locatie}:`);
    for (const taak of groep.taken) {
      if (geteld >= MAX_REGELS) break;
      regels.push(`- ${taak.plantName}: ${taak.title}`);
      geteld++;
    }
    regels.push('');
  }
  if (rijen.length > geteld) regels.push(`En nog ${rijen.length - geteld} andere taken.`);
  regels.push('', appUrl('/'));
  return regels.join('\n');
}

function alsHtml(tuin: string, maand: number, rijen: AgendaRow[]): string {
  const naam = MONTH_NAMES[maand - 1];
  if (rijen.length === 0) {
    return mailLayout(
      `${tuin} — ${naam}`,
      `<p style="margin:0;line-height:1.5;">Geen open taken deze maand.</p>${button(appUrl('/'), 'Naar de tuin')}`,
    );
  }

  let geteld = 0;
  const blokken: string[] = [];
  for (const groep of groepeer(rijen)) {
    if (geteld >= MAX_REGELS) break;
    const items: string[] = [];
    for (const taak of groep.taken) {
      if (geteld >= MAX_REGELS) break;
      items.push(
        `<li style="margin:2px 0;"><strong>${escapeHtml(taak.plantName)}</strong> — ${escapeHtml(taak.title)}</li>`,
      );
      geteld++;
    }
    blokken.push(
      `<h2 style="margin:16px 0 4px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#5b6b60;">${escapeHtml(groep.locatie)}</h2>
       <ul style="margin:0;padding-left:18px;line-height:1.5;">${items.join('')}</ul>`,
    );
  }

  const rest =
    rijen.length > geteld
      ? `<p style="margin:16px 0 0;color:#5b6b60;">En nog ${rijen.length - geteld} andere taken.</p>`
      : '';

  return mailLayout(
    `${tuin} — ${naam}`,
    `<p style="margin:0;line-height:1.5;">${rijen.length} ${rijen.length === 1 ? 'taak' : 'taken'} deze maand.</p>
     ${blokken.join('')}${rest}${button(appUrl('/'), 'Naar de tuin')}`,
  );
}
