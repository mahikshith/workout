// Small shared helpers for the Today / Progress / Fuel / You screens, so the same number reads the same everywhere.
import type { Profile, Session } from './store';
import { GUEST } from './store';

// A finished session's length in whole minutes, never under 1 (Summary, History and Progress all use this).
export const sessionMinutes = (s: Session) => Math.max(1, Math.round(Math.max(0, (s.endedAt ?? s.startedAt) - s.startedAt) / 60000));

// "1 day streak", "4 day streak": the streak counts training days (calc.streak), worded the same on every screen.
export const STREAK_SUFFIX = ' day streak';
export const streakLabel = (n: number) => `${n}${STREAK_SUFFIX}`;

// Profile fields that start as guest defaults. They count as answered when the user changed them, filled in the
// optional About step of setup (a name means they went through it), or picked them on a screen that marks them via
// store.dismissed['set:<field>'].
export type Answerable = 'gender' | 'age' | 'heightCm' | 'weightKg' | 'diet';
export const setKey = (f: Answerable) => `set:${f}`;
export function answered(p: Profile, dismissed: Record<string, string>, f: Answerable) {
  return !!p.name || !!dismissed[setKey(f)] || p[f] !== GUEST[f];
}
