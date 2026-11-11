// The person the engine reasons about: everything it knows, worked out once from the profile, the logged sessions and
// (when there is one) the watch. Pure TypeScript: no React, no stores, so Node self-checks can run it.
//
//   body      BMI and weight class from height and weight, age band
//   level     the stated level, moved up one step when the history clearly shows more (never down, never two steps)
//   kit       where they train and with what
//   safety    injuries and concerns, life stage, whether jumping is off the table
//   history   sets per muscle in the last 7 and 14 days, hours since each muscle last worked and how hard,
//             push/pull, upper/lower and front/back balance, what each exercise has done for them
//   readiness the watch score when there is one, else an estimate from yesterday's work, sleep and the mood check-in
//   adherence days trained against days planned over the last four weeks
import { dayKey, e1rm, postpartumWeek, pregnancyWeek } from '../calc';
import { byId, type Place } from '../data/exercises';
import { planById } from '../data/plans';
import { computeReadiness } from '../health/readiness';
import { weightClass, type PlanHistory, type WeightClass } from '../planner';
import type { Mood, Profile, Session } from '../store';
import type { DailyMetrics } from '../tracker';
import { mainMuscle, traitsOf } from './traits';

const HOUR = 3600000, DAY = 24 * HOUR, WEEK = 7 * DAY;

export type RecoInput = {
  profile: Profile;
  sessions?: Session[];
  checkins?: Record<string, Mood>;
  planId?: string; // the plan the person is on; leave out when they have none
  nextDay?: number;
  planStart?: number;
  tracker?: { daily?: Record<string, DailyMetrics>; strapHrv?: Record<string, number> }; // watch data, optional
  now?: number;
};

export type ExerciseHistory = { times: number; lastAt: number; progressed: boolean; stalled: boolean };
export type Lagging = 'push' | 'pull' | 'upper' | 'lower' | 'front' | 'back';
export type History = {
  sessions: number;
  weeks: number; // since the first logged session
  sets: number; // every set ever logged
  lastAt: number | null;
  hoursSinceLast: number | null;
  sets7: Record<string, number>; // per muscle, last 7 days (the main muscle counts 1 per set, helpers 0.5)
  sets14: Record<string, number>;
  lastWorked: Record<string, { at: number; sets: number }>; // per muscle: when, and how many sets in that session
  balance: Record<Lagging, number>; // sets over the last 14 days
  lagging: Lagging[]; // sides clearly behind their opposite
  cardioShare7: number; // share of last week's sets that were cardio
  lastWasCardio: boolean;
  ex: Record<string, ExerciseHistory>;
  plan: PlanHistory;
};
export type Readiness = { score: number; level: 'high' | 'mid' | 'low'; source: 'watch' | 'estimate'; why: string };
export type Adherence = { planned: number; done: number; rate: number | null };

export type Person = {
  input: RecoInput;
  profile: Profile;
  now: number;
  bmi: number;
  weightClass: WeightClass;
  heavy: boolean; // weight class heavy or very heavy, or the person says they carry more weight
  ageBand: 'teen' | 'adult' | 'mid' | 'senior'; // under 18, 18-39, 40-54, 55+
  level: 0 | 1 | 2; // the level the engine works with
  statedLevel: 0 | 1 | 2;
  levelWhy: string | null; // set when history moved the level
  rusty: boolean; // trained before, but nothing in the last four weeks
  place: Place; // where today's session happens
  gear: string[];
  office: boolean;
  noKit: boolean; // home with nothing
  knee: boolean;
  back: boolean;
  lifeStage: 'none' | 'pregnant' | 'after birth' | 'office';
  lowImpact: boolean; // no jumping or running in anything we suggest
  lowImpactWhy: string | null;
  days: number;
  sessionsDone: number;
  history: History;
  readiness: Readiness;
  adherence: Adherence;
};

const has = (p: Profile, c: string) => !!p.concerns?.includes(c as never);
const done = (it: Session['items'][number]) => it.sets.filter((x) => x.done);

