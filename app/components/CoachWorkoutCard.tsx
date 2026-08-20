import type { CoachWorkoutCard as CoachWorkoutCardData } from '@/lib/coach-contract';

type Props = { card: CoachWorkoutCardData; units: 'metric' | 'imperial'; timezone: string };

const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

function formatWeight(weightKg: number, units: Props['units']) {
  const value = units === 'imperial' ? weightKg * 2.20462 : weightKg;
  return `${number(value)} ${units === 'imperial' ? 'lb' : 'kg'}`;
}

export function CoachWorkoutCard({ card, units, timezone }: Props) {
  const date = card.startTime ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: timezone }).format(new Date(card.startTime)) : undefined;
  const stats = [date, card.stats.durationMinutes ? `${card.stats.durationMinutes} min` : undefined, `${card.stats.exerciseCount} exercises`, `${card.stats.totalSets} sets`, typeof card.stats.totalVolumeKg === 'number' ? `${formatWeight(card.stats.totalVolumeKg, units)} volume` : undefined, typeof card.stats.averageRpe === 'number' ? `RPE ${number(card.stats.averageRpe)}` : undefined].filter(Boolean);
  return <article className="coach-workout-card" aria-label={`Workout details: ${card.title}`}>
    <div className="coach-workout-heading"><strong>{card.title}</strong><span>{stats.join(' · ')}</span></div>
    {card.exercises.map((exercise) => <div className="coach-exercise" key={exercise.index}>
      <b>{exercise.title}</b><small>{exercise.setCount} sets</small>
      {exercise.sets.length > 0 && <div className="coach-set-list">{exercise.sets.map((set) => <span key={set.index}>{[
        set.type, typeof set.weightKg === 'number' ? formatWeight(set.weightKg, units) : undefined,
        typeof set.reps === 'number' ? `${number(set.reps)} reps` : undefined,
        typeof set.rpe === 'number' ? `RPE ${number(set.rpe)}` : undefined,
      ].filter(Boolean).join(' · ') || `Set ${set.index + 1}`}</span>)}</div>}
    </div>)}
  </article>;
}
