// The plan reasoning engine: picks the main plan for a profile and says why, in short lines.
//   1. Life stage wins: pregnancy, the first 12 weeks after birth and office-only training have their own plans.
//   2. Hard constraints filter the main plans: place and home gear, women-only plans, level (a split for experienced
//      lifters is not offered to beginners), and injuries or concerns that would hide too many of a plan's moves.
//   3. Days a week is a hard constraint too: every plan left is fitted to exactly the chosen days (src/data/split.ts),
//      and a beginner gets the lower-volume version with the same number of days.
//   4. Soft scores rank what's left: goal, level, body, age, concerns. Each score that counts can carry a reason.
// Pure functions over the profile, so a backend could return the same shapes later.
import { postpartumWeek, pregnancyWeek } from './calc';
import { available, byId, type Exercise } from './data/exercises';
import { perWeek, planById, type Plan } from './data/plans';
import { asWritten, MAIN } from './data/split';
import { hidden } from './engine';
import type { Goal, Profile } from './store';

export type Choice = { planId: string; reasons: string[] };
export type PlanPick = Choice & { alternatives: Choice[] };

const daysOf = (p: Profile) => Math.min(7, Math.max(1, Math.round(p.daysPerWeek || 3)));
const isBeginner = (p: Profile) => p.level === 'beginner';
const bmi = (p: Profile) => p.weightKg / (p.heightCm / 100) ** 2;
const has = (p: Profile, c: string) => !!p.concerns?.includes(c as never);

// Exercise traits, kept conservative (same spirit as engine.ts).
const impact = (e: Exercise) => e.category === 'plyometrics' || /jump|hop|burpee|skip|sprint|bound|jack|scissor|run|plyo|clap/i.test(e.name);
const straining = (e: Exercise) => ['olympic weightlifting', 'strongman', 'powerlifting'].includes(e.category) || /deadlift|clean|snatch|jerk|good morning/i.test(e.name);
const pulling = (e: Exercise) => ['middle back', 'lats', 'lower back', 'traps'].includes(e.primary[0]);
const slotsOf = (plan: Plan) => plan.days.flatMap((d) => d.slots).map((s) => byId[s.id]).filter(Boolean);
const share = (plan: Plan, test: (e: Exercise) => boolean) => {
  const all = slotsOf(plan);
  return all.length ? all.filter(test).length / all.length : 0;
};

// --- 1. life stage ---
type Fixed = { planId: string; reasons: string[]; alternatives: string[] };
function lifeStage(p: Profile): Fixed | null {
  if (pregnancyWeek(p) !== null)
    return { planId: 'pregnancy-safe', reasons: ['Safe for your pregnancy', 'Gentle strength, walks and pelvic floor'], alternatives: ['pelvic-floor', 'mobility'] };
  const pp = postpartumWeek(p);
  if (pp !== null && pp < 12)
    return { planId: 'after-birth', reasons: ['Made for your first weeks after birth', 'Short sessions around feeds'], alternatives: ['pelvic-floor', 'mobility'] };
  if (p.place === 'office')
    return { planId: 'desk-reset', reasons: ['Short resets for your workday', 'No gear or change of clothes'], alternatives: ['mobility', 'pelvic-floor'] };
  return null;
}

// --- 2. hard constraints on the plan as written ---
function allowed(p: Profile, base: Plan): boolean {
  if (base.category === 'Women' && p.gender !== 'female') return false;
  if (p.place === 'gym' && base.place === 'home') return false;
  if (p.place === 'home' && base.place === 'gym') return false;
  if (base.id === 'bro-split' && isBeginner(p)) return false; // one muscle a day suits experienced lifters only
  // Home plans need the gear: most of the moves must work with what this person has.
  if (base.place === 'home' && share(base, (e) => available(e, 'home', p.gear)) < 0.8) return false;
  return true;
}

// The base plan fitted to the chosen days and level: the plan as written when it already fits.
export function fitFor(p: Profile, base: Plan): Plan | null {
  const n = daysOf(p);
  const b = isBeginner(p);
  if (asWritten(base, n, b)) return base;
  return planById[`${base.id}~${n}${b ? 'b' : ''}`] ?? null;
}

