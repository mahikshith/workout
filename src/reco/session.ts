// Today's workout, built for one person when there is no plan day to run or they ask for something else, and a
// second opinion on a plan day (adjustDay) that never changes the plan by itself. Pure TypeScript.
//
// suggestSession():
//   1. Life stage first: pregnancy, the weeks after birth and the office get their own gentle sessions.
//   2. A low-readiness day gets easy movement and stretches, not training.
//   3. The goal decides the kind of session (strength, strength with a cardio finisher, cardio first, stretch flow,
//      power then strength).
//   4. Focus: body areas are ranked by how recovered they are (48-72 hour rule, src/reco/model.ts) and how far behind
//      their weekly sets they are. An area that is still recovering is never today's focus.
//   5. Exercises come from the scoring layer (src/reco/score.ts), sets, reps and rests from the goal and level, the
//      order from src/data/order.ts, and the whole thing is trimmed to the time available.
import { secsOf } from '../calc';
import { alternatives, byId, title, type Exercise } from '../data/exercises';
import { order } from '../data/order';
import { planById, type Day, type Slot } from '../data/plans';
import { asDay, quickById } from '../data/quick';
import { postpartumWeek } from '../calc';
import type { Goal } from '../store';
import { buildPerson, FRESH, recovery, type Person } from './model';
import { blocked, rankExercises, scoreExercise, type Scored, type Target } from './score';
import { mainMuscle, sayMuscle, traitsOf } from './traits';

export type SessionOpts = {
  minutes?: number; // time available; the session is trimmed to fit
  focus?: 'full' | 'upper' | 'lower' | 'cardio' | 'mobility' | string[]; // or muscle names the person asked for
  exclude?: string[]; // exercise ids to leave out (for "something else")
};
export type SessionPick = { slot: Slot; reasons: string[] };
export type SessionIdea = {
  day: Day; // ready for store.start(day, place)
  kind: 'strength' | 'mixed' | 'cardio' | 'mobility' | 'recovery' | 'gentle';
  focus: string[]; // body areas, in words
  muscles: string[]; // main muscles trained
  minutes: number;
  why: string[]; // short reasons, most important first; never empty
  picks: SessionPick[]; // each exercise with why it was chosen, in workout order
};

type Area = { id: string; label: string; muscles: string[]; region: 'upper' | 'lower' | 'core'; weight: number; weekly: [number, number, number]; targets: Target[] };
const AREAS: Area[] = [
  { id: 'quads', label: 'Legs', muscles: ['quadriceps'], region: 'lower', weight: 1, weekly: [6, 10, 14], targets: [{ muscles: ['quadriceps'], pattern: 'squat' }, { muscles: ['quadriceps'], pattern: 'lunge' }] },
  { id: 'chest', label: 'Chest', muscles: ['chest'], region: 'upper', weight: 1, weekly: [6, 10, 14], targets: [{ muscles: ['chest'], pattern: 'push' }, { muscles: ['chest'] }] },
  { id: 'back', label: 'Back', muscles: ['middle back', 'lats'], region: 'upper', weight: 1, weekly: [6, 10, 14], targets: [{ muscles: ['middle back'], pattern: 'row' }, { muscles: ['lats'], pattern: 'pulldown' }] },
  { id: 'posterior', label: 'Glutes and hamstrings', muscles: ['hamstrings', 'glutes'], region: 'lower', weight: 0.95, weekly: [6, 10, 14], targets: [{ muscles: ['hamstrings'], pattern: 'hinge' }, { muscles: ['glutes'] }] },
  { id: 'shoulders', label: 'Shoulders', muscles: ['shoulders'], region: 'upper', weight: 0.7, weekly: [4, 8, 10], targets: [{ muscles: ['shoulders'], pattern: 'press' }, { muscles: ['shoulders'], pattern: 'arms' }] },
  { id: 'core', label: 'Core', muscles: ['abdominals'], region: 'core', weight: 0.6, weekly: [4, 6, 8], targets: [{ muscles: ['abdominals'] }, { muscles: ['abdominals'] }] },
  { id: 'arms', label: 'Arms', muscles: ['biceps', 'triceps'], region: 'upper', weight: 0.45, weekly: [3, 6, 10], targets: [{ muscles: ['biceps'] }, { muscles: ['triceps'] }] },
  { id: 'calves', label: 'Calves', muscles: ['calves'], region: 'lower', weight: 0.3, weekly: [2, 4, 6], targets: [{ muscles: ['calves'] }] },
];
const areaOf = (m: string) => AREAS.find((a) => a.muscles.includes(m));

