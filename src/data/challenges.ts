// Challenges: 14 to 30 days of one clear task a day, picked for a goal and a level. Pure data and pure functions (no
// React Native), so scripts/selfcheck.mjs can run the day logic in Node.
//
// A challenge is a list of days. Each day asks for zero or more tasks (zero = a rest day). A day is done when every
// task is done in the person's real data (a finished workout, the steps their watch counted, the protein and water
// they logged), or when they tick the day by hand (ChallengeRun.done, for days the app can't see: a walk without a
// watch, a workout logged elsewhere). Weekly challenges ask for N workouts in each 7-day block, any days.
// Forgiving by design: every challenge has free misses. The badge needs no more misses than that; after it, the person
// can still finish, and the end screen says honestly how many days they got.
import type { Ionicons } from '@expo/vector-icons';
import { dayKey, postpartumWeek, pregnancyWeek } from '../calc';
import type { ChallengeRun, Profile } from '../store';
import type { Domain } from '../theme';
import { CARDIO } from './cardio';
import type { Slot } from './plans';
import { quickById, type Quick } from './quick';

type Icon = keyof typeof Ionicons.glyphMap;
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type GoalTag = 'Weight loss' | 'Muscle gain' | 'Strength' | 'HIIT' | 'Core' | 'Mobility' | 'Steps' | 'Habits' | 'Consistency';
export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
export const GOALS: GoalTag[] = ['Weight loss', 'Muscle gain', 'Strength', 'HIIT', 'Core', 'Mobility', 'Steps', 'Habits', 'Consistency'];
// One domain colour per goal (src/theme.ts DOMAINS), read as dom[GOAL_COLOR[goal]] at render time.
export const GOAL_COLOR: Record<GoalTag, Domain> = {
  'Weight loss': 'kcal', 'Muscle gain': 'train', Strength: 'weight', HIIT: 'heart', Core: 'protein', Mobility: 'sleep', Steps: 'steps', Habits: 'water', Consistency: 'streak',
};

export type Task =
  | { kind: 'workout' } // any finished workout (ours, or a watch workout of 15+ min)
  | { kind: 'session'; q: Quick } // this exact session (started from the challenge)
  | { kind: 'cardio'; min: number } // a cardio session from the app, or a watch workout of `min`+ minutes
  | { kind: 'steps'; n: number } // steps from the watch
  | { kind: 'protein' } // the protein target from src/calc.ts targets() (3 meals in no-numbers mode)
  | { kind: 'water' }; // the person's water goal (State.waterPrefs)
export type ChDay = { tasks: Task[]; rest?: boolean }; // rest with tasks: no training, but still e.g. protein

export type Challenge = {
  id: string; name: string; tagline: string; why: string; level: Level; goal: GoalTag; days: number;
  effort: string; // how long a day takes, e.g. "12–20 min a day"
  icon: Icon; badge: string; // the finisher badge's name
  free: number; // missed days forgiven (missed weeks for weekly challenges)
  weekly?: number; // weekly challenge: this many workouts in each 7-day block, any days
  gear?: 'gym'; // needs a gym (barbells)
  day: (i: number) => ChDay; // what day i (0-based) asks
};

// --- Sessions the challenges start. Same shape as src/data/quick.ts; every id is checked by selfCheck below and by
// scripts/check.mjs (the x() entries).
const x = (id: string, sets: number, reps: string, rest = 20): Slot => ({ id, sets, reps, rest });
const Q = (id: string, name: string, minutes: number, icon: Icon, tags: Quick['tags'], where: Quick['where'], blurb: string, slots: Slot[], gear?: string[]): Quick =>
  ({ id, name, minutes, icon, tags, where, blurb, slots, gear });

