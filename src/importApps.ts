// History import from other workout apps' CSV exports (Strong, Hevy, FitNotes) and our own "Export sets (CSV)".
// Pure: no React Native imports, so `scripts/selfcheck.mjs` runs it under plain Node.
//
// Formats, from each app's export (columns are found by name, so order and extra columns do not matter):
// - Strong: Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes,
//   Workout Notes, RPE. Comma or semicolon separated; newer exports may write "Weight (kg)" / "Duration (sec)" style
//   headers or a "Weight Unit" column, which are read too. Set Order "W" is a warm-up; "Rest Timer" rows are not sets.
// - Hevy: title, start_time, end_time, description, exercise_title, superset_id, exercise_notes, set_index, set_type,
//   weight_kg or weight_lbs, reps, distance_km or distance_miles, duration_seconds, rpe. Times are local wall time.
// - FitNotes: Date (YYYY-MM-DD), Exercise, Category, Weight (kgs) or Weight (lbs), Reps, Distance, Distance Unit,
//   Time, Comment. No time of day or duration.
// - Ours: Workout start, Workout end, Workout, Exercise, Exercise id, Target, Set, Weight (kg), Reps.
import { dayKey } from './calc';
import { byId, exercises } from './data/exercises';
import type { Item, Session } from './store';

export type AppId = 'strong' | 'hevy' | 'fitnotes' | 'gymbuddy';
export const APP_NAME: Record<AppId, string> = { strong: 'Strong', hevy: 'Hevy', fitnotes: 'FitNotes', gymbuddy: 'gym buddy' };

export type RawSet = { reps: number; kg: number; secs: number };
export type RawExercise = { name: string; exId?: string; sets: RawSet[] };
export type RawWorkout = { start: number; end?: number; title: string; exercises: RawExercise[] };
export type AppParse = { app: AppId; workouts: RawWorkout[]; warmups: number };

// Ready to write: sessions for days that have no workout yet, plus what was left out.
export type AppPlan = {
  app: AppId;
  sessions: Session[];
  skippedDays: number; // workouts on days that already have one
  unknown: string[]; // exercise names with no match in our library (their sets are skipped)
  emptyWorkouts: number; // workouts left with no sets we could match
};

const LB = 0.45359237;
const MIN = 60000;

// ---------- CSV ----------

// RFC 4180-ish: quoted fields, doubled quotes, CRLF. The delimiter is picked from the header line.
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, Math.max(0, text.indexOf('\n')) || text.length);
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---------- detection ----------

const head = (h: string[]) => h.map((x) => x.trim().toLowerCase());
const hasAll = (h: string[], ...names: string[]) => names.every((n) => h.some((x) => x === n || x.startsWith(n + ' (')));

export function detectApp(text: string): AppId | null {
  const h = head(parseCsv(text.slice(0, 2000))[0] ?? []);
  if (hasAll(h, 'workout start', 'exercise id', 'exercise', 'reps')) return 'gymbuddy';
  if (hasAll(h, 'exercise_title', 'start_time', 'set_index')) return 'hevy';
  if (hasAll(h, 'exercise name', 'set order', 'date')) return 'strong';
  if (hasAll(h, 'date', 'exercise', 'category', 'reps') && h.some((x) => x.startsWith('weight'))) return 'fitnotes';
  return null;
}

// ---------- values ----------

const MON: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const h24 = (h: number, ap?: string) => (!ap ? h : ap.toLowerCase() === 'pm' ? (h % 12) + 12 : h % 12);

// Dates as the apps write them, read as local time unless a zone is given.
export function parseWhen(s: string): number | null {
  s = (s ?? '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0).getTime();
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const t = Date.parse(s); return isNaN(t) ? null : t; }
  m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]*\.? (\d{4}),? (\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(s); // Hevy: 15 Jan 2024, 18:05
  if (m && MON[m[2].toLowerCase()] !== undefined) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1], h24(+m[4], m[6]), +m[5]).getTime();
  m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(s); // Jan 15, 2024, 6:05 PM
  if (m && MON[m[1].toLowerCase()] !== undefined) return new Date(+m[3], MON[m[1].toLowerCase()], +m[2], h24(+m[4], m[6]), +m[5]).getTime();
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}