function historyOf(sessions: Session[], now: number): History {
  const sorted = [...sessions].filter((s) => s.startedAt <= now).sort((a, b) => a.startedAt - b.startedAt);
  const sets7: Record<string, number> = {}, sets14: Record<string, number> = {};
  const lastWorked: History['lastWorked'] = {};
  const balance: History['balance'] = { push: 0, pull: 0, upper: 0, lower: 0, front: 0, back: 0 };
  const ex: History['ex'] = {};
  const bests: Record<string, number[]> = {};
  const recent: Record<string, number> = {};
  let sets = 0, cardio7 = 0, all7 = 0, lastWasCardio = false;

  for (const s of sorted) {
    const age = now - s.startedAt;
    const here: Record<string, number> = {};
    let cardioSets = 0, total = 0;
    for (const it of s.items) {
      const e = byId[it.exId];
      const ds = done(it);
      if (!e || !ds.length) continue;
      const t = traitsOf(e);
      sets += ds.length; total += ds.length;
      if (t.kind === 'cardio') cardioSets += ds.length;
      const best = Math.max(...ds.map((x) => (x.weight > 0 ? e1rm(x.weight, x.reps) : x.reps)));
      (bests[e.id] ??= []).push(best);
      ex[e.id] = { times: (ex[e.id]?.times ?? 0) + 1, lastAt: s.startedAt, progressed: false, stalled: false };
      if (t.kind !== 'strength' && t.kind !== 'power') continue; // stretches and cardio don't tire a muscle the same way
      const add = (m: string, n: number) => {
        here[m] = (here[m] ?? 0) + n;
        if (age < 7 * DAY) sets7[m] = (sets7[m] ?? 0) + n;
        if (age < 14 * DAY) sets14[m] = (sets14[m] ?? 0) + n;
      };
      add(mainMuscle(e), ds.length);
      for (const m of e.secondary) if (m !== mainMuscle(e)) add(m, ds.length * 0.5);
      if (age < 14 * DAY) {
        if (t.side !== 'none') balance[t.side] += ds.length;
        if (t.region === 'upper' || t.region === 'lower') balance[t.region] += ds.length;
        if (t.face !== 'none') balance[t.face] += ds.length;
      }
    }
    for (const [m, n] of Object.entries(here)) if (n >= 1) lastWorked[m] = { at: s.startedAt, sets: n };
    if (age < 7 * DAY) { cardio7 += cardioSets; all7 += total; }
    if (total) lastWasCardio = cardioSets / total >= 0.5;
    if (age < 6 * WEEK && s.planId) {
      const base = planById[s.planId]?.base ?? s.planId;
      recent[base] = (recent[base] ?? 0) + 1;
    }
  }
  for (const [id, b] of Object.entries(bests)) {
    ex[id].progressed = b.length >= 2 && b[b.length - 1] > b[0] * 1.02;
    ex[id].stalled = b.length >= 4 && Math.max(...b.slice(-3)) <= b[b.length - 4];
  }
  // A side is lagging when there is enough to judge (12 sets across the pair) and it has under 70% of its opposite.
  const lagging: Lagging[] = [];
  const pair = (a: Lagging, b: Lagging) => {
    if (balance[a] + balance[b] < 12) return;
    if (balance[a] < 0.7 * balance[b]) lagging.push(a);
    else if (balance[b] < 0.7 * balance[a]) lagging.push(b);
  };
  pair('push', 'pull'); pair('upper', 'lower'); pair('front', 'back');

  const first = sorted[0]?.startedAt, last = sorted[sorted.length - 1]?.startedAt ?? null;
  const weeks = first ? Math.max(0, (now - first) / WEEK) : 0;
  return {
    sessions: sorted.length, weeks, sets, lastAt: last, hoursSinceLast: last === null ? null : (now - last) / HOUR,
    sets7, sets14, lastWorked, balance, lagging, cardioShare7: all7 ? cardio7 / all7 : 0, lastWasCardio, ex,
    plan: { sessions: sorted.length, weeks, recent },
  };
}

