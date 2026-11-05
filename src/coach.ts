import { postpartumWeek, pregnancyWeek } from './calc';
import type { Place } from './data/exercises';
import { planById, plans, type Plan } from './data/plans';
import { planFor, scorePlan } from './planner';
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

// Plans that fit this person, best first. Women plans only for women; pregnancy and after-birth plans only when they apply.
// The engine's pick (or the plan it was fitted from) leads; main plans follow by the engine's score for the chosen days.
export const ranked = (p: Profile): Plan[] => {
  const pick = planFor(p);
  const lead = [pick.planId, ...pick.alternatives.map((a) => a.planId)].map((id) => planById[id]?.base ?? id);
  const preg = pregnancyWeek(p) !== null;
  const pp = postpartumWeek(p);
  const fresh = pp !== null && pp < 12;
  const place = p.place === 'both' ? null : p.place;
  const ok = (x: Plan) =>
    (x.category !== 'Women' || p.gender === 'female') && (x.category !== 'One muscle' || (!preg && !fresh && oneMuscleFits(p, x))) && (x.id !== 'pregnancy-safe' || preg) && (x.id !== 'after-birth' || fresh) &&
    (!place || x.place === place || x.place === 'any');
  const score = (x: Plan) => {
    const i = lead.indexOf(x.id);
    if (i >= 0) return 1000 - i;
    if (x.category === 'One muscle') return 60;
    if (x.category === 'Recovery') return (preg || fresh) ? (x.id === 'pelvic-floor' ? 80 : 70) : -50;
    return scorePlan(p, x);
  };
  return plans.filter(ok).sort((a, b) => score(b) - score(a));
};

export const defaultPlace = (p: Profile): Place => (p.place === 'home' ? 'home' : 'gym');

const hour = () => new Date().getHours();
export const greeting = () => (hour() < 5 ? 'Late night' : hour() < 12 ? 'Good morning' : hour() < 17 ? 'Good afternoon' : 'Good evening');

// One short coach line for the Today screen, chosen from what actually happened.
export function nudge(p: Profile, sessions: Session[], streak: number) {
  const last = sessions[sessions.length - 1];
  const days = last ? Math.floor((Date.now() - last.startedAt) / 86400000) : -1;
  const thisWeek = sessions.filter((s) => Date.now() - s.startedAt < 7 * 86400000).length;
  if (!last) return `Day one${p.name ? `, ${p.name}` : ''}. The hardest rep is walking in. Start your first session below.`;
  if (days === 0) return 'Session done today. Eat well, hydrate, sleep. Muscles grow on rest.';
  if (days >= 3) return `${days} days off. No guilt, just start small: one exercise is a win today.`;
  if (thisWeek >= p.daysPerWeek) return `Weekly goal hit: ${thisWeek}/${p.daysPerWeek}. Anything extra is a bonus. Mobility counts too.`;
  if (streak >= 5) return `${streak} sessions in a row. You're building a habit most people never do.`;
  return `${p.daysPerWeek - thisWeek} more this week to hit your goal. You've got this.`;
}
export { planFor, explain } from './planner';
