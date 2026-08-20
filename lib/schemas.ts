import { z } from 'zod';
export const coachStyleSchema = z.enum(['Encouraging & direct', 'Calm & analytical', 'High energy']);
const isValidIanaTimeZone = (value: string) => { try { Intl.DateTimeFormat(undefined, { timeZone: value }); return true; } catch { return false; } };
export const timeZoneSchema = z.string().trim().min(1).max(100).refine(isValidIanaTimeZone, 'Invalid time zone');
export const unitsSchema = z.enum(['metric', 'imperial']);
export const credentialsSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(10).max(128) }).strict();
export const signupSchema = credentialsSchema.extend({ name: z.string().trim().min(1).max(80) }).strict();
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80), coachStyle: coachStyleSchema,
  currentState: z.string().trim().max(2_000).optional(), primaryGoal: z.string().trim().max(500).optional(), initialPlan: z.string().trim().max(2_000).optional(), timezone: timeZoneSchema.optional(), units: unitsSchema.optional(),
}).strict();
export const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(80), coachStyle: coachStyleSchema,
  currentState: z.string().trim().min(1).max(2_000), primaryGoal: z.string().trim().min(1).max(500),
  initialPlan: z.string().trim().max(2_000).optional(), hevyKey: z.string().uuid(), timezone: timeZoneSchema.optional().default('UTC'), units: unitsSchema.optional().default('metric'),
}).strict();
export const goalCreateSchema = z.object({ title: z.string().trim().min(1).max(240), targetDate: z.string().date().optional() }).strict();
export const goalPatchSchema = z.object({ status: z.enum(['active', 'completed']) }).strict();
export const chatSchema = z.object({ message: z.string().trim().min(1).max(4_000) }).strict();
export const planCreateSchema = z.object({ title: z.string().trim().min(1).max(160) }).strict();
export const planStatusSchema = z.object({ status: z.enum(['active', 'completed']) }).strict();
export const planItemCreateSchema = z.object({ title: z.string().trim().min(1).max(240) }).strict();
export const planItemStatusSchema = z.object({ status: z.enum(['pending', 'completed']) }).strict();