// --- 4. soft scores and reasons ---
// [score, reason, how high the reason ranks]. The reason ranking is separate from the score, so the days line always
// comes first and a beginner always sees the lower-volume line next.
type Factor = [number, string?, number?];
const GOAL: Record<Goal, string> = {
  'build muscle': 'Made to build muscle', 'get stronger': 'Made to get stronger', 'lose fat': 'Made for fat loss', 'stay fit': 'Keeps you fit and moving',
};
const GOAL_CATEGORY: Partial<Record<Goal, Plan['category'][]>> = {
  'build muscle': ['Muscle'], 'get stronger': ['Strength'], 'lose fat': ['Fat loss', 'Cardio'],
};

function factors(p: Profile, plan: Plan): Factor[] {
  const base = planById[plan.base ?? plan.id] ?? plan;
  const n = daysOf(p);
  const days = perWeek(plan);
  const beginner = isBeginner(p);
  const f: Factor[] = [];

  // Days: exact by construction for main plans; a manual pick may differ.
  if (days === n) f.push([0, plan.base ? `Built for your ${n} days` : `Fits your ${n} days`, 1000]);
  else f.push([-20 * Math.abs(days - n)]);
  // A plan as written, or one made mostly of its own days, is the curated choice; a week built only from other plans'
  // days borrows this plan's goal and level, so it ranks below a real plan with the same days.
  f.push(!plan.base ? [8] : plan.own ? [6 * plan.own] : [-15]);
  if (plan.recovery) f.push([0, `${plan.recovery === 1 ? 'One' : 'Two'} light recovery day${plan.recovery > 1 ? 's' : ''}`, 80]);

  // Level.
  if (beginner) {
    if (base.level === 'beginner') f.push([15, plan.easy ? 'Lower volume for your first weeks' : 'Made for beginners', 100]);
    else f.push([-5, 'Lower volume for your first weeks', 100]);
  } else if (base.level === 'intermediate') f.push([12, 'Matches your experience', 10]);
  else f.push([p.level === 'advanced' ? -15 : -10]);
  if (p.body === 'muscular' && base.level === 'beginner') f.push([-6]);
  if (has(p, 'injury') && base.level === 'intermediate' && !plan.easy) f.push([-6]);

  // Goal.
  if (base.tags.includes(p.goal)) f.push([30 + (base.tags[0] === p.goal ? 5 : 0), GOAL[p.goal], 30]);
  if (GOAL_CATEGORY[p.goal]?.includes(base.category)) f.push([10]);
  if ((p.goal === 'build muscle' || p.goal === 'get stronger') && base.category === 'Cardio') f.push([-20]);

  // Place and gear.
  if (p.place === 'both' && base.place === 'gym') f.push([4]);
  if (base.place === 'home' && p.gear.includes('dumbbell') && share(plan, (e) => e.equipment === 'dumbbell') >= 0.3) f.push([10, 'Uses your dumbbells', 25]);
  else if (base.place === 'home' && share(plan, (e) => e.equipment === 'body only') === 1) f.push([0, 'No equipment needed', 20]);

  // Body, age and joints.
  const imp = share(plan, impact);
  const joints = p.age >= 55 || p.body === 'more' || p.body === 'extra' || has(p, 'knee');
  if (joints) {
    f.push([-60 * imp]);
    if (imp === 0) f.push([6, has(p, 'knee') ? 'Low impact for your knees' : 'Easy on your joints', 60]);
  }
  if (p.age >= 55) {
    f.push([-30 * share(plan, straining)]);
    if (base.level === 'beginner') f.push([5]);
  }
  if (p.body === 'more' && ['fat-loss-gym', 'home-beginner'].includes(base.id)) f.push([8]);
  const safe = share(plan, (e) => !!hidden(e, p));
  if (safe) f.push([-60 * safe]);
  else if (has(p, 'back')) f.push([0, 'Kind to your back', 55]);
  const thin = bmi(p) < 20;
  if (base.id === 'lean-gain' && p.place !== 'home') {
    if (has(p, 'gain')) f.push([40, 'Helps you gain lean weight', 60]);
    else if (p.goal === 'build muscle' && (thin || p.body === 'lean')) f.push([20, 'Helps you gain lean weight', 60]);
  }
  if ((p.body === 'lean' || p.body === 'soft') && beginner && p.goal !== 'get stronger' && p.place !== 'home' && base.id === 'full-body-gym') f.push([10]);

  // Concerns.
  if (has(p, 'endurance') || has(p, 'run')) {
    if (base.id === 'cardio-aerobic' && p.goal !== 'build muscle') f.push([45, 'Builds your stamina', 60]);
    if (base.id === 'functional') f.push([8, 'Builds your stamina', 40]);
  }
  if (has(p, 'lose-weight') && (base.category === 'Fat loss' || base.category === 'Cardio')) f.push([8]);
  if (p.gender === 'female' && base.id === 'glutes-legs-gym') {
    if (p.goal === 'build muscle' || p.goal === 'lose fat') f.push([8]);
    if (has(p, 'tone')) f.push([12, 'Shapes glutes and legs', 50]);
  }
  if (has(p, 'posture') && share(plan, pulling) >= 0.15) f.push([4, 'Strong back for better posture', 40]);
  return f;
}