// How much weekly lifting each goal asks for (against the level's base), and which areas it leans on.
const VOLUME: Record<Goal, number> = { 'build muscle': 1, 'gain weight': 1, 'get stronger': 0.9, 'tone up': 0.9, 'lose fat': 0.8, athletic: 0.8, 'stay fit': 0.7, endurance: 0.6, mobility: 0.4 };
const LEAN: Record<Goal, Record<string, number>> = {
  'build muscle': { chest: 0.1, back: 0.1, quads: 0.1 }, 'gain weight': { quads: 0.15, chest: 0.1, back: 0.1 },
  'get stronger': { quads: 0.2, posterior: 0.2, chest: 0.1, back: 0.1 }, 'tone up': { posterior: 0.2, core: 0.2 },
  'lose fat': { quads: 0.2, posterior: 0.15, back: 0.1 }, 'stay fit': { quads: 0.15, back: 0.1, core: 0.1 },
  endurance: { quads: 0.2, posterior: 0.15, core: 0.15 }, mobility: { core: 0.3, posterior: 0.2, back: 0.2 }, athletic: { quads: 0.2, posterior: 0.2, core: 0.15 },
};
const GOAL_WHY: Record<Goal, string> = {
  'build muscle': 'Medium reps, taken close to tired, to build muscle', 'gain weight': 'Big lifts first: they add the most size',
  'get stronger': 'Heavy sets with long rests, to get stronger', 'tone up': 'Higher reps and short rests to firm up',
  'lose fat': 'Short rests keep your heart rate up', 'stay fit': 'Strength and a little cardio in one session',
  endurance: 'Built around steady cardio for stamina', mobility: 'Slow stretches and control, never to the point of pain',
  athletic: 'Fast moves first, while you are fresh',
};

// --- sets, reps and rest ---
// [sets, reps, rest in seconds] for a big multi-joint lift and for a smaller single-joint one, by goal.
const DOSE: Record<Goal, { big: [number, string, number]; small: [number, string, number] }> = {
  'build muscle': { big: [4, '8-10', 90], small: [3, '10-12', 60] },
  'gain weight': { big: [4, '6-10', 120], small: [3, '10-12', 75] },
  'get stronger': { big: [4, '5', 180], small: [3, '8-10', 90] },
  'tone up': { big: [3, '12-15', 60], small: [3, '12-15', 45] },
  'lose fat': { big: [3, '12-15', 60], small: [3, '12-15', 45] },
  'stay fit': { big: [3, '10-12', 75], small: [2, '12-15', 60] },
  endurance: { big: [3, '15-20', 45], small: [2, '15-20', 40] },
  mobility: { big: [2, '10-12', 60], small: [2, '12', 45] },
  athletic: { big: [4, '6-8', 120], small: [3, '10-12', 60] },
};
const top = (reps: string) => Math.max(...(reps.match(/\d+/g) ?? ['10']).map(Number));

export function prescribe(person: Person, e: Exercise): Slot {
  const t = traitsOf(e), g = person.profile.goal;
  const easy = person.level === 0 || person.rusty;
  let [sets, reps, rest] = (DOSE[g] ?? DOSE['stay fit'])[t.compound ? 'big' : 'small'];
  if (t.hold) {
    const secs = e.timed ? null : person.level === 0 ? '20s' : person.level === 1 ? '30s' : '45s';
    if (e.timed) return { id: e.id, sets: 1, reps: `10 x ${e.timed.hold} s`, rest: e.timed.rest };
    return { id: e.id, sets: easy ? 2 : 3, reps: t.unilateral ? `${secs}/side` : secs!, rest: 45 };
  }
  // Low heavy reps are for people who know the lift; body weight cannot be loaded, so it gets more reps.
  if (top(reps) < 8 && (easy || person.ageBand === 'senior' || person.ageBand === 'teen')) { reps = '8-10'; rest = Math.min(rest, 120); }
  if (e.equipment === 'body only' && top(reps) < 10) reps = '8-12';
  if (e.equipment === 'barbell' && t.compound && rest < 120 && (g === 'build muscle' || g === 'gain weight')) rest = 120;
  if (easy) sets = Math.max(2, sets - 1);
  if (person.ageBand === 'senior') sets = Math.min(3, sets);
  if (person.readiness.level === 'low') sets = Math.max(2, sets - 1);
  if (person.level === 0) rest = Math.min(180, rest + 15);
  return { id: e.id, sets, reps: t.unilateral && !/\/side/.test(reps) ? `${reps}/side` : reps, rest };
}

const steady = (e: Exercise) => e.category === 'cardio' || /march/i.test(e.name);
function cardioSlot(person: Person, e: Exercise, mins: number): Slot {
  if (/march/i.test(e.name)) return { id: e.id, sets: Math.max(2, Math.round(mins / 3)), reps: '3 min', rest: 30 };
  if (e.category === 'cardio') return { id: e.id, sets: 1, reps: `${mins} min`, rest: 60 };
  const on = person.level === 0 ? 20 : 30, off = person.level === 0 ? 40 : 30;
  return { id: e.id, sets: Math.max(3, Math.min(8, Math.round((mins * 60) / (on + off)))), reps: `${on}s`, rest: off };
}