export const circuits: Quick[] = [
  Q('ch-starter', '10-minute starter', 10, 'rocket', ['strength', 'cardio'], ['home', 'anywhere'], 'March, squat, wall push-up, bridge, plank. Easy on the joints.',
    [x('March_In_Place', 1, '60s', 15), x('Bodyweight_Squat', 2, '10', 30), x('wg_wall-push-up', 2, '10', 30), x('Butt_Lift_Bridge', 2, '12', 30), x('Plank', 2, '20s', 30)]),
  Q('ch-fatburn', 'Fat-burn circuit', 20, 'flame', ['cardio', 'strength'], ['home', 'anywhere'], 'Six moves, short rests. Keeps your heart rate up the whole way.',
    [x('Bodyweight_Squat', 3, '15'), x('wg_jumping-jack', 3, '40s'), x('wg_knee-push-up', 3, '10'), x('wg_forward-lunge', 3, '10/side'), x('Mountain_Climbers', 3, '30s'), x('Plank', 3, '30s')]),
  Q('ch-hiit-1', 'Spark HIIT', 12, 'flash', ['cardio'], ['home', 'anywhere'], 'Jacks, squats, high knees, climbers. 30 seconds on, 20 off.',
    [x('wg_jumping-jack', 3, '30s'), x('Bodyweight_Squat', 3, '15'), x('wg_high-knees', 3, '30s'), x('Mountain_Climbers', 3, '30s')]),
  Q('ch-hiit-2', 'Build HIIT', 16, 'flash', ['cardio'], ['home', 'anywhere'], 'Half burpees, skater hops, plank jacks, lunges, high knees.',
    [x('wg_half-burpee', 3, '8'), x('wg_skater-hop', 3, '30s'), x('wg_plank-jack', 3, '30s'), x('wg_forward-lunge', 3, '10/side'), x('wg_high-knees', 3, '30s')]),
  Q('ch-hiit-3', 'Burn HIIT', 20, 'flash', ['cardio'], ['home', 'anywhere'], 'Burpees, split jumps, climbers, skaters, star jumps. 40 on, 20 off.',
    [x('wg_burpee', 4, '10'), x('Split_Jump', 4, '8/side'), x('Mountain_Climbers', 4, '40s'), x('wg_skater-hop', 4, '40s'), x('Star_Jump', 4, '10')]),
  Q('ch-core-2', 'Steel core', 12, 'flame', ['core'], ['home', 'anywhere'], 'Hollow hold, shoulder taps, side plank, reverse crunch, bird dog.',
    [x('wg_hollow-body-hold', 3, '20s', 15), x('wg_plank-shoulder-tap', 3, '16', 15), x('Side_Bridge', 3, '20s/side', 15), x('Reverse_Crunch', 3, '12', 15), x('wg_bird-dog', 3, '8/side', 15)]),
  Q('ch-hips', 'Hips and back flow', 10, 'leaf', ['mobility', 'calm'], ['home', 'anywhere'], 'Inchworms, hip circles, lunging stretch, cat-cow, child’s pose.',
    [x('Inchworm', 2, '5', 15), x('Standing_Hip_Circles', 2, '30s', 10), x('Runners_Stretch', 2, '30s/side', 10), x('Cat_Stretch', 2, '30s', 10), x('Upper_Back_Stretch', 2, '30s', 10), x('Childs_Pose', 1, '60s', 0)]),
  Q('ch-strength-a', 'Strength A: squat, bench, row', 50, 'barbell', ['strength'], ['gym'], 'Five sets of five, heavy. Long rests, perfect reps.',
    [x('Barbell_Squat', 5, '5', 150), x('Barbell_Bench_Press_-_Medium_Grip', 5, '5', 150), x('Bent_Over_Barbell_Row', 5, '5', 120)], ['barbell']),
  Q('ch-strength-b', 'Strength B: deadlift, press, pull-up', 50, 'barbell', ['strength'], ['gym'], 'Heavy pulls and presses. Stop each set with a rep in the tank.',
    [x('Barbell_Deadlift', 3, '5', 180), x('Standing_Military_Press', 5, '5', 150), x('Pullups', 4, '6', 120)], ['barbell']),
  // Push-up 30: the main sets grow each week.
  ...([['3', '8'], ['4', '10'], ['4', '12'], ['5', '12']] as const).map(([sets, reps], w) =>
    Q(`ch-push-${w + 1}`, `Push-ups · week ${w + 1}`, 5 + w * 2, 'fitness', ['strength'], ['home', 'anywhere'], `${sets} × ${reps} push-ups, plus scapular push-ups for healthy shoulders.`,
      [x('wg_scapular-push-up', 2, '10', 30), x('Pushups', +sets, reps, 60)])),
];
const C = Object.fromEntries(circuits.map((q) => [q.id, q])) as Record<string, Quick>;

// Task shorthands.
const W: Task = { kind: 'workout' };
const P: Task = { kind: 'protein' };
const H2O: Task = { kind: 'water' };
const S = (q: Quick): Task => ({ kind: 'session', q });
const STEPS = (n: number): Task => ({ kind: 'steps', n });
const CARD = (min: number): Task => ({ kind: 'cardio', min });
// A weekly pattern: day i asks for pattern[i % length]; [] is a rest day.
const every = (pattern: Task[][]) => (i: number): ChDay => {
  const tasks = pattern[i % pattern.length];
  return { tasks };
};
const plus = (t: Task, d: ChDay): ChDay => ({ tasks: [...d.tasks, t], rest: d.rest || !d.tasks.length }); // a rest day keeps its label

