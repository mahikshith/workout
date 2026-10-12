import type { Profile, Session } from './store';

export const dayKey = (d: Date | number = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const DAY = 86400000;
const startOfDay = (t: number) => new Date(dayKey(t) + 'T00:00:00').getTime();

const daysFrom = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / DAY);

// Women's context. Unknown dates resolve to the cautious answer (mid-pregnancy, fresh postpartum).
export function cycle(p: Profile, today = dayKey()) {
  const w = p.women;
  if (p.gender === 'male' || w?.mode !== 'cycle' || !w.periodStart) return null;
  const len = w.cycleLength ?? 28;
  const day = (((daysFrom(w.periodStart, today) % len) + len) % len) + 1;
  const phase = day <= 5 ? 'period' : day <= len - 16 ? 'follicular' : day <= len - 12 ? 'ovulation' : 'luteal';
  return { day, length: len, phase: phase as 'period' | 'follicular' | 'ovulation' | 'luteal' };
}
export const pregnancyWeek = (p: Profile, today = dayKey()) =>
  p.gender === 'male' || p.women?.mode !== 'pregnant' ? null : !p.women.date ? 14 : Math.max(1, Math.min(42, 40 - Math.ceil(daysFrom(today, p.women.date) / 7)));
export const postpartumWeek = (p: Profile, today = dayKey()) =>
  p.gender === 'male' || p.women?.mode !== 'postpartum' ? null : !p.women.date ? 0 : Math.max(0, Math.floor(daysFrom(p.women.date, today) / 7));

// Mifflin-St Jeor, scaled by training days, nudged by goal. Pregnancy, postpartum and thyroid never get a big deficit.
export function targets(p: Profile) {
  const sex = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sex;
  const activity = p.daysPerWeek <= 2 ? 1.3 : p.daysPerWeek <= 3 ? 1.4 : p.daysPerWeek <= 5 ? 1.55 : 1.7;
  const tdee = bmr * activity;
  let delta = { 'lose fat': -Math.min(500, tdee * 0.2), 'build muscle': tdee * 0.1, 'get stronger': tdee * 0.05, 'stay fit': 0 }[p.goal];
  const pw = pregnancyWeek(p);
  if (pw !== null) delta = pw >= 28 ? 450 : pw >= 14 ? 340 : 0;
  else if (postpartumWeek(p) !== null || p.concerns?.includes('food')) delta = Math.max(delta, 0);
  else if (p.concerns?.includes('thyroid')) delta = Math.max(delta, -tdee * 0.1);
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
  const w = (women: Profile['women']) => ({ women, gender: 'female' } as Profile);
  assert(cycle(w({ mode: 'cycle', periodStart: '2026-01-01' }), '2026-01-03')?.phase === 'period', 'cycle period');
  assert(cycle(w({ mode: 'cycle', periodStart: '2026-01-01' }), '2026-01-20')?.phase === 'luteal', 'cycle luteal');
  assert(cycle(w({ mode: 'cycle', periodStart: '2026-01-01' }), '2026-01-29')?.day === 1, 'cycle wraps');
  assert(pregnancyWeek(w({ mode: 'pregnant', date: '2026-03-01' }), '2026-01-04') === 32, 'pregnancy week');
  assert(pregnancyWeek(w({ mode: 'pregnant' })) === 14, 'unknown due date is cautious');
  assert(postpartumWeek(w({ mode: 'postpartum', date: '2026-01-01' }), '2026-02-12') === 6, 'postpartum week');
  assert(isTimed('30s') && !isTimed('10/side') && isTimed('30s/side') && !isTimed('8-12'), 'timed parse');
}

// Exercises with at least one logged set today, and plan days trained since Monday ("planId:dayIndex").
export const doneToday = (sessions: Session[], now = Date.now()) =>
  new Set(sessions.filter((s) => dayKey(s.startedAt) === dayKey(now)).flatMap((s) => s.items.filter((it) => it.sets.some((x) => x.done)).map((it) => it.exId)));
export function doneThisWeek(sessions: Session[], now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return new Set(sessions.filter((s) => s.startedAt >= d.getTime() && s.planId && s.dayIndex !== undefined).map((s) => `${s.planId}:${s.dayIndex}`));
}
