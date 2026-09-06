// Domeinmodel van Bloeiwijzer. Zie OVERDRACHT §3 en §4.
// Alle tuindata hangt aan een gardenId, nooit aan een userId.

export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  createdAt: string;
}

export interface Garden {
  id: string;
  name: string;
  ownerId: string;
  lat: number;
  lon: number;
  postcode?: string;
  createdAt: string;
  /** Per tuin uit te zetten weerregels; leeg = alle vijf actief. */
  disabledWeatherRules?: WeatherRuleId[];
}

export type MemberRole = 'eigenaar' | 'lid';

export interface Membership {
  gardenId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  notify: { email: boolean; push: boolean };
}

export interface Invite {
  token: string;
  gardenId: string;
  email: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt?: string;
}

export type Sun = 'zon' | 'halfschaduw' | 'schaduw';
export type Soil = 'zand' | 'klei' | 'veen' | 'leem' | 'potgrond' | 'onbekend';

export interface Location {
  id: string;
  name: string;
  /** false = binnen. Bepaalt of weerregels gelden. */
  outdoor: boolean;
  sun: Sun;
  soil?: Soil;
  notes?: string;
  sortOrder: number;
}

export const PLANT_CATEGORIES = [
  'boom',
  'struik',
  'haag',
  'vaste plant',
  'eenjarige',
  'bolgewas',
  'klimplant',
  'gras',
  'kruid',
  'groente',
  'fruit',
  'kamerplant',
  'overig',
] as const;
export type PlantCategory = (typeof PLANT_CATEGORIES)[number];

export type PlantStatus = 'levend' | 'dood' | 'verwijderd';

export interface PlantCandidate {
  name: string;
  scientificName?: string;
  score: number;
  source: string;
  /** Foto van deze soort bij de bron, om de match mee te controleren. */
  imageUrl?: string;
  /** Wie de foto maakte en onder welke licentie. */
  credit?: string;
}

export interface Plant {
  id: string;
  locationId: string;
  commonName: string;
  scientificName?: string;
  cultivar?: string;
  category: PlantCategory;
  photoUrl?: string;
  quantity: number;
  plantedAt?: string;
  /** Fase 6; veld nu al gereserveerd. */
  purchasedAt?: string;
  status: PlantStatus;
  statusChangedAt?: string;
  statusReason?: string;
  hardiness?: string;
  frostSensitive: boolean;
  droughtSensitive: boolean;
  notes?: string;
  labelCode?: string;
  source: 'foto' | 'url' | 'handmatig';
  sourceUrl?: string;
  identification?: {
    plantnet?: { name: string; score: number }[];
    ai?: { name: string; confidence: number };
    confirmedBy: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const TASK_TYPES = [
  'snoeien',
  'bemesten',
  'verpotten',
  'water',
  'winterbescherming',
  'ziektecontrole',
  'delen',
  'oogsten',
  'planten',
  'overig',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const WEATHER_RULE_IDS = [
  'geen-vorst',
  'nachtvorst-alarm',
  'droogte',
  'geen-hitte',
  'groeiseizoen',
] as const;
export type WeatherRuleId = (typeof WEATHER_RULE_IDS)[number];

export type Schedule =
  | { kind: 'jaarvenster'; startMonth: Month; endMonth: Month; timesPerWindow: number }
  | { kind: 'interval'; startMonth: Month; endMonth: Month; intervalDays: number }
  | {
      kind: 'meerjaarlijks';
      startMonth: Month;
      endMonth: Month;
      everyYears: number;
      anchorYear: number;
    }
  | { kind: 'weer-gestuurd'; startMonth: Month; endMonth: Month };

export type Importance = 'noodzakelijk' | 'aanbevolen' | 'optioneel';

export interface CareTask {
  id: string;
  plantId: string;
  type: TaskType;
  title: string;
  instructions: string;
  schedule: Schedule;
  weatherRules: WeatherRuleId[];
  importance: Importance;
  source: 'ai' | 'handmatig';
  enabled: boolean;
}

/**
 * `verlopen`: het venster is voorbij en er is al een nieuwe beurt begonnen.
 * Zo blijft er van een terugkerende taak altijd één regel over in plaats van
 * een stapel gemiste beurten.
 */
export type OccurrenceStatus = 'open' | 'gedaan' | 'overgeslagen' | 'verlopen';
export type WeatherFlag = 'gunstig' | 'ongunstig' | 'urgent';

export interface TaskOccurrence {
  /** `${plantId}:${taskId}:${year}:${seq}` — deterministisch. */
  id: string;
  plantId: string;
  taskId: string;
  year: number;
  seq: number;
  /** ISO-datum yyyy-mm-dd. */
  windowStart: string;
  windowEnd: string;
  status: OccurrenceStatus;
  doneAt?: string;
  doneBy?: string;
  /** Verplicht bij status 'overgeslagen'. */
  skipReason?: string;
  note?: string;
  photoUrl?: string;
  weatherFlag?: WeatherFlag;
  generatedAt: string;
}

export type LogKind =
  | 'aangemaakt'
  | 'gewijzigd'
  | 'gedaan'
  | 'overgeslagen'
  | 'heropend'
  | 'status'
  | 'foto'
  | 'notitie';

export interface LogEntry {
  id: string;
  plantId: string;
  kind: LogKind;
  text: string;
  at: string;
  by?: string;
  byName?: string;
  occurrenceId?: string;
  photoUrl?: string;
}

export interface PlantPhoto {
  url: string;
  takenAt: string;
  caption?: string;
}

export interface GardenMeta {
  lastGeneratedYear?: number;
  /** Versie van de generator; bij een hogere versie draait hij opnieuw. */
  generatorVersion?: number;
  lastWeatherSync?: string;
  lastMonthlyMail?: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  userAgent?: string;
}