export const challenges: Challenge[] = [
  {
    id: 'kickstart-21', name: '21-day Kickstart', tagline: 'Build the habit in three weeks, one small step a day.', level: 'Beginner', goal: 'Consistency', days: 21,
    effort: '10–45 min a day', icon: 'rocket', badge: 'Kickstarter', free: 2,
    why: 'Three workouts from your plan each week, a 10-minute starter and a walk. Short enough to fit any day, long enough to stick.',
    day: every([[W], [S(C['ch-starter'])], [], [W], [STEPS(6000)], [W], []]),
  },
  {
    id: 'weightloss-28', name: 'Weight loss 28', tagline: 'Move every day, eat your protein, watch it add up.', level: 'Beginner', goal: 'Weight loss', days: 28,
    effort: '20–40 min a day', icon: 'flame', badge: 'Lean machine', free: 3,
    why: 'Circuits and cardio burn energy, 8,000 steps keep you moving on the days between, and protein keeps the weight you lose fat, not muscle.',
    day: (i) => plus(P, every([[S(C['ch-fatburn'])], [STEPS(8000)], [CARD(20)], [W], [STEPS(8000)], [CARD(20)], []])(i)),
  },
  {
    id: 'muscle-30', name: 'Muscle gain 30', tagline: 'Four workouts a week and your protein, every single day.', level: 'Intermediate', goal: 'Muscle gain', days: 30,
    effort: '45–60 min, 4 days a week', icon: 'barbell', badge: 'Builder', free: 3,
    why: 'Muscle grows from hard sets plus enough protein, repeated. Thirty days is long enough to see it in the mirror and in your numbers.',
    day: (i) => {
      const train = [true, true, false, true, true, false, false][i % 7];
      return train ? { tasks: [W, P] } : { tasks: [P], rest: true };
    },
  },
  {
    id: 'hiit-21', name: 'HIIT 21', tagline: 'Short, sweaty intervals that level up every week.', level: 'Intermediate', goal: 'HIIT', days: 21,
    effort: '10–20 min a day', icon: 'flash', badge: 'Spark plug', free: 2,
    why: 'Three interval sessions a week, a harder one each week, with mobility days between so your legs keep up.',
    day: (i) => {
      const h = S(C[`ch-hiit-${Math.min(3, Math.floor(i / 7) + 1)}`]);
      return every([[h], [S(quickById.mobility)], [h], [], [h], [S(C['ch-hips'])], []])(i);
    },
  },
  {
    id: 'strength-28', name: 'Advanced strength 28', tagline: 'Heavy fives on the big lifts, four days a week.', level: 'Advanced', goal: 'Strength', days: 28,
    effort: '50 min, 4 days a week', icon: 'trophy', badge: 'Iron will', free: 2, gear: 'gym',
    why: 'Squat, bench, row, deadlift, press and pull-ups at five reps. Add a little weight each week when every rep is clean.',
    day: every([[S(C['ch-strength-a'])], [], [S(C['ch-strength-b'])], [], [S(C['ch-strength-a'])], [S(C['ch-strength-b'])], []]),
  },
  {
    id: 'shred-21', name: 'Shred 21', tagline: 'Lift, sprint, walk and eat clean. For when you’re ready to go hard.', level: 'Advanced', goal: 'Weight loss', days: 21,
    effort: '20–60 min a day', icon: 'speedometer', badge: 'Shredded', free: 1,
    why: 'Three strength workouts, two hard HIIT days, 10,000 steps and protein every day. One rest day a week, and you’ll want it.',
    day: (i) => plus(P, every([[W], [S(C['ch-hiit-3'])], [W], [STEPS(10000)], [W], [CARD(25)], []])(i)),
  },
  {
    id: 'core-14', name: 'Core 14', tagline: 'Ten minutes a day for a stronger middle.', level: 'Intermediate', goal: 'Core', days: 14,
    effort: '10–12 min a day', icon: 'body', badge: 'Rock solid', free: 1,
    why: 'Week one builds the basics, week two holds longer and adds anti-rotation. A strong core makes every lift and run feel better.',
    day: (i) => (i % 7 === 6 ? { tasks: [] } : { tasks: [S(i < 7 ? quickById.core : C['ch-core-2'])] }),
  },
  {
    id: 'pushup-30', name: 'Push-up 30', tagline: 'From a few good push-ups to sixty in one session.', level: 'Intermediate', goal: 'Strength', days: 30,
    effort: '5–11 min a day', icon: 'fitness', badge: 'Push-up pro', free: 3,
    why: 'Two days on, one off. The sets grow every week, so your chest, shoulders and arms keep adapting.',
    day: (i) => (i % 3 === 2 ? { tasks: [] } : { tasks: [S(C[`ch-push-${Math.min(4, Math.floor(i / 7) + 1)}`])] }),
  },
  {
    id: 'mobility-14', name: 'Mobility 14', tagline: 'Loosen hips, back and shoulders in ten minutes a day.', level: 'Beginner', goal: 'Mobility', days: 14,
    effort: '10–12 min a day', icon: 'leaf', badge: 'Bendy', free: 2,
    why: 'Two gentle flows on alternate days. Great after a desk day, and your squats will thank you.',
    day: (i) => ({ tasks: [S(i % 2 ? C['ch-hips'] : quickById.mobility)] }),
  },
  {
    id: 'steps-21', name: '10k steps 21', tagline: 'Walk 10,000 steps a day for three weeks.', level: 'Beginner', goal: 'Steps', days: 21,
    effort: 'About 90 min of walking', icon: 'footsteps', badge: 'Trailblazer', free: 3,
    why: 'Walking is the easiest fat burner there is. Split it up: a walk after each meal gets you most of the way.',
    day: () => ({ tasks: [STEPS(10000)] }),
  },
  {
    id: 'hydration-14', name: 'Hydration 14', tagline: 'Drink your water goal every day for two weeks.', level: 'Beginner', goal: 'Habits', days: 14,
    effort: 'A glass at a time', icon: 'water', badge: 'Well watered', free: 2,
    why: 'Even a little dehydration makes workouts feel harder. Two weeks of logging every glass turns it into a habit.',
    day: () => ({ tasks: [H2O] }),
  },
  {
    id: 'consistency-30', name: 'Consistency 30', tagline: 'Three workouts a week, any days you like.', level: 'Beginner', goal: 'Consistency', days: 30,
    effort: '3 workouts a week', icon: 'calendar', badge: 'Never miss a week', free: 1, weekly: 3,
    why: 'Results come from showing up week after week. Pick your days; any workout counts, from the app or your watch.',
    day: () => ({ tasks: [W] }),
  },
];
export const challengeById: Record<string, Challenge> = Object.fromEntries(challenges.map((x) => [x.id, x]));

