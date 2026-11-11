import type { Day, Plan, Slot } from './plans';

// Plans fitted to a number of days. Every main plan can be run on 1-7 days a week: the week is rebuilt from training
// days that already exist (the plan's own first, then a small pool of days from other plans), using a sensible split:
//   lifting:      2-3 full body · 4 upper/lower · 5 upper/lower + full body (or push/pull/legs + upper/lower) · 6 push/pull/legs twice
//   conditioning: harder and easier sessions in turn (circuits, intervals, steady cardio, core)
//   glutes plan:  glutes, upper body and legs in turn
// Beginners keep their number of days, with lower volume: days taken from intermediate plans get fewer sets, easier
// moves, higher reps and longer rests, and the plan runs the gentler week phases with RPE notes (program.ts). At 6 or
// more days, two of a beginner's days are light recovery (mobility, an easy walk).
// Ids are stable ("ppl-gym~6", "upper-lower-gym~4b") so a saved plan id keeps working.

type Role = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'hard' | 'easy' | 'glute' | 'rec';
type Kind = 'lift' | 'cond' | 'cycle' | 'fixed';
type Shape = { kind: Kind; roles: Partial<Record<Role, number[]>> };

// What each main plan's own days are. Plans not listed here (one-muscle add-ons, recovery, pregnancy, after birth) are
// never refitted; 'fixed' plans only run as written.
export const SHAPES: Record<string, Shape> = {
  'full-body-gym': { kind: 'lift', roles: { full: [0, 1] } },
  'lean-gain': { kind: 'lift', roles: { full: [0, 1, 2] } },
  'strength-5x5': { kind: 'lift', roles: { full: [0, 1] } },
  'upper-lower-gym': { kind: 'lift', roles: { upper: [0, 2], lower: [1, 3] } },
  phul: { kind: 'lift', roles: { upper: [0, 2], lower: [1, 3] } },
  'ppl-gym': { kind: 'lift', roles: { push: [0], pull: [1], legs: [2] } },
  'arnold-split': { kind: 'lift', roles: { push: [0], pull: [1], legs: [2] } },
  'bro-split': { kind: 'fixed', roles: {} },
  'home-beginner': { kind: 'lift', roles: { full: [0, 1] } },
  'home-bodyweight': { kind: 'lift', roles: { full: [0, 1] } },
  'home-dumbbell': { kind: 'lift', roles: { upper: [0], lower: [1] } },
  'fat-loss-gym': { kind: 'cond', roles: { hard: [0, 1], easy: [2] } },
  'fat-burn-home': { kind: 'cond', roles: { hard: [0], easy: [1] } },
  'cardio-aerobic': { kind: 'cond', roles: { easy: [0, 2], hard: [1, 3] } },
  functional: { kind: 'cond', roles: { hard: [0, 1, 2] } },
  'glutes-legs-gym': { kind: 'cycle', roles: { glute: [0], upper: [1], legs: [2] } },
  // Round 14. Bodyweight plans that run anywhere: stretch flows with one control day, quick-feet days around a
  // strength day, and steady marching with one day of quicker bursts.
  'move-better': { kind: 'cond', roles: { easy: [0, 1], hard: [2] } },
  'sport-ready': { kind: 'cond', roles: { hard: [0, 2], easy: [1] } },
  'home-stamina': { kind: 'cond', roles: { easy: [0, 2], hard: [1] } },
};
export const MAIN = Object.keys(SHAPES);

