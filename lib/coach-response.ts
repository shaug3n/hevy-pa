import type { NormalizedWorkout } from '@hevy-pa/hevy-mcp';
import type { CoachModelOutput, CoachWorkoutCard } from '@/lib/coach-contract';

const rounded = (value: number) => Math.round(value * 10) / 10;

function durationMinutes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return undefined;
  const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
  if (!Number.isFinite(duration) || duration <= 0) return undefined;
  return Math.round(duration / 60_000) || 1;
}

export function hydrateWorkoutCards(workouts: NormalizedWorkout[], references: CoachModelOutput['workoutReferences']): CoachWorkoutCard[] {
  const workoutsById = new Map(workouts.map((workout) => [workout.id, workout]));
  const seen = new Set<string>();
  const cards: CoachWorkoutCard[] = [];

  for (const reference of references) {
    if (seen.has(reference.workoutId) || cards.length === 3) continue;
    seen.add(reference.workoutId);
    const workout = workoutsById.get(reference.workoutId);
    if (!workout) continue;

    const allowedIndexes = new Set(reference.exerciseIndexes);
    const selected = (allowedIndexes.size
      ? workout.exercises.filter((exercise) => allowedIndexes.has(exercise.index))
      : workout.exercises).slice(0, 6);
    const totalSets = selected.reduce((total, exercise) => total + exercise.sets.length, 0);
    const totalVolumeKg = selected.reduce((total, exercise) => total + exercise.sets.reduce((sets, set) => (
      typeof set.weightKg === 'number' && typeof set.reps === 'number' ? sets + set.weightKg * set.reps : sets
    ), 0), 0);
    const rpes = selected.flatMap((exercise) => exercise.sets.flatMap((set) => typeof set.rpe === 'number' ? [set.rpe] : []));
    const duration = durationMinutes(workout.startTime, workout.endTime);
    cards.push({
      type: 'workout', workoutId: workout.id, title: workout.title,
      ...(workout.startTime ? { startTime: workout.startTime } : {}),
      ...(workout.endTime ? { endTime: workout.endTime } : {}),
      stats: {
        exerciseCount: selected.length, totalSets,
        ...(totalVolumeKg > 0 ? { totalVolumeKg: rounded(totalVolumeKg) } : {}),
        ...(rpes.length ? { averageRpe: rounded(rpes.reduce((total, value) => total + value, 0) / rpes.length) } : {}),
        ...(duration ? { durationMinutes: duration } : {}),
      },
      exercises: selected.map((exercise) => ({
        index: exercise.index, title: exercise.title, setCount: exercise.sets.length,
        sets: exercise.sets.slice(0, 8).map((set) => ({
          index: set.index,
          ...(set.type ? { type: set.type } : {}),
          ...(typeof set.weightKg === 'number' ? { weightKg: set.weightKg } : {}),
          ...(typeof set.reps === 'number' ? { reps: set.reps } : {}),
          ...(typeof set.rpe === 'number' ? { rpe: set.rpe } : {}),
        })),
      })),
    });
  }
  return cards;
}