// "1h 5m", "45m", "50s", "1:05:00", "05:30" or plain seconds.
export function parseDuration(s: string): number {
  s = (s ?? '').trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(+s);
  const c = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (c) return c[3] !== undefined ? +c[1] * 3600 + +c[2] * 60 + +c[3] : +c[1] * 60 + +c[2];
  let n = 0;
  for (const [, v, u] of s.matchAll(/(\d+(?:\.\d+)?)\s*(h|m|s)/gi)) n += +v * (u.toLowerCase() === 'h' ? 3600 : u.toLowerCase() === 'm' ? 60 : 1);
  return Math.round(n);
}

const num = (s: string | undefined) => {
  const t = (s ?? '').trim().replace(',', '.');
  const v = parseFloat(t);
  return isFinite(v) ? v : 0;
};
const kg1 = (v: number, lbs: boolean) => Math.round((lbs ? v * LB : v) * 10) / 10;

// ---------- exercise names ----------

// Lowercase words, equipment in brackets moved to the front ("Bench Press (Barbell)" -> "barbell bench press"),
// plurals and spelling variants folded.
const WORD: Record<string, string> = {
  db: 'dumbbell', dumbbells: 'dumbbell', bb: 'barbell', kb: 'kettlebell', kettlebells: 'kettlebell', ez: 'ez', e: 'e',
  flye: 'fly', flie: 'fly', triceps: 'tricep', biceps: 'bicep', skullcrusher: 'skullcrusher', ohp: 'overhead press',
  pullup: 'pull up', pullups: 'pull up', chinup: 'chin up', chinups: 'chin up', pushup: 'push up', pushups: 'push up',
  situp: 'sit up', situps: 'sit up', pulldown: 'pulldown', pushdown: 'pushdown', standing: 'standing',
};
const singular = (w: string) =>
  w.length <= 3 || /ss$|us$|is$/.test(w) ? w : /ches$|shes$/.test(w) ? w.slice(0, -2) : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /s$/.test(w) ? w.slice(0, -1) : w;

export function normName(name: string): string {
  let s = name.toLowerCase().trim();
  const br = /\(([^)]*)\)/.exec(s);
  if (br) s = `${br[1]} ${s.replace(br[0], ' ')}`;
  s = s.replace(/e-z|ez-bar|ez bar/g, 'ez').replace(/[-_/]/g, ' ').replace(/[^a-z0-9 ]/g, ' ');
  s = s.replace(/\b(pull|chin|push|sit) ups?\b/g, '$1up');
  return s.split(/\s+/).filter(Boolean).map((w) => WORD[singular(w)] ?? WORD[w] ?? singular(w)).join(' ').replace(/\s+/g, ' ').trim();
}

