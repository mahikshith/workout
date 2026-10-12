import { postpartumWeek, pregnancyWeek } from './calc';
import type { Place } from './data/exercises';
import { perWeek, plans, type Plan } from './data/plans';
import type { Profile, Session } from './store';

// One best plan from goal, place, experience, days per week and body context. Women plans are only picked for women.
export function recommend(p: Profile): string {
  if (pregnancyWeek(p) !== null) return 'pregnancy-safe';
  const pp = postpartumWeek(p);
  if (pp !== null && pp < 12) return 'after-birth'; // breathing, pelvic floor and walking come first after birth
  const female = p.gender === 'female';
  if (p.concerns?.some((x) => x === 'endurance' || x === 'run') && p.goal !== 'build muscle') return 'cardio-aerobic';
  if (p.concerns?.includes('gain') && p.place !== 'home') return 'lean-gain';
  if (p.place === 'office') return 'desk-reset';
  if (p.place === 'home') {
    if (p.goal === 'lose fat') return 'fat-burn-home';
    if (p.gear.includes('dumbbell')) return 'home-dumbbell';
    return p.level === 'beginner' ? 'home-beginner' : 'home-bodyweight';
  }
  const days = p.daysPerWeek;
  const thin = p.weightKg / (p.heightCm / 100) ** 2 < 20;
  if (p.goal === 'lose fat') return days >= 4 || p.level === 'beginner' ? 'fat-loss-gym' : 'functional';
  if (p.level === 'beginner' || days <= 3) {
    if (p.goal === 'get stronger') return 'strength-5x5';
    if (p.goal === 'build muscle' && thin) return 'lean-gain';
    if (female && days >= 5 && p.goal !== 'stay fit') return 'glutes-legs-gym';
    return 'full-body-gym';
  }
  if (p.goal === 'stay fit') return days >= 5 && female ? 'glutes-legs-gym' : 'functional';
  if (days >= 6) return p.goal === 'get stronger' ? 'phul' : 'ppl-gym';
  if (days === 5) return p.goal === 'get stronger' ? 'phul' : female ? 'glutes-legs-gym' : 'bro-split';
  return p.goal === 'get stronger' ? 'phul' : 'upper-lower-gym';
}

// Plans that fit this person, best first. Women plans only for women; pregnancy and after-birth plans only when they apply.
export const ranked = (p: Profile): Plan[] => {
  const best = recommend(p);
  const preg = pregnancyWeek(p) !== null;
  const pp = postpartumWeek(p);
  const fresh = pp !== null && pp < 12;
  const place = p.place === 'both' ? null : p.place;
  const ok = (x: Plan) =>
    (x.category !== 'Women' || p.gender === 'female') && (x.id !== 'pregnancy-safe' || preg) && (x.id !== 'after-birth' || fresh) &&
    (!place || x.place === place || x.place === 'any');
  const score = (x: Plan) =>
    (x.id === best ? 100 : 0) + (x.tags.includes(p.goal) ? 10 : 0) - 2 * Math.abs(perWeek(x) - p.daysPerWeek) +
    (x.level === 'intermediate' && p.level === 'beginner' ? -8 : 0) + ((preg || fresh) && x.category === 'Recovery' ? (x.id === 'pelvic-floor' ? 50 : 40) : 0);
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
