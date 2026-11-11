// The recommendation engine's front door. Screens build a Person once (src/reco/use.ts does it from the stores) and
// ask recommend() for everything Home and the Plans tab show: today's workout with reasons, every plan ranked, the
// best exercises for any muscle, and what to do instead. Pure TypeScript; the model is described in
// docs/round14/engine.md.
//
//   model.ts    who the person is (body, level, kit, safety, history, readiness, adherence)
//   traits.ts   what each exercise is (movement, kind, impact, hardness...)
//   score.ts    which exercises fit a person and a target, and why
//   plans.ts    every plan ranked with a fit % and reasons
//   session.ts  today's session from scratch, and a second opinion on a plan day
import { dayKey } from '../calc';
import { byId } from '../data/exercises';
import { planById, plans, type Day } from '../data/plans';
import { asDay, quickById } from '../data/quick';
import { suggest, type Suggestion } from '../engine';
import { explain } from '../planner';
import { buildPerson, FRESH, recovery, type Person, type RecoInput } from './model';
import { planGroups, rankPlans, type PlanGroup, type RankedPlan } from './plans';
import { blocked, explainExercise, rankExercises, targetFor, type Scored } from './score';
import { adjustDay, minutesFor, suggestSession, type Adjust, type SessionIdea, type SessionOpts } from './session';
import { mainMuscle, sayMuscle, traitsOf } from './traits';

export { buildPerson, recovery, FRESH } from './model';
export type { Person, RecoInput, Readiness, Adherence, History, Recovery } from './model';
export { rankPlans, planGroups } from './plans';
export type { RankedPlan, PlanGroup } from './plans';
export { blocked, explainExercise, rankExercises, scoreExercise, targetFor } from './score';
export type { Scored, Target, Explained } from './score';
export { adjustDay, suggestSession, prescribe, minutesFor } from './session';
export type { Adjust, Adjusted, SessionIdea, SessionOpts, SessionPick } from './session';
export { traitsOf, mainMuscle } from './traits';
export type { Traits, Pattern, Kind } from './traits';

export type Today = {
  // 'plan' | 'light' | 'rest' | 'gentle': a day of the person's plan, as src/engine.ts suggest() decides (the same day
  // useToday() starts). 'suggested': no plan, so the engine built a session.
  kind: Suggestion['kind'] | 'suggested';
  day: Day;
  title: string;
  minutes: number;
  planId?: string;
  dayIndex?: number;
  why: string[]; // two to four short reasons; never empty
  adjust: Adjust[]; // muscles still recovering, stand-ins, a tired day: offers, never applied
  lighter: Day | null; // the offered lighter version of `day`, when there is a reason for one
};
export type MuscleState = { muscle: string; label: string; ready: number; hoursLeft: number; sets7: number; fresh: boolean };
export type Recommendation = {
  person: Person;
  today: Today;
  plans: RankedPlan[]; // every plan, best first
  groups: PlanGroup[]; // "Best for you", then by category
  exercisesFor: (muscle: string, n?: number) => Scored[];
  nextBest: {
    session: SessionIdea; // "something else": a session built for today that shares no exercise with `today`
    plan: RankedPlan | null; // the best plan that is not the one they are on
    muscles: MuscleState[]; // most ready first
  };
};

const MUSCLES = ['chest', 'middle back', 'lats', 'shoulders', 'biceps', 'triceps', 'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves'];
export function muscleStates(person: Person): MuscleState[] {
  return MUSCLES.map((m) => {
    const r = recovery(person, m);
    return { muscle: m, label: sayMuscle(m), ready: Math.round(r.pct * 100), hoursLeft: r.hoursLeft, sets7: Math.round(person.history.sets7[m] ?? 0), fresh: r.pct >= FRESH };
  }).sort((a, b) => b.ready - a.ready || a.sets7 - b.sets7 || MUSCLES.indexOf(a.muscle) - MUSCLES.indexOf(b.muscle));
}

