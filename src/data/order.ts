import { byId, type Exercise } from './exercises';
import type { Slot } from './plans';

// 0 big compound lifts, 1 isolation, 2 core and abs, 3 conditioning, cardio and stretches.
const LAST = ['cardio', 'plyometrics', 'stretching', 'mobility', 'breathing', 'pelvic floor', 'desk', 'eyes'];
const CONDITIONING = /burpee|jumping jack|climber|battling|high knees|squat thrust|bear crawl|sprint|jump/i;
// workout-guide moves have no mechanic, so their names decide.
const COMPOUND = /squat|press|row|deadlift|lunge|pull-?up|chin-?up|dip|push-?up|thrust|swing|step|clean|carry|walk/i;

const tier = (e?: Exercise) =>
  !e ? 1
  : LAST.includes(e.category) || CONDITIONING.test(e.name) ? 3
  : e.primary[0] === 'abdominals' ? 2
  : e.mechanic === 'compound' || (!e.mechanic && COMPOUND.test(e.name)) ? 0 : 1;

// Stable within a tier; among lifts, picks the next slot that trains a different primary muscle than the last one when it can.
// Days without a compound lift (drills, flows, cardio) keep their written order: it is deliberate there.
export function order(slots: Slot[]): Slot[] {
  const left = slots.map((s, i) => ({ s, i, t: tier(byId[s.id]), m: byId[s.id]?.primary[0] })).sort((a, b) => a.t - b.t || a.i - b.i);
  if (left[0]?.t !== 0) return slots;
  const out: typeof left = [];
  while (left.length) {
    const prev = out[out.length - 1]?.m;
    const k = left.findIndex((x) => x.t === left[0].t && (x.t > 1 || x.m !== prev));
    out.push(left.splice(k < 0 ? 0 : k, 1)[0]);
  }
  return out.map((x) => x.s);
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
export function selfCheck() {
  const s = (id: string) => ({ id, sets: 3, reps: '10', rest: 60 });
  const ids = (xs: Slot[]) => xs.map((x) => x.id).join(',');
  assert(ids(order([s('Plank'), s('Side_Lateral_Raise'), s('Barbell_Squat')])) === 'Barbell_Squat,Side_Lateral_Raise,Plank', 'compound, isolation, core');
  assert(ids(order([s('wg_burpee'), s('Pushups')])) === 'Pushups,wg_burpee', 'conditioning last');
  assert(ids(order([s('Walking_Treadmill'), s('Cat_Stretch')])) === 'Walking_Treadmill,Cat_Stretch', 'flows keep their order');
  assert(ids(order([s('Barbell_Squat'), s('Leg_Press'), s('Barbell_Bench_Press_-_Medium_Grip')])) === 'Barbell_Squat,Barbell_Bench_Press_-_Medium_Grip,Leg_Press', 'no same muscle back to back');
}
