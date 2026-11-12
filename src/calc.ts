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

// Daily calories against what the body burns, by goal: a deficit to lose fat, a small one to tone up (lose a little fat,
// keep muscle), a surplus to build or gain, and maintenance for health, stamina, mobility and sport. Unknown goals
// (a newer save on an older build) get maintenance.
export const goalDelta = (goal: Profile['goal'], tdee: number): number => {
  switch (goal) {
    case 'lose fat': return -Math.min(500, tdee * 0.2);
    case 'tone up': return -Math.min(250, tdee * 0.1);
    case 'build muscle': return tdee * 0.1;
    case 'gain weight': return Math.min(450, tdee * 0.15);
    case 'get stronger': return tdee * 0.05;
    case 'athletic': return tdee * 0.03; // fuel for hard sessions
    default: return 0; // stay fit, endurance, mobility
  }
};
// Protein in grams per kg of body weight: highest when cutting (to keep muscle), lowest when the goal is moving well.
const PROTEIN_PER_KG: Record<Profile['goal'], number> = {
  'lose fat': 2, 'build muscle': 1.8, 'get stronger': 1.8, 'stay fit': 1.4,
  'tone up': 1.8, 'gain weight': 1.8, endurance: 1.5, mobility: 1.2, athletic: 1.7,
};

// Mifflin-St Jeor, scaled by training days, nudged by goal. Pregnancy, postpartum and thyroid never get a big deficit.
export function targets(p: Profile) {
  const sex = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sex;
  const activity = p.daysPerWeek <= 2 ? 1.3 : p.daysPerWeek <= 3 ? 1.4 : p.daysPerWeek <= 5 ? 1.55 : 1.7;
  const tdee = bmr * activity;
  let delta = goalDelta(p.goal, tdee);
  let proteinPerKg = PROTEIN_PER_KG[p.goal] ?? 1.4;
  // Body type (optional). Protein for larger bodies uses goal weight, or the weight at BMI 25, so targets aren't inflated.
  let proteinKg = p.weightKg;
  if (p.body === 'more') {
    proteinKg = p.goalWeightKg < p.weightKg ? p.goalWeightKg : Math.min(p.weightKg, 25 * (p.heightCm / 100) ** 2);
    proteinPerKg = Math.max(proteinPerKg, 1.6);
    delta = -Math.min(500, tdee * 0.15); // modest deficit: sustainable, keeps muscle
  } else if (p.body === 'lean' && (p.goal === 'build muscle' || p.goal === 'gain weight')) delta = Math.min(p.goal === 'gain weight' ? 450 : 350, tdee * (p.goal === 'gain weight' ? 0.15 : 0.1)); // small surplus, mostly muscle
  else if (p.body === 'soft') {
    delta = Math.min(tdee * 0.05, Math.max(-tdee * 0.1, delta)); // recomposition: near maintenance
    proteinPerKg = Math.max(proteinPerKg, 2);
  }
  const pw = pregnancyWeek(p);
  if (pw !== null) delta = pw >= 28 ? 450 : pw >= 14 ? 340 : 0;
  else if (postpartumWeek(p) !== null || p.concerns?.includes('food')) delta = Math.max(delta, 0);
  else if (p.concerns?.includes('thyroid')) delta = Math.max(delta, -tdee * 0.1);
  return {
    kcal: Math.round((tdee + delta) / 10) * 10,
    protein: Math.round(proteinKg * proteinPerKg),
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
    if (top > 0 && top > prev.e1rm) return [{ exId: it.exId, label: `about ${Math.round(top)} kg for one rep` }];
    if (!top && reps > prev.reps) return [{ exId: it.exId, label: `${reps} reps` }];
    return [];
  });
}

