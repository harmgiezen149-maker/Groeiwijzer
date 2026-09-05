import type { Importance, PlantCategory, TaskType, WeatherFlag } from './types';

/** Eén vaste kleur per taaktype, overal identiek (OVERDRACHT §11). */
export const TASK_COLOR: Record<TaskType, string> = {
  snoeien: 'var(--taak-snoeien)',
  bemesten: 'var(--taak-bemesten)',
  verpotten: 'var(--taak-verpotten)',
  water: 'var(--taak-water)',
  winterbescherming: 'var(--taak-winterbescherming)',
  ziektecontrole: 'var(--taak-ziektecontrole)',
  delen: 'var(--taak-delen)',
  oogsten: 'var(--taak-oogsten)',
  planten: 'var(--taak-planten)',
  overig: 'var(--taak-overig)',
};

export const TASK_LABEL: Record<TaskType, string> = {
  snoeien: 'Snoeien',
  bemesten: 'Bemesten',
  verpotten: 'Verpotten',
  water: 'Water geven',
  winterbescherming: 'Winterbescherming',
  ziektecontrole: 'Ziektecontrole',
  delen: 'Delen',
  oogsten: 'Oogsten',
  planten: 'Planten',
  overig: 'Overig',
};

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  noodzakelijk: 'Noodzakelijk',
  aanbevolen: 'Aanbevolen',
  optioneel: 'Optioneel',
};

export const CATEGORY_LABEL: Record<PlantCategory, string> = {
  boom: 'Boom',
  struik: 'Struik',
  haag: 'Haag',
  'vaste plant': 'Vaste plant',
  eenjarige: 'Eenjarige',
  bolgewas: 'Bolgewas',
  klimplant: 'Klimplant',
  gras: 'Gras',
  kruid: 'Kruid',
  groente: 'Groente',
  fruit: 'Fruit',
  kamerplant: 'Kamerplant',
  overig: 'Overig',
};

export const WEATHER_FLAG_LABEL: Record<WeatherFlag, string> = {
  gunstig: 'Goed weer hiervoor',
  ongunstig: 'Weer zit tegen',
  urgent: 'Nu doen',
};

export const SKIP_REASONS = ['Geen tijd', 'Weer te slecht', 'Niet nodig'] as const;
