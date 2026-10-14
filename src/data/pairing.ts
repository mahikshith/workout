// Which exercises go well together in one workout: plain push / pull / legs rules, each with a short reason.
// Pure functions, no React, so the same rules can run anywhere.
import { gate } from '../engine';
import type { Profile } from '../store';
import { available, exercises, type Exercise, type Place } from './exercises';
import { ease } from './muscles';

export type Family = 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'mobility' | 'pelvic' | 'desk' | 'other';
export type Planned = { ex: Exercise; sets: number }; // an exercise in the workout and how many sets it has
export type Fit = { level: 'great' | 'ok' | 'later'; reason: string };
export type Pick = Fit & { ex: Exercise };

const MUSCLE: Record<string, Family> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  lats: 'pull', 'middle back': 'pull', traps: 'pull', biceps: 'pull', forearms: 'pull', 'lower back': 'pull',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  abdominals: 'core',
};
const CAT: Record<string, Family> = {
  cardio: 'cardio', plyometrics: 'cardio', stretching: 'mobility', mobility: 'mobility',
  'pelvic floor': 'pelvic', eyes: 'desk', desk: 'desk', breathing: 'desk',
};
export const family = (e: Exercise): Family => CAT[e.category] ?? MUSCLE[e.primary[0]] ?? 'other';
const STRENGTH: Family[] = ['push', 'pull', 'legs', 'core'];
const FINISH: Family[] = ['core', 'cardio', 'mobility'];
const upper = (f: Family | null) => f === 'push' || f === 'pull';

const setsByFamily = (w: Planned[]) => {
  const m = new Map<Family, number>();
  for (const p of w) m.set(family(p.ex), (m.get(family(p.ex)) ?? 0) + p.sets);
  return m;
};

// The family with the most planned sets.
export function mainFamily(w: Planned[]): Family | null {
  let best: Family | null = null, most = 0;
  for (const [f, n] of setsByFamily(w)) if (n > most) { best = f; most = n; }
  return best;
}

export function fit(e: Exercise, w: Planned[]): Fit {
  if (w.some((p) => p.ex.id === e.id)) return { level: 'later', reason: 'Already in workout' };
  const f = family(e);
  const hard = w.reduce((n, p) => n + (STRENGTH.includes(family(p.ex)) && p.ex.primary[0] === e.primary[0] ? p.sets : 0), 0);
  if (STRENGTH.includes(f) && hard >= 9) return { level: 'later', reason: 'Already worked hard' };
  if (FINISH.includes(f)) return { level: 'great', reason: 'Good finisher' };
  const by = setsByFamily(w);
  const legs = (by.get('legs') ?? 0) > 0, up = (by.get('push') ?? 0) + (by.get('pull') ?? 0) > 0;
  // Only a workout with no legs at all is an upper-body day (and the other way round); full-body days take both.
  if ((f === 'legs' && up && !legs) || (upper(f) && legs && !up)) return { level: 'later', reason: 'Better on another day' };
  const main = mainFamily(w);
  if (f === main) return { level: 'great', reason: `Same ${f} day` };
  if (upper(f) && upper(main)) return { level: 'great', reason: 'Balances push and pull' };
  return { level: 'ok', reason: 'Fine to add' };
}

// Great fits that are allowed for this person at this place: muscles of the main family the workout hasn't touched
// yet first, then the rest; easiest first within each; at most two per muscle so the list stays varied.
export function recommend(w: Planned[], place: Place, gear: string[], profile: Profile, sessionsDone: number, n = 6): Pick[] {
  const main = mainFamily(w);
  const covered = new Set(w.map((p) => p.ex.primary[0]));
  const rank = (e: Exercise) => (family(e) !== main ? 2 : covered.has(e.primary[0]) ? 1 : 0) * 100 + ease(e);
  const great = exercises
    .filter((e) => available(e, place, gear))
    .map((ex) => ({ ex, ...fit(ex, w) }))
    .filter((x) => x.level === 'great' && !gate(x.ex, profile, sessionsDone).locked)
    .sort((a, b) => rank(a.ex) - rank(b.ex));
  const per = new Map<string, number>();
  const out: Pick[] = [];
  for (const x of great) {
    const k = x.ex.primary[0], used = per.get(k) ?? 0;
    if (used >= 2) continue;
    per.set(k, used + 1);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
export function selfCheck(byId: Record<string, Exercise>) {
  const w = (...ids: string[]) => ids.map((id) => ({ ex: byId[id], sets: 3 }));
  assert(fit(byId.Dumbbell_Bicep_Curl, w('Barbell_Shrug')).level === 'great', 'traps + biceps is a pull day');
  assert(fit(byId.Barbell_Squat, w('Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Flyes')).level === 'later', 'squats on a chest day wait');
  assert(fit(byId.Plank, w('Barbell_Squat')).level === 'great' && fit(byId.Plank, []).level === 'great', 'plank always fits');
  assert(fit(byId.Pushups, w('Pushups')).reason === 'Already in workout', 'duplicate is later');
  assert(fit(byId.Dumbbell_Flyes, w('Pushups', 'Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Bench_Press_-_Medium_Grip')).reason === 'Already worked hard', '9 chest sets is enough');
  assert(fit(byId.Dumbbell_Bicep_Curl, w('Pushups')).reason === 'Balances push and pull', 'push and pull balance');
  const guest = { name: '', gender: 'other', age: 30, heightCm: 170, weightKg: 70, goalWeightKg: 70, goal: 'stay fit', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } } as Profile;
  const rec = recommend(w('Pushups', 'Side_Lateral_Raise'), 'gym', [], guest, 0);
  assert(rec.length > 0 && rec[0].ex.primary[0] === 'triceps', 'push day without triceps suggests triceps first');
  assert(rec.every((x) => x.level === 'great' && x.ex.id !== 'Pushups'), 'only new great fits');
}