// Common names in the three apps that our library spells differently. Keys are run through normName.
const ALIAS: Record<string, string> = {
  'Bench Press (Barbell)': 'Barbell_Bench_Press_-_Medium_Grip',
  'Flat Barbell Bench Press': 'Barbell_Bench_Press_-_Medium_Grip',
  'Bench Press': 'Barbell_Bench_Press_-_Medium_Grip',
  'Incline Bench Press (Barbell)': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Incline Barbell Bench Press': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Decline Bench Press (Barbell)': 'Decline_Barbell_Bench_Press',
  'Close Grip Bench Press': 'Close-Grip_Barbell_Bench_Press',
  'Bench Press (Dumbbell)': 'Dumbbell_Bench_Press',
  'Flat Dumbbell Bench Press': 'Dumbbell_Bench_Press',
  'Incline Bench Press (Dumbbell)': 'Incline_Dumbbell_Press',
  'Incline Dumbbell Bench Press': 'Incline_Dumbbell_Press',
  'Squat (Barbell)': 'Barbell_Squat',
  'Back Squat': 'Barbell_Squat',
  'Squat': 'Barbell_Squat',
  'Front Squat (Barbell)': 'Front_Barbell_Squat',
  'Front Squat': 'Front_Barbell_Squat',
  'Goblet Squat (Kettlebell)': 'Goblet_Squat',
  'Goblet Squat (Dumbbell)': 'Goblet_Squat',
  'Squat (Bodyweight)': 'Bodyweight_Squat',
  'Air Squat': 'Bodyweight_Squat',
  'Squat (Smith Machine)': 'Smith_Machine_Squat',
  'Hack Squat': 'Hack_Squat',
  'Deadlift (Barbell)': 'Barbell_Deadlift',
  'Deadlift': 'Barbell_Deadlift',
  'Conventional Deadlift': 'Barbell_Deadlift',
  'Sumo Deadlift (Barbell)': 'Sumo_Deadlift',
  'Romanian Deadlift (Barbell)': 'Romanian_Deadlift',
  'Romanian Deadlift': 'Romanian_Deadlift',
  'Overhead Press (Barbell)': 'Standing_Military_Press',
  'Overhead Press': 'Standing_Military_Press',
  'Military Press': 'Standing_Military_Press',
  'Shoulder Press (Barbell)': 'Barbell_Shoulder_Press',
  'Shoulder Press (Dumbbell)': 'Dumbbell_Shoulder_Press',
  'Overhead Press (Dumbbell)': 'Dumbbell_Shoulder_Press',
  'Seated Dumbbell Press': 'Dumbbell_Shoulder_Press',
  'Arnold Press (Dumbbell)': 'Arnold_Dumbbell_Press',
  'Bent Over Row (Barbell)': 'Bent_Over_Barbell_Row',
  'Barbell Row': 'Bent_Over_Barbell_Row',
  'Bent Over Row (Dumbbell)': 'One-Arm_Dumbbell_Row',
  'Dumbbell Row': 'One-Arm_Dumbbell_Row',
  'One Arm Dumbbell Row': 'One-Arm_Dumbbell_Row',
  'T Bar Row': 'T-Bar_Row_with_Handle',
  'Upright Row (Barbell)': 'Upright_Barbell_Row',
  'Pull Up': 'Pullups',
  'Chin Up': 'Chin-Up',
  'Lat Pulldown (Cable)': 'Wide-Grip_Lat_Pulldown',
  'Lat Pulldown': 'Wide-Grip_Lat_Pulldown',
  'Seated Row (Cable)': 'Seated_Cable_Rows',
  'Seated Cable Row': 'Seated_Cable_Rows',
  'Bicep Curl (Barbell)': 'Barbell_Curl',
  'Barbell Curl': 'Barbell_Curl',
  'Bicep Curl (Dumbbell)': 'Dumbbell_Bicep_Curl',
  'Dumbbell Curl': 'Dumbbell_Bicep_Curl',
  'Hammer Curl (Dumbbell)': 'Hammer_Curls',
  'Hammer Curl': 'Hammer_Curls',
  'Preacher Curl (Barbell)': 'Preacher_Curl',
  'Triceps Pushdown (Cable)': 'Triceps_Pushdown',
  'Triceps Pushdown': 'Triceps_Pushdown',
  'Cable Tricep Pushdown': 'Triceps_Pushdown',
  'Skullcrusher (Barbell)': 'EZ-Bar_Skullcrusher',
  'Skullcrusher': 'EZ-Bar_Skullcrusher',
  'Lying Triceps Extension': 'EZ-Bar_Skullcrusher',
  'Lateral Raise (Dumbbell)': 'Side_Lateral_Raise',
  'Lateral Raise': 'Side_Lateral_Raise',
  'Front Raise (Dumbbell)': 'Front_Dumbbell_Raise',
  'Reverse Fly (Dumbbell)': 'Reverse_Flyes',
  'Face Pull (Cable)': 'Face_Pull',
  'Shrug (Barbell)': 'Barbell_Shrug',
  'Shrug (Dumbbell)': 'Dumbbell_Shrug',
  'Chest Fly (Dumbbell)': 'Dumbbell_Flyes',
  'Dumbbell Fly': 'Dumbbell_Flyes',
  'Cable Crossover': 'Cable_Crossover',
  'Chest Fly (Cable)': 'Cable_Crossover',
  'Leg Press': 'Leg_Press',
  'Leg Press (Machine)': 'Leg_Press',
  'Leg Extension (Machine)': 'Leg_Extensions',
  'Leg Extension': 'Leg_Extensions',
  'Lying Leg Curl (Machine)': 'Lying_Leg_Curls',
  'Lying Leg Curl': 'Lying_Leg_Curls',
  'Leg Curl': 'Lying_Leg_Curls',
  'Seated Leg Curl (Machine)': 'Seated_Leg_Curl',
  'Seated Leg Curl': 'Seated_Leg_Curl',
  'Standing Calf Raise (Machine)': 'Standing_Calf_Raises',
  'Standing Calf Raise': 'Standing_Calf_Raises',
  'Calf Raise': 'Standing_Calf_Raises',
  'Seated Calf Raise (Machine)': 'Seated_Calf_Raise',
  'Seated Calf Raise': 'Seated_Calf_Raise',
  'Hip Thrust (Barbell)': 'Barbell_Hip_Thrust',
  'Hip Thrust': 'Barbell_Hip_Thrust',
  'Lunge (Dumbbell)': 'Dumbbell_Lunges',
  'Dumbbell Lunge': 'Dumbbell_Lunges',
  'Lunge (Barbell)': 'Barbell_Lunge',
  'Walking Lunge': 'Bodyweight_Walking_Lunge',
  'Good Morning (Barbell)': 'Good_Morning',
  'Push Up': 'Pushups',
  'Dip': 'Dips_-_Triceps_Version',
  'Triceps Dip': 'Dips_-_Triceps_Version',
  'Chest Dip': 'Dips_-_Chest_Version',
  'Plank': 'Plank',
  'Crunch': 'Crunches',
  'Cable Crunch': 'Cable_Crunch',
  'Russian Twist': 'Russian_Twist',
  'Hanging Leg Raise': 'Hanging_Leg_Raise',
  'Back Extension': 'Hyperextensions_Back_Extensions',
  'Hyperextension': 'Hyperextensions_Back_Extensions',
  'Kettlebell Swing': 'One-Arm_Kettlebell_Swings',
};

