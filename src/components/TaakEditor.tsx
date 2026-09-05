'use client';

import { useState } from 'react';
import { MONTH_NAMES } from '@/lib/dates';
import { beschrijfPlanningTekst } from '@/lib/schedule-text';
import { IMPORTANCE_LABEL, TASK_COLOR, TASK_LABEL } from '@/lib/ui';
import { TASK_TYPES, WEATHER_RULE_IDS } from '@/lib/types';
import type { CareTask, Importance, Month, Schedule, TaskType, WeatherRuleId } from '@/lib/types';

export type TaakConcept = Omit<CareTask, 'id' | 'plantId'>;

export const LEGE_TAAK: TaakConcept = {
  type: 'snoeien',
  title: '',
  instructions: '',
  schedule: { kind: 'jaarvenster', startMonth: 3, endMonth: 4, timesPerWindow: 1 },
  weatherRules: [],
  importance: 'aanbevolen',
  source: 'handmatig',
  enabled: true,
};

const WEER_LABEL: Record<WeatherRuleId, string> = {
  'geen-vorst': 'Niet bij vorst',
  'nachtvorst-alarm': 'Nachtvorstalarm',
  droogte: 'Bij droogte',
  'geen-hitte': 'Niet bij hitte',
  groeiseizoen: 'Start groeiseizoen',
};

