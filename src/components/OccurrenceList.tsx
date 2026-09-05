'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AgendaRow } from '@/lib/dto';
import { SKIP_REASONS, TASK_COLOR, TASK_LABEL, WEATHER_FLAG_LABEL } from '@/lib/ui';
import { formatRange } from '@/lib/dates';
import { PlantFoto } from './PlantFoto';
import { TaakIcoon } from './TaakIcoon';
import { FotoKiezer } from './FotoKiezer';

type Groepering = 'locatie' | 'geen';

export function OccurrenceList({
  rows: initialRows,
  groupBy = 'locatie',
  emptyText = 'Niets te doen. Mooi.',
  compact = false,
  zonderPlantnaam = false,
}: {
  rows: AgendaRow[];
  groupBy?: Groepering;
  emptyText?: string;
  /** Agenda-variant: selectievakje in plaats van foto, meerdere tegelijk. */
  compact?: boolean;
  /** Op de plantpagina zelf is de plantnaam op elke regel overbodig. */
  zonderPlantnaam?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [fout, setFout] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (groupBy === 'geen') return [{ key: '', name: '', rows }];
    const map = new Map<string, { key: string; name: string; rows: AgendaRow[] }>();
    for (const row of rows) {
      const group = map.get(row.locationId) ?? {
        key: row.locationId,
        name: row.locationName,
        rows: [],
      };
      group.rows.push(row);
      map.set(row.locationId, group);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }, [rows, groupBy]);

  async function call(id: string, actie: 'complete' | 'skip' | 'reopen', body?: unknown) {
    const vorige = rows;
    // Optimistisch: de rij verandert meteen, bij een fout draaien we terug.
    setRows((huidig) =>
      huidig.map((row) =>
        row.id === id
          ? {
              ...row,
              status:
                actie === 'complete' ? 'gedaan' : actie === 'skip' ? 'overgeslagen' : 'open',
            }
          : row,
      ),
    );
    setFout(null);
    try {
      const res = await fetch(`/api/occurrences/${encodeURIComponent(id)}/${actie}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Opslaan lukte niet');
      }
      const data = (await res.json()) as { occurrence: Parameters<typeof pick>[0] };
      setRows((huidig) =>
        huidig.map((row) => (row.id === id ? { ...row, ...pick(data.occurrence) } : row)),
      );
      router.refresh();
    } catch (error) {
      setRows(vorige);
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
    }
  }

  if (rows.length === 0) {
    return <p className="bw-card p-5 text-sm text-[var(--ink-quiet)]">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.key}>
          {group.name ? <h3 className="bw-sectie mb-2.5">{group.name}</h3> : null}
          <ul className="flex flex-col gap-2.5">
            {group.rows.map((row) => (
              <OccurrenceRow
                key={row.id}
                row={row}
                onAction={call}
                compact={compact}
                zonderPlantnaam={zonderPlantnaam}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** De API geeft een TaskOccurrence terug; alleen deze velden zijn hier relevant. */
function pick(occ: {
  status?: AgendaRow['status'];
  doneAt?: string;
  note?: string;
  skipReason?: string;
  photoUrl?: string;
}): Partial<AgendaRow> {
  return {
    status: occ.status,
    doneAt: occ.doneAt,
    note: occ.note,
    skipReason: occ.skipReason,
    occurrencePhotoUrl: occ.photoUrl,
  };
}

function OccurrenceRow({
  row,
  onAction,
  compact,
  zonderPlantnaam,
}: {
  row: AgendaRow;
  onAction: (id: string, actie: 'complete' | 'skip' | 'reopen', body?: unknown) => Promise<void>;
  compact: boolean;
  zonderPlantnaam: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const overslaan = useRef<HTMLDialogElement>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const kleur = TASK_COLOR[row.taskType];

  if (row.status !== 'open') {
    return (
      <li className="bw-card flex items-center gap-3 p-2.5">
        <span
          aria-hidden
          className="bw-vink bw-vink-af bw-bloei"
          style={row.status === 'overgeslagen' ? { background: 'var(--ink-muted)', borderColor: 'var(--ink-muted)' } : undefined}
        >
          {row.status === 'gedaan' ? '✓' : '–'}
        </span>
        <span className="min-w-0 flex-1 text-[13.5px]">
          <span className="block font-semibold">{row.plantName}</span>
          <span className="block text-[12.5px] text-[var(--ink-quiet)]">
            {row.status === 'gedaan'
              ? `${row.title}${row.doneByName ? ` · ${row.doneByName}` : ''}`
              : `Overgeslagen: ${row.skipReason}`}
          </span>
        </span>
        <button
          type="button"
          className="bw-btn bw-btn-ghost px-3 text-[13px]"
          onClick={() => onAction(row.id, 'reopen')}
        >
          Ongedaan
        </button>
      </li>
    );
  }

  const vlag = row.weatherFlag ? (
    <span
      className="text-[11.5px] font-semibold"
      style={{
        color: row.weatherFlag === 'urgent' ? 'var(--zinnia-dark)' : 'var(--cornflower-dark)',
      }}
    >
      {WEATHER_FLAG_LABEL[row.weatherFlag]}
    </span>
  ) : null;

  return (
    <li className={compact ? 'bw-card-compact overflow-hidden' : 'bw-card overflow-hidden'}>
      {compact ? (
        /* Agenda: één regel per taak, met een selectievakje. */
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <input
            type="checkbox"
            className="bw-checkbox"
            aria-label={`${row.title} bij ${row.plantName} afvinken`}
            disabled={pending}
            onChange={() => start(() => void onAction(row.id, 'complete'))}
          />
          <button
            type="button"
            className="bw-regel flex min-w-0 flex-1 items-center gap-2 text-left text-[13.5px]"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="bw-taakblob bw-taakblob-klein" style={{ background: kleur }}>
              <TaakIcoon type={row.taskType} size={16} />
            </span>
            <span className="truncate">
              {zonderPlantnaam ? (
                row.title
              ) : (
                <>
                  {row.plantName} <span className="text-[var(--ink-quiet)]">— {row.title}</span>
                </>
              )}
            </span>
          </button>
          {vlag}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-2.5">
          {zonderPlantnaam || !row.photoUrl ? (
            <span className="bw-taakblob" style={{ background: kleur }}>
              <TaakIcoon type={row.taskType} />
            </span>
          ) : (
            /* Met foto: die blijft leidend, met de taakkleur als klein
               bloemetje in de hoek. */
            <span className="relative shrink-0">
              <PlantFoto url={row.photoUrl} alt="" className="size-14" />
              <span
                className="bw-taakblob absolute -bottom-1 -right-1 size-6"
                style={{ background: kleur, boxShadow: '0 0 0 2px var(--paper-raised)' }}
              >
                <TaakIcoon type={row.taskType} size={13} />
              </span>
            </span>
          )}

          <button
            type="button"
            className="bw-regel min-w-0 flex-1 text-left"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="block truncate text-[14.5px] font-semibold">
              {zonderPlantnaam ? row.title : row.plantName}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--ink-quiet)]">
              <span className="truncate">
                {zonderPlantnaam ? formatRange(row.windowStart, row.windowEnd) : row.title}
              </span>
            </span>
            {vlag ? <span className="mt-1 block">{vlag}</span> : null}
          </button>

          <button
            type="button"
            className="bw-vink"
            aria-label={`${row.title} bij ${row.plantName} afvinken`}
            disabled={pending}
            onClick={() => start(() => void onAction(row.id, 'complete'))}
          >
            <span aria-hidden className="text-lg leading-none">
              ✓
            </span>
          </button>
        </div>
      )}

      {open ? (
        <div className="border-t border-[var(--line)] px-3.5 pb-3.5 pt-3 text-[13.5px]">
          <p className="text-[var(--ink-soft)]">{row.instructions}</p>
          <p className="mt-2 text-[12.5px] text-[var(--ink-faint)]">
            {TASK_LABEL[row.taskType]} · {formatRange(row.windowStart, row.windowEnd)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/planten/${row.plantId}`} className="bw-btn bw-btn-secondary text-[13px]">
              Naar de plant
            </Link>
            <button
              type="button"
              className="bw-btn bw-btn-secondary text-[13px]"
              onClick={() => detail.current?.showModal()}
            >
              Afvinken met foto of notitie
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-ghost text-[13px]"
              onClick={() => overslaan.current?.showModal()}
            >
              Overslaan
            </button>
          </div>
        </div>
      ) : null}

      <CompleteDialog
        ref={detail}
        titel={`${row.title} — ${row.plantName}`}
        onComplete={async (body) => {
          detail.current?.close();
          await onAction(row.id, 'complete', body);
        }}
      />

      <SkipDialog
        ref={overslaan}
        titel={`${row.title} — ${row.plantName}`}
        onSkip={async (reden) => {
          overslaan.current?.close();
          await onAction(row.id, 'skip', { skipReason: reden });
        }}
      />
    </li>
  );
}