const DROP = new Set(['machine', 'bodyweight', 'body', 'only', 'lever', 'plate', 'loaded', 'weighted']);
let index: Map<string, string> | null = null;
function lookup(): Map<string, string> {
  if (index) return index;
  const m = new Map<string, string>();
  const put = (k: string, id: string) => { if (k && !m.has(k)) m.set(k, id); };
  for (const [k, id] of Object.entries(ALIAS)) if (byId[id]) put(normName(k), id);
  for (const e of exercises) put(normName(e.name), e.id);
  for (const e of exercises) put(normName(e.name.replace(/\s+-\s+.*$/, '')), e.id); // "Barbell Bench Press - Medium Grip"
  for (const e of exercises) put('~' + normName(e.name).split(' ').sort().join(' '), e.id);
  return (index = m);
}

// Our library id for an exercise name, or undefined when there is no confident match.
export function matchExercise(name: string): string | undefined {
  const m = lookup();
  const n = normName(name);
  if (!n) return undefined;
  const words = n.split(' ');
  const lean = words.filter((w) => !DROP.has(w)).join(' ');
  return m.get(n) ?? m.get('~' + [...words].sort().join(' ')) ?? (lean && lean !== n ? m.get(lean) ?? m.get('~' + lean.split(' ').sort().join(' ')) : undefined);
}

// ---------- parsing ----------