// Duration targets ('30s', '20-30 s', '10 min', '30s/side') in seconds; null for rep targets ('8-12', '10/side').
export const secsOf = (r: string) => {
  const m = /^(\d+)(?:-\d+)?\s?(s|min)\b/.exec(r);
  return m ? +m[1] * (m[2] === 'min' ? 60 : 1) : null;
};
export const parseReps = (r: string) => secsOf(r) ?? (parseInt(r, 10) || 10);
export const isTimed = (r: string) => secsOf(r) !== null;

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
  const me = { gender: 'female', age: 30, heightCm: 165, weightKg: 110, goalWeightKg: 110, goal: 'lose fat', daysPerWeek: 3 } as Profile;
  assert(targets({ ...me, body: 'more' }).protein === Math.round(25 * 1.65 ** 2 * 2), 'more: protein from BMI-25 weight');
  assert(targets({ ...me, body: 'more', goalWeightKg: 80 }).protein === 160, 'more: protein from goal weight');
  assert(targets({ ...me, body: 'more' }).kcal > targets(me).kcal, 'more: gentler deficit');
  const thin = { ...me, weightKg: 55, goalWeightKg: 55, goal: 'build muscle' } as Profile;
  assert(targets({ ...thin, body: 'lean' }).kcal - targets({ ...thin, goal: 'stay fit' }).kcal <= 350, 'lean: small surplus');
  const soft = targets({ ...me, weightKg: 65, body: 'soft' }), plain = targets({ ...me, weightKg: 65, goal: 'stay fit' });
  assert(Math.abs(soft.kcal - plain.kcal) <= plain.kcal * 0.11 && soft.protein === 130, 'soft: near maintenance, more protein');
  const fit = targets({ ...thin, goal: 'stay fit' });
  for (const g of ['lose fat', 'build muscle', 'get stronger', 'stay fit', 'tone up', 'gain weight', 'endurance', 'mobility', 'athletic'] as Profile['goal'][]) {
    const t = targets({ ...thin, goal: g });
    assert(Number.isFinite(t.kcal) && t.kcal > 1000 && t.protein > 40, `targets for ${g}`);
  }
  assert(targets({ ...thin, goal: 'gain weight' }).kcal > fit.kcal && targets({ ...thin, goal: 'tone up' }).kcal < fit.kcal, 'gain eats more, tone up a little less');
  assert(targets({ ...thin, goal: 'tone up' }).kcal > targets({ ...thin, goal: 'lose fat' }).kcal && targets({ ...thin, goal: 'endurance' }).kcal === fit.kcal, 'tone up is a small deficit, stamina eats at maintenance');
  assert(isTimed('30s') && !isTimed('10/side') && isTimed('30s/side') && !isTimed('8-12'), 'timed parse');
  assert(secsOf('10 min') === 600 && secsOf('20-30 s') === 20 && secsOf('10 x 4 s') === null && parseReps('10 min') === 600, 'duration parse');
}

// Exercises with at least one logged set today, and plan days trained since Monday ("planId:dayIndex").
export const doneToday = (sessions: Session[], now = Date.now()) =>
  new Set(sessions.filter((s) => dayKey(s.startedAt) === dayKey(now)).flatMap((s) => s.items.filter((it) => it.sets.some((x) => x.done)).map((it) => it.exId)));
export function doneThisWeek(sessions: Session[], now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return new Set(sessions.filter((s) => s.startedAt >= d.getTime() && s.planId && s.dayIndex !== undefined).map((s) => `${s.planId}:${s.dayIndex}`));
}

// "Done recently": the last time each exercise had a logged set, kept for 7 days. Screens tint these rows and say
// when they count as fresh again, so people can see what they already did this week without it looking locked.
export function doneRecently(sessions: Session[], now = Date.now()) {
  const out = new Map<string, number>();
  for (const s of sessions) {
    if (now - s.startedAt >= 7 * DAY) continue;
    for (const it of s.items) if (it.sets.some((x) => x.done) && (out.get(it.exId) ?? 0) < s.startedAt) out.set(it.exId, s.startedAt);
  }
  return out;
}
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function doneNote(at: number, now = Date.now()) {
  const day = dayKey(at) === dayKey(now) ? 'today' : WD[new Date(at).getDay()];
  const left = Math.max(1, Math.ceil((startOfDay(at) + 7 * DAY - startOfDay(now)) / DAY));
  return { day, left, text: `Done ${day} · rest it ${left} more day${left > 1 ? 's' : ''}` };
}