const slotSecs = (s: Slot) => {
  const side = /\/side/.test(s.reps) ? 2 : 1;
  const timed = /^10 x (\d+) s$/.exec(s.reps);
  const work = timed ? 10 * (Number(timed[1]) + 3) : (secsOf(s.reps) ?? 40) * side;
  return s.sets * (work + s.rest);
};
export const minutesFor = (slots: Slot[]) => Math.max(5, Math.round((slots.reduce((a, s) => a + slotSecs(s), 0) / 60 + 2) / 5) * 5);

const pick = (s: Scored, slot: Slot): SessionPick => ({ slot, reasons: s.reasons });
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const defaultMinutes = (person: Person) => {
  const g = person.profile.goal;
  let m = g === 'mobility' ? 25 : [35, 45, 55][person.level];
  if (person.days >= 5) m -= 5;
  if (person.ageBand === 'senior') m = Math.min(m, 40);
  if (person.rusty) m = Math.min(m, 35);
  return m;
};

function finish(person: Person, name: string, kind: SessionIdea['kind'], picks: SessionPick[], why: string[], focus: string[]): SessionIdea {
  const slots = picks.map((p) => p.slot);
  const muscles = [...new Set(slots.map((s) => byId[s.id]).filter((e) => e && ['strength', 'power'].includes(traitsOf(e).kind)).map((e) => mainMuscle(e)))];
  const minutes = minutesFor(slots);
  const lines = [...why];
  if (person.lowImpactWhy && kind !== 'mobility' && kind !== 'gentle') lines.push(person.lowImpactWhy);
  if (person.noKit && kind !== 'gentle') lines.push('No equipment needed');
  if (person.rusty) lines.push('Fewer sets while you ease back in');
  lines.push(`About ${minutes} minutes`);
  const seen = new Set<string>();
  return { day: { name, focus: focus.slice(0, 4).join(' · ') || title(kind), slots }, kind, focus, muscles, minutes, why: lines.filter((x) => x && !seen.has(x) && !!seen.add(x)).slice(0, 5), picks };
}

// A plan or quick-session day made safe for this person: anything they cannot do is replaced by the best stand-in.
function fromDay(person: Person, d: Day, why: string[]): SessionIdea {
  const picks: SessionPick[] = [];
  const used = new Set<string>();
  for (const s of d.slots) {
    let e = byId[s.id];
    if (!e) continue;
    if (blocked(person, e)) {
      const t = traitsOf(e);
      const alt = alternatives(e, person.place, person.gear, 12).find((x) => !blocked(person, x) && !used.has(x.id))
        ?? (t.kind === 'special' ? undefined : rankExercises(person, { muscles: [mainMuscle(e)], kind: t.kind }, 1, used)[0]?.ex);
      if (!alt) continue;
      e = alt;
    }
    if (used.has(e.id)) continue;
    used.add(e.id);
    picks.push({ slot: { ...s, id: e.id }, reasons: scoreExercise(person, e).reasons });
  }
  return finish(person, d.name, 'gentle', picks, why, [d.focus]);
}

function stretches(person: Person, muscles: string[], n: number, used: Set<string>): SessionPick[] {
  const out: SessionPick[] = [];
  for (const m of muscles) {
    if (out.length >= n) break;
    const s = rankExercises(person, { kind: 'mobility', muscles: [m] }, 1, used)[0];
    if (!s || mainMuscle(s.ex) !== m) continue;
    used.add(s.ex.id);
    const side = /side|one|single|knee|ankle|hip flexor|hamstring|quad|cross|neck|calf|runner/i.test(s.ex.name);
    out.push(pick(s, { id: s.ex.id, sets: 2, reps: side ? '30s/side' : '30s', rest: 15 }));
  }
  return out;
}

function easyCardio(person: Person, mins: number, used: Set<string>): SessionPick | null {
  const all = rankExercises(person, { kind: 'cardio' }, 8, used);
  const s = all.find((x) => steady(x.ex) && traitsOf(x.ex).hardness === 0) ?? all[0];
  if (!s) return null;
  used.add(s.ex.id);
  return pick(s, cardioSlot(person, s.ex, mins));
}

function recoveryDay(person: Person, used: Set<string>): SessionIdea {
  const worked = Object.entries(person.history.lastWorked).filter(([, w]) => person.now - w.at < 72 * 3600000).sort((a, b) => b[1].at - a[1].at).map(([m]) => m);
  const walk = easyCardio(person, 10, used);
  const st = stretches(person, [...worked, 'lower back', 'hamstrings', 'glutes', 'chest', 'quadriceps', 'shoulders', 'calves'], 4, used);
  return finish(person, 'Easy Recovery', 'recovery', [...(walk ? [walk] : []), ...st], [person.readiness.why, 'Easy movement and stretches help you bounce back'], ['Light recovery']);
}