type Row = (name: string) => string;
function table(text: string): { rows: Row[]; has: (n: string) => boolean; header: string[] } {
  const all = parseCsv(text);
  const h = head(all[0] ?? []);
  const col = (n: string) => { const i = h.indexOf(n); return i >= 0 ? i : h.findIndex((x) => x.startsWith(n + ' (') || x.startsWith(n + '(')); };
  const cache = new Map<string, number>();
  const at = (n: string) => { if (!cache.has(n)) cache.set(n, col(n)); return cache.get(n)!; };
  return {
    header: h,
    has: (n) => at(n) >= 0,
    rows: all.slice(1).map((r) => (n: string) => { const i = at(n); return i >= 0 ? (r[i] ?? '').trim() : ''; }),
  };
}

// Adds a set to the workout under its exercise (one entry per exercise name, in the order first seen).
function addSet(w: RawWorkout, name: string, set: RawSet) {
  let e = w.exercises.find((x) => x.name === name);
  if (!e) w.exercises.push((e = { name, sets: [] }));
  e.sets.push(set);
}

export function parseAppCsv(text: string): AppParse | null {
  const app = detectApp(text);
  if (!app) return null;
  const t = table(text);
  const lbsIn = (unitCol: string, r: Row) => /lb/i.test(r(unitCol)) || t.header.some((x) => x.startsWith('weight') && /lb/.test(x));
  const byKey = new Map<string, RawWorkout>();
  let warmups = 0;
  const workout = (key: string, make: () => RawWorkout | null) => {
    let w = byKey.get(key);
    if (!w) { const n = make(); if (!n) return null; byKey.set(key, (w = n)); }
    return w;
  };

  for (const r of t.rows) {
    if (app === 'strong') {
      const order = r('set order');
      if (/rest/i.test(order)) continue;
      if (/^w/i.test(order)) { warmups++; continue; }
      const date = r('date'), title = r('workout name') || 'Workout';
      const w = workout(`${r('workout #')}|${date}|${title}`, () => {
        const start = parseWhen(date);
        if (start === null) return null;
        const d = parseDuration(r('duration'));
        return { start, end: d ? start + d * 1000 : undefined, title, exercises: [] };
      });
      const name = r('exercise name');
      if (w && name) addSet(w, name, { reps: Math.round(num(r('reps'))), kg: kg1(num(r('weight')), lbsIn('weight unit', r)), secs: Math.round(num(r('seconds'))) });
    } else if (app === 'hevy') {
      if (/warm/i.test(r('set_type'))) { warmups++; continue; }
      const title = r('title') || 'Workout';
      const w = workout(`${title}|${r('start_time')}`, () => {
        const start = parseWhen(r('start_time'));
        if (start === null) return null;
        const end = parseWhen(r('end_time'));
        return { start, end: end !== null && end > start ? end : undefined, title, exercises: [] };
      });
      const lbs = !t.has('weight_kg') && t.has('weight_lbs');
      const name = r('exercise_title');
      if (w && name) addSet(w, name, { reps: Math.round(num(r('reps'))), kg: kg1(num(lbs ? r('weight_lbs') : r('weight_kg')), lbs), secs: Math.round(num(r('duration_seconds'))) });
    } else if (app === 'fitnotes') {
      const date = r('date');
      const w = workout(date, () => {
        const start = parseWhen(date); // date only: placed at noon
        return start === null ? null : { start, title: '', exercises: [] };
      });
      const name = r('exercise');
      if (!w || !name) continue;
      const cat = r('category');
      if (cat && !w.title.split(' and ').includes(cat)) w.title = w.title ? (w.title.split(' and ').length < 2 ? `${w.title} and ${cat}` : w.title) : cat;
      addSet(w, name, { reps: Math.round(num(r('reps'))), kg: kg1(num(r('weight')), lbsIn('weight unit', r)), secs: parseDuration(r('time')) });
    } else {
      const title = r('workout') || 'Workout';
      const w = workout(`${r('workout start')}|${title}`, () => {
        const start = parseWhen(r('workout start'));
        if (start === null) return null;
        const end = parseWhen(r('workout end'));
        return { start, end: end ?? undefined, title, exercises: [] };
      });
      const name = r('exercise');
      if (!w || !name) continue;
      const id = r('exercise id');
      const secs = /^\d+s$/.test(r('target')) ? Math.round(num(r('reps'))) : 0;
      addSet(w, name, { reps: secs ? 0 : Math.round(num(r('reps'))), kg: num(r('weight')), secs });
      const e = w.exercises.find((x) => x.name === name)!;
      if (id && byId[id]) e.exId = id;
    }
  }
  for (const w of byKey.values()) if (!w.title) w.title = 'Workout';
  const workouts = [...byKey.values()].sort((a, b) => a.start - b.start);
  return { app, workouts, warmups };
}