function Venster({
  ref,
  titel,
  children,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(26rem,92vw)] rounded-[var(--radius-xl)] bg-[var(--paper-raised)]"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 className="bw-titel-klein">{titel}</h2>
        {children}
      </div>
    </dialog>
  );
}

function SkipDialog({
  ref,
  titel,
  onSkip,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  titel: string;
  onSkip: (reden: string) => Promise<void>;
}) {
  const [reden, setReden] = useState('');
  const geldig = reden.trim().length >= 3;

  return (
    <Venster ref={ref} titel="Overslaan">
      <p className="text-[13px] text-[var(--ink-quiet)]">{titel}</p>
      <div className="bw-pillen">
        {SKIP_REASONS.map((optie) => (
          <button
            key={optie}
            type="button"
            className="bw-pil"
            aria-pressed={reden === optie}
            onClick={() => setReden(optie)}
          >
            {optie}
          </button>
        ))}
      </div>
      <div>
        <label className="bw-label" htmlFor={`reden-${titel}`}>
          Reden (verplicht)
        </label>
        <input
          id={`reden-${titel}`}
          className="bw-input"
          value={reden}
          onChange={(event) => setReden(event.target.value)}
          placeholder="Waarom sla je dit over?"
        />
      </div>
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" className="bw-btn bw-btn-ghost" onClick={() => ref.current?.close()}>
          Terug
        </button>
        <button
          type="button"
          className="bw-btn bw-btn-primary"
          disabled={!geldig}
          onClick={() => geldig && void onSkip(reden.trim())}
        >
          Overslaan
        </button>
      </div>
    </Venster>
  );
}

