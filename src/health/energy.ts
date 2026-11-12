// Energy burned in one of our logged workouts, and the day's total for the calendar. Pure: no React, no stores.
//
// Every number here is ACTIVE energy: what the workout cost on top of lying still, so it can sit next to a watch's
// "active calories" and never counts the resting burn twice. Three sources, best first:
//
// 1. 'watch'       the watch's own active calories over the workout's time window (Health Connect
//                  ActiveCaloriesBurned, or TotalCaloriesBurned minus resting burn), or the calories of the watch's
//                  own workout that was merged into ours.
// 2. 'heart rate'  Keytel et al. 2005 (J Sports Sci 23(3):289-97), energy from heart rate, age, weight and sex:
//                    men    kJ/min = -55.0969 + 0.6309 HR + 0.1988 kg + 0.2017 age
//                    women  kJ/min = -20.4022 + 0.4472 HR - 0.1263 kg + 0.0740 age
//                  It was fitted on steady aerobic work. Lifting raises heart rate more than oxygen use, so for the
//                  strength part of a workout the result is held between 0.5x and 1.5x the MET estimate.
// 3. 'estimate'    MET x body weight x time (2011 Compendium of Physical Activities, Ainsworth et al.), with the
//                  MET of each exercise's kind. Resting (1 MET) is taken off.
//
// Resting burn: Mifflin-St Jeor 1990, kcal/day = 10 kg + 6.25 cm - 5 age + 5 (men) or - 161 (women).
import type { Exercise } from '../data/exercises';

export type EnergySource = 'watch' | 'heart rate' | 'estimate';
export type ExerciseEnergy = { exId: string; kcal: number; avgHr?: number; maxHr?: number; minutes: number };
export type SessionEnergy = {
  kcal: number; source: EnergySource; avgHr?: number; maxHr?: number;
  minutes: number; // the time the split is spread over (the workout's length, or an estimate when that is unknown)
  perExercise: ExerciseEnergy[]; // same order and length as the session's items; kcal adds up to `kcal` exactly
};

export type Person = { weightKg?: number; age?: number; gender?: 'male' | 'female' | 'other'; heightCm?: number };
type SetLike = { reps: number; weight: number; done: boolean };
type ItemLike = { exId: string; target: string; rest: number; sets: SetLike[] };
export type SessionLike = { id: string; startedAt: number; endedAt?: number; items: ItemLike[] };
type Stat = { avg: number; max: number };
export type EnergyInput = {
  activeKcal?: number; // watch active calories over the workout window
  totalKcal?: number; // watch total calories over the window (resting burn is taken off here)
  hr?: { avg?: number; max?: number; sets?: (Stat | null)[][] };
  setTimes?: number[][]; // when each set was ticked (epoch ms, 0 unknown), same shape as items
};
type ExInfo = Pick<Exercise, 'name' | 'category' | 'mechanic'>;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const kgOf = (p: Person) => (p.weightKg && p.weightKg > 20 ? p.weightKg : 70);
const ageOf = (p: Person) => (p.age && p.age > 5 ? p.age : 30);

// ---------- Formulas ----------

// Gross kcal per minute from heart rate (Keytel 2005). 'other' or unknown sex: the mean of the two equations.
export function keytelKcalPerMin(hr: number, p: Person): number {
  const kg = kgOf(p), age = ageOf(p);
  const m = -55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age;
  const f = -20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age;
  const kj = p.gender === 'male' ? m : p.gender === 'female' ? f : (m + f) / 2;
  return Math.max(0, kj / 4.184);
}

// Resting kcal per minute (Mifflin-St Jeor). Without a height, 1 MET (1 kcal per kg per hour) stands in.
export function restingKcalPerMin(p: Person): number {
  const kg = kgOf(p);
  if (!p.heightCm || p.heightCm < 100) return kg / 60;
  const sex = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  return Math.max(600, 10 * kg + 6.25 * p.heightCm - 5 * ageOf(p) + sex) / 1440;
}

