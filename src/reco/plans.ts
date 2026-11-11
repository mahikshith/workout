// Every plan, ranked for one person, with a fit percentage and reasons. The plan reasoning engine (src/planner.ts)
// scores the main plans, fitted to the person's days; this layer adds the plans the planner never picks on its own
// (one-muscle add-on days, recovery flows, pregnancy and after-birth plans), says why a plan does not fit when it
// doesn't, and groups the result for the Plans tab and Home. Pure TypeScript.
import { byId } from '../data/exercises';
import { CATEGORIES, perWeek, planById, plans, type Category, type Plan } from '../data/plans';
import { MAIN } from '../data/split';
import { assess, baseSignature, fitFor, hiddenShare, impactShare, lifeStagePlan, planAllowed, planFor, signature } from '../planner';
import { buildPerson, type Person } from './model';
import { mainMuscle, sayMuscle } from './traits';

export type RankedPlan = {
  plan: Plan; // the plan as written (what lists show)
  planId: string; // the id to open or start: the version fitted to the person's days when there is one
  baseId: string;
  fit: number; // 0-100
  reasons: string[]; // short, most telling first; never empty
  category: Category;
  days: number; // training days a week of `planId`
  suitable: boolean; // false: shown greyed or left out, with `caution` saying why
  caution: string | null;
  pick: boolean; // the engine's one recommendation
  addOn: boolean; // a one-muscle day that goes on top of a main plan
};
export type PlanGroup = { id: string; title: string; plans: RankedPlan[] };

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(x)));
const has = (person: Person, ...cs: string[]) => cs.some((c) => person.profile.concerns?.includes(c as never));
const weekKey = (pl: Plan) => pl.days.map((d) => d.name).join('|') + pl.week.join(',');

// Why a main plan as written is not on offer.
function whyNot(person: Person, base: Plan): string {
  const p = person.profile;
  if (base.category === 'Women' && p.gender !== 'female') return 'Made for women';
  if (p.place === 'gym' && base.place === 'home') return 'A home plan; you train at the gym';
  if (p.place === 'home' && base.place === 'gym') return 'Needs a gym';
  if (base.id === 'bro-split') return 'For experienced lifters';
  return 'Needs equipment you do not have at home';
}

function mainPlan(person: Person, base: Plan): Omit<RankedPlan, 'pick'> {
  const p = person.profile, hist = person.history.plan;
  const out = (planId: string, fit: number, reasons: string[], suitable: boolean, caution: string | null) =>
    ({ plan: base, planId, baseId: base.id, fit, reasons, category: base.category, days: perWeek(planById[planId] ?? base), suitable, caution, addOn: false });
  if (person.office && base.place !== 'any') return out(base.id, 5, [signature(base) ?? base.tagline], false, 'Not a plan for the office');
  if (!planAllowed(p, base)) return out(base.id, 5, [signature(base) ?? base.tagline], false, whyNot(person, base));
  const fitted = fitFor(p, base);
  const plan = fitted && perWeek(fitted) === person.days ? fitted : base;
  const a = assess(p, plan, hist);
  const hid = hiddenShare(p, plan);
  if (hid > 0.34) return out(plan.id, clamp(20 - 20 * hid, 3, 20), a.reasons.length ? a.reasons : [signature(base) ?? base.tagline], false, 'Too many of its moves are paused for you right now');
  const reasons = [...a.reasons];
  if (perWeek(plan) !== person.days) reasons.push(`Runs on ${perWeek(plan)} days a week`);
  let fit = 42 + 0.55 * a.score;
  if (person.lifeStage === 'pregnant' || person.lifeStage === 'after birth') fit = Math.min(fit, 55);
  if (person.adherence.rate !== null && person.adherence.rate < 0.5 && perWeek(plan) >= 5) fit -= 5; // long weeks are hard to keep when the last month was patchy
  return out(plan.id, clamp(fit, 3, 97), reasons.length ? reasons : [base.tagline], true, null);
}

