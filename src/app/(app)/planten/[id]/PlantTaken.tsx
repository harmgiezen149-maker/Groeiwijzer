'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { TaakEditor, type TaakConcept } from '@/components/TaakEditor';
import type { CareTask } from '@/lib/types';

/**
 * Bewerkt het zorgprofiel van één plant. Bij bewaren wordt het verschil met
 * de opgeslagen taken bepaald, zodat afgevinkte occurrences blijven staan.
 */
export function PlantTaken({
  plantId,
  taken: opgeslagen,
  outdoor,
}: {
  plantId: string;
  taken: CareTask[];
  outdoor: boolean;
}) {
  const router = useRouter();
  const [concept, setConcept] = useState<(TaakConcept & { id?: string })[]>(
    opgeslagen.map((taak) => ({ ...taak })),
  );
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bewerken, setBewerken] = useState(false);

  async function bewaren() {
    setBezig(true);
    setFout(null);
    try {
      const behouden = new Set(concept.map((t) => t.id).filter(Boolean));
      for (const oud of opgeslagen) {
        if (!behouden.has(oud.id)) {
          await api(`/api/tasks?plantId=${plantId}&taskId=${oud.id}`, { method: 'DELETE' });
        }
      }
      for (const taak of concept) {
        const body = {
          type: taak.type,
          title: taak.title,
          instructions: taak.instructions,
          schedule: taak.schedule,
          weatherRules: outdoor ? taak.weatherRules : [],
          importance: taak.importance,
          source: taak.source,
          enabled: taak.enabled,
        };
        if (taak.id) {
          await api(`/api/tasks?plantId=${plantId}&taskId=${taak.id}`, {
            method: 'PATCH',
            json: body,
          });
        } else if (taak.title.trim()) {
          await api(`/api/tasks?plantId=${plantId}`, { method: 'POST', json: body });
        }
      }
      setBewerken(false);
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
    } finally {
      setBezig(false);
    }
  }

  if (!bewerken) {
    return (
      <div className="flex flex-col gap-2">
        {opgeslagen.length === 0 ? (
          <p className="bw-card p-4 text-sm text-[var(--ink-soft)]">
            Nog geen onderhoud vastgelegd.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {opgeslagen.map((taak) => (
              <li key={taak.id} className="bw-card p-3 text-sm">
                <span className="font-semibold">{taak.title}</span>
                <span className="block text-[var(--ink-soft)]">{taak.instructions}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="bw-btn bw-btn-secondary"
          onClick={() => {
            setConcept(opgeslagen.map((taak) => ({ ...taak })));
            setBewerken(true);
          }}
        >
          Onderhoud bewerken
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fout ? (
        <p role="alert" className="bw-card border-[var(--zinnia)] p-3 text-sm">
          {fout}
        </p>
      ) : null}
      <TaakEditor taken={concept} onChange={setConcept} outdoor={outdoor} />
      <div className="flex gap-2">
        <button
          type="button"
          className="bw-btn bw-btn-ghost"
          onClick={() => setBewerken(false)}
        >
          Terug
        </button>
        <button
          type="button"
          className="bw-btn bw-btn-primary flex-1"
          disabled={bezig}
          onClick={() => void bewaren()}
        >
          {bezig ? 'Bezig…' : 'Bewaren'}
        </button>
      </div>
    </div>
  );
}