const INHOUSE = ['desk', 'eyes', 'breathing', 'pelvic floor'];
const STRETCH = ['stretching', 'mobility'];
const HEAVY = ['olympic weightlifting', 'strongman', 'powerlifting'];
const CARDIO: [RegExp, number][] = [
  [/rope|sprint/i, 11], [/running|trail/i, 9], [/stair|step mill/i, 9], [/assault|prowler/i, 8.5], [/jog/i, 7], [/row/i, 7], [/skat/i, 7],
  [/ski/i, 6.8], [/incline|hik/i, 6], [/swim/i, 6], [/recumbent/i, 5.5], [/bicycl|bike|cycl/i, 7], [/elliptical/i, 5], [/walk|march/i, 4],
];
const isHold = (n: string) => /plank|hold|wall sit|isometric|dead hang|l-sit|hollow|static/i.test(n) && !/jack|tap|push|walk|jump|up to/i.test(n);

// MET for the whole block of one exercise, rests between its sets included (Compendium codes: 02054 resistance
// training 3.5, 02052 squats / explosive 5.0, 02050 vigorous lifting 6.0, 02030 vigorous calisthenics 8.0, 02101
// stretching 2.3, and the cardio machines and activities by kind).
export function metOf(e: ExInfo | undefined): number {
  if (!e) return 3.5;
  if (INHOUSE.includes(e.category)) return 1.5;
  if (STRETCH.includes(e.category)) return 2.3;
  if (e.category === 'cardio') return CARDIO.find(([re]) => re.test(e.name))?.[1] ?? 7;
  if (e.category === 'plyometrics') return 8;
  if (HEAVY.includes(e.category)) return 6;
  if (isHold(e.name)) return 3;
  return e.mechanic === 'compound' ? 5 : 3.5;
}
const isResistance = (e: ExInfo | undefined) => !e || (e.category !== 'cardio' && e.category !== 'plyometrics');

const secsOf = (target: string): number | null => {
  const m = /^(\d+)(?:-\d+)?\s*(s|sec|min)\b/i.exec(target.trim());
  return m ? Number(m[1]) * (/min/i.test(m[2]) ? 60 : 1) : null;
};

// Minutes one exercise takes when nothing was timed: each done set's work (its seconds when timed, about 3 s a rep
// otherwise) plus the rest after it.
function guessMinutes(it: ItemLike): number {
  const timed = secsOf(it.target) !== null;
  let s = 0;
  for (const x of it.sets) if (x.done) s += (timed ? clamp(x.reps || secsOf(it.target) || 30, 5, 7200) : clamp((x.reps || 8) * 3, 15, 60)) + clamp(it.rest ?? 60, 0, 300);
  return s / 60;
}

// Rounds parts to whole numbers that add up to `total` exactly (largest remainder).
function share(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  const raw = weights.map((w) => (sum > 0 ? (total * w) / sum : total / weights.length));
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
  return out;
}

// ---------- One workout ----------