function mobilityDay(person: Person, minutes: number, used: Set<string>): SessionIdea {
  const sits = person.profile.concerns?.some((c) => c === 'desk' || c === 'posture') || ['desk', 'wfh', 'student', 'driving'].includes(person.profile.lifestyle ?? '');
  const wanted = sits ? ['chest', 'quadriceps', 'neck', 'lower back', 'glutes', 'hamstrings', 'shoulders', 'calves'] : ['glutes', 'hamstrings', 'lower back', 'quadriceps', 'chest', 'shoulders', 'calves', 'neck'];
  const n = Math.max(3, Math.min(7, Math.round((minutes - 8) / 2.5)));
  const picks = stretches(person, wanted, n, used);
  // Two control moves: a steady core, and the back side of the body that holds posture.
  const control: SessionPick[] = [];
  for (const target of [{ muscles: ['abdominals'] }, { muscles: ['glutes'] }, { muscles: ['middle back'] }] as Target[]) {
    if (control.length >= (minutes >= 20 ? 3 : 2)) break;
    const s = rankExercises(person, target, 1, used)[0];
    if (!s || recovery(person, mainMuscle(s.ex)).pct < FRESH) continue;
    used.add(s.ex.id);
    control.push(pick(s, prescribe(person, s.ex)));
  }
  const why = [GOAL_WHY.mobility, sits ? 'Opens up what sitting tightens: chest, hips and neck' : 'Covers hips, back and shoulders'];
  if (control.length) why.push('A few control moves so the new range sticks');
  return finish(person, control.length ? 'Mobility & Control' : 'Mobility Flow', 'mobility', [...picks, ...control], why, ['Hips', 'Back', 'Shoulders', ...(control.length ? ['Core'] : [])]);
}

type Shape = 'full' | 'upper' | 'lower';
type StrengthPlan = { shape: Shape; picks: SessionPick[]; areas: Area[]; resting: Area[]; fresh: Area[] };

function strengthPicks(person: Person, n: number, used: Set<string>, opts: SessionOpts, sure: string[] = []): StrengthPlan {
  const g = person.profile.goal, h = person.history;
  const asked = Array.isArray(opts.focus) ? opts.focus.map((m) => m.toLowerCase()) : null;
  const freshness = (a: Area) => Math.min(...a.muscles.map((m) => recovery(person, m).pct));
  const need = (a: Area) => {
    const want = a.weekly[person.level] * (VOLUME[g] ?? 0.7);
    const done = a.muscles.reduce((s, m) => s + (h.sets7[m] ?? 0), 0);
    return Math.max(0, Math.min(1, (want - done) / want));
  };
  const fresh = AREAS.filter((a) => freshness(a) >= FRESH);
  const resting = AREAS.filter((a) => freshness(a) < FRESH);
  const prio = new Map<string, number>();
  for (const a of AREAS) {
    const ok = asked ? a.muscles.some((m) => asked.includes(m)) || asked.includes(a.id) : fresh.includes(a);
    const posture = person.profile.concerns?.includes('posture') && a.id === 'back' ? 0.2 : 0;
    const glutes = person.profile.concerns?.includes('tone') && person.profile.gender === 'female' && a.id === 'posterior' ? 0.1 : 0;
    prio.set(a.id, ok ? a.weight + 0.6 * need(a) + (LEAN[g]?.[a.id] ?? 0) + posture + glutes : 0);
  }
  // Shape: whole body for beginners, short weeks and goals that are not about one muscle; otherwise the half of the
  // body that is fresher and further behind, and never the half trained last time when the other is ready.
  const big = (r: 'upper' | 'lower') => AREAS.filter((a) => a.region === r && a.weight >= 0.9);
  const ready = (r: 'upper' | 'lower') => big(r).filter((a) => fresh.includes(a)).length / big(r).length;
  const pull = (r: 'upper' | 'lower') => big(r).reduce((s, a) => s + (prio.get(a.id) ?? 0), 0) / big(r).length;
  let shape: Shape = 'full';
  if (opts.focus === 'upper' || opts.focus === 'lower' || opts.focus === 'full') shape = opts.focus;
  else if (!asked && person.level > 0 && person.days >= 4 && (g === 'build muscle' || g === 'gain weight' || g === 'get stronger' || g === 'tone up')) {
    shape = ready('upper') === 1 && ready('lower') === 1 ? (pull('lower') > pull('upper') ? 'lower' : 'upper') : ready('upper') >= ready('lower') ? 'upper' : 'lower';
    if (ready(shape) < 0.5) shape = 'full';
  }
  const inShape = (a: Area) => shape === 'full' || a.region === 'core' || a.region === shape;
  const picks: SessionPick[] = [], areas: Area[] = [];
  const taken: Record<string, number> = {};
  const take = (a: Area): boolean => {
    const k = taken[a.id] ?? 0;
    const target = a.targets[k % a.targets.length];
    const s = rankExercises(person, target, 1, used)[0];
    prio.set(a.id, k + 1 >= 2 || !s ? 0 : (prio.get(a.id) ?? 0) * 0.4);
    if (!s) return false;
    taken[a.id] = k + 1;
    used.add(s.ex.id);
    picks.push(pick(s, prescribe(person, s.ex)));
    if (!areas.includes(a)) areas.push(a);
    return true;
  };
  for (const id of sure) { const a = AREAS.find((x) => x.id === id); if (a && (prio.get(a.id) ?? 0) > 0 && picks.length < n) take(a); }
  let guard = 0;
  while (picks.length < n && guard++ < 40) {
    const next = AREAS.filter((a) => inShape(a) && (prio.get(a.id) ?? 0) > 0).sort((a, b) => (prio.get(b.id) ?? 0) - (prio.get(a.id) ?? 0) || AREAS.indexOf(a) - AREAS.indexOf(b))[0];
    if (!next) break;
    take(next);
  }
  return { shape, picks, areas, resting, fresh };
}