const x = (id: string, sets: number, reps: string, rest = 90): Slot => ({ id, sets, reps, rest });
const STRETCH = [x('Cat_Stretch', 2, '30s', 15), x('Kneeling_Hip_Flexor', 2, '30s/side', 15), x('Childs_Pose', 2, '30s', 15)];
// Pool days that no plan has on its own: bodyweight upper and lower days for home, and an easy walk for recovery.
export const EXTRA: Record<string, Day> = {
  'home-upper': { name: 'Home Upper', focus: 'Push · Row · Shoulders', slots: [
    x('Pushups', 3, '6-10', 60), x('wg_doorway-row', 3, '10', 60), x('wg_pike-push-up', 2, '8', 60),
    x('wg_towel-row', 3, '10', 60), x('wg_chair-dip', 2, '10', 60), x('Plank', 3, '30s', 45) ] },
  'home-lower': { name: 'Home Lower', focus: 'Squat · Lunge · Glutes', slots: [
    x('Bodyweight_Squat', 3, '15', 60), x('Bodyweight_Walking_Lunge', 3, '10/side', 60), x('Single_Leg_Glute_Bridge', 3, '10/side', 45),
    x('wg_wall-sit', 3, '30s', 45), x('wg_calf-raise', 3, '15', 45), x('Dead_Bug', 3, '10/side', 45) ] },
  'walk-gym': { name: 'Easy Walk & Stretch', focus: 'Light recovery', slots: [x('Walking_Treadmill', 1, '20 min', 60), ...STRETCH] },
  'walk-home': { name: 'Easy Walk & Stretch', focus: 'Light recovery', slots: [x('March_In_Place', 1, '10 min', 30), ...STRETCH] },
};

// Where a role comes from when the plan has no day of its own for it. "plan:index" or "extra:key".
const POOL = (home: boolean, beginner: boolean): Partial<Record<Role, string[]>> => home
  ? {
    full: beginner ? ['home-beginner:0', 'home-beginner:1'] : ['home-bodyweight:0', 'home-bodyweight:1'],
    upper: ['extra:home-upper'], lower: ['extra:home-lower'],
    hard: ['fat-burn-home:0'], easy: ['fat-burn-home:1'], rec: ['mobility:0', 'extra:walk-home'],
  }
  : {
    full: ['full-body-gym:0', 'full-body-gym:1'],
    upper: beginner ? ['upper-lower-gym:2', 'upper-lower-gym:0'] : ['upper-lower-gym:0', 'upper-lower-gym:2'],
    lower: beginner ? ['upper-lower-gym:3', 'upper-lower-gym:1'] : ['upper-lower-gym:1', 'upper-lower-gym:3'],
    push: ['ppl-gym:0'], pull: ['ppl-gym:1'], legs: ['ppl-gym:2'],
    hard: ['fat-loss-gym:0', 'fat-loss-gym:1'], easy: ['fat-loss-gym:2'], rec: ['mobility:0', 'extra:walk-gym'],
  };

// The roles for n training days, in week order.
function template(shape: Shape, n: number, home: boolean, beginner: boolean): Role[] {
  if (beginner && n >= 6) {
    const [a, b, c, d] = template(shape, 4, home, false);
    return [a, b, 'rec', c, d, 'rec', ...(n > 6 ? ['rec' as Role] : [])];
  }
  const r = shape.roles;
  if (shape.kind === 'cond') {
    const first: Role = r.hard?.includes(0) ? 'hard' : 'easy';
    const other: Role = first === 'hard' ? 'easy' : 'hard';
    if (n <= 3 && !r.easy) return Array(n).fill('hard');
    return Array.from({ length: n }, (_, i) => (i % 2 ? other : first));
  }
  if (shape.kind === 'cycle') {
    const cyc: Role[] = ['glute', 'upper', 'legs'];
    return Array.from({ length: n }, (_, i) => cyc[i % 3]);
  }
  const ppl = !!r.push;
  if (n <= 3) return ppl && n === 3 ? ['push', 'pull', 'legs'] : Array(n).fill('full');
  if (n === 4) return ['upper', 'lower', 'upper', 'lower'];
  if (n === 5) return ppl ? ['push', 'pull', 'legs', 'upper', 'lower'] : ['upper', 'lower', 'full', 'upper', 'lower'];
  const six: Role[] = home ? ['upper', 'lower', 'full', 'upper', 'lower', 'full'] : ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
  return n === 6 ? six : [...six, 'rec'];
}