export function sessionEnergy(s: SessionLike, p: Person, byId: Record<string, ExInfo>, x: EnergyInput = {}): SessionEnergy {
  const kg = kgOf(p);
  const items = s.items;
  const guess = items.map(guessMinutes);
  const guessed = guess.reduce((a, b) => a + b, 0);
  const real = s.endedAt ? (s.endedAt - s.startedAt) / 60000 : 0;
  // The clock is trusted unless it is far from what the sets could take (a workout logged afterwards in two minutes,
  // or one left open all evening).
  const minutes = real >= 1 && (!guessed || (real >= guessed / 4 && real <= guessed * 3 + 10)) ? real : Math.max(1, guessed);

  // Minutes per exercise: from when its sets were ticked when we know (each set owns the time since the set before
  // it), else from the sets themselves; both are scaled to the workout's length.
  let mins = guess;
  const t = x.setTimes;
  if (t && s.endedAt && t.length === items.length) {
    const marks: { i: number; t: number }[] = [];
    let done = 0;
    items.forEach((it, i) => { let j = 0; for (const set of it.sets) { if (!set.done) continue; done++; const at = t[i]?.[j++] ?? 0; if (at > s.startedAt - 3600000 && at <= s.endedAt! + 60000) marks.push({ i, t: at }); } });
    if (marks.length && marks.length >= done * 0.8) {
      marks.sort((a, b) => a.t - b.t);
      const m = items.map(() => 0);
      let from = Math.min(s.startedAt, marks[0].t - 45000);
      for (const mk of marks) { m[mk.i] += Math.max(0, mk.t - from) / 60000; from = mk.t; }
      if (m.reduce((a, b) => a + b, 0) > 0) mins = m;
    }
  }
  const total = mins.reduce((a, b) => a + b, 0);
  mins = mins.map((v) => (total > 0 ? (v * minutes) / total : minutes / Math.max(1, items.length)));

  // Short rests make a circuit: more than three sets every four minutes lifts the strength work towards circuit
  // training (Compendium 02040: 4.3 moderate to 8.0 vigorous).
  const sets = items.reduce((a, it) => a + it.sets.filter((q) => q.done).length, 0);
  const circuit = sets / minutes > 0.75 ? 1.25 : 1;
  const met = items.map((it) => { const e = byId[it.exId]; return isResistance(e) && metOf(e) >= 3 ? Math.min(8, metOf(e) * circuit) : metOf(e); });
  const est = items.map((_, i) => (mins[i] * (met[i] - 1) * kg) / 60);
  const estAll = est.reduce((a, b) => a + b, 0);
  const estR = est.reduce((a, v, i) => a + (isResistance(byId[items[i].exId]) ? v : 0), 0);
  const minR = mins.reduce((a, v, i) => a + (isResistance(byId[items[i].exId]) ? v : 0), 0);

  // Heart rate per exercise from its sets.
  const hrOf = (i: number): Stat | undefined => {
    const row = (x.hr?.sets?.length === items.length ? x.hr.sets[i] : undefined)?.filter((q): q is Stat => !!q && q.avg > 0);
    return row?.length ? { avg: Math.round(row.reduce((a, q) => a + q.avg, 0) / row.length), max: Math.max(...row.map((q) => q.max)) } : undefined;
  };
  const avgHr = x.hr?.avg && x.hr.avg > 30 ? Math.round(x.hr.avg) : undefined;
  const maxHr = x.hr?.max && x.hr.max > 30 ? Math.round(x.hr.max) : undefined;

  const rest = restingKcalPerMin(p) * minutes;
  // A watch that was not worn (or a phone's step calories) reports next to nothing; more than 25 kcal a minute is not
  // a person. Either way the number is not used.
  const plausible = (v: number | undefined) => v !== undefined && v >= Math.max(10, 0.3 * estAll) && v <= 25 * minutes;
  const measured = plausible(x.activeKcal) ? x.activeKcal! : x.totalKcal !== undefined && plausible(x.totalKcal - rest) ? x.totalKcal - rest : undefined;

  let kcal: number, source: EnergySource;
  if (measured !== undefined) { kcal = measured; source = 'watch'; }
  else if (avgHr) {
    const active = Math.max(0, keytelKcalPerMin(avgHr, p) * minutes - rest);
    const r = minutes > 0 ? minR / minutes : 1;
    kcal = Math.max(active * (1 - r), 0.5 * (estAll - estR)) + (estR > 0 ? clamp(active * r, 0.5 * estR, 1.5 * estR) : 0);
    source = 'heart rate';
  } else { kcal = estAll; source = 'estimate'; }
  kcal = Math.max(0, Math.round(kcal));

  // The split: time x intensity, nudged by each exercise's own heart rate against the workout's average.
  const w = items.map((_, i) => { const h = hrOf(i); return Math.max(0.01, mins[i] * Math.max(0.3, met[i] - 1) * (h && avgHr ? clamp(h.avg / avgHr, 0.6, 1.6) : 1)); });
  const parts = share(kcal, w);
  return {
    kcal, source, avgHr, maxHr, minutes: Math.round(minutes),
    perExercise: items.map((it, i) => { const h = hrOf(i); return { exId: it.exId, kcal: parts[i], avgHr: h?.avg, maxHr: h?.max, minutes: Math.round(mins[i] * 10) / 10 }; }),
  };
}

