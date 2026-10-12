// Realistic expectations: what changes when, so nobody quits in week three because they don't look like a feed.
import type { Profile } from '../store';

// Safe paces: fat loss about 0.5 kg a week, beginner muscle gain about 1 kg a month.
export function goalWeeks(p: Profile) {
  const diff = p.goalWeightKg - p.weightKg;
  if (Math.abs(diff) < 0.5) return null;
  const perWeek = diff < 0 ? 0.5 : 0.25;
  return { weeks: Math.ceil(Math.abs(diff) / perWeek), losing: diff < 0, perWeek };
}

export function timeline(p: Profile) {
  const gentle = p.gentle || p.concerns?.includes('food');
  const muscle = p.goal === 'build muscle' || p.goal === 'get stronger';
  return [
    { when: 'Week 1-2', what: 'You learn the moves, sleep better and feel more energy. Some soreness is normal.' },
    { when: 'Week 3-4', what: 'Strength climbs fast as your nerves and muscles learn to work together. Workouts feel easier.' },
    { when: 'Week 6-8', what: muscle ? 'Clothes fit differently and the mirror starts to agree.' : gentle ? 'Stairs feel easier and your mood is steadier.' : 'Clothes fit looser. Friends may notice before you do.' },
    { when: 'Week 12', what: 'A clear difference you can see and feel, if you kept showing up most weeks.' },
  ];
}

// For the first two months: one honest line per week since the first workout.
export function expectLine(weeksIn: number) {
  if (weeksIn < 1) return 'The first two weeks are about learning, not results. Showing up is the whole job right now.';
  if (weeksIn < 3) return 'Strength comes before looks. Your numbers going up is the first sign it is working.';
  if (weeksIn < 6) return 'Visible change usually starts around week six to eight. You are building the base for it now.';
  return 'What you see online took years and good lighting. Yours is built week by week, and it lasts.';
}