// Turns parsed workouts into sessions, leaving out days that already have a workout and exercises we can't match.
// Only sets with reps, weight or seconds count; distance-only cardio rows are left out.
export function planImport(p: AppParse, existing: { startedAt: number }[]): AppPlan {
  const taken = new Set(existing.map((s) => dayKey(s.startedAt)));
  const unknown = new Set<string>();
  const sessions: Session[] = [];
  let skippedDays = 0, emptyWorkouts = 0;
  for (const w of p.workouts) {
    if (taken.has(dayKey(w.start))) { skippedDays++; continue; }
    const items: Item[] = [];
    for (const e of w.exercises) {
      const exId = e.exId ?? matchExercise(e.name);
      if (!exId) { unknown.add(e.name); continue; }
      const timed = !!byId[exId].timed || e.sets.every((x) => !x.reps && x.secs > 0);
      const sets = e.sets
        .map((x) => ({ reps: timed ? x.secs || x.reps : x.reps, weight: x.kg, done: true }))
        .filter((x) => x.reps > 0 || x.weight > 0);
      if (!sets.length) continue;
      const target = timed ? `${mode(sets.map((x) => x.reps))}s` : String(mode(sets.map((x) => x.reps)) || 10);
      const prev = items.find((x) => x.exId === exId);
      if (prev) prev.sets.push(...sets);
      else items.push({ exId, target, rest: byId[exId].timed?.rest ?? 90, sets });
    }
    if (!items.length) { emptyWorkouts++; continue; }
    const n = items.reduce((a, it) => a + it.sets.length, 0);
    // FitNotes and some Strong rows carry no duration: about 3 minutes a set, at least 20.
    const end = w.end && w.end > w.start ? w.end : w.start + Math.max(20, n * 3) * MIN;
    sessions.push({ id: `${p.app}-${w.start.toString(36)}-${sessions.length}`, title: w.title, place: 'gym', startedAt: w.start, endedAt: end, items, source: p.app });
  }
  return { app: p.app, sessions, skippedDays, unknown: [...unknown].sort(), emptyWorkouts };
}

const mode = (xs: number[]) => {
  const c = new Map<number, number>();
  let best = 0, top = 0;
  for (const x of xs) { const k = (c.get(x) ?? 0) + 1; c.set(x, k); if (k > top) { top = k; best = x; } }
  return best;
};

// One short line for the summary sheet: "42 workouts, 3 unknown exercises".
export function planLine(p: AppPlan): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const bits = [part(p.sessions.length, 'workout', 'workouts')];
  if (p.unknown.length) bits.push(part(p.unknown.length, 'unknown exercise', 'unknown exercises'));
  if (p.skippedDays) bits.push(part(p.skippedDays, 'day already logged', 'days already logged'));
  return bits.join(', ');
}

// ---------- export ----------

const local = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dayKey(d)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const EXPORT_HEADER = ['Workout start', 'Workout end', 'Workout', 'Exercise', 'Exercise id', 'Target', 'Set', 'Weight (kg)', 'Reps'];

// Every logged set, one row each. Our own importer reads it back (see detectApp), and spreadsheets open it.
export function setsCsv(sessions: Session[]): string {
  const lines = [EXPORT_HEADER.join(',')];
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt))
    for (const it of s.items) {
      let n = 0;
      for (const x of it.sets) if (x.done)
        lines.push([local(s.startedAt), s.endedAt ? local(s.endedAt) : '', s.title, byId[it.exId]?.name ?? it.exId, it.exId, it.target, ++n, x.weight, x.reps].map(esc).join(','));
    }
  return lines.join('\n') + '\n';
}

