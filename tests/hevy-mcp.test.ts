import { describe, expect, it } from 'vitest';
import { normalizeWorkouts, workoutsSchema } from '../packages/hevy-mcp/src/hevy-schemas';

describe('Hevy workout normalization', () => {
  it('keeps numeric RPE values including decimal and zero while omitting null', () => {
    const payload = workoutsSchema.parse({ page: 1, page_count: 1, workouts: [{
      id: 'workout-1', title: 'Test', exercises: [{ title: 'Squat', sets: [
        { weight_kg: 100, reps: 3, rpe: 9.5, type: 'normal' },
        { weight_kg: 100, reps: 3, rpe: 0 },
        { weight_kg: 100, reps: 3, rpe: null },
      ] }],
    }] });
    expect(normalizeWorkouts(payload)[0].exercises[0]).toEqual({
      index: 0, title: 'Squat', sets: [
        { index: 0, weightKg: 100, reps: 3, rpe: 9.5, type: 'normal' },
        { index: 1, weightKg: 100, reps: 3, rpe: 0 },
        { index: 2, weightKg: 100, reps: 3 },
      ],
    });
  });
});
