// The plan reasoning engine: picks the main plan for a profile and says why, in short lines.
//   1. Life stage wins: pregnancy, the first 12 weeks after birth and office-only training have their own plans.
//   2. Hard constraints filter the main plans: place and home gear, women-only plans, level (a split for experienced
//      lifters is not offered to beginners), and injuries or concerns that would hide too many of a plan's moves.
//   3. Days a week is a hard constraint too: every plan left is fitted to exactly the chosen days (src/data/split.ts),
//      and a beginner gets the lower-volume version with the same number of days.
//   4. Soft scores rank what's left: goal (nine of them), level, body, height and weight (BMI bands), age, concerns,
//      and training history where there is any. Each score that counts can carry a reason.
// Pure functions over the profile, so a backend could return the same shapes later. The wider engine in src/reco/
// (every plan ranked with a fit %, exercise scoring, today's session) uses this as its plan-picking input.
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
// BMI bands from height and weight. A body the person calls muscular is never treated as heavy (BMI misreads muscle),
// and unusable numbers (no height) count as the healthy band.
export type WeightClass = 'under' | 'healthy' | 'over' | 'heavy' | 'very heavy';
export function weightClass(p: Profile): WeightClass {
  const b = bmi(p);
  if (!Number.isFinite(b) || b <= 0) return 'healthy';
  if (b < 18.5) return 'under';
  if (b < 25) return 'healthy';
  if (p.body === 'muscular') return b < 32 ? 'healthy' : 'over';
  return b < 30 ? 'over' : b < 35 ? 'heavy' : 'very heavy';
}
const heavy = (p: Profile) => { const w = weightClass(p); return w === 'heavy' || w === 'very heavy'; };

// What the person has actually done, when the caller knows it (src/reco/model.ts builds it from the sessions).
// recent: sessions in the last six weeks by the plan they were run on (base plan ids, "ppl-gym" not "ppl-gym~5").
export type PlanHistory = { sessions: number; weeks: number; recent: Record<string, number> };
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
  'tone up': 'Firms you up all over', 'gain weight': 'Builds healthy size', endurance: 'Builds your stamina', mobility: 'Helps you move freely',
  athletic: 'Builds speed and power',
};
const GOAL_CATEGORY: Partial<Record<Goal, Plan['category'][]>> = {
  'build muscle': ['Muscle'], 'get stronger': ['Strength'], 'lose fat': ['Fat loss', 'Cardio'],
  'gain weight': ['Muscle'], endurance: ['Cardio'], athletic: ['Functional'], mobility: ['Recovery'],
};
// What each plan is, in a few words: the one reason no other plan shares, so two cards never read the same.
const SIGNATURE: Record<string, string> = {
  'full-body-gym': 'Whole body every session', 'ppl-gym': 'Push, pull and legs days', 'upper-lower-gym': 'Upper and lower days in turn',
  'bro-split': 'One muscle group a day', 'arnold-split': 'Chest with back, lots of sets', phul: 'Heavy days and lighter days',
  'strength-5x5': 'Three big lifts a session', 'lean-gain': 'Big lifts with extra sets for size', 'fat-loss-gym': 'Circuits plus steady cardio',
  'cardio-aerobic': 'Walks, bike, rower and easy runs', functional: 'Swings, carries and rowing', 'glutes-legs-gym': 'Glutes and legs come first',
  'home-beginner': 'A gentle start at home', 'home-bodyweight': 'Just your body weight', 'home-dumbbell': 'Dumbbells and a band cover everything',
  'fat-burn-home': 'Fast circuits in a small space', 'move-better': 'Stretch flows and posture work', 'sport-ready': 'Quick feet, jumps and a strong core',
  'home-stamina': 'Steady marching, no jumping', 'pregnancy-safe': 'Safe for your pregnancy', 'after-birth': 'Short sessions around feeds',
  'pelvic-floor': 'Ten quiet minutes for your pelvic floor', mobility: 'One easy stretch flow', 'desk-reset': 'Done in your chair',
  'chest-day': 'An extra day for your chest', 'back-day': 'An extra day for your back', 'shoulder-day': 'An extra day for your shoulders',
  'arm-day': 'An extra day for your arms', 'leg-day': 'An extra day for your legs', 'glute-day': 'An extra day for your glutes', 'core-day': 'Twenty minutes for your middle',
};
// A plan refitted into another split (full body turned upper/lower) is described by what it became.
export const signature = (plan: Plan): string | undefined => {
  const base = planById[plan.base ?? plan.id] ?? plan;
  if (plan.base && plan.name !== base.name) return plan.tagline.replace(/\.$/, '');
  return SIGNATURE[base.id];
};

