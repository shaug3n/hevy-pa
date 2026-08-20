import { z } from 'zod';

const setSchema = z.object({ index: z.number().int().nonnegative().optional(), weight_kg: z.number().nullable().optional(), reps: z.number().nullable().optional(), rpe: z.number().nullable().optional(), type: z.string().optional() }).passthrough();
const exerciseSchema = z.object({ index: z.number().int().nonnegative().optional(), title: z.string().optional(), exercise_template_id: z.string().optional(), sets: z.array(setSchema).optional() }).passthrough();
const workoutSchema = z.object({ id: z.string(), title: z.string().optional(), start_time: z.string().optional(), end_time: z.string().optional(), exercises: z.array(exerciseSchema).optional() }).passthrough();
export const userInfoSchema = z.object({ data: z.object({ id: z.string(), name: z.string(), url: z.string().optional() }) });
export const workoutsSchema = z.object({ page: z.number(), page_count: z.number(), workouts: z.array(workoutSchema) });
export type NormalizedWorkout = { id: string; title: string; startTime?: string; endTime?: string; exercises: Array<{ index: number; title: string; sets: Array<{ index: number; weightKg?: number; reps?: number; rpe?: number; type?: string }> }> };
export const normalizeWorkouts = (payload: z.infer<typeof workoutsSchema>) => payload.workouts.map((workout): NormalizedWorkout => ({
  id: workout.id, title: workout.title || 'Untitled workout', ...(workout.start_time ? { startTime: workout.start_time } : {}), ...(workout.end_time ? { endTime: workout.end_time } : {}),
  exercises: (workout.exercises || []).slice(0, 20).map((exercise, exerciseIndex) => ({ index: exercise.index ?? exerciseIndex, title: exercise.title || exercise.exercise_template_id || 'Exercise', sets: (exercise.sets || []).slice(0, 20).map((set, setIndex) => ({ index: set.index ?? setIndex, ...(typeof set.weight_kg === 'number' ? { weightKg: set.weight_kg } : {}), ...(typeof set.reps === 'number' ? { reps: set.reps } : {}), ...(typeof set.rpe === 'number' ? { rpe: set.rpe } : {}), ...(set.type ? { type: set.type } : {}) })) })),
}));