function readinessOf(i: RecoInput, h: History, sessions: Session[], now: number): Readiness {
  const today = dayKey(now);
  const level = (s: number): Readiness['level'] => (s >= 67 ? 'high' : s >= 40 ? 'mid' : 'low');
  const mood = i.checkins?.[today];
  if (i.tracker?.daily) {
    const r = computeReadiness({ daily: i.tracker.daily, strapHrv: i.tracker.strapHrv }, today);
    if (r.score !== null) {
      // The check-in still counts: someone who says they are drained is, whatever the watch thinks.
      const score = Math.max(0, Math.min(100, Math.round(r.score + (mood === 1 ? -20 : mood === 4 ? 5 : 0))));
      const lv = level(score);
      return { score, level: lv, source: 'watch', why: lv === 'high' ? 'Your watch says you are well recovered' : lv === 'low' ? 'Your watch says you are still recovering' : 'Your watch shows a normal day' };
    }
  }
  let score = 70;
  const notes: [number, string][] = [];
  const bump = (n: number, why: string) => { score += n; notes.push([n, why]); };
  const since = (ms: number) => sessions.filter((s) => now - s.startedAt < ms && s.startedAt <= now);
  const setsIn = (list: Session[]) => list.reduce((n, s) => n + s.items.reduce((a, it) => a + done(it).length, 0), 0);
  const y = setsIn(since(30 * HOUR));
  if (y >= 20) bump(-15, 'A big session yesterday');
  else if (y >= 12) bump(-8, 'You trained yesterday');
  const streak = [0, 1, 2, 3, 4, 5].filter((n) => sessions.some((s) => dayKey(s.startedAt) === dayKey(now - (n + 1) * DAY))).length;
  if (streak >= 5) bump(-15, 'Many days in a row without a rest');
  else if (streak >= 3 && [1, 2, 3].every((n) => sessions.some((s) => dayKey(s.startedAt) === dayKey(now - n * DAY)))) bump(-8, 'Three days in a row');
  const sleep = i.tracker?.daily?.[today]?.sleep?.minutes;
  if (sleep !== undefined) {
    if (sleep < 330) bump(-18, 'A short night of sleep');
    else if (sleep < 390) bump(-8, 'A little short on sleep');
    else if (sleep >= 450) bump(6, 'A good night of sleep');
  }
  if (mood === 1) bump(-32, 'You said you feel drained today');
  else if (mood === 2) bump(-8, 'A so-so day by your check-in');
  else if (mood === 4) bump(14, 'You said you feel fired up');
  if (h.hoursSinceLast !== null && h.hoursSinceLast > 60 && h.hoursSinceLast < 10 * 24) bump(6, 'Rested since your last session');
  score = Math.max(0, Math.min(100, Math.round(score)));
  const lv = level(score);
  const want = lv === 'low' ? notes.filter((n) => n[0] < 0).sort((a, b) => a[0] - b[0])[0] : lv === 'high' ? notes.filter((n) => n[0] > 0).sort((a, b) => b[0] - a[0])[0] : undefined;
  return { score, level: lv, source: 'estimate', why: want?.[1] ?? (lv === 'high' ? 'You should be fresh today' : lv === 'low' ? 'Your body needs an easy day' : 'A normal training day') };
}

function adherenceOf(p: Profile, sessions: Session[], now: number): Adherence {
  const first = sessions.reduce((m, s) => Math.min(m, s.startedAt), Infinity);
  const span = Math.min(28 * DAY, now - first);
  if (!Number.isFinite(first) || span < 7 * DAY) return { planned: 0, done: 0, rate: null };
  const days = new Set(sessions.filter((s) => now - s.startedAt <= span && s.startedAt <= now).map((s) => dayKey(s.startedAt))).size;
  const planned = Math.max(1, Math.round((Math.max(1, p.daysPerWeek) * span) / WEEK));
  return { planned, done: days, rate: Math.min(1.5, days / planned) };
}

