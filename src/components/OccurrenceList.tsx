'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AgendaRow } from '@/lib/dto';
import { SKIP_REASONS, TASK_COLOR, TASK_LABEL, WEATHER_FLAG_LABEL } from '@/lib/ui';
import { formatRange } from '@/lib/dates';

type Groepering = 'locatie' | 'geen';

export function OccurrenceList({
  rows: initialRows,
  groupBy = 'locatie',
  emptyText = 'Niets te doen. Mooi.',
}: {
  rows: AgendaRow[];
  groupBy?: Groepering;
  emptyText?: string;
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
    return <p className="bw-card p-5 text-[var(--ink-soft)]">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {fout ? (
        <p role="alert" className="bw-card border-[var(--zinnia)] p-3 text-sm">
          {fout}
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.key}>
          {group.name ? (
            <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              {group.name}
            </h3>
          ) : null}
          <ul className="flex flex-col gap-2">
            {group.rows.map((row) => (
              <OccurrenceRow key={row.id} row={row} onAction={call} />
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
}: {
  row: AgendaRow;
  onAction: (id: string, actie: 'complete' | 'skip' | 'reopen', body?: unknown) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const kleur = TASK_COLOR[row.taskType];

  if (row.status !== 'open') {
    return (
      <li className="bw-card flex items-center gap-3 p-3">
        <span
          aria-hidden
          className="bw-vink-animatie grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
          style={{ background: row.status === 'gedaan' ? 'var(--leaf)' : 'var(--ink-faint)' }}
        >
          {row.status === 'gedaan' ? '✓' : '–'}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{row.plantName}</span>{' '}
          <span className="text-[var(--ink-soft)]">
            — {row.status === 'gedaan' ? row.title.toLowerCase() : `overgeslagen: ${row.skipReason}`}
          </span>
        </span>
        <button
          type="button"
          className="bw-btn bw-btn-ghost px-3 text-sm"
          onClick={() => onAction(row.id, 'reopen')}
        >
          Ongedaan
        </button>
      </li>
    );
  }

  return (
    <li className="bw-card overflow-hidden">
      <div className="flex items-stretch">
        <span aria-hidden className="w-1.5 shrink-0" style={{ background: kleur }} />
        <div className="min-w-0 flex-1 p-3">
          <button
            type="button"
            className="w-full text-left"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="block truncate font-semibold">{row.plantName}</span>
            <span className="mt-0.5 block text-sm text-[var(--ink-soft)]">{row.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="bw-chip" style={{ borderColor: kleur, color: kleur }}>
                {TASK_LABEL[row.taskType]}
              </span>
              <span className="bw-chip">{formatRange(row.windowStart, row.windowEnd)}</span>
              {row.weatherFlag ? (
                <span
                  className="bw-chip"
                  style={{
                    borderColor:
                      row.weatherFlag === 'urgent' ? 'var(--zinnia)' : 'var(--cornflower)',
                    color:
                      row.weatherFlag === 'urgent'
                        ? 'var(--zinnia-dark)'
                        : 'var(--cornflower-dark)',
                  }}
                >
                  {WEATHER_FLAG_LABEL[row.weatherFlag]}
                </span>
              ) : null}
            </span>
          </button>

          {open ? (
            <div className="mt-3 border-t border-[var(--line)] pt-3 text-sm">
              <p className="text-[var(--ink-soft)]">{row.instructions}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/planten/${row.plantId}`} className="bw-btn bw-btn-secondary text-sm">
                  Naar de plant
                </Link>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary text-sm"
                  onClick={() => detail.current?.showModal()}
                >
                  Afvinken met foto of notitie
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary text-sm"
                  onClick={() => dialog.current?.showModal()}
                >
                  Overslaan
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="bw-btn bw-btn-done m-2 shrink-0 self-center px-4 text-lg"
          aria-label={`${row.title} bij ${row.plantName} afvinken`}
          disabled={pending}
          onClick={() => start(() => void onAction(row.id, 'complete'))}
        >
          ✓
        </button>
      </div>

      <CompleteDialog
        ref={detail}
        titel={`${row.title} — ${row.plantName}`}
        onComplete={async (body) => {
          detail.current?.close();
          await onAction(row.id, 'complete', body);
        }}
      />

      <SkipDialog
        ref={dialog}
        titel={`${row.title} — ${row.plantName}`}
        onSkip={async (reden) => {
          dialog.current?.close();
          await onAction(row.id, 'skip', { skipReason: reden });
        }}
      />
    </li>
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
    <dialog
      ref={ref}
      className="m-auto w-[min(28rem,92vw)] rounded-[var(--radius)] p-0 backdrop:bg-black/40"
      onClose={() => setReden('')}
    >
      <form
        method="dialog"
        className="flex flex-col gap-3 bg-[var(--paper-raised)] p-5 text-[var(--ink)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (geldig) void onSkip(reden.trim());
        }}
      >
        <h2 className="text-lg font-bold">Overslaan</h2>
        <p className="text-sm text-[var(--ink-soft)]">{titel}</p>
        <div className="flex flex-wrap gap-2">
          {SKIP_REASONS.map((optie) => (
            <button
              key={optie}
              type="button"
              className="bw-btn bw-btn-secondary text-sm"
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
          <button
            type="button"
            className="bw-btn bw-btn-ghost"
            onClick={() => ref.current?.close()}
          >
            Terug
          </button>
          <button type="submit" className="bw-btn bw-btn-primary" disabled={!geldig}>
            Overslaan
          </button>
        </div>
      </form>
    </dialog>
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
  const bestand = useRef<HTMLInputElement>(null);

  async function verstuur() {
    setBezig(true);
    setFout(null);
    try {
      let photoUrl: string | undefined;
      const file = bestand.current?.files?.[0];
      if (file) photoUrl = await uploadFoto(file);
      await onComplete({ note: note.trim() || undefined, photoUrl });
      setNote('');
      if (bestand.current) bestand.current.value = '';
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
    } finally {
      setBezig(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(28rem,92vw)] rounded-[var(--radius)] p-0 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 bg-[var(--paper-raised)] p-5 text-[var(--ink)]">
        <h2 className="text-lg font-bold">Afvinken</h2>
        <p className="text-sm text-[var(--ink-soft)]">{titel}</p>
        <div>
          <label className="bw-label" htmlFor={`foto-${titel}`}>
            Foto (optioneel)
          </label>
          <input
            id={`foto-${titel}`}
            ref={bestand}
            className="bw-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
          />
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
        {fout ? <p role="alert" className="text-sm text-[var(--zinnia-dark)]">{fout}</p> : null}
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            className="bw-btn bw-btn-ghost"
            onClick={() => ref.current?.close()}
          >
            Terug
          </button>
          <button type="button" className="bw-btn bw-btn-done" disabled={bezig} onClick={verstuur}>
            {bezig ? 'Bezig…' : 'Gedaan'}
          </button>
        </div>
      </div>
    </dialog>
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

/** Client-side verkleinen naar maximaal 1600 px, JPEG 0,8 (§6.2). */
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