// A full-body day from an upper/lower plan's own days: lower, upper, upper, lower, upper, lower (big lifts first).
function merge(base: Plan, shape: Shape, k: number): Day {
  const up = base.days[shape.roles.upper![k]].slots, lo = base.days[shape.roles.lower![k]].slots;
  const slots = [lo[0], up[0], up[1], lo[1], up[2], lo[2]].filter(Boolean);
  return { name: `Full Body ${'ABC'[k] ?? k + 1}`, focus: 'Upper and lower in one', slots };
}

// Monday = 0. Training days spread so hard days have rest between them where the week allows.
const SPREAD: Record<number, number[]> = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
};

// Easier stand-ins for a beginner's first weeks: machines, dumbbells and goblet squats before heavy barbell work.
const EASIER: Record<string, string> = {
  Barbell_Deadlift: 'Romanian_Deadlift', Pullups: 'Wide-Grip_Lat_Pulldown', 'Chin-Up': 'Wide-Grip_Lat_Pulldown',
  'Dips_-_Chest_Version': 'Dumbbell_Bench_Press', Bent_Over_Barbell_Row: 'Seated_Cable_Rows', Hack_Squat: 'Leg_Press',
  Barbell_Squat: 'Goblet_Squat', 'Barbell_Bench_Press_-_Medium_Grip': 'Dumbbell_Bench_Press',
  Standing_Military_Press: 'Dumbbell_Shoulder_Press', Lying_Triceps_Press: 'Triceps_Pushdown',
  'Close-Grip_Barbell_Bench_Press': 'Triceps_Pushdown', Front_Box_Jump: 'Bodyweight_Squat', Pushups: 'wg_knee-push-up',
};
const range = (reps: string) => { const m = reps.match(/^(\d+)(?:-(\d+))?$/); return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null; };
// Lower volume and intensity: one set fewer (2-3 sets), no heavy low-rep sets, longer rests, easier moves.
export function ease(d: Day): Day {
  const ids = new Set(d.slots.map((s) => s.id));
  return {
    ...d,
    slots: d.slots.map((s) => {
      const alt = EASIER[s.id];
      const id = alt && !ids.has(alt) ? alt : s.id;
      const r = range(s.reps);
      return {
        id,
        sets: s.sets >= 2 ? Math.min(3, Math.max(2, s.sets - 1)) : s.sets,
        reps: r && r[0] < 8 && r[1] <= 10 ? '8-10' : s.reps,
        rest: s.rest >= 60 ? Math.min(180, s.rest + 30) : s.rest + 15,
      };
    }),
  };
}

