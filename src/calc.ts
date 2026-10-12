import type { Profile, Session } from './store';

export const dayKey = (d: Date | number = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const DAY = 86400000;
const startOfDay = (t: number) => new Date(dayKey(t) + 'T00:00:00').getTime();

// Mifflin-St Jeor, scaled by training days, nudged by goal.
export function targets(p: Profile) {
  const sex = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sex;
  const activity = p.daysPerWeek <= 2 ? 1.3 : p.daysPerWeek <= 3 ? 1.4 : p.daysPerWeek <= 5 ? 1.55 : 1.7;
  const tdee = bmr * activity;
  const delta = { 'lose fat': -Math.min(500, tdee * 0.2), 'build muscle': tdee * 0.1, 'get stronger': tdee * 0.05, 'stay fit': 0 }[p.goal];
  const proteinPerKg = { 'lose fat': 2, 'build muscle': 1.8, 'get stronger': 1.8, 'stay fit': 1.4 }[p.goal];
  return {
    kcal: Math.round((tdee + delta) / 10) * 10,
    protein: Math.round(p.weightKg * proteinPerKg),
    water: Math.round((p.weightKg * 35) / 250), // 250 ml glasses
    bmi: p.weightKg / (p.heightCm / 100) ** 2,
  };
}

// Epley estimated one-rep max.
export const e1rm = (w: number, reps: number) => (reps <= 1 ? w : w * (1 + reps / 30));

// Rest days don't break a streak: sessions count as a chain while gaps stay within 3 days.
export function streak(sessions: Session[], now = Date.now()) {
  const days = [...new Set(sessions.map((s) => startOfDay(s.startedAt)))].sort((a, b) => b - a);
  if (!days.length || startOfDay(now) - days[0] > 3 * DAY) return 0;
  let n = 1;
  for (let i = 1; i < days.length && days[i - 1] - days[i] <= 3 * DAY; i++) n++;
  return n;
}

export function bestStreak(sessions: Session[]) {
  const days = [...new Set(sessions.map((s) => startOfDay(s.startedAt)))].sort((a, b) => a - b);
  let best = 0, run = 0;
  days.forEach((d, i) => { run = i && d - days[i - 1] <= 3 * DAY ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

export const volume = (s: Session) =>
  s.items.reduce((v, it) => v + it.sets.filter((x) => x.done).reduce((a, x) => a + x.reps * (x.weight || 0), 0), 0);
export const doneSets = (s: Session) => s.items.reduce((n, it) => n + it.sets.filter((x) => x.done).length, 0);

// Best previous performance per exercise, for "last time" hints and PR checks.
export function bestBefore(sessions: Session[], exId: string, before = Infinity) {
  let best = { e1rm: 0, reps: 0 };
  for (const s of sessions) {
    if (s.startedAt >= before) continue;
    for (const it of s.items) if (it.exId === exId)
      for (const x of it.sets) if (x.done) best = { e1rm: Math.max(best.e1rm, e1rm(x.weight, x.reps)), reps: Math.max(best.reps, x.reps) };
  }
  return best;
}

export function lastSets(sessions: Session[], exId: string) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const it = sessions[i].items.find((x) => x.exId === exId && x.sets.some((s) => s.done));
    if (it) return it.sets.filter((s) => s.done);
  }
  return null;
}

export function prs(s: Session, history: Session[]) {
  return s.items.flatMap((it) => {
    const done = it.sets.filter((x) => x.done);
    if (!done.length) return [];
    const prev = bestBefore(history, it.exId, s.startedAt);
    if (!prev.e1rm && !prev.reps) return [];
    const top = Math.max(...done.map((x) => e1rm(x.weight, x.reps)));
    const reps = Math.max(...done.map((x) => x.reps));
    if (top > 0 && top > prev.e1rm) return [{ exId: it.exId, label: `${Math.round(top)} kg est. 1RM` }];
    if (!top && reps > prev.reps) return [{ exId: it.exId, label: `${reps} reps` }];
    return [];
  });
}

export const parseReps = (r: string) => parseInt(r, 10) || 10;
export const isTimed = (r: string) => /^\d+s(\/|$)/.test(r);

export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`;

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
export function selfCheck() {
  const day = (n: number) => ({ id: String(n), startedAt: Date.now() - n * DAY, items: [] } as unknown as Session);
  assert(streak([day(0), day(2), day(5)]) === 3, 'rest gaps keep streak');
  assert(streak([day(0), day(5)]) === 1, 'long gap breaks streak');
  assert(streak([day(4)]) === 0, 'stale streak is zero');
  assert(bestStreak([day(20), day(18), day(5), day(3), day(1)]) === 3, 'best streak');
  assert(Math.round(e1rm(100, 5)) === 117, 'epley');
  assert(isTimed('30s') && !isTimed('10/side') && isTimed('30s/side') && !isTimed('8-12'), 'timed parse');
}
