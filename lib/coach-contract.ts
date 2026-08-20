import { z } from 'zod';

const nonNegativeNumber = z.number().finite().nonnegative();

export const coachModelOutputSchema = z.object({
  reply: z.string().trim().min(1).max(1_200),
  workoutReferences: z.array(z.object({
    workoutId: z.string().trim().min(1).max(200),
    exerciseIndexes: z.array(z.number().int().nonnegative()).max(6),
  }).strict()).max(3),
}).strict();

export const coachWorkoutCardSchema = z.object({
  type: z.literal('workout'),
  workoutId: z.string().min(1).max(200),
  title: z.string().min(1).max(240),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  stats: z.object({
    exerciseCount: z.number().int().nonnegative(),
    totalSets: z.number().int().nonnegative(),
    totalVolumeKg: nonNegativeNumber.optional(),
    averageRpe: nonNegativeNumber.optional(),
    durationMinutes: z.number().int().positive().optional(),
  }).strict(),
  exercises: z.array(z.object({
    index: z.number().int().nonnegative(),
    title: z.string().min(1).max(240),
    setCount: z.number().int().nonnegative(),
    sets: z.array(z.object({
      index: z.number().int().nonnegative(),
      type: z.string().max(80).optional(),
      weightKg: nonNegativeNumber.optional(),
      reps: nonNegativeNumber.optional(),
      rpe: nonNegativeNumber.optional(),
    }).strict()).max(8),
  }).strict()).max(6),
}).strict();

export type CoachModelOutput = z.infer<typeof coachModelOutputSchema>;
export type CoachWorkoutCard = z.infer<typeof coachWorkoutCardSchema>;
