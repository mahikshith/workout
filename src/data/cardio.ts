// The cardio ladder: four stages from an easy walk to sprints and HIIT. The reasoning engine (`cardioFor`) starts
// people at the stage that fits their level, moves them up every 6 cardio sessions, and only offers high-impact work
// to bodies it suits (no running or jumping with knee or back trouble, during pregnancy or after birth, at 55+ or
// with a high BMI to start). Every session is time-based, so the workout screen shows a timer instead of reps.
import type { Ionicons } from '@expo/vector-icons';
import { postpartumWeek, pregnancyWeek } from '../calc';
import type { Profile, Session } from '../store';
import { byId } from './exercises';
import type { Slot } from './plans';
import type { Quick } from './quick';

type Icon = keyof typeof Ionicons.glyphMap;
export type CardioSession = Quick & { stage: 1 | 2 | 3 | 4; impact: 'low' | 'high'; at: 'gym' | 'home' | 'any' };

const x = (id: string, sets: number, reps: string, rest = 0): Slot => ({ id, sets, reps, rest });
const S = (id: string, stage: CardioSession['stage'], impact: CardioSession['impact'], at: CardioSession['at'], name: string, minutes: number,
  icon: Icon, blurb: string, slots: Slot[], gear?: string[]): CardioSession =>
  ({ id: 'cardio-' + id, stage, impact, at, name, minutes, icon, blurb, slots, gear, where: at === 'gym' ? ['gym'] : at === 'home' ? ['home'] : ['anywhere'], tags: ['cardio'] });

export const STAGES = ['Base', 'Build', 'Push', 'Peak'] as const;

export const CARDIO: CardioSession[] = [
  // 1 Base: easy, talking pace. Builds the habit and the heart's base.
  S('walk', 1, 'low', 'any', 'Brisk walk', 25, 'walk', 'Talking pace, every day if you like.', [x('Walking_Treadmill', 1, '25 min')]),
  S('incline-walk', 1, 'low', 'gym', 'Incline walk', 25, 'trending-up', 'Treadmill uphill: big burn, kind to knees.', [x('Walking_Treadmill', 1, '5 min', 30), x('wg_treadmill-incline-walk', 1, '20 min')]),
  S('easy-bike', 1, 'low', 'gym', 'Easy ride', 20, 'bicycle', 'Seated, steady, no impact.', [x('Recumbent_Bike', 1, '20 min')]),
  S('march', 1, 'low', 'home', 'March and step', 12, 'footsteps', 'Indoor walking in your living room.', [x('March_In_Place', 4, '3 min', 30)]),
  // 2 Build: longer and a little harder; first intervals.
  S('elliptical', 2, 'low', 'gym', 'Elliptical glide', 25, 'infinite', 'Running motion without the pounding.', [x('Elliptical_Trainer', 1, '25 min')]),
  S('row', 2, 'low', 'gym', 'Rowing blocks', 20, 'boat', 'Whole body: 4 × 4 minutes steady.', [x('Rowing_Stationary', 4, '4 min', 60)]),
  S('run-walk', 2, 'high', 'any', 'Run-walk', 24, 'walk-outline', 'Jog 2 minutes, walk 1. Your first runs.', [x('Walking_Treadmill', 1, '5 min', 30), x('Jogging_Treadmill', 6, '2 min', 60)]),
  S('stairs', 2, 'low', 'gym', 'Stair climber', 15, 'stats-chart', 'Steady climb, legs and lungs.', [x('Stairmaster', 3, '5 min', 60)]),
  S('home-circuit', 2, 'high', 'home', 'Jacks circuit', 12, 'flash', 'Jumping jacks and high knees, 30 on, 30 off.', [x('wg_jumping-jack', 6, '30s', 30), x('wg_high-knees', 6, '30s', 30)]),
  // 3 Push: continuous running and real intervals.
  S('run', 3, 'high', 'any', 'Steady run', 25, 'speedometer', 'Easy run, no walk breaks.', [x('Walking_Treadmill', 1, '5 min', 30), x('Running_Treadmill', 1, '20 min')]),
  S('bike-intervals', 3, 'low', 'gym', 'Bike intervals', 20, 'bicycle', '1 minute hard, 90 seconds easy, × 8.', [x('Recumbent_Bike', 1, '3 min', 30), x('Bicycling_Stationary', 8, '60s', 90)]),
  S('rope', 3, 'high', 'any', 'Jump rope', 12, 'pulse', '1 minute on, 30 seconds off, × 8.', [x('Rope_Jumping', 8, '60s', 30)], ['jump rope']),
  S('row-intervals', 3, 'low', 'gym', 'Row intervals', 18, 'boat', '500 m hard, 2 minutes easy, × 4.', [x('Rowing_Stationary', 4, '2 min', 120)]),
  // 4 Peak: sprints and HIIT, for well-trained bodies.
  S('sprints', 4, 'high', 'any', 'Sprints', 20, 'rocket', '20 seconds all-out, walk back, × 8.', [x('Jogging_Treadmill', 1, '5 min', 30), x('Wind_Sprints', 8, '20s', 90)]),
  S('hiit', 4, 'high', 'home', 'HIIT burners', 16, 'flame', 'Burpees, climbers, squat thrusts. 40 on, 20 off.', [x('wg_burpee', 4, '40s', 20), x('Mountain_Climbers', 4, '40s', 20), x('wg_squat-thrust', 4, '40s', 20)]),
  S('tempo', 4, 'high', 'gym', 'Tempo run', 30, 'speedometer', '10 easy, 15 comfortably hard, 5 easy.', [x('Jogging_Treadmill', 1, '10 min', 0), x('Running_Treadmill', 1, '15 min', 0), x('Walking_Treadmill', 1, '5 min')]),
  S('bike-hiit', 4, 'low', 'gym', 'Air bike sprints', 15, 'bicycle', '15 seconds flat out, 45 easy, × 10.', [x('wg_assault-bike', 10, '15s', 45)]),
];