// The best n exercises for a muscle, a group ("back", "legs", "arms", "core") or a kind ("cardio", "mobility"). A
// group of several muscles is dealt round-robin, so "arms" is not five triceps moves.
export function exercisesFor(person: Person, muscle: string, n = 5): Scored[] {
  const target = targetFor(muscle);
  if (!target.muscles || target.muscles.length < 2) return rankExercises(person, target, n);
  const lists = target.muscles.map((m) => rankExercises(person, { ...target, muscles: [m] }, n).filter((s) => mainMuscle(s.ex) === m));
  const out: Scored[] = [];
  for (let k = 0; out.length < n && k < n; k++) for (const l of lists) if (l[k] && out.length < n && !out.some((s) => s.ex.id === l[k].ex.id)) out.push(l[k]);
  return out.length ? out : rankExercises(person, target, n);
}

function todayFor(person: Person): Today {
  const i = person.input, p = person.profile;
  const fromIdea = (s: SessionIdea): Today => ({ kind: 'suggested', day: s.day, title: s.day.name, minutes: s.minutes, why: s.why, adjust: [], lighter: null });
  if (person.office) {
    const desk = asDay(quickById.desk);
    return { kind: 'plan', day: desk, title: desk.name, minutes: quickById.desk.minutes, why: ['Short resets for your workday', 'No gear or change of clothes'], adjust: [], lighter: null };
  }
  const plan = i.planId ? planById[i.planId] : undefined;
  if (!plan) return fromIdea(suggestSession(person));
  const sug = suggest({ profile: p, sessions: i.sessions ?? [], meals: [], water: {}, checkins: i.checkins ?? {}, planId: plan.id, nextDay: i.nextDay ?? 0, planStart: i.planStart }, person.now);
  const adj = sug.kind === 'plan' || sug.kind === 'light' ? adjustDay(person, sug.day) : { notes: [], lighter: null, swapped: null };
  const why = [sug.reason];
  const about = explain(p, sug.planId ?? plan.id, person.history.plan).find((x) => !/days/.test(x));
  if (about) why.push(about);
  const note = adj.notes.find((n) => n.kind === 'recovering') ?? adj.notes.find((n) => n.kind === 'lighter');
  if (note) why.push(note.reason);
  else if (person.readiness.level === 'high' && sug.kind === 'plan' && person.history.sessions > 0) why.push(person.readiness.why);
  return { kind: sug.kind, day: sug.day, title: sug.title, minutes: sug.minutes, planId: sug.planId, dayIndex: sug.dayIndex, why: why.filter(Boolean).slice(0, 4), adjust: adj.notes, lighter: sug.kind === 'light' ? null : adj.lighter };
}

const CACHE = new WeakMap<Person, Recommendation>();
export function recommend(person: Person): Recommendation {
  const hit = CACHE.get(person);
  if (hit) return hit;
  const today = todayFor(person);
  const ranked = rankPlans(person);
  const curBase = person.input.planId ? planById[person.input.planId]?.base ?? person.input.planId : null;
  let other: SessionIdea | null = null;
  const out: Recommendation = {
    person, today, plans: ranked, groups: planGroups(person),
    exercisesFor: (muscle, n = 5) => exercisesFor(person, muscle, n),
    nextBest: {
      // Built on first use: Home rarely needs it, and it is the most work.
      get session() { return (other ??= suggestSession(person, { exclude: today.day.slots.map((s) => s.id) })); },
      plan: ranked.find((r) => r.suitable && !r.addOn && r.baseId !== curBase) ?? null,
      muscles: muscleStates(person),
    },
  };
  CACHE.set(person, out);
  return out;
}

// One call for callers that have the raw inputs.
export const recommendFor = (input: RecoInput): Recommendation => recommend(buildPerson(input));