const ADD_ON_WHY: Record<string, [string[], string]> = {
  'glute-day': [['tone'], 'Shapes glutes and legs'],
  'core-day': [['back', 'posture'], 'A strong middle protects your back'],
  'back-day': [['posture'], 'Strong back for better posture'],
};

function addOn(person: Person, plan: Plan): Omit<RankedPlan, 'pick'> {
  const p = person.profile;
  const out = (fit: number, reasons: string[], suitable: boolean, caution: string | null) =>
    ({ plan, planId: plan.id, baseId: plan.id, fit, reasons, category: plan.category, days: perWeek(plan), suitable, caution, addOn: true });
  const sig = signature(plan) ?? plan.tagline;
  if (person.lifeStage === 'pregnant' || person.lifeStage === 'after birth') return out(5, [sig], false, 'Paused for now; your own plan covers what is safe');
  if (person.office) return out(5, [sig], false, 'Not a plan for the office');
  if (plan.place === 'gym' && person.place === 'home') return out(5, [sig], false, 'Needs a gym');
  const hid = hiddenShare(p, plan);
  if (hid > 0.34) return out(8, [sig], false, 'Too many of its moves are paused for you right now');
  const f: [number, string][] = [[100, sig]];
  let fit = 42;
  if (plan.tags.includes(p.goal)) { fit += 10; f.push([10, 'Adds to your goal']); }
  const why = ADD_ON_WHY[plan.id];
  if (why && has(person, ...why[0])) { fit += 18; f.push([18, why[1]]); }
  // The muscle this day trains most, and how much work it has had in the last two weeks.
  const count: Record<string, number> = {};
  for (const s of plan.days[0].slots) { const e = byId[s.id]; if (e) count[mainMuscle(e)] = (count[mainMuscle(e)] ?? 0) + s.sets; }
  const main = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (main && person.history.sessions >= 4 && (person.history.sets14[main] ?? 0) < 4) { fit += 10; f.push([12, `Your ${sayMuscle(main)} has had little work lately`]); }
  if (plan.id === 'glute-day' && p.gender === 'male' && !has(person, 'tone')) fit -= 8;
  if (plan.level === 'intermediate' && person.level === 0) fit -= 15;
  if (person.level === 0 && person.sessionsDone < 6) fit -= 6; // first weeks: the main plan is enough
  if (person.lowImpact && impactShare(plan) > 0) fit -= 20;
  if (person.days >= 6) fit -= 8; // no room in the week
  return out(clamp(fit, 3, 90), f.sort((a, b) => b[0] - a[0]).map((x) => x[1]), true, null);
}