// --- What the app knows about a day, from the store and the tracker. Built by src/challenges/use.tsx.
export type Ctx = {
  sessions: { startedAt: number; title: string }[];
  watch: { start: string; durationS: number }[]; // imported watch workouts (merged ones are already our sessions)
  meals: { day: string; protein: number }[];
  water: Record<string, number>; // glasses by day
  glassMl: number; waterGoalMl: number; proteinTarget: number; gentle?: boolean;
  steps: Record<string, number | undefined>; // steps by day, from the watch
  excused?: Record<string, unknown>; // days excused on Today (sick, travel, rest): they pause the challenge like a rest day
};
export type TaskState = { task: Task; done: boolean; have?: number; need?: number };
export type DayState = 'done' | 'missed' | 'rest' | 'today' | 'upcoming' | 'open';
// madeUp: missed, then made up on one of the next two days. makeUp: missed, and that is still possible (yesterday or
// the day before). excused: a day excused on Today, which counts like a rest day.
export type DayInfo = {
  i: number; key: string; tasks: TaskState[]; rest: boolean; required: boolean; ticked: boolean; done: boolean; state: DayState;
  madeUp?: boolean; makeUp?: boolean; excused?: boolean;
};
export type WeekInfo = { from: number; to: number; have: number; need: number; state: 'done' | 'missed' | 'current' | 'upcoming' };
export type Progress = {
  ch: Challenge; run: ChallengeRun; days: DayInfo[]; todayIdx: number; today?: DayInfo; weeks?: WeekInfo[];
  done: number; required: number; missed: number; freeLeft: number; streak: number; pct: number; // rest days count as done
  makeUp?: DayInfo; // the oldest missed day that can still be made up today
  over: boolean; completed: boolean; // over: every day has passed (or all done early); completed: over within the free misses
};

const DAY = 86400000;
export const addDays = (key: string, n: number) => dayKey(Date.parse(key + 'T12:00:00') + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / DAY);
const CARDIO_NAMES = new Set([...CARDIO.map((s) => s.name), ...circuits.filter((q) => q.tags.includes('cardio')).map((q) => q.name)]);

export function taskState(t: Task, day: string, ctx: Ctx): TaskState {
  const ours = ctx.sessions.filter((s) => dayKey(s.startedAt) === day);
  const watch = ctx.watch.filter((w) => dayKey(Date.parse(w.start)) === day);
  switch (t.kind) {
    case 'workout': return { task: t, done: ours.length > 0 || watch.some((w) => w.durationS >= 15 * 60) };
    case 'session': return { task: t, done: ours.some((s) => s.title === t.q.name) };
    case 'cardio': return { task: t, done: ours.some((s) => CARDIO_NAMES.has(s.title)) || watch.some((w) => w.durationS >= t.min * 60) };
    case 'steps': { const have = ctx.steps[day]; return { task: t, done: (have ?? 0) >= t.n, have, need: t.n }; }
    case 'protein': {
      const mine = ctx.meals.filter((m) => m.day === day);
      if (ctx.gentle) return { task: t, done: mine.length >= 3, have: mine.length, need: 3 };
      const have = Math.round(mine.reduce((a, m) => a + (m.protein || 0), 0));
      return { task: t, done: have >= ctx.proteinTarget, have, need: ctx.proteinTarget };
    }
    case 'water': { const have = (ctx.water[day] ?? 0) * ctx.glassMl; return { task: t, done: have >= ctx.waterGoalMl, have, need: ctx.waterGoalMl }; }
  }
}