// A session counts as cardio when most of its logged sets are cardio exercises (or it is a ladder session).
const isCardio = (s: Session) => {
  const sets = s.items.map((it) => ({ cardio: byId[it.exId]?.category === 'cardio' || byId[it.exId]?.category === 'plyometrics', n: it.sets.filter((z) => z.done).length }));
  const total = sets.reduce((a, z) => a + z.n, 0);
  return total > 0 && sets.reduce((a, z) => a + (z.cardio ? z.n : 0), 0) / total >= 0.5;
};

export function cardioFor(p: Profile, sessions: Session[]) {
  const done = sessions.filter(isCardio).length;
  const start = p.level === 'beginner' ? 1 : p.level === 'intermediate' ? 2 : 3;
  const stage = Math.min(4, start + Math.floor(done / 6)) as CardioSession['stage'];
  const toNext = stage < 4 ? 6 - (done % 6) : 0;
  const bmi = p.weightKg / ((p.heightCm / 100) ** 2);
  const careful = pregnancyWeek(p) !== null || postpartumWeek(p) !== null || p.age >= 55 || bmi >= 32
    || !!p.concerns?.some((x) => x === 'knee' || x === 'back' || x === 'injury');
  const places = p.place === 'gym' ? ['gym', 'any'] : p.place === 'both' ? ['gym', 'home', 'any'] : ['home', 'any'];
  const fits = (s: CardioSession) => places.includes(s.at) && (!careful || s.impact === 'low') && (!s.gear || s.gear.every((g) => p.gear.includes(g) || p.place !== 'home'));
  const runner = !!p.concerns?.some((x) => x === 'run' || x === 'endurance');
  const leaner = p.goal === 'lose fat' || !!p.concerns?.includes('lose-weight');
  const score = (s: CardioSession) =>
    (s.stage === stage ? 30 : s.stage === stage - 1 ? 12 : 0) + (runner && /run|sprint|tempo/.test(s.id) ? 10 : 0) + (leaner && s.minutes >= 20 ? 6 : 0) + (s.impact === 'low' ? 1 : 0);
  const picks = CARDIO.filter((s) => s.stage <= stage && fits(s)).sort((a, b) => score(b) - score(a)).slice(0, 4);
  const next = stage < 4 ? CARDIO.find((s) => s.stage === stage + 1 && fits(s)) : undefined;
  return { stage, name: STAGES[stage - 1], done, toNext, careful, picks, next };
}

export function selfCheck(byIdMap: Record<string, unknown> = byId) {
  const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('cardio: ' + m); };
  for (const s of CARDIO) for (const sl of s.slots) assert(sl.id in byIdMap, `${s.id} uses unknown exercise ${sl.id}`);
  const base = { name: 'A', gender: 'male', age: 30, heightCm: 178, weightKg: 75, goalWeightKg: 75, goal: 'stay fit', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } } as unknown as Profile;
  const r = cardioFor(base, []);
  assert(r.stage === 1 && r.picks.length > 0 && r.picks.every((s) => s.stage === 1), 'beginner starts at Base');
  assert(cardioFor({ ...base, concerns: ['knee'], level: 'advanced' } as Profile, []).picks.every((s) => s.impact === 'low'), 'knees get low impact only');
  assert(cardioFor({ ...base, place: 'home' } as Profile, []).picks.every((s) => s.at !== 'gym'), 'home gets no machines');
}