function gentle(person: Person, plan: Plan, life: string | null): Omit<RankedPlan, 'pick'> {
  const p = person.profile;
  const out = (fit: number, reasons: string[], suitable = true, caution: string | null = null) =>
    ({ plan, planId: plan.id, baseId: plan.id, fit, reasons, category: plan.category, days: perWeek(plan), suitable, caution, addOn: false });
  const sig = signature(plan) ?? plan.tagline;
  if (plan.id === 'pregnancy-safe') return person.lifeStage === 'pregnant' ? out(97, ['Safe for your pregnancy', 'Gentle strength, walks and pelvic floor']) : out(3, [sig], false, 'Made for pregnancy');
  if (plan.id === 'after-birth') return person.lifeStage === 'after birth' ? out(97, ['Made for your first weeks after birth', 'Short sessions around feeds']) : out(3, [sig], false, 'Made for the first weeks after birth');
  const f: [number, string][] = [[100, sig]];
  let fit = 40;
  const add = (n: number, why: string) => { fit += n; f.push([n, why]); };
  const sits = has(person, 'desk', 'posture') || ['desk', 'wfh', 'student', 'driving'].includes(p.lifestyle ?? '');
  const tender = person.lifeStage === 'pregnant' || person.lifeStage === 'after birth';
  if (plan.id === 'mobility') {
    if (p.goal === 'mobility') add(22, 'Helps you move freely');
    if (has(person, 'flexibility', 'injury', 'back')) add(14, has(person, 'back') ? 'Eases a stiff back' : 'Loosens you up');
    if (person.ageBand === 'senior') add(8, 'Keeps joints moving well');
    if (tender) add(28, 'Gentle and safe for you now');
    if (person.readiness.level === 'low') add(6, 'A good choice on a tired day');
    if (sits) add(6, 'Undoes hours of sitting');
  } else if (plan.id === 'pelvic-floor') {
    if (person.lifeStage === 'pregnant') add(40, 'Supports you through pregnancy');
    else if (person.lifeStage === 'after birth') add(42, 'The first step after birth');
    else if (p.gender === 'female') add(8, 'Good for bladder control and core');
    if (sits) add(5, 'Can be done sitting at your desk');
    if (p.gender === 'male' && !sits) fit -= 10;
  } else if (plan.id === 'desk-reset') {
    if (person.office) add(55, 'Short resets for your workday');
    else if (sits) add(22, 'Fits between meetings');
    if (p.goal === 'mobility') add(8, 'Helps you move freely');
    if (has(person, 'posture')) add(6, 'Eases a stiff neck and shoulders');
  }
  if (life === plan.id) fit = Math.max(fit, 96);
  return out(clamp(fit, 3, 97), f.sort((a, b) => b[0] - a[0]).map((x) => x[1]));
}

const CACHE = new WeakMap<Person, RankedPlan[]>();

// Every plan in the app, once each, best first. Suitable plans lead; the engine's pick is first of all.
export function rankPlans(person: Person): RankedPlan[] {
  const hit = CACHE.get(person);
  if (hit) return hit;
  const p = person.profile;
  const pick = planFor(p, person.history.plan);
  const pickBase = planById[pick.planId]?.base ?? pick.planId;
  const life = lifeStagePlan(p);
  const rows = plans.map((plan) => (MAIN.includes(plan.id) ? mainPlan(person, plan) : plan.category === 'One muscle' ? addOn(person, plan) : gentle(person, plan, life)));

  // Two main plans can come out as the same week once fitted (both home plans become "Home Upper / Lower" at four
  // days). The better one keeps the fitted week; the other is offered as written, so every card is a different plan.
  const seen = new Set<string>(planById[pick.planId] ? [weekKey(planById[pick.planId])] : []);
  for (const r of [...rows].sort((a, b) => b.fit - a.fit)) {
    const pl = planById[r.planId];
    if (!r.suitable || !pl?.base || r.baseId === pickBase) continue;
    const k = weekKey(pl);
    if (!seen.has(k)) { seen.add(k); continue; }
    const a = assess(p, r.plan, person.history.plan);
    r.planId = r.baseId;
    r.days = perWeek(r.plan);
    r.fit = clamp(Math.min(r.fit - 4, 42 + 0.55 * a.score), 3, 97);
    r.reasons = [...a.reasons, `Runs on ${r.days} days a week`];
  }

  const top = Math.max(0, ...rows.filter((r) => r.suitable && r.baseId !== pickBase).map((r) => r.fit));
  const out: RankedPlan[] = rows.map((r) => {
    if (r.baseId !== pickBase) return { ...r, pick: false };
    // The pick is the planner's answer, with the planner's reasons, and never sits below another plan.
    return { ...r, planId: pick.planId, days: perWeek(planById[pick.planId] ?? r.plan), reasons: pick.reasons.length ? pick.reasons : r.reasons, suitable: true, caution: null, fit: clamp(Math.max(r.fit, top + 1, 80), 3, 99), pick: true };
  });
  // Every card leads with a line of its own: what the plan is comes first, and when two plans would still open with
  // the same words the later one falls back to its own description.
  const said = new Set<string>();
  const order = [...out].sort((a, b) => Number(b.pick) - Number(a.pick) || b.fit - a.fit);
  for (const r of order) {
    const pl = planById[r.planId] ?? r.plan;
    const own = [signature(pl), baseSignature(r.baseId), r.plan.tagline.replace(/\.$/, ''), r.plan.name].filter((x): x is string => !!x);
    const lead = own.find((x) => !said.has(x)) ?? own[0];
    said.add(lead);
    r.reasons = [lead, ...r.reasons.filter((x) => x !== lead && !own.slice(0, 2).includes(x))];
  }
  out.sort((a, b) => Number(b.pick) - Number(a.pick) || Number(b.suitable) - Number(a.suitable) || b.fit - a.fit || a.baseId.localeCompare(b.baseId));
  CACHE.set(person, out);
  return out;
}