const restingLine = (person: Person, resting: Area[]): string | null => {
  const recent = resting.filter((a) => a.muscles.some((m) => recovery(person, m).sets >= 2)).slice(0, 2);
  if (!recent.length) return null;
  const hours = Math.min(...recent.flatMap((a) => a.muscles.map((m) => recovery(person, m).hoursSince ?? 999)));
  const when = hours < 14 ? 'earlier today' : hours < 38 ? 'yesterday' : 'in the last few days';
  return `${cap(list(recent.map((a) => a.label.toLowerCase())))} worked hard ${when}, so ${recent.length > 1 || / and /.test(recent[0].label) ? 'they rest' : 'it rests'} today`;
};

function strengthDay(person: Person, minutes: number, used: Set<string>, opts: SessionOpts): SessionIdea {
  const g = person.profile.goal;
  const finisherMin = Array.isArray(opts.focus) ? 0 : g === 'lose fat' ? 10 : g === 'stay fit' ? 8 : g === 'tone up' || g === 'athletic' ? 6 : g === 'endurance' ? 10 : 0;
  const lead: SessionPick[] = [];
  // Sport fitness: one or two fast moves first, for people whose joints allow it.
  if (g === 'athletic' && !Array.isArray(opts.focus) && opts.focus !== 'upper') {
    for (const s of rankExercises(person, { kind: 'power' }, person.level === 0 ? 1 : 2, used)) {
      used.add(s.ex.id);
      const hold = secsOf(s.ex.name) !== null;
      lead.push(pick(s, { id: s.ex.id, sets: person.level === 0 ? 2 : 3, reps: hold ? '20s' : traitsOf(s.ex).unilateral ? '5/side' : '6', rest: 75 }));
    }
  }
  const budget = minutes - finisherMin - lead.length * 4;
  const n = Math.max(3, Math.min(7, Math.round(budget / (g === 'get stronger' ? 10 : g === 'gain weight' || g === 'build muscle' ? 8 : 6.5))));
  const sp = strengthPicks(person, n, used, opts, g === 'tone up' || g === 'mobility' ? ['core'] : []);
  if (sp.picks.length < 2 && !Array.isArray(opts.focus)) return recoveryDay(person, used);
  const fin = finisherMin ? rankExercises(person, { kind: 'cardio' }, 1, used)[0] : undefined;

  // Order the lifts (big first, no muscle twice in a row), keep each pick's reasons with its slot.
  const byRef = new Map(sp.picks.map((p) => [p.slot, p]));
  let lifts = order(sp.picks.map((p) => p.slot)).map((s) => byRef.get(s)!);
  const tail = fin ? [pick(fin, cardioSlot(person, fin.ex, finisherMin))] : [];
  const total = () => minutesFor([...lead, ...lifts, ...tail].map((p) => p.slot));
  // Trim to the time: the last-chosen lift goes first (it was the least needed), then sets come down.
  const chosen = [...sp.picks];
  while (total() > minutes + 4 && lifts.length > 3) { const drop = chosen.pop()!; lifts = lifts.filter((p) => p !== drop); }
  for (let k = lifts.length - 1; k >= 0 && total() > minutes + 4; k--) if (lifts[k].slot.sets > 2) lifts[k] = { ...lifts[k], slot: { ...lifts[k].slot, sets: lifts[k].slot.sets - 1 } };

  const regions = new Set(lifts.map((p) => traitsOf(byId[p.slot.id]).region).filter((r) => r === 'upper' || r === 'lower'));
  const name = lead.length ? 'Power & Strength' : regions.size === 1 ? (regions.has('upper') ? 'Upper Body' : 'Lower Body') : 'Full Body';
  const areas = sp.areas.filter((a) => lifts.some((p) => a.muscles.includes(mainMuscle(byId[p.slot.id]))));
  const why: string[] = [];
  const rest = Array.isArray(opts.focus) ? null : restingLine(person, sp.resting);
  if (person.history.sessions === 0) why.push('A first session: a bit of everything, nothing too hard');
  else if (rest) why.push(rest);
  else if (areas.length) why.push(`${cap(list(areas.slice(0, 3).map((a) => a.label.toLowerCase())))} are fresh and due some work`);
  if (Array.isArray(opts.focus)) {
    const tired = opts.focus.filter((m) => recovery(person, m.toLowerCase()).pct < FRESH);
    if (tired.length) why.push(`Your ${list(tired.map((m) => sayMuscle(m.toLowerCase())))} worked recently: keep the weights a little lighter`);
  }
  why.push(GOAL_WHY[g] ?? GOAL_WHY['stay fit']);
  if (person.history.lagging.includes('pull') && areas.some((a) => a.id === 'back')) why.push('More pulling, to even out your pushing');
  else if (person.history.lagging.includes('lower') && areas.some((a) => a.region === 'lower')) why.push('Your legs have had less work lately');
  if (person.levelWhy) why.push(person.levelWhy);
  return finish(person, name, tail.length || lead.length ? 'mixed' : 'strength', [...lead, ...lifts, ...tail], why, areas.map((a) => a.label));
}