const WORD = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
type Split = { name: string; tagline: string; about: string; benefits: string[] };
const SPLITS: Record<string, Split> = {
  full: { name: 'Full Body', tagline: 'Full-body days with rest between.', about: 'Every session trains your whole body with a few big moves. Simple, efficient and easy to recover from.', benefits: ['Every muscle each session', 'Easy to recover from', 'Short, simple sessions'] },
  ul: { name: 'Upper / Lower', tagline: 'Upper body and legs, twice each.', about: 'Upper days train chest, back, shoulders and arms; lower days train legs and glutes. Each half rests while the other works.', benefits: ['Each muscle twice a week', 'Rest built into the split', 'Focused sessions'] },
  ulf: { name: 'Upper / Lower + Full Body', tagline: 'Upper and lower twice, plus a full-body day.', about: 'Upper and lower days do most of the work, and a full-body day ties the week together.', benefits: ['Each muscle two or three times a week', 'Varied, focused sessions', 'Rest built into the split'] },
  pplul: { name: 'Push Pull Legs + Upper / Lower', tagline: 'Push, pull and legs, then upper and lower.', about: 'Pushing muscles, pulling muscles and legs each get a day, then upper and lower days add a second hit.', benefits: ['Each muscle twice a week', 'High volume for size', 'Clear focus every session'] },
  ppl: { name: 'Push Pull Legs', tagline: 'Push, pull and legs, twice a week.', about: 'Pushing muscles, pulling muscles and legs each get their own day, so you can do more work for each.', benefits: ['Each muscle twice a week', 'High volume for size', 'Clear focus every session'] },
  ulfh: { name: 'Upper / Lower + Full Body', tagline: 'Upper, lower and full body, twice a week.', about: 'Upper and lower days do most of the work, and full-body days tie the week together.', benefits: ['Each muscle two or three times a week', 'No gym needed', 'Varied sessions'] },
};
const splitOf = (roles: Role[]): string => {
  const has = (r: Role) => roles.includes(r);
  if (has('push')) return has('upper') ? 'pplul' : 'ppl';
  if (has('upper')) return has('full') ? (roles.filter((r) => r === 'full').length > 1 ? 'ulfh' : 'ulf') : 'ul';
  return 'full';
};
const WHY: Record<string, (n: number) => string> = {
  full: (n) => `${WORD[n]} full-body day${n > 1 ? 's' : ''} train${n > 1 ? '' : 's'} every muscle ${['', 'once', 'twice'][n] ?? `${WORD[n].toLowerCase()} times`} a week, with rest days between.`,
  ul: (n) => (n >= 4 ? `${WORD[n]} days trains each half of the body twice a week and leaves rest days to recover.` : `${WORD[n]} days alternate upper and lower body, so each half rests while the other works.`),
  ulf: () => 'Five days runs upper and lower twice, then one full-body day, so each muscle works two or three times a week.',
  pplul: () => 'Five days runs push, pull and legs, then upper and lower, so each muscle is trained twice a week.',
  ppl: (n) => (n >= 6 ? 'Six days runs push, pull and legs twice, so each muscle is trained twice a week.' : `${WORD[n]} days runs push, pull and legs once, so each muscle gets one hard session and a full week to recover.`),
  ulfh: () => 'Six days runs upper, lower and full body twice, so each muscle works two or three times a week.',
  cond: (n) => `${WORD[n]} days alternate harder and easier sessions, so you recover between the hard ones.`,
  hard: (n) => `${WORD[n]} hard session${n > 1 ? 's' : ''} with rest days between. Hard mixed sessions need about 48 hours to recover from.`,
  cycle: (n) => `${WORD[n]} days rotate glutes, upper body and legs, so each gets rest before it trains again.`,
};
// Tips that describe the original week (A-B-A, "three days") don't fit a refitted one.
const weekTip = /A and B|A-B-A|three days|six sessions|rest days a week|three rest days|sets of five/i;
const DAYS_RE = /\b(one|two|three|four|five|six|seven)( full-body)? days?\b/i;
const count = (n: number) => `${WORD[n]} day${n > 1 ? 's' : ''}`;

