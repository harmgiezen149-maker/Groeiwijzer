import { z } from 'zod';
import { PLANT_CATEGORIES, TASK_TYPES, WEATHER_RULE_IDS, type Month } from '../types';

const month = z.coerce
  .number()
  .int()
  .min(1)
  .max(12)
  .transform((v) => v as Month);

export const aiSchedule = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('jaarvenster'),
    startMonth: month,
    endMonth: month,
    timesPerWindow: z.coerce.number().int().min(1).max(24).default(1),
  }),
  z.object({
    kind: z.literal('interval'),
    startMonth: month,
    endMonth: month,
    intervalDays: z.coerce.number().int().min(1).max(365),
  }),
  z.object({
    kind: z.literal('meerjaarlijks'),
    startMonth: month,
    endMonth: month,
    everyYears: z.coerce.number().int().min(2).max(20),
    anchorYear: z.coerce.number().int().min(1900).max(2200),
  }),
  z.object({
    kind: z.literal('weer-gestuurd'),
    startMonth: month,
    endMonth: month,
  }),
]);

export const aiTask = z.object({
  type: z.enum(TASK_TYPES),
  title: z.string().trim().min(1).max(80),
  instructions: z.string().trim().min(1).max(1200),
  schedule: aiSchedule,
  weatherRules: z.array(z.enum(WEATHER_RULE_IDS)).max(5).default([]),
  importance: z.enum(['noodzakelijk', 'aanbevolen', 'optioneel']).default('aanbevolen'),
});

export const careProfileSchema = z.object({
  commonName: z.string().trim().min(1).max(80),
  scientificName: z.string().trim().max(120).nullish(),
  category: z.enum(PLANT_CATEGORIES),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  frostSensitive: z.boolean().default(false),
  droughtSensitive: z.boolean().default(false),
  hardiness: z.string().trim().max(160).nullish(),
  tasks: z.array(aiTask).max(8).default([]),
});

export type CareProfile = z.infer<typeof careProfileSchema>;