function cardioDay(person: Person, minutes: number, used: Set<string>, opts: SessionOpts): SessionIdea {
  const main = easyCardio(person, Math.max(8, Math.min([12, 20, 25][person.level], minutes - 12)), used);
  const picks: SessionPick[] = main ? [main] : [];
  // A second, quicker block for people past their first weeks whose joints allow it.
  if (person.level > 0 && minutes >= 30) {
    const s = rankExercises(person, { kind: 'cardio' }, 6, used).find((x) => !steady(x.ex) || person.lowImpact);
    if (s) { used.add(s.ex.id); picks.push(pick(s, steady(s.ex) ? { id: s.ex.id, sets: 4, reps: '60s', rest: 60 } : cardioSlot(person, s.ex, 5))); }
  }
  const left = minutes - minutesFor(picks.map((p) => p.slot));
  const sp = opts.focus === 'cardio' && left < 8 ? null : strengthPicks(person, Math.max(2, Math.min(3, Math.round(left / 5))), used, {}, ['quads', 'core']);
  const lifts = sp ? order(sp.picks.map((p) => p.slot)).map((s) => sp.picks.find((p) => p.slot === s)!) : [];
  const why = [GOAL_WHY.endurance];
  if (main && steady(byId[main.slot.id])) why.push('A pace you could still talk at');
  if (lifts.length) why.push('A little strength keeps your legs and core strong for it');
  return finish(person, lifts.length ? 'Cardio & Strength' : 'Steady Cardio', 'cardio', [...picks, ...lifts], why, ['Heart and lungs', ...(sp?.areas.map((a) => a.label) ?? [])]);
}

export function suggestSession(person: Person, opts: SessionOpts = {}): SessionIdea {
  const used = new Set<string>(opts.exclude ?? []);
  const p = person.profile, g = p.goal;
  if (person.lifeStage === 'pregnant') {
    const plan = planById['pregnancy-safe'];
    return fromDay(person, plan.days[person.sessionsDone % plan.days.length], ['Safe for your pregnancy', 'Gentle strength, walks and pelvic floor']);
  }
  if (person.lifeStage === 'after birth') {
    const early = (postpartumWeek(p) ?? 0) < 6;
    const plan = planById[early ? 'pelvic-floor' : 'after-birth'];
    return fromDay(person, plan.days[person.sessionsDone % plan.days.length], [early ? 'Breathing and pelvic floor come first after birth' : 'Made for your first weeks after birth', 'Short and gentle']);
  }
  if (person.office) return fromDay(person, asDay(quickById.desk), ['Short resets for your workday', 'No gear or change of clothes']);
  const minutes = Math.max(10, Math.min(90, opts.minutes ?? defaultMinutes(person)));
  if (opts.focus === 'mobility') return mobilityDay(person, minutes, used);
  if (opts.focus === 'cardio') return cardioDay(person, minutes, used, opts);
  if (!opts.focus && person.readiness.level === 'low') return recoveryDay(person, used);
  if (!opts.focus && g === 'mobility') return mobilityDay(person, minutes, used);
  // Stamina: cardio leads, unless the last session (within a day and a half) was cardio; then strength takes its turn.
  if (!opts.focus && g === 'endurance' && !(person.history.lastWasCardio && (person.history.hoursSinceLast ?? 99) < 36)) return cardioDay(person, minutes, used, opts);
  return strengthDay(person, minutes, used, opts);
}