// ---------- One day ----------

export type BurnPart = { id: string; kcal: number; source: EnergySource | 'watch workout' };
export type DayBurn = {
  kcal?: number;
  from: 'day' | 'workouts' | 'none'; // the watch's day total, or the day's workouts added up
  estimated: boolean; // the number shown leans on a heart-rate or MET estimate
  parts: BurnPart[]; // every workout that day, each once
};

// Calories burned on one day, each workout counted once. `watch` holds the watch workouts that are NOT merged into
// one of our sessions; a merged one only counts through its session (whose energy already uses its calories). The
// watch's day total wins when it is at least the workouts' sum, because it already contains them; a smaller day total
// means the watch missed a workout, so the workouts' sum stands instead. The two are never added together.
export function dayBurn(activeKcal: number | undefined, watch: { id: string; kcal?: number }[], sessions: { id: string; kcal: number; source: EnergySource }[]): DayBurn {
  const seen = new Set<string>();
  const parts: BurnPart[] = [];
  for (const q of sessions) if (q.kcal > 0 && !seen.has(q.id)) { seen.add(q.id); parts.push({ id: q.id, kcal: Math.round(q.kcal), source: q.source }); }
  for (const q of watch) if (q.kcal && q.kcal > 0 && !seen.has(q.id)) { seen.add(q.id); parts.push({ id: q.id, kcal: Math.round(q.kcal), source: 'watch workout' }); }
  const sum = parts.reduce((a, q) => a + q.kcal, 0);
  if (activeKcal !== undefined && activeKcal > 0 && activeKcal >= sum) return { kcal: Math.round(activeKcal), from: 'day', estimated: false, parts };
  if (sum > 0) return { kcal: sum, from: 'workouts', estimated: parts.some((q) => q.source === 'heart rate' || q.source === 'estimate'), parts };
  return { kcal: undefined, from: 'none', estimated: false, parts };
}

export const SOURCE_LABEL: Record<EnergySource, string> = { watch: 'Watch', 'heart rate': 'Heart rate', estimate: 'Estimate' };
export const SOURCE_LINE: Record<EnergySource, string> = {
  watch: 'From your watch', 'heart rate': 'Worked out from your heart rate', estimate: 'Estimated from your sets and weight',
};