const TITLE: Record<Category, string> = {
  Muscle: 'Build muscle', Strength: 'Get stronger', 'One muscle': 'Add-on days', 'Fat loss': 'Fat loss', Cardio: 'Cardio and stamina',
  Functional: 'Sport and function', Home: 'At home', Women: "Women's health", Recovery: 'Mobility and recovery',
};
// Categories that serve each goal, in the order they should appear.
const FIRST: Record<string, Category[]> = {
  'lose fat': ['Fat loss', 'Cardio'], 'build muscle': ['Muscle', 'Strength'], 'get stronger': ['Strength', 'Muscle'], 'stay fit': ['Functional', 'Cardio'],
  'tone up': ['Muscle', 'Fat loss'], 'gain weight': ['Muscle', 'Strength'], endurance: ['Cardio', 'Fat loss'], mobility: ['Recovery', 'Functional'],
  athletic: ['Functional', 'Strength'],
};

// "Best for you" (the pick and the closest fits, up to five), then every category that has a plan for this person,
// the goal's own categories first, then the plans that do not fit right now with the reason. Every plan is in the
// last two kinds of group exactly once; "Best for you" repeats the leaders.
export function planGroups(person: Person): PlanGroup[] {
  const all = rankPlans(person);
  const ok = all.filter((r) => r.suitable);
  const mains = ok.filter((r) => !r.addOn);
  const best = [...mains.filter((r) => r.pick || r.fit >= 60).slice(0, 4), ...ok.filter((r) => r.addOn && r.fit >= 64).slice(0, 1)];
  const lead = person.profile.place === 'home' ? ['Home' as Category] : [];
  const order = [...new Set<Category>([...lead, ...(FIRST[person.profile.goal] ?? []), ...CATEGORIES])];
  const groups: PlanGroup[] = [{ id: 'best', title: 'Best for you', plans: best.length ? best : ok.slice(0, 3) }];
  for (const cat of order) {
    const list = ok.filter((r) => r.category === cat);
    if (list.length) groups.push({ id: cat, title: TITLE[cat], plans: list });
  }
  const rest = all.filter((r) => !r.suitable);
  if (rest.length) groups.push({ id: 'other', title: 'Not for you right now', plans: rest });
  return groups;
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('reco plans: ' + m); };
export function selfCheck() {
  const base = { name: 'T', gender: 'male', age: 30, heightCm: 175, weightKg: 75, goalWeightKg: 75, goal: 'build muscle', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } };
  const who = (x: object) => buildPerson({ profile: { ...base, ...x } as never, now: Date.parse('2026-11-11T18:00:00') });
  const r = rankPlans(who({}));
  assert(r.length === plans.length && new Set(r.map((x) => x.baseId)).size === plans.length, 'every plan once');
  assert(r[0].pick && r[0].suitable && r.filter((x) => x.pick).length === 1 && r[0].planId === planFor(who({}).profile).planId, 'the pick leads and matches the planner');
  assert(r.every((x) => x.reasons.length > 0 && x.reasons.every((s) => s.length > 0) && x.fit >= 0 && x.fit <= 100 && (x.suitable || !!x.caution)), 'reasons, fit and cautions');
  assert(r.every((x, i) => i === 0 || !r[i - 1].suitable || !x.suitable || x.pick || r[i - 1].pick || r[i - 1].fit >= x.fit), 'sorted by fit');
  // Cards read differently: among the suitable plans no two lead with the same line.
  const leads = r.map((x) => x.reasons[0]);
  assert(new Set(leads).size === leads.length, `each plan leads with its own reason: ${leads.filter((s, i) => leads.indexOf(s) !== i).join(', ')}`);
  // A man never sees women's plans as suitable; a gym-goer never a home plan; a home trainer never a gym plan.
  assert(r.filter((x) => x.category === 'Women').every((x) => !x.suitable) && r.filter((x) => x.plan.place === 'home').every((x) => !x.suitable), 'gym man');
  const home = rankPlans(who({ place: 'home' }));
  assert(home.filter((x) => x.plan.place === 'gym').every((x) => !x.suitable && !!x.caution) && home[0].plan.place !== 'gym', 'home trainer');
  // The tester's case: intermediate, home, dumbbells, four days, build muscle gets a plan for their level.
  const tester = rankPlans(who({ level: 'intermediate', place: 'home', gear: ['dumbbell', 'bands'], daysPerWeek: 4 }))[0];
  assert(tester.baseId === 'home-dumbbell' && tester.plan.level === 'intermediate' && tester.days === 4, 'intermediate at home with dumbbells');
  // Days are honoured for every suitable main plan that can be fitted.
  for (const d of [2, 4, 6]) {
    const list = rankPlans(who({ daysPerWeek: d, level: 'intermediate' }));
    assert(list[0].days === d, `pick has ${d} days`);
    assert(list.filter((x) => x.suitable && planById[x.planId]?.base).every((x) => x.days === d), `fitted plans have ${d} days`);
  }
  // Goals move the order: mobility leads with a mobility plan, gain weight with a lifting plan, stamina with cardio.
  assert(rankPlans(who({ goal: 'mobility' }))[0].plan.tags.includes('mobility'), 'mobility goal');
  assert(['Muscle', 'Strength'].includes(rankPlans(who({ goal: 'gain weight', weightKg: 55 }))[0].category), 'gain weight goal');
  assert(rankPlans(who({ goal: 'endurance' }))[0].plan.tags.includes('endurance'), 'endurance goal');
  assert(rankPlans(who({ goal: 'athletic', level: 'intermediate' }))[0].plan.tags.includes('athletic'), 'athletic goal');
  // Pregnancy: the pregnancy plan leads, pelvic floor is close behind, add-ons are paused.
  const preg = rankPlans(who({ gender: 'female', women: { mode: 'pregnant' } }));
  assert(preg[0].baseId === 'pregnancy-safe' && preg.find((x) => x.baseId === 'pelvic-floor')!.fit >= 75 && preg.filter((x) => x.addOn).every((x) => !x.suitable), 'pregnancy');
  // Groups: best first, every plan in exactly one category or "other" group.
  const g = planGroups(who({}));
  assert(g[0].id === 'best' && g[0].plans[0].pick && g[0].plans.length >= 1 && g[0].plans.length <= 5, 'best group');
  const rest = g.slice(1).flatMap((x) => x.plans.map((y) => y.baseId));
  assert(rest.length === plans.length && new Set(rest).size === plans.length, 'groups cover every plan once');
  assert(g[1].id === 'Muscle' && planGroups(who({ goal: 'lose fat' }))[1].id === 'Fat loss', "the goal's category comes first");
  assert(JSON.stringify(rankPlans(who({})).map((x) => [x.planId, x.fit])) === JSON.stringify(r.map((x) => [x.planId, x.fit])), 'same person, same ranking');
}