export function buildPerson(input: RecoInput): Person {
  const p = input.profile;
  const now = input.now ?? Date.now();
  const sessions = input.sessions ?? [];
  const history = historyOf(sessions, now);
  const bmi = p.weightKg / (p.heightCm / 100) ** 2;
  const wc = weightClass(p);
  const heavy = wc === 'heavy' || wc === 'very heavy' || p.body === 'more';
  const stated = p.level === 'advanced' ? 2 : p.level === 'intermediate' ? 1 : 0;
  // History can move the level up one step: a "beginner" with three steady months is not one any more.
  let level = stated as 0 | 1 | 2, levelWhy: string | null = null;
  if (stated === 0 && history.sessions >= 30 && history.weeks >= 12) { level = 1; levelWhy = `You have trained for ${Math.round(history.weeks)} weeks now`; }
  else if (stated === 1 && history.sessions >= 150 && history.weeks >= 78) { level = 2; levelWhy = 'You have trained steadily for well over a year'; }
  const rusty = history.sessions > 0 && history.hoursSinceLast !== null && history.hoursSinceLast > 28 * 24;

  const pw = pregnancyWeek(p, dayKey(now)), pp = postpartumWeek(p, dayKey(now));
  const lifeStage: Person['lifeStage'] = pw !== null ? 'pregnant' : pp !== null && pp < 12 ? 'after birth' : p.place === 'office' ? 'office' : 'none';
  const knee = has(p, 'knee'), back = has(p, 'back');
  const lowImpactWhy =
    pw !== null ? 'No jumping during pregnancy'
    : pp !== null && pp < 12 ? 'No jumping in the first weeks after birth'
    : knee ? 'No jumping, to look after your knee'
    : heavy || p.body === 'extra' ? 'No jumping, easy on your joints'
    : p.age >= 65 || (p.age >= 55 && level < 2) ? 'Low impact, easy on your joints'
    : has(p, 'injury') ? 'Low impact while you come back from injury'
    : null;
  const place: Place = p.place === 'home' || p.place === 'office' ? 'home' : 'gym';
  const gear = p.gear ?? [];
  return {
    input, profile: p, now, bmi, weightClass: wc, heavy,
    ageBand: p.age < 18 ? 'teen' : p.age < 40 ? 'adult' : p.age < 55 ? 'mid' : 'senior',
    level, statedLevel: stated as 0 | 1 | 2, levelWhy, rusty,
    place, gear, office: p.place === 'office', noKit: place === 'home' && gear.length === 0,
    knee, back, lifeStage, lowImpact: lowImpactWhy !== null, lowImpactWhy,
    days: Math.min(7, Math.max(1, Math.round(p.daysPerWeek || 3))),
    sessionsDone: sessions.length,
    history, readiness: readinessOf(input, history, sessions, now), adherence: adherenceOf(p, sessions, now),
  };
}