// ---------- self-check ----------

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('importApps: ' + m); };
export function selfCheck() {
  // Names
  assert(matchExercise('Bench Press (Barbell)') === 'Barbell_Bench_Press_-_Medium_Grip', 'alias bench');
  assert(matchExercise('Squat (Barbell)') === 'Barbell_Squat', 'squat');
  assert(matchExercise('Pull Up') === 'Pullups' && matchExercise('Pull-ups') === 'Pullups', 'pull up');
  assert(matchExercise('Bicep Curl (Dumbbell)') === 'Dumbbell_Bicep_Curl', 'curl from brackets');
  assert(matchExercise('Barbell Curls') === 'Barbell_Curl', 'plural');
  assert(matchExercise('Lat Pulldown (Cable)') === 'Wide-Grip_Lat_Pulldown', 'lat pulldown');
  assert(matchExercise('Leg Press (Machine)') === 'Leg_Press', 'machine dropped');
  assert(matchExercise('Plank') === 'Plank' && matchExercise('Face Pull (Cable)') === 'Face_Pull', 'plank, face pull');
  assert(matchExercise('Zercher Yoga Teleport') === undefined && matchExercise('') === undefined, 'no false match');
  for (const id of Object.values(ALIAS)) assert(!!byId[id], 'alias id exists: ' + id);

  // Dates and durations
  const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo, d, h, mi).getTime();
  assert(parseWhen('2024-01-15 08:30:00') === at(2024, 0, 15, 8, 30), 'strong date');
  assert(parseWhen('15 Jan 2024, 18:05') === at(2024, 0, 15, 18, 5), 'hevy date');
  assert(parseWhen('Jan 15, 2024, 6:05 PM') === at(2024, 0, 15, 18, 5), 'us date');
  assert(parseWhen('2024-01-15') === at(2024, 0, 15, 12, 0), 'date only at noon');
  assert(parseDuration('1h 5m') === 3900 && parseDuration('45m') === 2700 && parseDuration('0:01:30') === 90 && parseDuration('3600') === 3600, 'durations');

  // Strong: comma separated, warm-up and rest-timer rows, an unknown exercise, a quoted note with a comma.
  const strong = [
    'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
    '2024-01-15 08:30:00,Push day,1h 5m,Bench Press (Barbell),W,40,10,0,0,,,',
    '2024-01-15 08:30:00,Push day,1h 5m,Bench Press (Barbell),1,60,8,0,0,"felt good, easy",,8',
    '2024-01-15 08:30:00,Push day,1h 5m,Bench Press (Barbell),2,60,8,0,0,,,',
    '2024-01-15 08:30:00,Push day,1h 5m,Bench Press (Barbell),Rest Timer,0,0,0,90,,,',
    '2024-01-15 08:30:00,Push day,1h 5m,Plank,1,0,0,0,60,,,',
    '2024-01-15 08:30:00,Push day,1h 5m,Zercher Yoga Teleport,1,10,10,0,0,,,',
    '2024-01-17 18:00:00,Legs,50m,Squat (Barbell),1,100,5,0,0,,,',
  ].join('\n');
  assert(detectApp(strong) === 'strong', 'detect strong');
  const sp = parseAppCsv(strong)!;
  assert(sp.workouts.length === 2 && sp.warmups === 1, 'strong workouts');
  const s1 = planImport(sp, []);
  const push = s1.sessions[0];
  assert(push.title === 'Push day' && push.endedAt! - push.startedAt === 3900000 && push.items.length === 2, 'strong session');
  assert(push.items[0].sets.length === 2 && push.items[0].sets[0].weight === 60 && push.items[0].target === '8', 'strong sets');
  assert(push.items[1].exId === 'Plank' && push.items[1].target === '60s' && push.items[1].sets[0].reps === 60, 'strong timed');
  assert(s1.unknown.length === 1 && planLine(s1) === '2 workouts, 1 unknown exercise', 'strong summary: ' + planLine(s1));
  // Second import of the same file: both days are taken, nothing is added.
  const again = planImport(sp, s1.sessions);
  assert(again.sessions.length === 0 && again.skippedDays === 2, 'no duplicates on re-import');

  // Strong, semicolon separated with units in the headers.
  const strongSemi = 'Workout #;Date;Workout Name;Duration (sec);Exercise Name;Set Order;Weight (lbs);Reps;RPE;Distance (meters);Seconds;Notes;Workout Notes\n'
    + '1;2024-02-01 07:00:00;Pull;3000;Deadlift (Barbell);1;225;5;;;0;;\n';
  const ss = planImport(parseAppCsv(strongSemi)!, []).sessions[0];
  assert(ss.items[0].exId === 'Barbell_Deadlift' && ss.items[0].sets[0].weight === 102.1 && ss.endedAt! - ss.startedAt === 3000000, 'strong semicolon + lbs');

  // Hevy
  const hevy = [
    '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
    '"Upper","15 Jan 2024, 18:05","15 Jan 2024, 19:10","","Lat Pulldown (Cable)","","","0","warmup","20","12","","",""',
    '"Upper","15 Jan 2024, 18:05","15 Jan 2024, 19:10","","Lat Pulldown (Cable)","","","1","normal","50","10","","",""',
    '"Upper","15 Jan 2024, 18:05","15 Jan 2024, 19:10","","Treadmill","","","0","normal","","","2","600",""',
  ].join('\n');
  assert(detectApp(hevy) === 'hevy', 'detect hevy');
  const hp = parseAppCsv(hevy)!;
  const hs = planImport(hp, []);
  assert(hp.warmups === 1 && hs.sessions.length === 1 && hs.sessions[0].endedAt! - hs.sessions[0].startedAt === 65 * MIN, 'hevy times');
  assert(hs.sessions[0].items[0].exId === 'Wide-Grip_Lat_Pulldown' && hs.sessions[0].items[0].sets.length === 1, 'hevy sets');
  const hevyLb = hevy.replace('"weight_kg"', '"weight_lbs"').replace('"distance_km"', '"distance_miles"');
  assert(planImport(parseAppCsv(hevyLb)!, []).sessions[0].items[0].sets[0].weight === 22.7, 'hevy lbs');

  // FitNotes: date only, title from categories.
  const fit = [
    'Date,Exercise,Category,Weight (kgs),Reps,Distance,Distance Unit,Time,Comment',
    '2024-03-02,Flat Barbell Bench Press,Chest,80.0,5,,,,',
    '2024-03-02,Barbell Curl,Biceps,30.0,10,,,,',
    '2024-03-02,Plank,Abs,,,,,0:01:00,',
  ].join('\n');
  assert(detectApp(fit) === 'fitnotes', 'detect fitnotes');
  const fs = planImport(parseAppCsv(fit)!, []).sessions[0];
  assert(fs.title === 'Chest and Biceps' && fs.items.length === 3 && fs.items[2].sets[0].reps === 60, 'fitnotes');
  assert(dayKey(fs.startedAt) === '2024-03-02', 'fitnotes day');

  // Our own export round-trips.
  const csv = setsCsv([...s1.sessions, fs]);
  assert(detectApp(csv) === 'gymbuddy', 'detect own');
  const back = planImport(parseAppCsv(csv)!, []);
  assert(back.sessions.length === 3 && back.unknown.length === 0, 'own round trip count');
  const a = JSON.stringify(s1.sessions.concat(fs).map((s) => [s.title, s.startedAt, s.endedAt, s.items.map((i) => [i.exId, i.target, i.sets])]));
  const b = JSON.stringify(back.sessions.map((s) => [s.title, s.startedAt, s.endedAt, s.items.map((i) => [i.exId, i.target, i.sets])]));
  assert(a === b, 'own round trip exact');
  assert(detectApp('a,b,c\n1,2,3') === null && parseAppCsv('hello') === null, 'unknown csv');
}
