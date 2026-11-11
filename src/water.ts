// Water in millilitres. The store keeps State.water[day] in standard 250 ml glasses (so badges, charts and nudges that
// compare it with targets().water stay right); this file turns that into ml and adds the person's own glass size.
import { dayKey, targets } from './calc';
import { useStore, type Profile } from './store';

export const STD = 250; // ml in one stored unit
export const SIZES: { ml: number; label: string }[] = [
  { ml: 150, label: 'Small glass' },
  { ml: 250, label: 'Glass' },
  { ml: 350, label: 'Large glass' },
  { ml: 500, label: 'Bottle' },
  { ml: 750, label: 'Big bottle' },
];
type Prefs = { glassMl: number; goalMl: number; auto?: boolean };

// About 35 ml per kg of body weight, the same number Today's ring and the charts use.
export const autoGoalMl = (p: Profile) => targets(p).water * STD;
export const goalMl = (p: Profile, w?: Prefs) => (w && w.auto === false && w.goalMl > 0 ? w.goalMl : autoGoalMl(p));
export const toMl = (units: number) => Math.round(units * STD);
export const ml = (n: number) => `${Math.round(n).toLocaleString('en-US')} ml`;
export const sizeName = (glass: number) => SIZES.find((x) => x.ml === glass)?.label ?? 'Glass';

// One tap: a glass (or bottle) of the person's size, today. n = -1 takes one back.
export function drink(n = 1) {
  const { waterPrefs, addWater } = useStore.getState();
  addWater((n * (waterPrefs?.glassMl ?? STD)) / STD);
}

// Today's water in ml with the goal, for any screen.
export function useWater(day = dayKey()) {
  const units = useStore((s) => s.water[day] ?? 0);
  const prefs = useStore((s) => s.waterPrefs);
  const profile = useStore((s) => s.profile);
  const goal = goalMl(profile, prefs);
  return { ml: toMl(units), goal, glass: prefs?.glassMl ?? STD, auto: prefs?.auto !== false };
}
