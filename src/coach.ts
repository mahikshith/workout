import { postpartumWeek } from './calc';
import type { Place } from './data/exercises';
import { plans } from './data/plans';
import type { Profile, Session } from './store';

// Gender only shifts the default; every plan stays open to everyone.
export function recommend(p: Profile): string {
  const pp = postpartumWeek(p);
  if (pp !== null && pp < 12) return 'pelvic-floor'; // breathing, pelvic floor and walking come first after birth
  const place: Place = p.place === 'home' ? 'home' : 'gym';
  if (place === 'home') {
    if (p.goal === 'lose fat') return 'fat-burn-home';
    return p.gear.includes('dumbbell') ? 'home-dumbbell' : 'home-bodyweight';
  }
  if (p.level === 'beginner' || p.daysPerWeek <= 3) return p.gender === 'female' && p.goal !== 'get stronger' ? 'glutes-legs-gym' : 'full-body-gym';
  if (p.daysPerWeek >= 5 && p.goal !== 'lose fat') return 'ppl-gym';
  return p.gender === 'female' && p.goal !== 'get stronger' ? 'glutes-legs-gym' : 'upper-lower-gym';
}

export const ranked = (p: Profile) => {
  const best = recommend(p);
  const place = p.place === 'both' ? null : p.place;
  return [...plans].sort((a, b) => score(b) - score(a));
  function score(x: (typeof plans)[number]) {
    return (x.id === best ? 100 : 0) + (x.tags.includes(p.goal) ? 10 : 0) + (!place || x.place === place || x.place === 'any' ? 5 : 0);
  }
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