// A missed day isn't lost: doing its task again on one of the next two days makes it up. Workouts count when that day
// has more of them than it asked for itself; steps, protein and water when that day didn't ask for the same thing.
// Each extra on a day makes up one missed day, oldest first.
const MAKE_UP_DAYS = 2;
function makeUps(days: DayInfo[], todayIdx: number, ctx: Ctx) {
  const used = new Map<string, number>(); // `${day}|${bucket}` -> extras already spent
  const bucket = (t: Task) => (t.kind === 'session' ? `s:${t.q.name}` : t.kind === 'workout' || t.kind === 'cardio' ? 'w' : t.kind);
  const count = (t: Task, key: string) => {
    const ours = ctx.sessions.filter((s) => dayKey(s.startedAt) === key);
    const watch = ctx.watch.filter((w) => dayKey(Date.parse(w.start)) === key && w.durationS >= 15 * 60).length;
    if (t.kind === 'session') return ours.filter((s) => s.title === t.q.name).length;
    if (t.kind === 'workout' || t.kind === 'cardio') return ours.length + watch;
    return taskState(t, key, ctx).done ? 1 : 0;
  };
  for (const d of days) {
    if (d.state !== 'missed') continue;
    const todo = d.tasks.filter((t) => !t.done).map((t) => t.task);
    for (let j = d.i + 1; j <= Math.min(todayIdx, d.i + MAKE_UP_DAYS, days.length - 1); j++) {
      const on = days[j];
      const spend: string[] = [];
      const ok = todo.every((t) => {
        const b = bucket(t), k = `${on.key}|${b}`;
        const own = on.tasks.filter((x) => (b === 'w' ? ['workout', 'cardio', 'session'].includes(x.task.kind) : bucket(x.task) === b)).length;
        const extra = count(t, on.key) - own - (used.get(k) ?? 0) - spend.filter((x) => x === k).length;
        if (extra < 1) return false;
        spend.push(k);
        return true;
      });
      if (ok) {
        for (const k of spend) used.set(k, (used.get(k) ?? 0) + 1);
        Object.assign(d, { done: true, madeUp: true, state: 'done' });
        break;
      }
    }
    if (d.state === 'missed' && todayIdx <= d.i + MAKE_UP_DAYS) d.makeUp = true;
  }
}

// Milestone stars at a quarter, half and three quarters, and the badge at the finish.
export const MILESTONES = [{ at: 0.25, label: 'Quarter way' }, { at: 0.5, label: 'Halfway' }, { at: 0.75, label: 'Three quarters' }] as const;
export const milestoneKey = (run: ChallengeRun, k: number) => `challenge:${run.id}:${run.start}:${k}`;
// The highest milestone reached that hasn't been celebrated yet (seen: the store's hints map).
export function newMilestone(p: Progress, seen: Record<string, number>) {
  if (p.over) return null;
  for (let k = MILESTONES.length - 1; k >= 0; k--) {
    if (p.pct >= MILESTONES[k].at && !seen[milestoneKey(p.run, k)]) return { k, ...MILESTONES[k] };
  }
  return null;
}

// Where a run stands on `today`. Days before today that asked for something and weren't done are missed; rest days
// never are. A weekly challenge never misses a day, only a week that ended short.
export function progress(ch: Challenge, run: ChallengeRun, ctx: Ctx, today = dayKey()): Progress {
  const todayIdx = Math.max(0, daysBetween(run.start, today));
  const ticks = new Set(run.done);
  const days: DayInfo[] = Array.from({ length: ch.days }, (_, i) => {
    const key = addDays(run.start, i);
    const d = ch.day(i);
    const future = i > todayIdx;
    const tasks = d.tasks.map((t) => (future ? { task: t, done: false } : taskState(t, key, ctx)));
    const required = !ch.weekly && tasks.length > 0;
    const ticked = !future && ticks.has(key);
    const done = tasks.length > 0 && (ticked || tasks.every((t) => t.done));
    const excused = !done && !future && i < todayIdx && required && !!ctx.excused?.[key];
    const state: DayState = done ? 'done' : !tasks.length || excused ? 'rest' : i === todayIdx ? 'today' : future ? 'upcoming' : ch.weekly ? 'open' : 'missed';
    return { i, key, tasks, rest: !tasks.length || !!d.rest || excused, required, ticked, done, state, excused };
  });
  if (!ch.weekly) makeUps(days, todayIdx, ctx);
  let done: number, required: number, missed: number, weeks: WeekInfo[] | undefined;
  if (ch.weekly) {
    weeks = [];
    for (let from = 0; from < ch.days; from += 7) {
      const to = Math.min(ch.days, from + 7) - 1;
      const need = to - from === 6 ? ch.weekly : Math.ceil((ch.weekly * (to - from + 1)) / 7);
      const have = days.slice(from, to + 1).filter((d) => d.done).length;
      const state = have >= need ? 'done' : to < todayIdx ? 'missed' : from <= todayIdx ? 'current' : 'upcoming';
      weeks.push({ from, to, have, need, state });
    }
    done = weeks.reduce((a, w) => a + Math.min(w.have, w.need), 0);
    required = weeks.reduce((a, w) => a + w.need, 0);
    missed = weeks.filter((w) => w.state === 'missed').length;
  } else {
    // Rest days (and excused days) count as done once they arrive: resting is part of the plan.
    done = days.filter((d) => d.done || (d.state === 'rest' && d.i <= todayIdx)).length;
    required = ch.days;
    missed = days.filter((d) => d.state === 'missed').length;
  }
  // Days in a row, today included once it's done; rest days don't break it. Weekly: weeks in a row that were met.
  let streak = 0;
  if (weeks) {
    for (let k = weeks.length - 1; k >= 0; k--) {
      const w = weeks[k];
      if (w.state === 'upcoming' || (w.state === 'current' && w.have < w.need)) continue;
      if (w.state !== 'done') break;
      streak++;
    }
  } else {
    for (let i = Math.min(todayIdx, ch.days - 1); i >= 0; i--) {
      const d = days[i];
      if (!d.required) continue;
      if (d.done) streak++;
      else if (i === todayIdx) continue; // today isn't over yet
      else break;
    }
  }
  const over = todayIdx >= ch.days || done >= required;
  return {
    ch, run, days, todayIdx, today: days[todayIdx], weeks, done, required, missed, freeLeft: Math.max(0, ch.free - missed), streak,
    makeUp: over ? undefined : days.find((d) => d.makeUp),
    pct: required ? done / required : 0, over, completed: over && missed <= ch.free,
  };
}