// Goals that need the body to keep (or add) weight: long cardio weeks work against them.
const GROWING: Goal[] = ['build muscle', 'get stronger', 'gain weight'];

function factors(p: Profile, plan: Plan, hist?: PlanHistory): Factor[] {
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
  const sig = signature(plan);
  if (sig) f.push([0, sig, 90]);
  if (plan.recovery) f.push([0, `${plan.recovery === 1 ? 'One' : 'Two'} light recovery day${plan.recovery > 1 ? 's' : ''}`, 80]);

  // Level.
  if (beginner) {
    if (base.level === 'beginner') f.push(plan.easy ? [15, 'Lower volume for your first weeks', 100] : [15, 'Made for beginners', 20]);
    else f.push([-5, 'Lower volume for your first weeks', 100]);
  } else if (base.level === 'intermediate') f.push([12, 'Matches your experience', 10]);
  else f.push([p.level === 'advanced' ? -15 : -10]);
  if (p.body === 'muscular' && base.level === 'beginner') f.push([-6]);
  if (has(p, 'injury') && base.level === 'intermediate' && !plan.easy) f.push([-6]);

  // Goal.
  if (base.tags.includes(p.goal)) f.push([30 + (base.tags[0] === p.goal ? 5 : 0), GOAL[p.goal], 30]);
  if (GOAL_CATEGORY[p.goal]?.includes(base.category)) f.push([10]);
  if (GROWING.includes(p.goal) && base.category === 'Cardio') f.push([-20]);
  if (p.goal === 'gain weight' && base.category === 'Fat loss') f.push([-25]);
  // Stretch-and-control plans are for people who asked to move better (or said they feel stiff); heavy splits are
  // not what a move-better goal is after.
  if (base.id === 'move-better' && p.goal !== 'mobility') f.push(has(p, 'flexibility') ? [20, 'Loosens you up', 50] : [-30]);
  if (p.goal === 'mobility' && (base.category === 'Muscle' || base.category === 'Strength')) f.push([-12]);
  if (p.goal === 'mobility' && !base.tags.includes('mobility') && base.level === 'beginner' && share(plan, impact) === 0) f.push([6, 'Gentle, controlled moves', 28]);
  if (p.goal === 'endurance' && base.category === 'Fat loss') f.push([6]);
  if (p.goal === 'athletic' && base.category === 'Strength') f.push([4, 'Strength is the base for speed', 28]);

  // Place and gear.
  if (p.place === 'both' && base.place === 'gym') f.push([4]);
  if (base.place === 'home' && p.gear.includes('dumbbell') && share(plan, (e) => e.equipment === 'dumbbell') >= 0.3) f.push([10, 'Uses your dumbbells', 25]);
  else if (base.place === 'home' && share(plan, (e) => e.equipment === 'body only') === 1) f.push([0, 'No equipment needed', 20]);

  // Body, age and joints.
  const imp = share(plan, impact);
  const joints = p.age >= 55 || p.body === 'more' || p.body === 'extra' || has(p, 'knee') || heavy(p);
  if (joints) {
    f.push([-60 * imp]);
    if (imp === 0) f.push([6, has(p, 'knee') ? 'Low impact for your knees' : 'Easy on your joints', 60]);
  }
  if (p.age >= 55) {
    f.push([-30 * share(plan, straining)]);
    if (base.level === 'beginner') f.push([5]);
  }
  if ((p.body === 'more' || weightClass(p) === 'very heavy') && ['fat-loss-gym', 'home-beginner'].includes(base.id)) f.push([8]);
  // Height and weight. Under the healthy band: plans that burn a lot are the wrong tool, lifting is the right one.
  const wc = weightClass(p);
  if (wc === 'under' && (base.category === 'Fat loss' || base.category === 'Cardio') && p.goal !== 'endurance') f.push([-15]);
  if (wc === 'under' && (base.category === 'Muscle' || base.category === 'Strength') && p.goal !== 'mobility' && p.goal !== 'endurance') f.push([5]);
  // Above it, with a goal that is about getting leaner: circuits and cardio that stay on the ground move up a little.
  if ((wc === 'heavy' || wc === 'very heavy') && (p.goal === 'lose fat' || p.goal === 'tone up' || p.goal === 'stay fit') && base.category === 'Fat loss' && imp === 0) f.push([5]);
  const safe = share(plan, (e) => !!hidden(e, p));
  if (safe) f.push([-60 * safe]);
  else if (has(p, 'back')) f.push([0, 'Kind to your back', 55]);
  const thin = bmi(p) < 20;
  if (base.id === 'lean-gain' && p.place !== 'home') {
    if (has(p, 'gain')) f.push([40, 'Helps you gain lean weight', 60]);
    else if (p.goal === 'gain weight') f.push([thin || p.body === 'lean' ? 30 : 22, 'Helps you gain lean weight', 60]);
    else if (p.goal === 'build muscle' && (thin || p.body === 'lean')) f.push([20, 'Helps you gain lean weight', 60]);
  }
  if (p.goal === 'gain weight' && base.id === 'home-dumbbell') f.push([10]);
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

  // History, where there is any: a plan the person has been turning up for keeps a small edge (changing plans every
  // few weeks is the commonest way to stall), and someone long past their first weeks is not pulled back to a
  // first-weeks plan unless they are a beginner by their own word.
  if (hist) {
    const done = hist.recent[base.id] ?? 0;
    if (done >= 4) f.push([6, 'You are already making progress on it', 45]);
    if (!beginner && hist.sessions >= 24 && hist.weeks >= 8 && base.level === 'beginner' && !['Recovery', 'Cardio', 'Home'].includes(base.category)) f.push([-4]);
  }
  return f;
}