// Builds plan `base` for n training days. null when the plan can't sensibly run on n days (a fixed plan, or a
// conditioning or glutes week that would use none of the plan's own days).
export function fit(base: Plan, n: number, beginner: boolean, byId: Record<string, Plan>): Plan | null {
  const shape = SHAPES[base.id];
  if (!shape || shape.kind === 'fixed' || n < 1 || n > 7) return null;
  const home = base.place !== 'gym'; // plans that run anywhere are bodyweight plans: they borrow from the home pool
  const pool = POOL(home, beginner);
  const roles = template(shape, n, home, beginner);
  const used: Record<string, number> = {};
  const keys = roles.map((role) => {
    const k = used[role] ?? 0;
    used[role] = k + 1;
    const own = shape.roles[role];
    if (own?.length) return `${base.id}:${own[k % own.length]}`;
    // An upper/lower plan makes its own full-body days: the first half of an upper day with the first half of a lower day.
    if (role === 'full' && shape.roles.upper && shape.roles.lower) return `merge:${k % Math.min(shape.roles.upper.length, shape.roles.lower.length)}`;
    const from = pool[role] ?? pool.full!;
    return from[k % from.length];
  });
  const training = keys.filter((_, i) => roles[i] !== 'rec');
  const own = training.filter((k) => k.startsWith(`${base.id}:`) || k.startsWith('merge:')).length;
  // A lifting plan may be built entirely from pool days (a home full-body plan at 4 days becomes upper/lower); a
  // conditioning or glutes plan without its own days would not be that plan any more.
  if (!own && shape.kind !== 'lift') return null;

  // The app runs plan days in rotation (days[0], days[1], ...). Unique days are enough when the week is that rotation
  // (A-B-A, push-pull-legs twice); otherwise each training day gets its own entry, so the rotation follows the week.
  const uniq = [...new Set(keys)];
  const order = keys.every((k, i) => k === uniq[i % uniq.length]) ? uniq : keys;
  const days = order.map((k) => {
    const [src, idx] = k.split(':');
    const d = src === 'extra' ? EXTRA[idx] : src === 'merge' ? merge(base, shape, Number(idx)) : byId[src].days[Number(idx)];
    const level = src === 'extra' ? (idx.startsWith('walk') ? 'beginner' : 'intermediate') : byId[src === 'merge' ? base.id : src].level;
    return beginner && level !== 'beginner' ? ease(d) : d;
  });
  const week: (number | null)[] = Array(7).fill(null);
  SPREAD[n].forEach((wd, i) => { week[wd] = order === keys ? i : order.indexOf(keys[i]); });

  const rec = roles.filter((r) => r === 'rec').length;
  const lifts = n - rec;
  // A lifting plan keeps its name when every training day is its own and the split is its usual one (push/pull/legs
  // on 3 or 6 days, upper/lower on 4); otherwise it is named for the split it became.
  const split = shape.kind === 'lift' ? splitOf(roles) : null;
  const natural = shape.roles.push ? 'ppl' : shape.roles.upper ? 'ul' : 'full';
  const look = split && (own < training.length || split !== natural) ? SPLITS[split] : null;
  const homeName = look && home ? `Home ${look.name}` : look?.name;
  const why = shape.kind === 'cycle' ? WHY.cycle(lifts) : shape.kind === 'cond' ? (roles.includes('easy') ? WHY.cond(lifts) : WHY.hard(lifts)) : WHY[split!](lifts);
  const tagline = rec ? `${count(lifts)} of training and ${rec === 1 ? 'one light recovery day' : `${WORD[rec].toLowerCase()} light recovery days`}.`
    : look ? look.tagline
    : shape.kind === 'cycle' ? `Glutes, upper body and legs in turn. ${count(n)} a week.`
    : DAYS_RE.test(base.tagline) ? base.tagline.replace(DAYS_RE, (m) => (m[0] === m[0].toUpperCase() ? count(n) : count(n).toLowerCase()))
    : `${base.tagline} ${count(n)} a week.`;
  return {
    ...base,
    id: `${base.id}~${n}${beginner ? 'b' : ''}`,
    name: homeName ?? base.name,
    tagline,
    level: beginner ? 'beginner' : base.level,
    about: look?.about ?? base.about,
    who: beginner ? `Beginners who want to train ${n} days a week.` : look ? `Anyone who can train ${n} days a week.` : base.who,
    why: rec ? `${why} ${rec === 1 ? 'One easy recovery day helps' : `${WORD[rec]} easy recovery days help`} a new body bounce back.` : why,
    benefits: (look?.benefits ?? base.benefits).filter((t) => !weekTip.test(t)),
    tips: base.tips.filter((t) => !weekTip.test(t)),
    week,
    days,
    base: base.id,
    easy: beginner || undefined,
    recovery: rec || undefined,
    own: own / training.length,
  };
}

// Whether a plan as written already is what fit() would make for these days and this level.
export const asWritten = (base: Plan, n: number, beginner: boolean) =>
  base.week.filter((d) => d !== null).length === n && (!beginner || (base.level === 'beginner' && n < 6));

// Every fitted plan, built once at start-up so planById can look up any saved id. Plans as written keep their own id.
export function variants(all: Plan[]): Plan[] {
  const byId = Object.fromEntries(all.map((p) => [p.id, p]));
  const out: Plan[] = [];
  for (const id of MAIN) {
    const base = byId[id];
    if (!base) continue;
    for (let n = 1; n <= 7; n++) for (const b of [false, true]) {
      if (asWritten(base, n, b)) continue;
      const v = fit(base, n, b, byId);
      if (v) out.push(v);
    }
  }
  return out;
}