export function TaakEditor({
  taken,
  onChange,
  outdoor,
}: {
  taken: TaakConcept[];
  onChange: (taken: TaakConcept[]) => void;
  outdoor: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);

  function wijzig(index: number, patch: Partial<TaakConcept>) {
    onChange(taken.map((taak, i) => (i === index ? { ...taak, ...patch } : taak)));
  }

  return (
    <div className="flex flex-col gap-2">
      {taken.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-muted)]">
          Nog geen taken. Voeg er zelf een toe of laat er een voorstellen.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {taken.map((taak, index) => (
          <li key={index} className="bw-card-compact overflow-hidden">
            <div className="flex items-stretch">
              <span aria-hidden className="w-1.5 shrink-0" style={{ background: TASK_COLOR[taak.type] }} />
              <div className="min-w-0 flex-1 p-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="bw-checkbox mt-1"
                    checked={taak.enabled}
                    onChange={(e) => wijzig(index, { enabled: e.target.checked })}
                    aria-label={`${taak.title || 'Taak'} meenemen`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {taak.title || TASK_LABEL[taak.type]}
                    </span>
                    <span className="block text-[12.5px] text-[var(--ink-faint)]">
                      {beschrijfPlanningTekst(taak.schedule)} · {IMPORTANCE_LABEL[taak.importance]}
                    </span>
                  </span>
                </label>

                {open === index ? (
                  <TaakVelden
                    taak={taak}
                    index={index}
                    outdoor={outdoor}
                    onChange={(patch) => wijzig(index, patch)}
                  />
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col justify-center gap-1 p-2">
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost px-3 text-[13px]"
                  aria-expanded={open === index}
                  onClick={() => setOpen(open === index ? null : index)}
                >
                  {open === index ? 'Klaar' : 'Wijzig'}
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost px-3 text-[13px]"
                  onClick={() => onChange(taken.filter((_, i) => i !== index))}
                >
                  Weg
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="bw-btn bw-btn-secondary"
        onClick={() => {
          onChange([...taken, { ...LEGE_TAAK }]);
          setOpen(taken.length);
        }}
      >
        Taak toevoegen
      </button>
    </div>
  );
}

function TaakVelden({
  taak,
  index,
  outdoor,
  onChange,
}: {
  taak: TaakConcept;
  index: number;
  outdoor: boolean;
  onChange: (patch: Partial<TaakConcept>) => void;
}) {
  const s = taak.schedule;
  // Elk veld een eigen id: zonder koppeling weet een schermlezer niet welk
  // label bij welk veld hoort, en werkt tikken op het label ook niet.
  const veld = (naam: string) => `taak-${index}-${naam}`;

  function zetPlanning(patch: Partial<Schedule>) {
    onChange({ schedule: { ...s, ...patch } as Schedule });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[var(--line)] pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="bw-label" htmlFor={veld('type')}>
            Soort werk
          </label>
          <select
            id={veld('type')}
            className="bw-select"
            value={taak.type}
            onChange={(e) => onChange({ type: e.target.value as TaskType })}
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="bw-label" htmlFor={veld('belang')}>
            Belang
          </label>
          <select
            id={veld('belang')}
            className="bw-select"
            value={taak.importance}
            onChange={(e) => onChange({ importance: e.target.value as Importance })}
          >
            {(['noodzakelijk', 'aanbevolen', 'optioneel'] as Importance[]).map((i) => (
              <option key={i} value={i}>
                {IMPORTANCE_LABEL[i]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="bw-label" htmlFor={veld('titel')}>
            Titel
          </label>
        <input
          id={veld('titel')}
          className="bw-input"
          value={taak.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Bijvoorbeeld: uitgebloeide bloemen wegknippen"
        />
      </div>

      <div>
        <label className="bw-label" htmlFor={veld('uitleg')}>
            Uitleg
          </label>
        <textarea
          id={veld('uitleg')}
          className="bw-textarea"
          value={taak.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="bw-label" htmlFor={veld('herhaling')}>
            Herhaling
          </label>
          <select
            id={veld('herhaling')}
            className="bw-select"
            value={s.kind}
            onChange={(e) => onChange({ schedule: nieuwePlanning(e.target.value, s) })}
          >
            <option value="jaarvenster">Per jaar</option>
            <option value="interval">Elke zoveel dagen</option>
            <option value="meerjaarlijks">Om de zoveel jaar</option>
            <option value="weer-gestuurd">Als het weer erom vraagt</option>
          </select>
        </div>
        <div>
          <label className="bw-label" htmlFor={veld('van')}>
            Van
          </label>
          <select
            id={veld('van')}
            className="bw-select"
            value={s.startMonth}
            onChange={(e) => zetPlanning({ startMonth: Number(e.target.value) as Month })}
          >
            {MONTH_NAMES.map((naam, i) => (
              <option key={naam} value={i + 1}>
                {naam}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="bw-label" htmlFor={veld('tot')}>
            Tot en met
          </label>
          <select
            id={veld('tot')}
            className="bw-select"
            value={s.endMonth}
            onChange={(e) => zetPlanning({ endMonth: Number(e.target.value) as Month })}
          >
            {MONTH_NAMES.map((naam, i) => (
              <option key={naam} value={i + 1}>
                {naam}
              </option>
            ))}
          </select>
        </div>
      </div>

      {s.kind === 'jaarvenster' ? (
        <div>
          <label className="bw-label" htmlFor={veld('aantal')}>
            Hoe vaak binnen dat venster
          </label>
          <input
            className="bw-input"
            type="number"
            min={1}
            max={24}
            id={veld('aantal')}
            value={s.timesPerWindow}
            onChange={(e) => zetPlanning({ timesPerWindow: Number(e.target.value) })}
          />
        </div>
      ) : null}

      {s.kind === 'interval' ? (
        <div>
          <label className="bw-label" htmlFor={veld('dagen')}>
            Om de hoeveel dagen
          </label>
          <input
            className="bw-input"
            type="number"
            min={1}
            max={365}
            id={veld('dagen')}
            value={s.intervalDays}
            onChange={(e) => zetPlanning({ intervalDays: Number(e.target.value) })}
          />
        </div>
      ) : null}

      {s.kind === 'meerjaarlijks' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="bw-label" htmlFor={veld('jaren')}>
            Om de hoeveel jaar
          </label>
            <input
              className="bw-input"
              type="number"
              min={2}
              max={20}
              id={veld('jaren')}
              value={s.everyYears}
              onChange={(e) => zetPlanning({ everyYears: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="bw-label" htmlFor={veld('startjaar')}>
            Startjaar
          </label>
            <input
              className="bw-input"
              type="number"
              min={1900}
              max={2200}
              id={veld('startjaar')}
              value={s.anchorYear}
              onChange={(e) => zetPlanning({ anchorYear: Number(e.target.value) })}
            />
          </div>
        </div>
      ) : null}

      {outdoor ? (
        <fieldset>
          <legend className="bw-label">Weerregels</legend>
          <div className="bw-pillen">
            {WEATHER_RULE_IDS.map((regel) => {
              const aan = taak.weatherRules.includes(regel);
              return (
                <button
                  key={regel}
                  type="button"
                  aria-pressed={aan}
                  className="bw-pil"
                  onClick={() =>
                    onChange({
                      weatherRules: aan
                        ? taak.weatherRules.filter((r) => r !== regel)
                        : [...taak.weatherRules, regel],
                    })
                  }
                >
                  {WEER_LABEL[regel]}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="text-[13px] text-[var(--ink-muted)]">
          Deze plant staat binnen; weerregels gelden hier niet.
        </p>
      )}
    </div>
  );
}

function nieuwePlanning(kind: string, huidig: Schedule): Schedule {
  const { startMonth, endMonth } = huidig;
  switch (kind) {
    case 'interval':
      return { kind: 'interval', startMonth, endMonth, intervalDays: 7 };
    case 'meerjaarlijks':
      return {
        kind: 'meerjaarlijks',
        startMonth,
        endMonth,
        everyYears: 3,
        anchorYear: new Date().getFullYear(),
      };
    case 'weer-gestuurd':
      return { kind: 'weer-gestuurd', startMonth, endMonth };
    default:
      return { kind: 'jaarvenster', startMonth, endMonth, timesPerWindow: 1 };
  }
}