export function assess(p: Profile, plan: Plan, hist?: PlanHistory): { score: number; reasons: string[] } {
  const f = factors(p, plan, hist);
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
export function candidates(p: Profile, hist?: PlanHistory): (Choice & { score: number })[] {
  const out = new Map<string, Choice & { score: number }>();
  for (const id of MAIN) {
    const base = planById[id];
    if (!base || !allowed(p, base)) continue;
    const plan = fitFor(p, base);
    if (!plan || perWeek(plan) !== daysOf(p)) continue;
    if (share(plan, (e) => !!hidden(e, p)) > 0.34) continue; // too many moves hidden for a knee or back
    const { score, reasons } = assess(p, plan, hist);
    const key = plan.days.map((d) => d.name).join('|') + plan.week.join(',');
    const prev = out.get(key);
    if (!prev || score > prev.score) out.set(key, { planId: plan.id, reasons, score });
  }
  return [...out.values()].sort((a, b) => b.score - a.score);
}

// The main entry: one plan, why, and up to three alternatives.
// hist (optional): what the person has done so far; without it the pick is from the profile alone.
export function planFor(p: Profile, hist?: PlanHistory): PlanPick {
  const life = lifeStage(p);
  if (life) return { planId: life.planId, reasons: life.reasons, alternatives: life.alternatives.map((id) => ({ planId: id, reasons: [planById[id].tagline] })) };
  let list = candidates(p, hist);
  // Nothing left (very unusual: a knee and a back with no gear) - drop the soft injury filter rather than show nothing.
  if (!list.length) list = candidates({ ...p, concerns: p.concerns?.filter((c) => c !== 'knee' && c !== 'back') }, hist);
  if (!list.length) {
    const id = p.place === 'home' ? 'home-beginner' : 'full-body-gym';
    const plan = fitFor(p, planById[id]) ?? planById[id];
    return { planId: plan.id, reasons: assess(p, plan, hist).reasons, alternatives: [] };
  }
  const [best, ...rest] = list;
  return { planId: best.planId, reasons: best.reasons, alternatives: rest.slice(0, 3).map(({ planId, reasons }) => ({ planId, reasons })) };
}

// Why a given plan suits this person (for the plan page and Train). Life-stage plans keep their own lines.
export function explain(p: Profile, planId: string, hist?: PlanHistory): string[] {
  const life = lifeStage(p);
  if (life?.planId === planId) return life.reasons;
  const plan = planById[planId];
  return plan ? assess(p, plan, hist).reasons : [];
}
// The life-stage plan for this person, if one applies (pregnancy, the first 12 weeks after birth, office-only).
export const lifeStagePlan = (p: Profile): string | null => lifeStage(p)?.planId ?? null;
// Whether a plan as written may be offered at all (place, gear, women-only, level), and the share of its moves the
// safety filters would hide. For src/reco/plans.ts, which ranks every plan and says why one does not fit.
export const planAllowed = (p: Profile, base: Plan): boolean => allowed(p, base);
export const hiddenShare = (p: Profile, plan: Plan): number => share(plan, (e) => !!hidden(e, p));
export const impactShare = (plan: Plan): number => share(plan, impact);

// A score for any plan as written, for ordering lists (Train). Main plans are scored as fitted to the chosen days.
export function scorePlan(p: Profile, plan: Plan, hist?: PlanHistory): number {
  if (!MAIN.includes(plan.id)) return -100;
  const fitted = allowed(p, plan) ? fitFor(p, plan) : null;
  return fitted ? assess(p, fitted, hist).score : assess(p, plan, hist).score - 50;
}

