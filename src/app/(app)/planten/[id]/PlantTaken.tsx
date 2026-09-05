'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { TaakEditor, type TaakConcept } from '@/components/TaakEditor';
import { beschrijfPlanningKort } from '@/lib/schedule-text';
import { TASK_COLOR } from '@/lib/ui';
import type { CareTask } from '@/lib/types';

/**
 * Het zorgprofiel van één plant. De schakelaar zet een taak direct aan of
 * uit; voor de rest is er de volledige bewerkstand. Bij bewaren wordt het
 * verschil met de opgeslagen taken bepaald, zodat afgevinkte occurrences
 * blijven staan.
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
  const [aan, setAan] = useState<Record<string, boolean>>(
    Object.fromEntries(opgeslagen.map((t) => [t.id, t.enabled])),
  );
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bewerken, setBewerken] = useState(false);

  async function schakel(taskId: string, enabled: boolean) {
    const vorige = aan[taskId];
    setAan((huidig) => ({ ...huidig, [taskId]: enabled }));
    setFout(null);
    try {
      await api(`/api/tasks?plantId=${plantId}&taskId=${taskId}`, {
        method: 'PATCH',
        json: { enabled },
      });
      router.refresh();
    } catch (error) {
      setAan((huidig) => ({ ...huidig, [taskId]: vorige }));
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
    }
  }

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

  if (bewerken) {
    return (
      <div className="flex flex-col gap-3">
        {fout ? (
          <p role="alert" className="bw-banner bw-banner-urgent">
            {fout}
          </p>
        ) : null}
        <TaakEditor taken={concept} onChange={setConcept} outdoor={outdoor} />
        <div className="flex gap-2">
          <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setBewerken(false)}>
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

  return (
    <div className="flex flex-col gap-2">
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      {opgeslagen.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-muted)]">Nog geen onderhoud vastgelegd.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {opgeslagen.map((taak) => (
            <li
              key={taak.id}
              className="bw-card-compact flex items-center gap-2.5 px-3 py-2.5"
            >
              <i
                aria-hidden
                className="bw-stip size-[9px]"
                style={{ background: TASK_COLOR[taak.type] }}
              />
              <span className="min-w-0 flex-1 text-[13.5px]">
                {taak.title}{' '}
                <span className="text-[var(--ink-faint)]">
                  · {beschrijfPlanningKort(taak.schedule, taak.weatherRules)}
                </span>
              </span>
              <input
                type="checkbox"
                className="bw-toggle"
                checked={aan[taak.id] ?? taak.enabled}
                aria-label={`${taak.title} ${aan[taak.id] ?? taak.enabled ? 'uitzetten' : 'aanzetten'}`}
                onChange={(event) => void schakel(taak.id, event.target.checked)}
              />
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