// --- recovery: the 48-72 hour rule, scaled ---
// A muscle needs about 48 hours after a normal session. Fewer sets need less (2 sets: about a day), a big session
// more (15+ sets: about 72 hours). Beginners and people over 55 take longer, advanced lifters a little less, small
// muscles (calves, forearms, core) bounce back faster, and a low-readiness day stretches everything.
const QUICK = ['calves', 'forearms', 'abdominals', 'neck', 'abductors', 'adductors'];
export type Recovery = { pct: number; hoursLeft: number; hoursSince: number | null; sets: number };
export function recovery(person: Person, muscle: string): Recovery {
  const w = person.history.lastWorked[muscle];
  if (!w) return { pct: 1, hoursLeft: 0, hoursSince: null, sets: 0 };
  const volume = w.sets <= 2 ? 0.5 : w.sets <= 5 ? 0.85 : w.sets <= 9 ? 1 : w.sets <= 14 ? 1.25 : 1.5;
  const need = 48 * volume * [1.15, 1, 0.9][person.level] * (person.ageBand === 'senior' ? 1.15 : 1) * (QUICK.includes(muscle) ? 0.75 : 1)
    * (person.readiness.level === 'low' ? 1.1 : 1);
  const hours = (person.now - w.at) / HOUR;
  return { pct: Math.max(0, Math.min(1, hours / need)), hoursLeft: Math.max(0, Math.round(need - hours)), hoursSince: hours, sets: w.sets };
}
export const FRESH = 0.85; // a muscle at 85% or more of its recovery time can be a session's focus

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('reco model: ' + m); };
export function selfCheck() {
  const base = { name: 'T', gender: 'male', age: 30, heightCm: 175, weightKg: 75, goalWeightKg: 75, goal: 'build muscle', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } } as unknown as Profile;
  const now = Date.parse('2026-11-11T18:00:00');
  const set = { reps: 10, weight: 40, done: true };
  const ses = (hoursAgo: number, ids: string[], n = 3, weight = 40): Session => ({ id: `s${hoursAgo}`, title: 'x', place: 'gym', startedAt: now - hoursAgo * HOUR, endedAt: now - hoursAgo * HOUR + 2400000,
    items: ids.map((exId) => ({ exId, target: '10', rest: 60, sets: Array.from({ length: n }, () => ({ ...set, weight })) })) });
  const fresh = buildPerson({ profile: base, now });
  assert(fresh.weightClass === 'healthy' && fresh.level === 0 && !fresh.lowImpact && fresh.readiness.level === 'high' && fresh.adherence.rate === null, 'a new person');
  assert(buildPerson({ profile: { ...base, weightKg: 100 }, now }).heavy && buildPerson({ profile: { ...base, weightKg: 100 }, now }).lowImpact, '100 kg at 175 cm is heavy and low impact');
  assert(!buildPerson({ profile: { ...base, weightKg: 95, body: 'muscular' }, now }).heavy, 'a muscular body is not treated as heavy');
  assert(buildPerson({ profile: { ...base, weightKg: 52 }, now }).weightClass === 'under', 'under the healthy band');
  assert(buildPerson({ profile: { ...base, age: 60 }, now }).lowImpact && buildPerson({ profile: { ...base, age: 60 }, now }).ageBand === 'senior', '55+ is low impact');
  // Chest hard yesterday: not recovered. Legs four days ago: recovered.
  const p = buildPerson({ profile: base, now, sessions: [ses(96, ['Barbell_Squat', 'Leg_Press']), ses(20, ['Dumbbell_Bench_Press', 'Incline_Dumbbell_Press', 'Pushups'])] });
  assert(recovery(p, 'chest').pct < 0.6 && recovery(p, 'quadriceps').pct === 1 && recovery(p, 'lats').pct === 1, 'recovery follows the last session');
  assert(p.history.sets7.chest === 9 && p.history.sets7.triceps > 0 && p.history.sessions === 2, 'sets per muscle');
  assert(recovery(buildPerson({ profile: base, now, sessions: [ses(20, ['Dumbbell_Bench_Press'], 2)] }), 'chest').pct > recovery(p, 'chest').pct, 'fewer sets recover faster');
  // Lots of pushing, no pulling: pull is lagging.
  const pushy = buildPerson({ profile: base, now, sessions: [ses(100, ['Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press', 'Pushups']), ses(52, ['Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press', 'Seated_Cable_Rows'])] });
  assert(pushy.history.lagging.includes('pull') && pushy.history.lagging.includes('lower'), 'balance spots what is behind');
  // Progress on an exercise, and a level moved up by history.
  const many = Array.from({ length: 36 }, (_, k) => ses((36 - k) * 56, ['Goblet_Squat'], 3, 20 + k));
  const grown = buildPerson({ profile: base, now, sessions: many });
  assert(grown.history.ex.Goblet_Squat.progressed && grown.level === 1 && grown.statedLevel === 0 && !!grown.levelWhy, 'history moves a beginner up one step');
  assert(grown.adherence.rate !== null && grown.adherence.done > 0, 'adherence');
  // Readiness: the check-in and a heavy day pull it down.
  const today = dayKey(now);
  assert(buildPerson({ profile: base, now, checkins: { [today]: 1 } }).readiness.level === 'low', 'drained is low');
  assert(buildPerson({ profile: base, now, checkins: { [today]: 4 } }).readiness.score > fresh.readiness.score, 'fired up is higher');
  const tired = buildPerson({ profile: base, now, sessions: [ses(20, ['Barbell_Squat', 'Leg_Press', 'Dumbbell_Bench_Press', 'Seated_Cable_Rows', 'Plank'], 4)], tracker: { daily: { [today]: { date: today, sleep: { start: '', end: '', minutes: 300 } } } } });
  assert(tired.readiness.score < fresh.readiness.score && tired.readiness.source === 'estimate' && tired.readiness.why.length > 0, 'a hard day and a short night lower readiness');
  assert(buildPerson({ profile: base, now, sessions: [ses(40 * 24, ['Goblet_Squat'])] }).rusty, 'a long gap is noticed');
}