// --- Words.
const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const litres = (ml: number) => `${+(ml / 1000).toFixed(1)} L`;
export function taskTitle(t: Task, ctx?: Pick<Ctx, 'proteinTarget' | 'waterGoalMl' | 'gentle'>) {
  switch (t.kind) {
    case 'workout': return 'A workout from your plan';
    case 'session': return t.q.name;
    case 'cardio': return `${t.min} min of cardio`;
    case 'steps': return `${thousands(t.n)} steps`;
    case 'protein': return ctx?.gentle ? 'Log 3 meals' : ctx ? `Hit ${ctx.proteinTarget} g protein` : 'Hit your protein';
    case 'water': return ctx ? `Drink ${litres(ctx.waterGoalMl)} of water` : 'Drink your water goal';
  }
}
// One short line under a task: what's left, or what it is.
export function taskSub(s: TaskState, gentle?: boolean) {
  const t = s.task;
  if (t.kind === 'session') return `${t.q.minutes} min · ${t.q.slots.length} moves`;
  if (t.kind === 'workout') return s.done ? 'Logged' : 'Any workout counts';
  if (t.kind === 'cardio') return s.done ? 'Logged' : 'A cardio session, or a watch workout';
  if (t.kind === 'steps') return s.have === undefined ? 'No watch data yet · tick it yourself' : `${thousands(s.have)} of ${thousands(t.n)} from your watch`;
  if (t.kind === 'protein') return gentle ? `${s.have ?? 0} of 3 logged` : `${s.have ?? 0} of ${s.need} g logged`;
  return `${litres(s.have ?? 0)} of ${litres(s.need ?? 0)}`;
}
export const taskIcon = (t: Task): Icon =>
  t.kind === 'session' ? t.q.icon : t.kind === 'workout' ? 'barbell' : t.kind === 'cardio' ? 'heart' : t.kind === 'steps' ? 'footsteps' : t.kind === 'protein' ? 'nutrition' : 'water';
export const taskDomain = (t: Task): Domain =>
  t.kind === 'steps' ? 'steps' : t.kind === 'protein' ? 'protein' : t.kind === 'water' ? 'water' : t.kind === 'cardio' ? 'heart' : 'train';

// What the whole challenge asks, counted: "9 × Spark HIIT", "6 rest days".
export function summary(ch: Challenge) {
  const rows = new Map<string, { task: Task; n: number }>();
  let rest = 0;
  for (let i = 0; i < ch.days; i++) {
    const d = ch.day(i);
    if (!d.tasks.length) rest++;
    for (const t of d.tasks) {
      const k = t.kind === 'session' ? t.q.id : t.kind === 'steps' ? `steps-${t.n}` : t.kind === 'cardio' ? `cardio-${t.min}` : t.kind;
      rows.set(k, { task: t, n: (rows.get(k)?.n ?? 0) + 1 });
    }
  }
  return { rows: [...rows.values()], rest };
}

// A line that fits where the person is. Motivating, never guilt-tripping.
export function cheer(p: Progress): string {
  const left = p.ch.days - p.todayIdx;
  if (p.over) return p.completed ? `${p.ch.days} days. You did it.` : `${p.done} of ${p.required} ${p.ch.weekly ? 'workouts' : 'days'}. Every one of them counted.`;
  if (p.todayIdx === 0) return p.today?.done ? 'Day one, done. That was the hardest one.' : 'Day one. Showing up is the hardest part.';
  const wk = p.weeks?.find((w) => w.from <= p.todayIdx && p.todayIdx <= w.to);
  if (wk) {
    const daysLeft = wk.to - p.todayIdx + 1;
    return wk.have >= wk.need ? `This week’s ${wk.need} done. Anything more is a bonus.`
      : `This week: ${wk.have} of ${wk.need}. ${daysLeft} day${daysLeft > 1 ? 's' : ''} to fit in ${wk.need - wk.have} more.`;
  }
  if (p.makeUp && !p.today?.done) return `Missed day ${p.makeUp.i + 1}? Make it up today, it still counts.`;
  if (p.missed > p.ch.free) return 'Free misses used. Every day you show up still counts.';
  if (p.today?.done) return left <= 1 ? 'Done. One last sleep before the finish.' : p.streak >= 3 ? `${p.streak} in a row. See you tomorrow.` : 'Done for today. See you tomorrow.';
  if (left <= 3) return `${left} day${left > 1 ? 's' : ''} left. Finish strong.`;
  if (p.streak >= 3) return `${p.streak} ${p.ch.weekly ? 'weeks' : 'days'} in a row. Keep it rolling.`;
  if (p.pct >= 0.5 && p.pct < 0.6) return 'Past halfway. This is where habits stick.';
  if (p.missed > 0 && p.freeLeft > 0) return `Missed one? It happens. ${p.freeLeft} free miss${p.freeLeft > 1 ? 'es' : ''} left.`;
  if (p.today?.rest && !p.today.tasks.length) return 'Rest day. Recovery is part of the plan.';
  return `Day ${p.todayIdx + 1}. One task, then you’re done.`;
}