// ---------------------------------------------------------------------------------------------------------------
// Scenario matrix: every goal × level × place (gym, home with nothing, home with dumbbells and bands, both, office)
// × a set of people (man, woman, 55+, heavy, knee and back, pregnant), fresh and with a week of history.
const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('reco: ' + m); };
export function selfCheck(): string {
  const HOUR = 3600000;
  const now = Date.parse('2026-11-11T18:00:00');
  const base = { name: 'T', gender: 'male', age: 30, heightCm: 175, weightKg: 75, goalWeightKg: 75, goal: 'build muscle', level: 'beginner',
    place: 'gym', gear: [] as string[], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } };
  const due = dayKey(now + 100 * 24 * HOUR);
  const people: [string, object][] = [
    ['man', {}], ['woman', { gender: 'female', heightCm: 163, weightKg: 60 }], ['55+', { age: 62 }], ['heavy', { weightKg: 112 }],
    ['knee+back', { concerns: ['knee', 'back'] }], ['pregnant', { gender: 'female', heightCm: 165, weightKg: 68, women: { mode: 'pregnant', date: due } }],
  ];
  const places: [string, object][] = [['gym', { place: 'gym' }], ['home', { place: 'home' }], ['home+db', { place: 'home', gear: ['dumbbell', 'bands'] }], ['both', { place: 'both' }], ['office', { place: 'office' }]];
  const goals = ['lose fat', 'build muscle', 'get stronger', 'stay fit', 'tone up', 'gain weight', 'endurance', 'mobility', 'athletic'];
  const ses = (hoursAgo: number, ids: string[], where: string) => ({ id: `s${hoursAgo}`, title: 'x', place: where, startedAt: now - hoursAgo * HOUR, endedAt: now - hoursAgo * HOUR + 2400000,
    items: ids.map((exId) => ({ exId, target: '10', rest: 60, sets: Array.from({ length: 4 }, () => ({ reps: 10, weight: 0, done: true })) })) });
  // Yesterday: legs, hard, with moves anyone can do anywhere. Four days ago: pushing.
  const week = (where: string) => [ses(96, ['wg_wall-push-up', 'Incline_Push-Up', 'wg_pike-push-up'], where), ses(20, ['Bodyweight_Squat', 'wg_wall-sit', 'Butt_Lift_Bridge', 'Single_Leg_Glute_Bridge'], where)];
  const YESTERDAY = ['quadriceps', 'glutes'];
  let n = 0;
  for (const goal of goals) for (const level of ['beginner', 'intermediate', 'advanced']) for (const [pn, place] of places) for (const [who, extra] of people) for (const days of who === 'man' ? [2, 3, 4, 5, 6] : [3, 5]) {
    const profile = { ...base, ...place, ...extra, goal, level, daysPerWeek: days } as never as Person['profile'];
    const tag = `${goal}/${level}/${pn}/${who}/${days}d`;
    const where = (profile.place === 'home' || profile.place === 'office' ? 'home' : 'gym');
    for (const hist of who === 'man' || days === 3 ? [false, true] : [false]) {
      const input: RecoInput = { profile, now, sessions: hist ? (week(where) as never) : [] };
      const person = buildPerson(input);
      const rec = recommend(person);
      const t = `${tag}${hist ? '+history' : ''}`;
      n++;
      // Plans: every plan once, a pick, reasons, days honoured.
      const top = rec.plans[0];
      assert(rec.plans.length === plans.length && new Set(rec.plans.map((r) => r.baseId)).size === plans.length, `all plans ranked ${t}`);
      assert(!!top && top.pick && top.suitable && !!planById[top.planId], `a plan is always returned ${t}`);
      assert(rec.plans.every((r) => r.reasons.length > 0 && r.reasons.every((x) => x.length > 2) && r.fit >= 0 && r.fit <= 100 && (r.suitable || !!r.caution)), `plan reasons ${t}`);
      const special = person.lifeStage !== 'none';
      if (!special) assert(top.days === days, `days honoured ${t}: ${top.planId} has ${top.days}`);
      if (!special && level === 'beginner') assert(planById[top.planId].level === 'beginner', `beginner plan ${t}: ${top.planId}`);
      assert(top.category !== 'Women' || profile.gender === 'female', `women's plan ${t}`);
      if (profile.place === 'home') assert(top.plan.place !== 'gym', `home plan ${t}`);
      if (goal === 'mobility' && !special) assert(top.category !== 'Muscle' && top.baseId !== 'bro-split', `move better never gets a muscle split ${t}: ${top.planId}`);
      assert(rec.groups[0].id === 'best' && rec.groups[0].plans[0] === top, `best group ${t}`);
      // Today and "something else": real exercises, available, safe, right for the level, with reasons.
      const sessions: [string, { day: Day; why: string[] }][] = [['today', rec.today], ['else', rec.nextBest.session]];
      for (const [name, s] of sessions) {
        assert(s.day.slots.length > 0 && s.why.length > 0 && s.why.every((x) => x.length > 2), `${name} has exercises and reasons ${t}`);
        for (const sl of s.day.slots) {
          const e = byId[sl.id];
          assert(!!e && sl.sets >= 1 && sl.sets <= 8 && sl.reps.length > 0, `${name} slot ${sl.id} ${t}`);
          const why = blocked(person, e);
          assert(!why, `${name}: ${e.name} is not allowed (${why}) ${t}`);
          if (person.lowImpact) assert(!traitsOf(e).impact, `${name}: no impact for ${t}: ${e.name}`);
          if (level === 'beginner') assert(e.level !== 'expert' && traitsOf(e).hardness < 2, `${name}: beginners never get expert moves ${t}: ${e.name}`);
        }
      }
      assert(rec.today.kind === 'suggested' || special, `no plan means a built session ${t}`);
      if (hist && !special && goal !== 'mobility') {
        const idea = suggestSession(person);
        assert(!idea.muscles.some((m) => YESTERDAY.includes(m)), `a muscle trained hard yesterday is not today's focus ${t}: ${idea.muscles}`);
      }
      // Exercises for a muscle: available, allowed, with reasons.
      for (const m of ['chest', 'back', 'legs', 'core']) {
        if (special && profile.place === 'office') continue;
        const list = rec.exercisesFor(m, 4);
        if (!special) assert(list.length > 0, `exercises for ${m} ${t}`);
        assert(list.every((s) => !blocked(person, s.ex) && s.reasons.length > 0 && s.score >= 0 && s.score <= 100), `exercises for ${m} are allowed ${t}`);
      }
      // Determinism: the same inputs give the same answer.
      if (n % 7 === 0) {
        const again = recommend(buildPerson(input));
        const sig = (r: Recommendation) => JSON.stringify([r.today.day, r.today.why, r.plans.map((x) => [x.planId, x.fit, x.reasons]), r.nextBest.session.day, r.exercisesFor('back', 5).map((s) => s.ex.id)]);
        assert(sig(again) === sig(rec), `deterministic ${t}`);
      }
    }
  }
  // With a plan: today is the plan's day, as the Today engine picks it, with a note when muscles are still tired.
  const withPlan = recommend(buildPerson({ profile: base as never, now, planId: 'full-body-gym', nextDay: 0, sessions: [ses(20, ['Goblet_Squat', 'Leg_Press'], 'gym')] as never }));
  assert(withPlan.today.planId === 'full-body-gym' && withPlan.today.dayIndex !== undefined && withPlan.today.kind !== 'suggested', 'plan day');
  assert(withPlan.today.why.length >= 2 && withPlan.today.adjust.some((a) => a.kind === 'recovering') && !!withPlan.today.lighter, 'plan day says legs are still recovering');
  assert(withPlan.nextBest.plan !== null && withPlan.nextBest.plan.baseId !== 'full-body-gym' && withPlan.nextBest.muscles[0].ready === 100, 'next best plan and muscles');
  assert(minutesFor(withPlan.today.day.slots) > 0 && explainExercise(withPlan.person, 'Goblet_Squat').ok, 'helpers');
  return `${n} people`;
}
