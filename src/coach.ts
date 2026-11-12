import type { Place } from './data/exercises';
import type { Plan } from './data/plans';
import { planFor } from './planner';
import { buildPerson } from './reco/model';
import { rankPlans } from './reco/plans';
import type { Concern, Profile, Session } from './store';

// One best plan for the profile, from the plan reasoning engine (src/planner.ts): life stage first, then hard
// constraints (place, gear, women-only plans, injuries, exactly the chosen days a week), then goal, level and body
// context. Use planFor() when the reasons are needed too.
export function recommend(p: Profile): string {
  return planFor(p).planId;
}

// One-muscle plans show in "Best for you" only when a concern clearly points at them, never by default.
const ONE_MUSCLE: Record<string, Concern[]> = { 'glute-day': ['tone'], 'core-day': ['back', 'posture'], 'back-day': ['posture'] };
const oneMuscleFits = (p: Profile, x: Plan) => (ONE_MUSCLE[x.id] ?? []).some((c) => p.concerns?.includes(c));

// Plans that fit this person, best first: the recommendation engine's ranking (src/reco/plans.ts) over every plan,
// keeping only the ones that suit (women's plans for women, pregnancy and after-birth plans when they apply, nothing
// the place cannot support or the safety filters would gut). The engine's pick leads. One-muscle add-on days are
// listed only when a concern points at them, as before. Screens that want the fit % and reasons use rankPlans().
export const ranked = (p: Profile): Plan[] =>
  rankPlans(buildPerson({ profile: p }))
    .filter((r) => r.suitable && (!r.addOn || oneMuscleFits(p, r.plan)))
    .map((r) => r.plan);

export const defaultPlace = (p: Profile): Place => (p.place === 'home' ? 'home' : 'gym');

const hour = () => new Date().getHours();
export const greeting = () => (hour() < 5 ? 'Late night' : hour() < 12 ? 'Good morning' : hour() < 17 ? 'Good afternoon' : 'Good evening');

// One short coach line for the Today screen, chosen from what actually happened.
export function nudge(p: Profile, sessions: Session[], streak: number) {
  const last = sessions[sessions.length - 1];
  const days = last ? Math.floor((Date.now() - last.startedAt) / 86400000) : -1;
  const thisWeek = sessions.filter((s) => Date.now() - s.startedAt < 7 * 86400000).length;
  if (!last) return `Day one${p.name ? `, ${p.name}` : ''}. Start small.`;
  if (days === 0) return 'Done today. Eat, drink, sleep.';
  if (days >= 3) return `${days} days off. One exercise is a win.`;
  if (thisWeek >= p.daysPerWeek) return `Weekly goal hit: ${thisWeek}/${p.daysPerWeek}. Extra is a bonus.`;
  if (streak >= 5) return `${streak} in a row. Habit building.`;
  return `${p.daysPerWeek - thisWeek} more this week. You've got this.`;
}
export { planFor, explain } from './planner';
