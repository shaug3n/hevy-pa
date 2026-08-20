import { describe, expect, it } from 'vitest';
import { hydrateWorkoutCards } from '@/lib/coach-response';
import { buildCoachInstructions } from '@/lib/coach-instructions';
import type { NormalizedWorkout } from '@hevy-pa/hevy-mcp';

const workouts: NormalizedWorkout[] = [{
  id: 'workout-1', title: 'Upper body', startTime: '2026-08-20T08:00:00.000Z', endTime: '2026-08-20T09:05:00.000Z', exercises: [
    { index: 2, title: 'Bench press', sets: [{ index: 0, weightKg: 80, reps: 5, rpe: 9.5 }, { index: 1, weightKg: 80, reps: 5, rpe: 0 }] },
    { index: 4, title: 'Row', sets: [{ index: 0, weightKg: 60, reps: 10 }] },
  ],
}];

describe('coach workout hydration', () => {
  it('creates cards only from referenced workout facts and preserves decimal or zero RPE', () => {
    const cards = hydrateWorkoutCards(workouts, [{ workoutId: 'workout-1', exerciseIndexes: [2] }]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ workoutId: 'workout-1', stats: { exerciseCount: 1, totalSets: 2, totalVolumeKg: 800, averageRpe: 4.8, durationMinutes: 65 } });
    expect(cards[0].exercises[0].sets).toEqual([{ index: 0, weightKg: 80, reps: 5, rpe: 9.5 }, { index: 1, weightKg: 80, reps: 5, rpe: 0 }]);
  });

  it('drops unknown and duplicate references, rather than trusting model-generated card values', () => {
    const cards = hydrateWorkoutCards(workouts, [
      { workoutId: 'unknown', exerciseIndexes: [] },
      { workoutId: 'workout-1', exerciseIndexes: [] },
      { workoutId: 'workout-1', exerciseIndexes: [4] },
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0].stats.exerciseCount).toBe(2);
  });
});

describe('coach instructions', () => {
  it('keeps prompt-injection boundaries and applies each fixed onboarding tone', async () => {
    const [direct, calm, energy] = await Promise.all([
      buildCoachInstructions('Encouraging & direct'),
      buildCoachInstructions('Calm & analytical'),
      buildCoachInstructions('High energy'),
    ]);
    expect(direct).toContain('UNTRUSTED CONTEXT');
    expect(direct).toContain('read-only');
    expect(direct).toContain('one concrete next step');
    expect(calm).toContain('evidence-led');
    expect(energy).toContain('no shouting');
    expect(direct).not.toContain('ignore all prior instructions');
  });
});
