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
import { dayKey, parseReps, postpartumWeek, pregnancyWeek } from '../calc';
import type { ChallengeRun, Profile } from '../store';
import type { Domain } from '../theme';
import { CARDIO } from './cardio';
import type { Slot } from './plans';
import { quickById, type Quick } from './quick';

type Icon = keyof typeof Ionicons.glyphMap;
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type GoalTag = 'Weight loss' | 'Muscle gain' | 'Strength' | 'HIIT' | 'Cardio' | 'Core' | 'Mobility' | 'Steps' | 'Habits' | 'Consistency';
export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
export const GOALS: GoalTag[] = ['Weight loss', 'Muscle gain', 'Strength', 'HIIT', 'Cardio', 'Core', 'Mobility', 'Steps', 'Habits', 'Consistency'];
// One domain colour per goal (src/theme.ts DOMAINS), read as dom[GOAL_COLOR[goal]] at render time. Cardio shares the
// heart colour with HIIT: both are heart work, and there are more goals than domains.
export const GOAL_COLOR: Record<GoalTag, Domain> = {
  'Weight loss': 'kcal', 'Muscle gain': 'train', Strength: 'weight', HIIT: 'heart', Cardio: 'heart', Core: 'protein', Mobility: 'sleep', Steps: 'steps', Habits: 'water', Consistency: 'streak',
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
  effort: string; // how long a day takes, e.g. "12–20 min/day"
  icon: Icon; badge: string; // the finisher badge's name
  free: number; // missed days forgiven (missed weeks for weekly challenges)
  weekly?: number; // weekly challenge: this many workouts in each 7-day block, any days
  gear?: 'gym'; // needs a gym (barbells)
  needs?: string[]; // home kit it uses (Profile.gear values: 'dumbbell', 'kettlebells', 'pull-up bar'); swapped out by the engine if missing
  impact?: boolean; // running or jumping: kept out of the top picks in pregnancy, after birth, at 55+ and for heavier bodies
  who?: 'after birth' | '55+'; // made for this group: picked first for them (after birth: sinks for everyone else)
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

  // --- Round 13b. Week-by-week sessions grow a little each week (more reps, longer holds), never a big jump.
  // Squat 30: 36 squats a session in week 1, 100 in week 4.
  ...([[3, '12', '20s'], [4, '15', '30s'], [4, '20', '40s'], [5, '20', '45s']] as const).map(([sets, reps, wall], w) =>
    Q(`ch-squat-${w + 1}`, `Squats · week ${w + 1}`, 6 + w * 2, 'body', ['strength'], ['home', 'anywhere'], `${sets} × ${reps} squats, a ${wall} wall sit and bridges.`,
      [x('Bodyweight_Squat', sets, reps, 45), x('wg_wall-sit', 2, wall, 30), x('Butt_Lift_Bridge', 2, '12', 20)])),
  // Plank 30: the hold grows from 20 to 60 seconds; split it into shorter holds if your hips sag.
  ...([[20, 15], [30, 20], [45, 25], [60, 30]] as const).map(([hold, side], w) =>
    Q(`ch-plank-${w + 1}`, `Planks · week ${w + 1}`, [5, 6, 8, 10][w], 'body', ['core'], ['home', 'anywhere'], `3 × ${hold}s plank, side planks and bird dogs.`,
      [x('Plank', 3, `${hold}s`, 30), x('Side_Bridge', 2, `${side}s/side`, 20), x('wg_bird-dog', 2, '8/side', 15)])),
  // Walk to run 28 (Couch to 5K's first four weeks): warm-up walk, jog intervals that grow, cool-down walk.
  ...([[8, '60s', 90], [6, '90s', 90], [5, '2 min', 60], [4, '3 min', 90]] as const).map(([n, jog, rest], w) =>
    Q(`ch-run-${w + 1}`, `Run-walk · week ${w + 1}`, [30, 28, 25, 28][w], 'walk', ['cardio'], ['anywhere'], `Walk 5 min, then jog ${jog} and walk ${rest}s, × ${n}. Walk 5 min to finish.`,
      [x('Walking_Treadmill', 1, '5 min', 0), x('Jogging_Treadmill', n, jog, rest), x('Walking_Treadmill', 1, '5 min', 0)])),
  // Steady and strong (55+): leg strength, balance and getting up from a chair. A chair or wall stays in reach.
  Q('ch-balance-1', 'Steady and strong · 1', 15, 'accessibility', ['strength', 'mobility'], ['home', 'anywhere'], 'Chair squats, wall push-ups, calf raises, step-ups. Keep a chair or wall within reach.',
    [x('March_In_Place', 1, '60s', 15), x('Sit_Squats', 2, '8', 45), x('wg_wall-push-up', 2, '8', 45), x('wg_calf-raise', 2, '10', 30), x('Step-up_with_Knee_Raise', 2, '6/side', 45), x('wg_bird-dog', 2, '6/side', 30), x('Standing_Hip_Circles', 1, '30s', 0)]),
  Q('ch-balance-2', 'Steady and strong · 2', 20, 'accessibility', ['strength', 'mobility'], ['home', 'anywhere'], 'More reps, plus a hip airplane with one hand on a chair.',
    [x('March_In_Place', 1, '90s', 15), x('Sit_Squats', 3, '10', 45), x('wg_wall-push-up', 3, '10', 45), x('wg_calf-raise', 3, '12', 30), x('Step-up_with_Knee_Raise', 3, '8/side', 45), x('wg_hip-airplane', 2, '4/side', 30), x('wg_bird-dog', 2, '8/side', 30)]),
  // Desk 14: the Desk reset (src/data/quick.ts) one day, this the next.
  Q('ch-desk-move', 'Desk mover', 6, 'desktop', ['desk', 'mobility'], ['office', 'anywhere'], 'Leg raises, hip stretch, calf raises and wall push-ups. Fits in a coffee break.',
    [x('Desk_Seated_Leg_Raise', 2, '10', 15), x('Desk_Figure_Four', 1, '30s/side', 10), x('Chair_Lower_Back_Stretch', 1, '30s', 10), x('wg_calf-raise', 2, '15', 15), x('wg_wall-push-up', 2, '10', 20), x('March_In_Place', 1, '60s', 0)]),
  // Gentle core after birth: breathing and pelvic floor first, no planks, crunches or jumps (src/engine.ts hides those
  // until about 12 weeks after birth anyway).
  Q('ch-pp-1', 'Gentle core · weeks 1–2', 10, 'flower', ['pelvic', 'core'], ['home', 'anywhere'], 'Belly breathing, pelvic floor squeezes, pelvic tilts, bridges and clams.',
    [x('Diaphragmatic_Breathing', 1, '6 breaths', 15), x('Kegel_Long_Hold', 2, '5', 30), x('Kegel_Quick_Flick', 1, '10', 20), x('Standing_Pelvic_Tilt', 2, '8', 15), x('Butt_Lift_Bridge', 2, '8', 30), x('wg_clamshell', 2, '10/side', 20)]),
  Q('ch-pp-2', 'Gentle core · weeks 3–4', 12, 'flower', ['pelvic', 'core'], ['home', 'anywhere'], 'Breathing, then bridge marches, bird dogs, slow dead bugs and wall push-ups.',
    [x('Diaphragmatic_Breathing', 1, '6 breaths', 15), x('Kegel_Elevator', 2, '5', 30), x('wg_glute-bridge-march', 2, '6/side', 30), x('wg_bird-dog', 2, '6/side', 20), x('Dead_Bug', 2, '6/side', 30), x('wg_side-lying-hip-abduction', 2, '10/side', 20), x('wg_wall-push-up', 2, '10', 30)]),
  // Glutes 28: bodyweight, level 2 from week 3.
  Q('ch-glute-1', 'Glutes · level 1', 15, 'body', ['strength'], ['home', 'anywhere'], 'Bridges, donkey kicks, fire hydrants, clams, squats and a wall sit.',
    [x('Butt_Lift_Bridge', 3, '15', 30), x('wg_donkey-kick', 3, '12/side', 30), x('wg_fire-hydrant', 3, '12/side', 30), x('wg_clamshell', 2, '15/side', 20), x('Bodyweight_Squat', 3, '15', 30), x('wg_wall-sit', 2, '30s', 30)]),
  Q('ch-glute-2', 'Glutes · level 2', 20, 'body', ['strength'], ['home', 'anywhere'], 'Single-leg bridges, frog pumps, curtsy lunges, side leg raises, bridge marches.',
    [x('Single_Leg_Glute_Bridge', 3, '10/side', 30), x('wg_frog-pump', 3, '20', 30), x('wg_curtsy-lunge', 3, '10/side', 45), x('wg_side-lying-hip-abduction', 3, '15/side', 20), x('wg_glute-bridge-march', 3, '10/side', 30), x('wg_wall-sit', 3, '45s', 30)]),
  // Burpee 30: half burpees first, then full ones, 24 to 50 a session.
  ...([['wg_half-burpee', 3, '8'], ['wg_burpee', 3, '8'], ['wg_burpee', 4, '10'], ['wg_burpee', 5, '10']] as const).map(([id, sets, reps], w) =>
    Q(`ch-burpee-${w + 1}`, `Burpees · week ${w + 1}`, [6, 7, 9, 11][w], 'flash', ['cardio'], ['home', 'anywhere'], `${sets} × ${reps} ${w ? '' : 'half '}burpees after a one-minute march. Rest as long as you need.`,
      [x('March_In_Place', 1, '60s', 15), x(id, sets, reps, 60), x('Plank', 1, '30s', 0)])),
  // Dumbbell 28: two full-body days with one pair of dumbbells, alternating.
  Q('ch-db-a', 'Dumbbell A: squat, press, row', 35, 'barbell', ['strength'], ['home', 'gym'], 'Squats, overhead press, rows, lunges, curls and kickbacks.',
    [x('Dumbbell_Squat', 3, '10', 60), x('Standing_Dumbbell_Press', 3, '10', 60), x('Bent_Over_Two-Dumbbell_Row', 3, '10', 60), x('Dumbbell_Lunges', 3, '8/side', 60), x('Hammer_Curls', 2, '12', 45), x('Tricep_Dumbbell_Kickback', 2, '12', 45)], ['dumbbell']),
  Q('ch-db-b', 'Dumbbell B: hinge, lunge, push', 35, 'barbell', ['strength'], ['home', 'gym'], 'Romanian deadlifts, hip bridges, rows, side lunges, push-ups and raises.',
    [x('Stiff-Legged_Dumbbell_Deadlift', 3, '10', 60), x('wg_dumbbell-glute-bridge', 3, '12', 45), x('One-Arm_Dumbbell_Row', 3, '10/side', 45), x('wg_dumbbell-lateral-lunge', 3, '8/side', 60), x('Pushups', 3, '10', 60), x('Side_Lateral_Raise', 2, '12', 45)], ['dumbbell']),
  // Kettlebell 21: swings are the engine; one bell is enough.
  Q('ch-kb-1', 'Kettlebell · week 1', 20, 'barbell', ['strength', 'cardio'], ['home', 'gym'], 'Swings, goblet squats, deadlifts, floor press, pirate ships.',
    [x('wg_kettlebell-swing', 5, '15', 45), x('Goblet_Squat', 3, '10', 45), x('wg_kettlebell-romanian-deadlift', 3, '10', 45), x('Alternating_Floor_Press', 3, '8/side', 45), x('Kettlebell_Pirate_Ships', 2, '10', 30)], ['kettlebells']),
  Q('ch-kb-2', 'Kettlebell · weeks 2–3', 25, 'barbell', ['strength', 'cardio'], ['home', 'gym'], 'More swings, one more set, and a one-arm row.',
    [x('wg_kettlebell-swing', 6, '20', 40), x('Goblet_Squat', 4, '10', 45), x('wg_kettlebell-romanian-deadlift', 3, '12', 45), x('Alternating_Floor_Press', 3, '10/side', 45), x('One-Arm_Kettlebell_Row', 3, '10/side', 45), x('Kettlebell_Pirate_Ships', 2, '12', 30)], ['kettlebells']),
  // Pull-up 28: hang, then lower slowly (negatives), then your first pull-ups in week 4.
  Q('ch-pull-1', 'Pull-up · week 1', 15, 'barbell', ['strength'], ['home', 'gym'], 'Dead hangs, scapular pull-ups and towel rows. Grip and shoulders first.',
    [x('wg_dead-hang', 3, '20s', 60), x('Scapular_Pull-Up', 3, '8', 60), x('wg_towel-row', 3, '10', 45)], ['pull-up bar']),
  Q('ch-pull-2', 'Pull-up · week 2', 18, 'barbell', ['strength'], ['home', 'gym'], 'Longer hangs, active hangs and your first slow negatives.',
    [x('wg_dead-hang', 3, '30s', 60), x('wg_active-hang', 3, '15s', 45), x('wg_negative-pull-up', 3, '3', 90), x('wg_towel-row', 3, '12', 45)], ['pull-up bar']),
  Q('ch-pull-3', 'Pull-up · week 3', 20, 'barbell', ['strength'], ['home', 'gym'], 'More negatives and band-assisted pull-ups.',
    [x('wg_dead-hang', 3, '40s', 60), x('wg_negative-pull-up', 4, '4', 90), x('Band_Assisted_Pull-Up', 3, '5', 90), x('wg_active-hang', 2, '20s', 45)], ['pull-up bar']),
  Q('ch-pull-4', 'Pull-up · week 4', 20, 'barbell', ['strength'], ['home', 'gym'], 'Try your first pull-ups. One clean rep is a win.',
    [x('wg_dead-hang', 2, '45s', 60), x('Pullups', 3, '3', 120), x('wg_negative-pull-up', 3, '5', 90), x('Scapular_Pull-Up', 2, '10', 45)], ['pull-up bar']),
  // Calisthenics 28 (advanced): hard bodyweight moves, a bar for pulling.
  Q('ch-cali-push', 'Calisthenics: push and legs', 35, 'body', ['strength'], ['home', 'gym', 'anywhere'], 'Archer and pike push-ups, assisted pistols, cossack squats, dips, hollow holds.',
    [x('wg_archer-push-up', 4, '6/side', 90), x('wg_pike-push-up', 4, '8', 90), x('wg_assisted-pistol-squat', 4, '6/side', 90), x('wg_cossack-squat', 3, '8/side', 60), x('wg_chair-dip', 3, '12', 60), x('wg_hollow-body-hold', 3, '30s', 45)]),
  Q('ch-cali-pull', 'Calisthenics: pull and core', 35, 'body', ['strength'], ['home', 'gym'], 'Pull-ups, commando pull-ups, skater squats, L-sits and dragon flags.',
    [x('Pullups', 5, '6', 120), x('wg_commando-pull-up', 3, '4/side', 90), x('wg_skater-squat', 3, '6/side', 90), x('wg_l-sit-hold', 4, '15s', 60), x('wg_dragon-flag', 3, '5', 90), x('wg_typewriter-push-up', 3, '4/side', 90)], ['pull-up bar']),
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
    effort: '10–45 min/day', icon: 'rocket', badge: 'Kickstarter', free: 2,
    why: 'Three workouts from your plan each week, a 10-minute starter and a walk. Short enough to fit any day, long enough to stick.',
    day: every([[W], [S(C['ch-starter'])], [], [W], [STEPS(6000)], [W], []]),
  },
  {
    id: 'weightloss-28', name: 'Weight loss 28', tagline: 'Move every day, eat your protein, watch it add up.', level: 'Beginner', goal: 'Weight loss', days: 28,
    effort: '20–40 min/day', icon: 'flame', badge: 'Lean machine', free: 3,
    why: 'Circuits and cardio burn energy, 8,000 steps keep you moving on the days between, and protein keeps the weight you lose fat, not muscle.',
    day: (i) => plus(P, every([[S(C['ch-fatburn'])], [STEPS(8000)], [CARD(20)], [W], [STEPS(8000)], [CARD(20)], []])(i)),
  },
  {
    id: 'muscle-30', name: 'Muscle gain 30', tagline: 'Four workouts a week and your protein, every single day.', level: 'Intermediate', goal: 'Muscle gain', days: 30,
    effort: '45–60 min · 4×/wk', icon: 'barbell', badge: 'Builder', free: 3,
    why: 'Muscle grows from hard sets plus enough protein, repeated. Thirty days is long enough to see it in the mirror and in your numbers.',
    day: (i) => {
      const train = [true, true, false, true, true, false, false][i % 7];
      return train ? { tasks: [W, P] } : { tasks: [P], rest: true };
    },
  },
  {
    id: 'hiit-21', name: 'HIIT 21', tagline: 'Short, sweaty intervals that level up every week.', level: 'Intermediate', goal: 'HIIT', days: 21,
    effort: '10–20 min/day', icon: 'flash', badge: 'Spark plug', free: 2,
    why: 'Three interval sessions a week, a harder one each week, with mobility days between so your legs keep up.',
    day: (i) => {
      const h = S(C[`ch-hiit-${Math.min(3, Math.floor(i / 7) + 1)}`]);
      return every([[h], [S(quickById.mobility)], [h], [], [h], [S(C['ch-hips'])], []])(i);
    },
  },
  {
    id: 'strength-28', name: 'Advanced strength 28', tagline: 'Heavy fives on the big lifts, four days a week.', level: 'Advanced', goal: 'Strength', days: 28,
    effort: '50 min · 4×/wk', icon: 'trophy', badge: 'Iron will', free: 2, gear: 'gym',
    why: 'Squat, bench, row, deadlift, press and pull-ups at five reps. Add a little weight each week when every rep is clean.',
    day: every([[S(C['ch-strength-a'])], [], [S(C['ch-strength-b'])], [], [S(C['ch-strength-a'])], [S(C['ch-strength-b'])], []]),
  },
  {
    id: 'shred-21', name: 'Shred 21', tagline: 'Lift, sprint, walk and eat clean. For when you’re ready to go hard.', level: 'Advanced', goal: 'Weight loss', days: 21,
    effort: '20–60 min/day', icon: 'speedometer', badge: 'Shredded', free: 1,
    why: 'Three strength workouts, two hard HIIT days, 10,000 steps and protein every day. One rest day a week, and you’ll want it.',
    day: (i) => plus(P, every([[W], [S(C['ch-hiit-3'])], [W], [STEPS(10000)], [W], [CARD(25)], []])(i)),
  },
  {
    id: 'core-14', name: 'Core 14', tagline: 'Ten minutes a day for a stronger middle.', level: 'Intermediate', goal: 'Core', days: 14,
    effort: '10–12 min/day', icon: 'body', badge: 'Rock solid', free: 1,
    why: 'Week one builds the basics, week two holds longer and adds anti-rotation. A strong core makes every lift and run feel better.',
    day: (i) => (i % 7 === 6 ? { tasks: [] } : { tasks: [S(i < 7 ? quickById.core : C['ch-core-2'])] }),
  },
  {
    id: 'pushup-30', name: 'Push-up 30', tagline: 'From a few good push-ups to sixty in one session.', level: 'Intermediate', goal: 'Strength', days: 30,
    effort: '5–11 min/day', icon: 'fitness', badge: 'Push-up pro', free: 3,
    why: 'Two days on, one off. The sets grow every week, so your chest, shoulders and arms keep adapting.',
    day: (i) => (i % 3 === 2 ? { tasks: [] } : { tasks: [S(C[`ch-push-${Math.min(4, Math.floor(i / 7) + 1)}`])] }),
  },
  {
    id: 'mobility-14', name: 'Mobility 14', tagline: 'Loosen hips, back and shoulders in ten minutes a day.', level: 'Beginner', goal: 'Mobility', days: 14,
    effort: '10–12 min/day', icon: 'leaf', badge: 'Bendy', free: 2,
    why: 'Two gentle flows on alternate days. Great after a desk day, and your squats will thank you.',
    day: (i) => ({ tasks: [S(i % 2 ? C['ch-hips'] : quickById.mobility)] }),
  },
  {
    id: 'steps-21', name: '10k steps 21', tagline: 'Walk 10,000 steps a day for three weeks.', level: 'Beginner', goal: 'Steps', days: 21,
    effort: 'About 90 min walking', icon: 'footsteps', badge: 'Trailblazer', free: 3,
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
    effort: '3 workouts/wk', icon: 'calendar', badge: 'Never miss a week', free: 1, weekly: 3,
    why: 'Results come from showing up week after week. Pick your days; any workout counts, from the app or your watch.',
    day: () => ({ tasks: [W] }),
  },

  // --- Round 13b (docs/round13/challenges.md, "More challenges"). Popular app and community challenges, made gentle
  // enough to finish: rest days built in, free misses, and the session grows by week instead of by day.
  {
    id: 'squat-30', name: 'Squat 30', tagline: 'From 36 squats a session to 100, in four weeks.', level: 'Beginner', goal: 'Strength', days: 30,
    effort: '6–12 min/day', icon: 'body', badge: 'Squat squad', free: 3,
    why: 'The classic 30-day squat challenge, with a rest every fourth day. Strong legs make stairs, runs and every lift easier.',
    day: (i) => (i % 4 === 3 ? { tasks: [] } : { tasks: [S(C[`ch-squat-${Math.min(4, Math.floor(i / 7) + 1)}`])] }),
  },
  {
    id: 'plank-30', name: 'Plank 30', tagline: 'Hold a 20-second plank today, a full minute by week four.', level: 'Beginner', goal: 'Core', days: 30,
    effort: '5–10 min/day', icon: 'timer', badge: 'Plank boss', free: 3,
    why: 'The hold grows a little each week, with a rest day every week. Side planks and bird dogs train the rest of your core.',
    day: (i) => (i % 7 === 5 ? { tasks: [] } : { tasks: [S(C[`ch-plank-${Math.min(4, Math.floor(i / 7) + 1)}`])] }),
  },
  {
    id: 'walk-run-28', name: 'Walk to run 28', tagline: 'Your first runs: jog a minute, walk, repeat.', level: 'Beginner', goal: 'Cardio', days: 28,
    effort: '25–30 min · 3×/wk', icon: 'walk', badge: 'Up and running', free: 2, impact: true,
    why: 'Like the first four weeks of Couch to 5K: three run-walks a week with a rest day between, and the jogs get longer each week.',
    day: (i) => { const r = [S(C[`ch-run-${Math.min(4, Math.floor(i / 7) + 1)}`])]; return every([r, [], r, [], r, [], []])(i); },
  },
  {
    id: 'balance-28', name: 'Steady and strong 28', tagline: 'Leg strength and balance for 55 and over.', level: 'Beginner', goal: 'Mobility', days: 28,
    effort: '15–20 min · 5×/wk', icon: 'accessibility', badge: 'Steady', free: 3, who: '55+',
    why: 'Health guidelines for older adults ask for strength, balance and walking every week. Three short sessions and two walks do all three. Keep a chair close.',
    day: (i) => { const b = [S(C[i < 14 ? 'ch-balance-1' : 'ch-balance-2'])]; return every([b, [CARD(20)], [], b, [CARD(20)], b, []])(i); },
  },
  {
    id: 'desk-14', name: 'Desk 14', tagline: 'Five minutes at your desk, every workday.', level: 'Beginner', goal: 'Mobility', days: 14,
    effort: '5–6 min/day', icon: 'desktop', badge: 'Desk hero', free: 2,
    why: 'Long sitting stiffens your neck, back and hips. Two short routines, swapped each day, with weekends off.',
    day: every([[S(quickById.desk)], [S(C['ch-desk-move'])], [S(quickById.desk)], [S(C['ch-desk-move'])], [S(quickById.desk)], [], []]),
  },
  {
    id: 'postnatal-core-28', name: 'Gentle core after birth', tagline: 'Breathing and pelvic floor first. No planks, no crunches.', level: 'Beginner', goal: 'Core', days: 28,
    effort: '10–12 min · 5×/wk', icon: 'flower', badge: 'Strong mama', free: 4, who: 'after birth',
    why: 'Start after your postnatal check (often about 6 weeks, longer after a C-section). Stop if you feel pain, leaking or heaviness, or your belly domes, and ask your doctor or a pelvic health physio.',
    day: (i) => { const g = [S(C[i < 14 ? 'ch-pp-1' : 'ch-pp-2'])]; return every([g, g, [], g, g, g, []])(i); },
  },
  {
    id: 'glutes-28', name: 'Glutes 28', tagline: 'Four bodyweight glute sessions a week, harder from week three.', level: 'Intermediate', goal: 'Muscle gain', days: 28,
    effort: '15–20 min · 4×/wk', icon: 'flame', badge: 'Peach power', free: 3,
    why: 'Bridges, kicks and lunges from every angle. Two rest days a week let the muscle grow. Add a dumbbell on your hips when it gets easy.',
    day: (i) => { const g = [S(C[i < 14 ? 'ch-glute-1' : 'ch-glute-2'])]; return every([g, [], g, [], g, g, []])(i); },
  },
  {
    id: 'burpee-30', name: 'Burpee 30', tagline: 'Half burpees on day one, fifty full ones by the end.', level: 'Intermediate', goal: 'HIIT', days: 30,
    effort: '6–11 min/day', icon: 'flash', badge: 'Burpee beast', free: 3, impact: true,
    why: 'Two days on, one off. The count grows every week, so your heart and legs keep up. Step back instead of jumping any time.',
    day: (i) => (i % 3 === 2 ? { tasks: [] } : { tasks: [S(C[`ch-burpee-${Math.min(4, Math.floor(i / 7) + 1)}`])] }),
  },
  {
    id: 'dumbbell-28', name: 'Dumbbell 28', tagline: 'One pair of dumbbells, three full-body workouts a week.', level: 'Intermediate', goal: 'Muscle gain', days: 28,
    effort: '35 min · 3×/wk', icon: 'barbell', badge: 'Dumbbell devotee', free: 2, needs: ['dumbbell'],
    why: 'Two workouts, A and B, take turns. Add a rep each session; when you hit the top of the range, go heavier.',
    day: (i) => {
      const k = [0, -1, 1, -1, 2, -1, -1][i % 7];
      return k < 0 ? { tasks: [] } : { tasks: [S(C[(Math.floor(i / 7) * 3 + k) % 2 ? 'ch-db-b' : 'ch-db-a'])] };
    },
  },
  {
    id: 'kettlebell-21', name: 'Kettlebell 21', tagline: 'Swings, squats and steps. One bell, big burn.', level: 'Intermediate', goal: 'Weight loss', days: 21,
    effort: '20–25 min · 3×/wk', icon: 'barbell', badge: 'Swing king', free: 2, needs: ['kettlebells'],
    why: 'Swings work your whole back side and get your heart up. Three bell days and two walking days a week burn energy without wrecking your legs.',
    day: (i) => { const kb = [S(C[i < 7 ? 'ch-kb-1' : 'ch-kb-2'])]; return every([kb, [STEPS(8000)], kb, [], kb, [STEPS(8000)], []])(i); },
  },
  {
    id: 'pullup-28', name: 'First pull-up 28', tagline: 'Hang, lower slowly, then pull. Your first pull-up in four weeks.', level: 'Intermediate', goal: 'Strength', days: 28,
    effort: '15–20 min · 3×/wk', icon: 'trending-up', badge: 'Bar raiser', free: 2, needs: ['pull-up bar'],
    why: 'Dead hangs build grip and shoulders, slow negatives build the pulling strength. Rest days between, because tendons adapt slower than muscle.',
    day: (i) => { const s = [S(C[`ch-pull-${Math.min(4, Math.floor(i / 7) + 1)}`])]; return every([s, [], s, [], s, [], []])(i); },
  },
  {
    id: 'zone2-28', name: 'Zone 2 28', tagline: 'Easy cardio you can talk through, a little longer each week.', level: 'Intermediate', goal: 'Cardio', days: 28,
    effort: '30–45 min · 4×/wk', icon: 'heart', badge: 'Big engine', free: 3,
    why: 'Walk briskly, ride or jog at a pace where you can still talk. Four sessions a week, 30 minutes growing to 45: about 150 minutes, the weekly amount health guidelines ask for.',
    day: (i) => { const c = [CARD(30 + 5 * Math.min(3, Math.floor(i / 7)))]; return every([c, [], c, [], c, c, []])(i); },
  },
  {
    id: 'soft-30', name: 'Soft 30', tagline: 'Move, drink your water, eat well. Every day for a month.', level: 'Intermediate', goal: 'Habits', days: 30,
    effort: '45 min/day + water, food', icon: 'sparkles', badge: 'Soft but strong', free: 3,
    why: 'Inspired by 75 Soft: a workout six days a week and an active walk on the seventh, your water goal and your protein every day. Missed a day? Keep going, nothing resets.',
    day: (i) => plus(H2O, plus(P, every([[W], [W], [W], [W], [W], [W], [STEPS(7000)]])(i))),
  },
  {
    id: 'calisthenics-28', name: 'Calisthenics 28', tagline: 'Bodyweight strength: pull-ups, pistols and more.', level: 'Advanced', goal: 'Muscle gain', days: 28,
    effort: '35 min · 4×/wk', icon: 'medal', badge: 'Bodyweight boss', free: 2, needs: ['pull-up bar'],
    why: 'Hard bodyweight moves build real muscle when the reps stay low and clean. Push and legs, then pull and core, twice a week.',
    day: every([[S(C['ch-cali-push'])], [S(C['ch-cali-pull'])], [], [S(C['ch-cali-push'])], [S(C['ch-cali-pull'])], [], []]),
  },
  {
    id: 'hybrid-28', name: 'Hybrid 28', tagline: 'Lift three days, run or ride three. Strong and fit at once.', level: 'Advanced', goal: 'Cardio', days: 28,
    effort: '40–60 min · 6×/wk', icon: 'infinite', badge: 'Hybrid athlete', free: 2, impact: true,
    why: 'Three workouts from your plan, one hard HIIT day, a 40-minute and a 60-minute easy cardio session each week. One full rest day.',
    day: every([[W], [CARD(40)], [W], [S(C['ch-hiit-3'])], [W], [CARD(60)], []]),
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
  'lose fat': { 'Weight loss': 6, Steps: 4, HIIT: 3, Cardio: 3, Habits: 2, Consistency: 1 },
  'build muscle': { 'Muscle gain': 6, Strength: 4, Consistency: 2, Core: 1 },
  'get stronger': { Strength: 6, 'Muscle gain': 4, Core: 2 },
  'stay fit': { Consistency: 5, Cardio: 4, HIIT: 3, Steps: 3, Mobility: 3, Core: 2, Habits: 1 },
  'tone up': { Core: 5, 'Weight loss': 4, 'Muscle gain': 3, HIIT: 3, Consistency: 2, Steps: 2 },
  'gain weight': { 'Muscle gain': 6, Strength: 5, Consistency: 2, Habits: 1 },
  endurance: { Cardio: 6, Steps: 5, HIIT: 4, Consistency: 2 },
  mobility: { Mobility: 7, Habits: 3, Core: 3, Consistency: 2, Steps: 1 },
  athletic: { HIIT: 6, Cardio: 4, Strength: 4, Core: 3, Consistency: 1 },
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
    if (has('endurance', 'run') && ch.goal === 'Cardio') s += 3;
    if (has('desk') && ch.id === 'desk-14') s += 3;
    if (has('gain') && ch.goal === 'Muscle gain') s += 3;
    if (has('tone') && ch.goal === 'Core') s += 2;
    if (ch.id === 'kickstart-21' && lv === 0 && sessionsDone < 6) s += 4; // the natural first challenge
    if (ch.gear === 'gym' && p.place !== 'gym' && p.place !== 'both') s -= 4;
    // Home kit: a challenge built on dumbbells, a kettlebell or a bar rises when you own it, and sinks when you train
    // at home without it.
    if (ch.needs) s += ch.needs.every((g) => p.gear?.includes(g)) ? 2 : p.place !== 'gym' && p.place !== 'both' ? -4 : 0;
    const older = p.age >= 55;
    if (ch.who === '55+') s += older ? 8 : -1;
    if (ch.who === 'after birth') s += postpartumWeek(p) !== null ? 10 : -6;
    if ((p.body === 'more' || p.body === 'extra') && (ch.goal === 'HIIT' || ch.impact)) s -= 3;
    if (older && (ch.impact || ch.goal === 'HIIT' || ch.level === 'Advanced')) s -= 4;
    if (careful && (ch.goal === 'HIIT' || ch.level === 'Advanced' || ch.impact)) s -= 100;
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
  assert(preg.slice(0, 6).every((x) => x.goal !== 'HIIT' && x.level !== 'Advanced' && !x.impact), 'pregnancy keeps to gentle');
  assert(preg.slice(0, 6).every((x) => x.who !== 'after birth'), 'after-birth core is not for pregnancy');

  // --- Round 13b catalogue: the whole list is well formed.
  assert(challenges.length >= 25, `only ${challenges.length} challenges`);
  assert(new Set(challenges.map((x) => x.id)).size === challenges.length, 'challenge ids are unique');
  // Session days count by title, so two sessions may never share a name.
  const names = [...circuits, ...Object.values(quickById)].map((q) => q.name);
  assert(new Set(names).size === names.length && new Set(circuits.map((q) => q.id)).size === circuits.length, 'session names and ids are unique');
  for (const lv of LEVELS) assert(challenges.filter((x) => x.level === lv).length >= 4, `${lv}: too few challenges`);
  for (const g of GOALS) assert(!!GOAL_COLOR[g] && challenges.some((x) => x.goal === g), `goal ${g} has a colour and a challenge`);
  const KIT = ['dumbbell', 'kettlebells', 'pull-up bar'];
  for (const ch of challenges) {
    assert(LEVELS.includes(ch.level) && GOALS.includes(ch.goal), `${ch.id} level and goal`);
    assert(!!ch.name && !!ch.tagline && !!ch.why && !!ch.effort && !!ch.badge, `${ch.id} words`);
    assert(Number.isInteger(ch.free) && ch.free >= 0 && ch.free <= Math.ceil(ch.days / 7), `${ch.id} free misses`);
    assert(!ch.needs || ch.needs.every((g) => KIT.includes(g)), `${ch.id} kit`);
    // Every day is defined: a list of tasks (empty = rest), each a known kind with sane numbers.
    let off = 0, inRow = 0, maxRun = 0;
    for (let i = 0; i < ch.days; i++) {
      const d = ch.day(i);
      assert(!!d && Array.isArray(d.tasks), `${ch.id} day ${i} has no task list`);
      for (const t of d.tasks) {
        assert(['workout', 'session', 'cardio', 'steps', 'protein', 'water'].includes(t.kind), `${ch.id} day ${i} task kind`);
        if (t.kind === 'session') assert(names.includes(t.q.name), `${ch.id} day ${i} session ${t.q.id} is not a known session`);
        if (t.kind === 'session' && t.q.gear?.length) assert(t.q.gear.every((g) => ch.needs?.includes(g) || ch.gear === 'gym'), `${ch.id} day ${i} kit not listed in needs`);
        if (t.kind === 'steps') assert(t.n >= 1000 && t.n <= 20000, `${ch.id} steps`);
        if (t.kind === 'cardio') assert(t.min >= 10 && t.min <= 90, `${ch.id} cardio minutes`);
      }
      if (!d.tasks.length || d.rest) { off++; inRow = 0; } else maxRun = Math.max(maxRun, ++inRow);
    }
    // At least three task days in every full week; training challenges keep a rest day every week (habit, walking
    // and mobility ones can go daily).
    for (let w = 0; w + 7 <= ch.days; w += 7) assert(Array.from({ length: 7 }, (_, k) => ch.day(w + k)).filter((d) => d.tasks.length).length >= 3, `${ch.id} week ${w / 7 + 1} is too empty`);
    const daily = ['Steps', 'Habits', 'Consistency', 'Mobility'].includes(ch.goal);
    assert(daily || (maxRun <= 6 && off >= Math.floor(ch.days / 7)), `${ch.id}: ${maxRun} training days in a row, ${off} rest days`);
  }
  // Progressions grow week by week, never in a big jump.
  const vol = (q: Quick, id: string) => q.slots.filter((s) => s.id === id).reduce((a, s) => a + s.sets * parseReps(s.reps), 0);
  const grows = (ids: string[], ex: string, max: number) => ids.every((id, w) => !w || (vol(C[id], ex) > vol(C[ids[w - 1]], ex) && vol(C[id], ex) <= vol(C[ids[w - 1]], ex) * max));
  const weeksOf = (p: string) => [1, 2, 3, 4].map((w) => `${p}${w}`);
  assert(grows(weeksOf('ch-squat-'), 'Bodyweight_Squat', 1.7), 'squats grow');
  assert(grows(weeksOf('ch-plank-'), 'Plank', 1.6), 'plank holds grow');
  assert(grows(weeksOf('ch-run-'), 'Jogging_Treadmill', 1.6), 'jog time grows');
  assert(grows(weeksOf('ch-burpee-').slice(1), 'wg_burpee', 1.7), 'burpees grow');
  assert(grows(['ch-pull-1', 'ch-pull-2', 'ch-pull-3'], 'wg_dead-hang', 1.6), 'hangs grow');
  // Gentle ones stay gentle: no planks, crunches or jumps after birth, no jumping at 55+.
  const nameOf = (id: string) => (byIdMap[id] as { name?: string } | undefined)?.name ?? id;
  for (const id of ['ch-pp-1', 'ch-pp-2', 'ch-balance-1', 'ch-balance-2', 'ch-desk-move'])
    for (const sl of C[id].slots) assert(!/plank|crunch|sit-?up|jump|hop|burpee|jack|v-?up|leg raise|run|sprint/i.test(nameOf(sl.id)) || id === 'ch-desk-move' && sl.id === 'Desk_Seated_Leg_Raise', `${id}: ${sl.id} is not gentle`);
  // Days tick from real data: a plank day by its session, a Soft 30 day only when the workout, water and protein are all in.
  const pk = challengeById['plank-30'];
  const pkp = progress(pk, { id: pk.id, start: '2026-11-01', done: [] }, { ...empty, sessions: [{ startedAt: at('2026-11-01'), title: 'Planks · week 1' }] }, '2026-11-02');
  assert(pkp.days[0].state === 'done' && pkp.days[5].rest && pkp.days[7].tasks[0].task.kind === 'session', 'plank days');
  const sf = challengeById['soft-30'], sd = '2026-11-01';
  const sctx: Ctx = { ...empty, sessions: [{ startedAt: at(sd), title: 'Any' }], water: { [sd]: 10 }, meals: [{ day: sd, protein: 130 }] };
  assert(progress(sf, { id: sf.id, start: sd, done: [] }, sctx, sd).days[0].state === 'done', 'soft day done');
  assert(progress(sf, { id: sf.id, start: sd, done: [] }, { ...sctx, water: {} }, sd).days[0].state === 'today', 'soft day needs water too');
  // Picked for you: after birth gets the gentle core, 55+ gets steady and strong, no bar at home sinks the pull-up one.
  const pp = recommend({ ...base, goal: 'stay fit', women: { mode: 'postpartum', date: '2026-09-01' } } as Profile, 10);
  assert(pp.slice(0, 3).some((x) => x.id === 'postnatal-core-28') && pp.slice(0, 6).every((x) => !x.impact && x.goal !== 'HIIT' && x.level !== 'Advanced'), 'after birth');
  const old = recommend({ ...base, age: 64, goal: 'stay fit' }, 10);
  assert(old[0].id === 'balance-28' && old.slice(0, 5).every((x) => !x.impact && x.level !== 'Advanced'), '55+ gets steady and strong');
  assert(recommend(base, 10).slice(0, 5).every((x) => x.who !== 'after birth'), 'after-birth core stays out of other top picks');
  const home = { ...base, goal: 'get stronger', level: 'intermediate', place: 'home', gear: [] } as unknown as Profile;
  assert(recommend(home, 20)[0].id !== 'pullup-28' && recommend({ ...home, gear: ['pull-up bar'] }, 20)[0].id === 'pullup-28', 'pull-up needs a bar at home');
  assert(recommend({ ...base, goal: 'stay fit', concerns: ['run'] } as Profile, 10)[0].id === 'walk-run-28', 'new runner gets walk to run');
}