// ---------- Self-check ----------

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('energy: ' + m); };
export function selfCheck() {
  const ex: Record<string, ExInfo> = {
    squat: { name: 'Barbell Squat', category: 'strength', mechanic: 'compound' }, curl: { name: 'Dumbbell Curl', category: 'strength', mechanic: 'isolation' },
    press: { name: 'Bench Press', category: 'strength', mechanic: 'compound' }, raise: { name: 'Lateral Raise', category: 'strength', mechanic: 'isolation' },
    run: { name: 'Running, Treadmill', category: 'cardio', mechanic: null }, walk: { name: 'Walking, Treadmill', category: 'cardio', mechanic: null },
  };
  const sets = (n: number, reps = 10) => Array.from({ length: n }, () => ({ reps, weight: 40, done: true }));
  const t0 = Date.UTC(2026, 10, 10, 17), MIN = 60000;
  const item = (exId: string, n = 4, target = '8-12', rest = 90, reps = 10): ItemLike => ({ exId, target, rest, sets: sets(n, reps) });
  const gym: SessionLike = { id: 'a', startedAt: t0, endedAt: t0 + 45 * MIN, items: [item('squat'), item('press'), item('curl', 3), item('raise', 3)] };
  const man: Person = { weightKg: 70, age: 30, gender: 'male', heightCm: 178 };

  // Estimate: 70 kg, 45 minutes of mixed strength work.
  const e = sessionEnergy(gym, man, ex);
  assert(e.source === 'estimate' && e.kcal >= 150 && e.kcal <= 350, `45 min strength at 70 kg: ${e.kcal}`);
  assert(e.minutes === 45 && e.perExercise.length === 4, 'minutes and parts');
  assert(e.perExercise.reduce((a, q) => a + q.kcal, 0) === e.kcal, 'parts add up (estimate)');
  assert(e.perExercise[0].kcal > e.perExercise[2].kcal, 'squats cost more than curls');
  assert(Math.abs(e.perExercise.reduce((a, q) => a + q.minutes, 0) - 45) < 0.5, 'exercise minutes add up to the workout');
  assert(sessionEnergy(gym, { ...man, weightKg: 90 }, ex).kcal > e.kcal, 'heavier person burns more');
  assert(sessionEnergy({ ...gym, endedAt: t0 + 60 * MIN }, man, ex).kcal > e.kcal, 'longer workout burns more');
  // Cardio by kind, and a clock that can't be right falls back to the sets.
  const run: SessionLike = { id: 'r', startedAt: t0, endedAt: t0 + 30 * MIN, items: [{ exId: 'run', target: '30 min', rest: 0, sets: [{ reps: 1800, weight: 0, done: true }] }] };
  const walk: SessionLike = { ...run, items: [{ ...run.items[0], exId: 'walk' }] };
  const rk = sessionEnergy(run, man, ex).kcal, wk = sessionEnergy(walk, man, ex).kcal;
  assert(rk > 220 && rk < 400 && wk > 70 && wk < 160 && rk > 2 * wk, `30 min run ${rk}, walk ${wk}`);
  assert(sessionEnergy({ ...gym, endedAt: t0 + MIN }, man, ex).minutes > 20, 'logged in a minute: sets give the time');
  assert(sessionEnergy({ ...gym, endedAt: t0 + 600 * MIN }, man, ex).minutes < 60, 'left open for hours: sets give the time');
  assert(sessionEnergy({ ...gym, items: [] }, man, ex).perExercise.length === 0, 'no exercises');

  // Heart rate: Keytel is monotonic in HR, the published example magnitudes hold, and the session figure never falls
  // as HR rises.
  for (const g of ['male', 'female', 'other'] as const)
    for (let hr = 80; hr < 190; hr += 10) assert(keytelKcalPerMin(hr + 10, { ...man, gender: g }) > keytelKcalPerMin(hr, { ...man, gender: g }), `keytel monotonic ${g} ${hr}`);
  const k150 = keytelKcalPerMin(150, man);
  assert(k150 > 13 && k150 < 15, `keytel male 150 bpm: ${k150}`);
  assert(keytelKcalPerMin(150, { ...man, gender: 'female' }) < k150, 'women lower at the same heart rate');
  let last = 0;
  for (let hr = 70; hr <= 180; hr += 10) {
    const h = sessionEnergy(run, man, ex, { hr: { avg: hr, max: hr + 20 } });
    assert(h.source === 'heart rate' && h.kcal >= last, `session energy non-decreasing in HR at ${hr}`);
    last = h.kcal;
  }
  const lift = sessionEnergy(gym, man, ex, { hr: { avg: 135, max: 170 } });
  assert(lift.source === 'heart rate' && lift.kcal <= 1.5 * e.kcal + 1 && lift.kcal >= 0.5 * e.kcal - 1 && lift.avgHr === 135 && lift.maxHr === 170, `lifting HR held near the estimate: ${lift.kcal}`);

  // Watch: used as is; a watch left in the locker is ignored; total has resting burn taken off.
  const w = sessionEnergy(gym, man, ex, { activeKcal: 287, hr: { avg: 128, max: 162 } });
  assert(w.source === 'watch' && w.kcal === 287 && w.perExercise.reduce((a, q) => a + q.kcal, 0) === 287, 'watch calories, parts add up');
  assert(sessionEnergy(gym, man, ex, { activeKcal: 6 }).source === 'estimate', 'watch not worn');
  assert(sessionEnergy(gym, man, ex, { activeKcal: 6, hr: { avg: 120, max: 150 } }).source === 'heart rate', 'no calories but a strap');
  const tot = sessionEnergy(gym, man, ex, { totalKcal: 340 });
  assert(tot.source === 'watch' && tot.kcal < 340 && tot.kcal > 250, `total minus resting: ${tot.kcal}`);

  // Split by set times and per-exercise heart rate.
  const at = (m: number) => t0 + m * MIN;
  const times = [[3, 6, 9, 12].map(at), [15, 18, 21, 24].map(at), [27, 29, 31].map(at), [40, 42, 44].map(at)];
  const timed = sessionEnergy(gym, man, ex, { activeKcal: 300, setTimes: times });
  assert(Math.abs(timed.perExercise[3].minutes - 13) < 1.5 && Math.abs(timed.perExercise[2].minutes - 7) < 1.5, 'minutes follow the set times');
  assert(timed.perExercise.reduce((a, q) => a + q.kcal, 0) === 300, 'parts add up (timed)');
  const st = (avg: number): Stat => ({ avg, max: avg + 10 });
  const hot = sessionEnergy(gym, man, ex, { activeKcal: 300, hr: { avg: 125, max: 165, sets: [[st(150), st(155), st(150), st(155)], [st(120), null, st(120), st(120)], [st(110), st(110), st(110)], [st(105), st(105), st(105)]] } });
  assert(hot.perExercise[0].avgHr === 153 && hot.perExercise[0].maxHr === 165 && hot.perExercise[1].avgHr === 120, 'per-exercise heart rate');
  assert(hot.perExercise[0].kcal > w.perExercise[0].kcal, 'a harder-working exercise gets a bigger share');
  assert(hot.perExercise.reduce((a, q) => a + q.kcal, 0) === 300, 'parts add up (heart rate)');
  for (const total of [0, 1, 7, 99, 1000]) assert(share(total, [3, 1, 1, 0.2]).reduce((a, b) => a + b, 0) === total, `share ${total}`);

  // The day: no double counting.
  const ours = [{ id: 'a', kcal: 287, source: 'watch' as const }];
  const d1 = dayBurn(640, [{ id: 'w1', kcal: 180 }], ours);
  assert(d1.kcal === 640 && d1.from === 'day' && !d1.estimated && d1.parts.length === 2, 'the watch day total wins and holds its workouts');
  const d2 = dayBurn(undefined, [{ id: 'w1', kcal: 180 }], ours);
  assert(d2.kcal === 467 && d2.from === 'workouts' && !d2.estimated, 'no day total: workouts add up');
  const d3 = dayBurn(undefined, [{ id: 'w1', kcal: 180 }, { id: 'w1', kcal: 180 }, { id: 'a', kcal: 250 }], [...ours, ...ours]);
  assert(d3.kcal === 467, 'the same workout twice counts once, and a watch copy of our session never adds');
  const d4 = dayBurn(120, [], [{ id: 'a', kcal: 230, source: 'estimate' }]);
  assert(d4.kcal === 230 && d4.from === 'workouts' && d4.estimated, 'a day total smaller than the workout: not added on top');
  assert(dayBurn(undefined, [], []).kcal === undefined && dayBurn(0, [{ id: 'x' }], []).from === 'none', 'nothing to show');
  assert(dayBurn(500, [], []).kcal === 500, 'a day without workouts');
}
