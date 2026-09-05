import { z } from 'zod';
import { PLANT_CATEGORIES, TASK_TYPES, WEATHER_RULE_IDS, type Month } from './types';

export const monthSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(12)
  .transform((value) => value as Month);

export const locationInput = z.object({
  name: z.string().trim().min(1, 'Geef de locatie een naam').max(60),
  outdoor: z.boolean(),
  sun: z.enum(['zon', 'halfschaduw', 'schaduw']),
  soil: z.enum(['zand', 'klei', 'veen', 'leem', 'potgrond', 'onbekend']).optional(),
  notes: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('jaarvenster'),
    startMonth: monthSchema,
    endMonth: monthSchema,
    timesPerWindow: z.coerce.number().int().min(1).max(24),
  }),
  z.object({
    kind: z.literal('interval'),
    startMonth: monthSchema,
    endMonth: monthSchema,
    intervalDays: z.coerce.number().int().min(1).max(365),
  }),
  z.object({
    kind: z.literal('meerjaarlijks'),
    startMonth: monthSchema,
    endMonth: monthSchema,
    everyYears: z.coerce.number().int().min(2).max(20),
    anchorYear: z.coerce.number().int().min(1900).max(2200),
  }),
  z.object({
    kind: z.literal('weer-gestuurd'),
    startMonth: monthSchema,
    endMonth: monthSchema,
  }),
]);

export const careTaskInput = z.object({
  type: z.enum(TASK_TYPES),
  title: z.string().trim().min(1).max(80),
  instructions: z.string().trim().max(1200).default(''),
  schedule: scheduleSchema,
  weatherRules: z.array(z.enum(WEATHER_RULE_IDS)).max(5).default([]),
  importance: z.enum(['noodzakelijk', 'aanbevolen', 'optioneel']).default('aanbevolen'),
  source: z.enum(['ai', 'handmatig']).default('handmatig'),
  enabled: z.boolean().default(true),
});

export const plantInput = z.object({
  locationId: z.string().trim().min(1, 'Kies een locatie'),
  commonName: z.string().trim().min(1, 'Geef de plant een naam').max(80),
  scientificName: z.string().trim().max(120).optional(),
  cultivar: z.string().trim().max(80).optional(),
  category: z.enum(PLANT_CATEGORIES),
  photoUrl: z.string().trim().max(500).optional(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  plantedAt: z.string().trim().max(10).optional(),
  hardiness: z.string().trim().max(120).optional(),
  frostSensitive: z.boolean().default(false),
  droughtSensitive: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(['foto', 'url', 'handmatig']).default('handmatig'),
  sourceUrl: z.string().trim().max(500).optional(),
  tasks: z.array(careTaskInput).max(8).optional(),
  identification: z
    .object({
      plantnet: z.array(z.object({ name: z.string(), score: z.number() })).optional(),
      ai: z.object({ name: z.string(), confidence: z.number() }).optional(),
    })
    .optional(),
});

export const plantPatch = plantInput
  .partial()
  .omit({ tasks: true, identification: true })
  .extend({
    status: z.enum(['levend', 'dood', 'verwijderd']).optional(),
    statusReason: z.string().trim().max(300).optional(),
  });

/** Zet een Zod-fout om in één leesbare Nederlandse regel. */
export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const pad = first.path.join('.');
    throw Object.assign(new Error(pad ? `${pad}: ${first.message}` : first.message), {
      status: 400,
    });
  }
  return result.data;
}