function CompleteDialog({
  ref,
  titel,
  onComplete,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  titel: string;
  onComplete: (body: { note?: string; photoUrl?: string }) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);

  async function verstuur() {
    setBezig(true);
    setFout(null);
    try {
      let photoUrl: string | undefined;
      if (foto) photoUrl = await uploadFoto(foto);
      await onComplete({ note: note.trim() || undefined, photoUrl });
      setNote('');
      setFoto(null);
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
    } finally {
      setBezig(false);
    }
  }

  return (
    <Venster ref={ref} titel="Afvinken">
      <p className="text-[13px] text-[var(--ink-quiet)]">{titel}</p>
      <div>
        <p className="bw-label">Foto (optioneel)</p>
        <FotoKiezer disabled={bezig} onKies={setFoto} gekozen={foto?.name} />
      </div>
      <div>
        <label className="bw-label" htmlFor={`notitie-${titel}`}>
          Notitie (optioneel)
        </label>
        <textarea
          id={`notitie-${titel}`}
          className="bw-textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {fout ? (
        <p role="alert" className="text-[13px] text-[var(--wijnrood)]">
          {fout}
        </p>
      ) : null}
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" className="bw-btn bw-btn-ghost" onClick={() => ref.current?.close()}>
          Terug
        </button>
        <button type="button" className="bw-btn bw-btn-done" disabled={bezig} onClick={verstuur}>
          {bezig ? 'Bezig…' : 'Gedaan'}
        </button>
      </div>
    </Venster>
  );
}

export async function uploadFoto(file: File): Promise<string> {
  const verkleind = await verkleinAfbeelding(file);
  const form = new FormData();
  form.append('file', verkleind, file.name.replace(/\.[^.]+$/, '') + '.jpg');
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Foto uploaden lukte niet');
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** Client-side verkleinen naar maximaal 1600 px, JPEG 0,8. */
export async function verkleinAfbeelding(file: File, max = 1600): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const schaal = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const breedte = Math.round(bitmap.width * schaal);
    const hoogte = Math.round(bitmap.height * schaal);
    const canvas = document.createElement('canvas');
    canvas.width = breedte;
    canvas.height = hoogte;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, breedte, hoogte);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8),
    );
    bitmap.close?.();
    return blob ?? file;
  } catch {
    return file;
  }
}