// --- a second opinion on a plan day ---
export type Adjust = { kind: 'recovering' | 'swap' | 'lighter'; reason: string; muscle?: string; exId?: string; toId?: string };
export type Adjusted = {
  notes: Adjust[]; // empty when the day is fine as written
  lighter: Day | null; // the same day with a set fewer where it matters; offered, never applied
  swapped: Day | null; // the same day with stand-ins for moves the person cannot do (the store makes the same swaps on start)
};

// Looks at a plan day for this person today: muscles still recovering, moves that are unavailable or paused, and a
// tired day. It only reports and offers; the plan stays as written unless the person takes the offer.
export function adjustDay(person: Person, day: Day): Adjusted {
  const notes: Adjust[] = [];
  const swaps = new Map<string, string>();
  const used = new Set(day.slots.map((s) => s.id));
  for (const s of day.slots) {
    const e = byId[s.id];
    const why = e ? blocked(person, e) : null;
    if (!e || !why) continue;
    const t = traitsOf(e);
    const alt = alternatives(e, person.place, person.gear, 12).find((x) => !blocked(person, x) && !used.has(x.id))
      ?? (t.kind === 'special' ? undefined : rankExercises(person, { muscles: [mainMuscle(e)], kind: t.kind === 'power' ? 'strength' : t.kind }, 1, used)[0]?.ex);
    if (!alt) continue;
    used.add(alt.id);
    swaps.set(e.id, alt.id);
    notes.push({ kind: 'swap', exId: e.id, toId: alt.id, reason: `${alt.name} in place of ${e.name}. ${why}` });
  }
  const tired = new Map<string, number>();
  for (const s of day.slots) {
    const e = byId[s.id];
    if (!e || !['strength', 'power'].includes(traitsOf(e).kind)) continue;
    const m = mainMuscle(e), r = recovery(person, m);
    if (r.pct < 0.6 && r.sets >= 2 && !tired.has(m)) tired.set(m, r.hoursSince ?? 0);
  }
  for (const [m, hours] of tired) {
    const when = hours < 14 ? 'earlier today' : hours < 38 ? 'yesterday' : 'recently';
    notes.push({ kind: 'recovering', muscle: m, reason: `Your ${sayMuscle(m)} worked hard ${when}. Go a little lighter on ${sayMuscle(m) === 'core' ? 'it' : 'those moves'} today.` });
  }
  const low = person.readiness.level === 'low';
  if (low) notes.push({ kind: 'lighter', reason: `${person.readiness.why}. One set fewer and longer rests still counts.` });
  const swapped = swaps.size ? { ...day, slots: day.slots.map((s) => (swaps.has(s.id) ? { ...s, id: swaps.get(s.id)! } : s)) } : null;
  const ease = (s: Slot) => ({ ...s, sets: Math.max(1, s.sets - 1), rest: s.rest + 15 });
  const lighter = low || tired.size
    ? { ...(swapped ?? day), name: `${day.name}, light`, slots: (swapped ?? day).slots.map((s) => (low || tired.has(mainMuscle(byId[s.id] ?? ({ primary: [''] } as never))) ? ease(s) : s)) }
    : null;
  return { notes, lighter, swapped };
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('reco session: ' + m); };
export function selfCheck() {
  const HOUR = 3600000;
  const base = { name: 'T', gender: 'male', age: 30, heightCm: 175, weightKg: 75, goalWeightKg: 75, goal: 'build muscle', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } };
  const now = Date.parse('2026-11-11T18:00:00');
  const ses = (hoursAgo: number, ids: string[], n = 3) => ({ id: `s${hoursAgo}`, title: 'x', place: 'gym' as const, startedAt: now - hoursAgo * HOUR, endedAt: now - hoursAgo * HOUR + 2400000,
    items: ids.map((exId) => ({ exId, target: '10', rest: 60, sets: Array.from({ length: n }, () => ({ reps: 10, weight: 40, done: true })) })) });
  const who = (x: object, sessions: object[] = [], extra: object = {}) => buildPerson({ profile: { ...base, ...x } as never, sessions: sessions as never, now, ...extra });
  const first = suggestSession(who({}));
  assert(first.day.slots.length >= 3 && first.why.length >= 2 && first.picks.every((p) => p.reasons.length > 0) && first.minutes <= 45, 'a first session');
  assert(first.day.name === 'Full Body' && ['quadriceps', 'chest'].every((m) => first.muscles.includes(m)) && first.muscles.some((m) => m === 'middle back' || m === 'lats'), 'a beginner starts with the whole body');
  assert(first.day.slots.every((s) => s.sets <= 3), 'beginner volume');
  // Chest, shoulders and triceps hard yesterday: none of them is today's focus.
  const after = suggestSession(who({ level: 'intermediate', daysPerWeek: 4 }, [ses(20, ['Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Dumbbell_Shoulder_Press', 'Triceps_Pushdown'], 4)]));
  assert(!after.muscles.includes('chest') && !after.muscles.includes('shoulders') && !after.muscles.includes('triceps'), `muscles trained yesterday rest: ${after.muscles}`);
  assert(after.why.some((w) => /yesterday/.test(w)), 'and the session says so');
  // Upper body two days running for an intermediate on four days: legs next.
  const legs = suggestSession(who({ level: 'intermediate', daysPerWeek: 4 }, [ses(44, ['Seated_Cable_Rows', 'Wide-Grip_Lat_Pulldown', 'Dumbbell_Bicep_Curl'], 4), ses(20, ['Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press', 'Triceps_Pushdown'], 4)]));
  assert(legs.day.name === 'Lower Body', `legs after two upper days: ${legs.day.name}`);
  // Goals shape the session.
  assert(suggestSession(who({ goal: 'mobility' })).kind === 'mobility' && suggestSession(who({ goal: 'endurance' })).kind === 'cardio', 'mobility and stamina sessions');
  const fat = suggestSession(who({ goal: 'lose fat' }));
  assert(fat.kind === 'mixed' && traitsOf(byId[fat.day.slots[fat.day.slots.length - 1].id]).kind === 'cardio', 'fat loss ends with cardio');
  const sport = suggestSession(who({ goal: 'athletic', level: 'intermediate' }));
  assert(traitsOf(byId[sport.day.slots[0].id]).kind === 'power', 'sport fitness opens with a fast move');
  assert(suggestSession(who({ goal: 'get stronger', level: 'advanced' })).day.slots.some((s) => s.reps === '5' && s.rest >= 150), 'strength: heavy fives, long rests');
  // A 100 kg beginner with knee pain: nothing jumps, lunges or hangs.
  const heavy = who({ weightKg: 100, concerns: ['knee'], goal: 'athletic' });
  const hs = suggestSession(heavy);
  assert(hs.day.slots.every((s) => !traitsOf(byId[s.id]).impact && !blocked(heavy, byId[s.id])), 'heavy with a knee: no impact');
  // Drained: an easy day. Time: a 20-minute cap is kept.
  assert(suggestSession(who({}, [], { checkins: { '2026-11-11': 1 } })).kind === 'recovery', 'a drained day is a recovery day');
  assert(suggestSession(who({ level: 'intermediate' }), { minutes: 20 }).minutes <= 25, 'short sessions stay short');
  // Something else: excluded moves stay out, and asking for a muscle gets that muscle.
  const again = suggestSession(who({}), { exclude: first.day.slots.map((s) => s.id) });
  assert(again.day.slots.every((s) => !first.day.slots.some((f) => f.id === s.id)), 'something else is different');
  assert(suggestSession(who({}), { focus: ['biceps'] }).muscles.includes('biceps'), 'asked-for muscle');
  // Pregnancy and office.
  const preg = who({ gender: 'female', women: { mode: 'pregnant' } });
  assert(suggestSession(preg).kind === 'gentle' && suggestSession(preg).day.slots.every((s) => !blocked(preg, byId[s.id])), 'pregnancy session is safe');
  assert(suggestSession(who({ place: 'office' })).day.name === 'Desk reset', 'office gets the desk reset');
  // adjustDay: reports, offers, never edits.
  const day = planById['full-body-gym'].days[0];
  const copy = JSON.stringify(day);
  assert(adjustDay(who({}), day).notes.length === 0 && adjustDay(who({}), day).lighter === null, 'a fresh person keeps the day as written');
  const sore = adjustDay(who({}, [ses(20, ['Goblet_Squat', 'Leg_Press'], 4)]), day);
  assert(sore.notes.some((n) => n.kind === 'recovering' && n.muscle === 'quadriceps') && !!sore.lighter && sore.lighter.slots[0].sets < day.slots[0].sets && JSON.stringify(day) === copy, 'sore legs: a lighter offer, plan untouched');
  const homeSwap = adjustDay(who({ place: 'home' }), day);
  assert(homeSwap.notes.some((n) => n.kind === 'swap') && !!homeSwap.swapped && homeSwap.swapped.slots.every((s) => !blocked(who({ place: 'home' }), byId[s.id])), 'home: stand-ins for gym moves');
}