export function assess(p: Profile, plan: Plan): { score: number; reasons: string[] } {
  const f = factors(p, plan);
  const score = f.reduce((s, [w]) => s + w, 0);
  const seen = new Set<string>();
  const reasons = f
    .filter(([, why]) => !!why)
    .sort((a, b) => (b[2] ?? b[0]) - (a[2] ?? a[0]))
    .map(([, why]) => why!)
    .filter((why) => !seen.has(why) && !!seen.add(why));
  return { score, reasons };
}

// Every main plan that passes the hard constraints, fitted to the chosen days, best first. One per resulting week:
// two bases that end up as the same days keep the better-scoring one.
export function candidates(p: Profile): (Choice & { score: number })[] {
  const out = new Map<string, Choice & { score: number }>();
  for (const id of MAIN) {
    const base = planById[id];
    if (!base || !allowed(p, base)) continue;
    const plan = fitFor(p, base);
    if (!plan || perWeek(plan) !== daysOf(p)) continue;
    if (share(plan, (e) => !!hidden(e, p)) > 0.34) continue; // too many moves hidden for a knee or back
    const { score, reasons } = assess(p, plan);
    const key = plan.days.map((d) => d.name).join('|') + plan.week.join(',');
    const prev = out.get(key);
    if (!prev || score > prev.score) out.set(key, { planId: plan.id, reasons, score });
  }
  return [...out.values()].sort((a, b) => b.score - a.score);
}

// The main entry: one plan, why, and up to three alternatives.
export function planFor(p: Profile): PlanPick {
  const life = lifeStage(p);
  if (life) return { planId: life.planId, reasons: life.reasons, alternatives: life.alternatives.map((id) => ({ planId: id, reasons: [planById[id].tagline] })) };
  let list = candidates(p);
  // Nothing left (very unusual: a knee and a back with no gear) - drop the soft injury filter rather than show nothing.
  if (!list.length) list = candidates({ ...p, concerns: p.concerns?.filter((c) => c !== 'knee' && c !== 'back') });
  if (!list.length) {
    const id = p.place === 'home' ? 'home-beginner' : 'full-body-gym';
    const plan = fitFor(p, planById[id]) ?? planById[id];
    return { planId: plan.id, reasons: assess(p, plan).reasons, alternatives: [] };
  }
  const [best, ...rest] = list;
  return { planId: best.planId, reasons: best.reasons, alternatives: rest.slice(0, 3).map(({ planId, reasons }) => ({ planId, reasons })) };
}

// Why a given plan suits this person (for the plan page and Train). Life-stage plans keep their own lines.
export function explain(p: Profile, planId: string): string[] {
  const life = lifeStage(p);
  if (life?.planId === planId) return life.reasons;
  const plan = planById[planId];
  return plan ? assess(p, plan).reasons : [];
}

// A score for any plan as written, for ordering lists (Train). Main plans are scored as fitted to the chosen days.
export function scorePlan(p: Profile, plan: Plan): number {
  if (!MAIN.includes(plan.id)) return -100;
  const fitted = allowed(p, plan) ? fitFor(p, plan) : null;
  return fitted ? assess(p, fitted).score : assess(p, plan).score - 50;
}