// --- Picked for you: goal first, then level, then what the person told us. Pregnancy and after birth keep to the
// gentle ones; harder challenges sink but stay listed.
const GOAL_FIT: Record<Profile['goal'], Partial<Record<GoalTag, number>>> = {
  'lose fat': { 'Weight loss': 6, Steps: 4, HIIT: 3, Habits: 2, Consistency: 1 },
  'build muscle': { 'Muscle gain': 6, Strength: 4, Consistency: 2, Core: 1 },
  'get stronger': { Strength: 6, 'Muscle gain': 4, Core: 2 },
  'stay fit': { Consistency: 5, HIIT: 3, Steps: 3, Mobility: 3, Core: 2 },
};
export function recommend(p: Profile, sessionsDone = 0, list = challenges): Challenge[] {
  const lv = p.level === 'advanced' ? 2 : p.level === 'intermediate' ? 1 : 0;
  const careful = pregnancyWeek(p) !== null || postpartumWeek(p) !== null;
  const has = (...xs: string[]) => xs.some((k) => p.concerns?.includes(k as never));
  const score = (ch: Challenge) => {
    let s = GOAL_FIT[p.goal]?.[ch.goal] ?? 0;
    const diff = LEVELS.indexOf(ch.level) - lv;
    s += diff === 0 ? 4 : diff === -1 ? 1 : diff === 1 ? -2 : diff <= -2 ? -1 : -6;
    if (has('flexibility', 'posture', 'back', 'desk') && ch.goal === 'Mobility') s += 4;
    if (has('lose-weight') && ch.goal === 'Weight loss') s += 3;
    if (has('endurance', 'run') && (ch.goal === 'Steps' || ch.goal === 'HIIT')) s += 2;
    if (has('gain') && ch.goal === 'Muscle gain') s += 3;
    if (has('tone') && ch.goal === 'Core') s += 2;
    if (ch.id === 'kickstart-21' && lv === 0 && sessionsDone < 6) s += 4; // the natural first challenge
    if (ch.gear === 'gym' && p.place !== 'gym' && p.place !== 'both') s -= 4;
    if ((p.body === 'more' || p.body === 'extra') && ch.goal === 'HIIT') s -= 3;
    if (careful && (ch.goal === 'HIIT' || ch.level === 'Advanced')) s -= 100;
    return s;
  };
  return [...list].sort((a, b) => score(b) - score(a));
}

// --- Self-check (scripts/selfcheck.mjs).
export function selfCheck(byIdMap: Record<string, unknown>) {
  const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('challenges: ' + m); };
  for (const q of circuits) for (const sl of q.slots) assert(sl.id in byIdMap, `${q.id} uses unknown exercise ${sl.id}`);
  for (const ch of challenges) {
    assert([14, 21, 28, 30].includes(ch.days), `${ch.id} length`);
    for (let i = 0; i < ch.days; i++) for (const t of ch.day(i).tasks) if (t.kind === 'session') assert(!!t.q && t.q.slots.every((sl) => sl.id in byIdMap), `${ch.id} day ${i} session`);
  }
  const at = (key: string, h = 18) => Date.parse(`${key}T${String(h).padStart(2, '0')}:00:00`);
  const empty: Ctx = { sessions: [], watch: [], meals: [], water: {}, glassMl: 250, waterGoalMl: 2500, proteinTarget: 120, steps: {} };

  // Kickstart: day 1 workout done, day 2 starter done, day 3 rest, day 4 nothing (missed), day 5 steps ticked by hand.
  const ks = challengeById['kickstart-21'];
  const run: ChallengeRun = { id: ks.id, start: '2026-11-01', done: ['2026-11-05'] };
  const ctx: Ctx = { ...empty, sessions: [{ startedAt: at('2026-11-01'), title: 'Full body A' }, { startedAt: at('2026-11-02'), title: '10-minute starter' }] };
  const p = progress(ks, run, ctx, '2026-11-06');
  assert(p.todayIdx === 5 && p.days[0].state === 'done' && p.days[1].state === 'done' && p.days[2].state === 'rest', 'kickstart first days');
  assert(p.days[3].state === 'missed' && p.days[4].state === 'done' && p.days[4].ticked && p.days[5].state === 'today' && p.days[7].state === 'upcoming', 'kickstart missed, tick, today');
  assert(p.done === 4 && p.missed === 1 && p.freeLeft === 1 && p.required === 21 && !p.over && p.streak === 1, `kickstart counts ${p.done}/${p.required} missed ${p.missed} streak ${p.streak}`);
  assert(p.makeUp?.i === 3 && p.days[3].makeUp === true, 'missed day 4 can be made up today');
  // Two workouts today: today's own and the make-up for day 4. One workout only covers today.
  const two = { ...ctx, sessions: [...ctx.sessions, { startedAt: at('2026-11-06', 8), title: 'Full body B' }, { startedAt: at('2026-11-06'), title: 'Full body C' }] };
  const mu = progress(ks, run, two, '2026-11-06');
  assert(mu.days[3].madeUp === true && mu.days[3].state === 'done' && mu.missed === 0 && mu.days[5].state === 'done' && !mu.makeUp, 'made up');
  const one = progress(ks, run, { ...ctx, sessions: [...ctx.sessions, { startedAt: at('2026-11-06'), title: 'Full body B' }] }, '2026-11-06');
  assert(!one.days[3].madeUp && one.days[5].state === 'done', 'one workout covers today only');
  const closed = progress(ks, run, ctx, '2026-11-09');
  assert(closed.days[3].state === 'missed' && !closed.days[3].makeUp, 'make-up window closes after two days');
  // An excused day pauses: it counts like a rest day.
  const ex = progress(ks, run, { ...ctx, excused: { '2026-11-04': 'sick' } }, '2026-11-06');
  assert(ex.days[3].state === 'rest' && !!ex.days[3].excused && ex.missed === 0 && ex.done === 5, 'excused day');
  // Milestones: a quarter of 21 is reached at 6 days done.
  assert(newMilestone(p, {}) === null && newMilestone(mu, {})?.k === 0 && newMilestone(mu, { [milestoneKey(run, 0)]: 1 }) === null, 'milestones');
  // The wrong session on a session day doesn't count; the right one does.
  assert(!taskState({ kind: 'session', q: C['ch-starter'] }, '2026-11-01', ctx).done, 'other session does not count');
  // Steps from the watch, water in glasses, protein against the target (or 3 meals in no-numbers mode).
  const day = '2026-11-03';
  assert(taskState(STEPS(8000), day, { ...empty, steps: { [day]: 8100 } }).done && !taskState(STEPS(8000), day, { ...empty, steps: { [day]: 7999 } }).done, 'steps');
  assert(taskState(H2O, day, { ...empty, water: { [day]: 10 } }).done && !taskState(H2O, day, { ...empty, water: { [day]: 9 } }).done, 'water');
  const meals = [{ day, protein: 70 }, { day, protein: 55 }];
  assert(taskState(P, day, { ...empty, meals }).done && !taskState(P, day, { ...empty, meals, gentle: true }).done, 'protein and gentle meals');
  assert(taskState(CARD(20), day, { ...empty, watch: [{ start: `${day}T07:00:00`, durationS: 1500 }] }).done, 'watch cardio counts');
  assert(taskState(CARD(20), day, { ...empty, sessions: [{ startedAt: at(day), title: 'Brisk walk' }] }).done, 'ladder cardio counts');
  // Finishing: within the free misses earns the badge; past the end it's over either way.
  const allDone = { ...run, done: Array.from({ length: 21 }, (_, i) => addDays('2026-11-01', i)) };
  const fin = progress(ks, allDone, empty, '2026-11-21');
  assert(fin.over && fin.completed && fin.done === fin.required, 'finishes early on the last day when all done');
  const late = progress(ks, run, ctx, '2026-11-25');
  assert(late.over && !late.completed && late.missed > ks.free, 'over with too many misses');
  // Weekly: 3 workouts in week one, 1 in week two (still running), 2 in the 2-day tail is only asked for 1.
  const cs = challengeById['consistency-30'];
  const wk = (i: number) => ({ startedAt: at(addDays('2026-11-01', i)), title: 'Any' });
  const wp = progress(cs, { id: cs.id, start: '2026-11-01', done: [] }, { ...empty, sessions: [wk(0), wk(2), wk(4), wk(8)] }, '2026-11-11');
  assert(wp.weeks!.length === 5 && wp.weeks![0].state === 'done' && wp.weeks![1].state === 'current' && wp.weeks![4].need === 1, 'weekly weeks');
  assert(wp.days[1].state === 'open' && wp.missed === 0 && wp.done === 4 && wp.required === 13 && wp.streak === 1, `weekly counts ${wp.done}/${wp.required}`);
  const wl = progress(cs, { id: cs.id, start: '2026-11-01', done: [] }, { ...empty, sessions: [wk(0)] }, '2026-11-16');
  assert(wl.weeks![0].state === 'missed' && wl.weeks![1].state === 'missed' && wl.missed === 2, 'weekly missed weeks');
  // Recommendations follow goal and level, and keep pregnancy away from HIIT.
  const base = { name: 'A', gender: 'female', age: 30, heightCm: 168, weightKg: 70, goalWeightKg: 65, goal: 'lose fat', level: 'beginner', place: 'gym', gear: [],
    daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } } as unknown as Profile;
  assert(recommend(base, 10)[0].id === 'weightloss-28', 'lose fat beginner gets weight loss');
  assert(recommend(base, 0)[0].id === 'kickstart-21' || recommend(base, 0)[0].id === 'weightloss-28', 'new beginner');
  assert(recommend({ ...base, goal: 'get stronger', level: 'advanced' }, 50)[0].id === 'strength-28', 'advanced strength');
  const preg = recommend({ ...base, women: { mode: 'pregnant', date: '2027-03-01' } } as Profile, 10);
  assert(preg.slice(0, 6).every((x) => x.goal !== 'HIIT' && x.level !== 'Advanced'), 'pregnancy keeps to gentle');
}
