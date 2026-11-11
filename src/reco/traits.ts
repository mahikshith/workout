// What each exercise is, in the terms the recommendation engine reasons in. Everything is worked out once from the
// exercise data (name, category, equipment, muscles), kept conservative, and cached. Pure TypeScript: no React, no stores.
import { CARDIO } from '../data/cardio';
import { byId, exercises, type Exercise } from '../data/exercises';
import { plans } from '../data/plans';
import { quick } from '../data/quick';
import { EXTRA } from '../data/split';
import { impact as isImpact, straining as isStraining } from '../engine';

// The movement an exercise trains. Sessions are built from patterns (a squat, a push, a pull...) so they stay balanced.
export type Pattern =
  | 'squat' | 'lunge' | 'hinge' | 'push' | 'press' | 'row' | 'pulldown' | 'core' | 'arms' | 'calves' | 'hips' | 'carry'
  | 'cardio' | 'power' | 'stretch' | 'other';
// strength: lifts and bodyweight strength · cardio: steady or interval heart work · power: jumps, throws, swings ·
// mobility: stretches and easy range-of-motion moves · special: eye, desk, breathing and pelvic-floor drills, which only
// ever appear in their own short sessions.
export type Kind = 'strength' | 'cardio' | 'power' | 'mobility' | 'special';

export type Traits = {
  kind: Kind;
  pattern: Pattern;
  region: 'upper' | 'lower' | 'core' | 'none';
  side: 'push' | 'pull' | 'none'; // upper body only
  face: 'front' | 'back' | 'none'; // muscles on the front or the back of the body
  compound: boolean; // several joints and muscles at once
  impact: boolean; // jumping, running, landing
  straining: boolean; // heavy, breath-holding lifts
  hardness: 0 | 1 | 2; // 0 anyone, 1 needs some training behind it, 2 advanced
  supported: boolean; // a machine, cable, seat or wall guides the move
  ownWeight: boolean; // arms or one leg carry the whole body (push-ups, pull-ups, dips, planks, pistols)
  easedOwnWeight: boolean; // ...made lighter: on the wall, on the knees, assisted
  unilateral: boolean; // one side at a time
  hold: boolean; // held still for time
  staple: boolean; // used by one of the app's own plans or sessions: a proven, well-explained move
  odd: boolean; // needs unusual kit or is a specialist variation
  risky: boolean; // positions that bother many shoulders or backs; never suggested below advanced
};

const UPPER_PUSH = ['chest', 'shoulders', 'triceps'];
const UPPER_PULL = ['lats', 'middle back', 'traps', 'biceps', 'forearms'];
const LOWER = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];
const FRONT = ['chest', 'shoulders', 'quadriceps', 'abdominals', 'biceps'];
const BACK = ['lats', 'middle back', 'lower back', 'traps', 'hamstrings', 'glutes', 'calves', 'triceps'];

const CONDITIONING = /march in place|high knees|jumping jack|seal jack|fast feet|lateral shuffle|burpee|squat thrust|sprawl|mountain climber|rope jumping|plank jack|battling rope|bear crawl|crab walk|butt kick|skipping|wind sprint/i;
const POWER = /jump|bound|hop|throw|slam|swing|toss|\bclean\b|snatch|push press|plyo|box skip|depth|sprint|start technique|wall drill/i;
const COMPOUND = /squat|press|row|deadlift|lunge|pull-?up|chin-?up|pulldown|dip|push-?up|thrust|swing|step|clean|carry|walk|bridge/i;
const HOLD = /plank|hold|wall sit|isometric|dead hang|active hang|l-sit|hollow body|static|side bridge|vacuum/i;
const UNI = /single|one.?arm|one.?leg|alternat|lunge|split|step-?up|step-?down|pistol|side plank|side bridge|bird.?dog|dead bug|kickback|donkey|hydrant|clam|curtsy|cossack|skater|airplane|copenhagen|archer|\/side/i;
const SUPPORTED = /seated|machine|smith|leg press|supported|lying leg curl|assisted|wall |chair|incline push|pulldown|pushdown|preacher|pec deck|butterfly|hack squat|recumbent/i;
const OWN = /push-?up|pull-?up|chin-?up|\bdips?\b|plank|burpee|handstand|muscle.?up|inverted row|pistol|l-sit|crawl|crab walk|hollow|dragon|sprawl|squat thrust|mountain climber|shrimp|skater squat|v-up|hanging/i;
const EASED = /wall|knee push|kneeling push|incline push|assisted|negative|band.assisted|doorway|towel row/i;
// Calisthenics and gym moves the dataset marks as easy but that are not.
const HARD2 = /pistol|shrimp|dragon flag|handstand|muscle.?up|l-sit|one.?arm (chin|pull|push)|wall walk|archer|typewriter|kipping|planche|front lever|rope climb|side to side chin|gironda|london bridge|clap|commando|towel pull/i;
const HARD1 = /weighted|sissy|v-up|hindu|skater squat|copenhagen|cossack|feet.elevated|decline push|burpee|plyo|pull-?up|chin-?up|\bdips?\b|hanging|toes to bar|ab roller|rollout|jack.?knife|hollow rock|deficit|single.?leg (squat|deadlift)|nordic|glute.ham|good morning|hip airplane|depth jump|box jump|sprawl/i;
const ODD = /chain|with bands|- with bands|board press|reverse band|pin press|anti-gravity|zercher|jefferson|kneeling squat|off pins|speed box|powerlifting|sled|suspended|balance board|plate pinch|otis|cuban|scott|drag curl|one handed hang|neck resistance|head harness|bosu|landmine|rickshaw|axle|keg|atlas|tire|yoke|log lift|conan|circus|car driver|iron cross|around the world|svend|bradford|sots|muscle snatch|drop snatch|frankenstein|hang |from blocks|rack delivery|carioca|defensive slide|moving claw|arm drill/i;
const RISKY = /behind (the )?(neck|head)|guillotine|neck press|upright row|kipping|good morning|jefferson|sissy|straight.?leg deadlift|stiff.?leg|bradford/i;

// Every exercise the app's own plans, quick sessions and cardio ladder use.
// The dataset files a few moves under a muscle they only help with. The engine reads the main muscle through here.
const MAIN_FIX: Record<string, string> = { Flutter_Kicks: 'abdominals' };
export const mainMuscle = (e: Exercise): string => MAIN_FIX[e.id] ?? e.primary[0];

const STAPLES = new Set<string>([
  ...plans.flatMap((p) => p.days.flatMap((d) => d.slots.map((s) => s.id))),
  ...Object.values(EXTRA).flatMap((d) => d.slots.map((s) => s.id)),
  ...quick.flatMap((q) => q.slots.map((s) => s.id)),
  ...CARDIO.flatMap((q) => q.slots.map((s) => s.id)),
]);
export const isStaple = (id: string) => STAPLES.has(id);

function kindOf(e: Exercise): Kind {
  if (['pelvic floor', 'eyes', 'desk', 'breathing'].includes(e.category)) return 'special';
  if (e.category === 'cardio' || CONDITIONING.test(e.name)) return 'cardio';
  if (e.category === 'stretching' || e.category === 'mobility') return 'mobility';
  if (e.category === 'plyometrics') return 'power';
  if (POWER.test(e.name) && !/squat thrust|hip thrust|glute/i.test(e.name) && (e.category === 'olympic weightlifting' || /jump|bound|hop|throw|slam|swing|toss|plyo/i.test(e.name))) return 'power';
  return 'strength';
}

function patternOf(e: Exercise, kind: Kind): Pattern {
  if (kind === 'cardio') return 'cardio';
  if (kind === 'power') return 'power';
  if (kind === 'mobility') return 'stretch';
  if (kind === 'special') return 'other';
  const m = mainMuscle(e);
  const n = e.name;
  if (/farmer|carry|suitcase/i.test(n)) return 'carry';
  if (m === 'abdominals') return 'core';
  if (m === 'quadriceps') return /lunge|split squat|step-?up|step-?down|curtsy|cossack|skater/i.test(n) ? 'lunge' : 'squat';
  if (m === 'glutes') return /lunge|step-?up|split/i.test(n) ? 'lunge' : /squat/i.test(n) ? 'squat' : /abduct|clam|hydrant|lateral walk|side.lying/i.test(n) ? 'hips' : 'hinge';
  if (m === 'hamstrings' || m === 'lower back') return 'hinge';
  if (m === 'adductors' || m === 'abductors') return 'hips';
  if (m === 'calves') return 'calves';
  if (m === 'chest') return 'push';
  if (m === 'shoulders') return /press|push/i.test(n) ? 'press' : 'arms'; // raises and flys are small single-joint work
  if (m === 'lats') return /row/i.test(n) ? 'row' : 'pulldown';
  if (m === 'middle back' || m === 'traps') return 'row';
  if (m === 'triceps') return /dip|close.grip|bench press|push-?up/i.test(n) ? 'push' : 'arms';
  if (m === 'biceps') return /chin/i.test(n) ? 'pulldown' : 'arms';
  if (m === 'forearms') return 'arms';
  return 'other';
}

function build(e: Exercise): Traits {
  const kind = kindOf(e);
  const pattern = patternOf(e, kind);
  const m = mainMuscle(e);
  const n = e.name;
  const region = m === 'abdominals' || m === 'lower back' ? 'core' : LOWER.includes(m) ? 'lower' : UPPER_PUSH.includes(m) || UPPER_PULL.includes(m) || m === 'neck' ? 'upper' : 'none';
  const lv = e.level === 'expert' ? 2 : e.level === 'intermediate' ? 1 : 0;
  const skill = e.category === 'olympic weightlifting' ? 2 : e.category === 'strongman' || e.category === 'powerlifting' ? 1 : 0;
  const own = (e.equipment === 'body only' || e.equipment === 'other' || e.equipment === 'pull-up bar') && OWN.test(n);
  const eased = EASED.test(n);
  const named = HARD2.test(n) ? 2 : HARD1.test(n) && !eased ? 1 : 0;
  return {
    kind, pattern, region,
    side: UPPER_PUSH.includes(m) ? 'push' : UPPER_PULL.includes(m) ? 'pull' : 'none',
    face: FRONT.includes(m) ? 'front' : BACK.includes(m) ? 'back' : 'none',
    compound: e.mechanic === 'compound' || (!e.mechanic && COMPOUND.test(n) && pattern !== 'arms'),
    impact: isImpact(e),
    straining: isStraining(e),
    hardness: Math.max(lv, skill, named) as 0 | 1 | 2,
    supported: e.equipment === 'machine' || e.equipment === 'cable' || SUPPORTED.test(n),
    ownWeight: own && !eased,
    easedOwnWeight: own && eased,
    unilateral: UNI.test(n),
    hold: !!e.timed || (HOLD.test(n) && !/jack|tap|push|walk|jump|up to|march|dip/i.test(n)),
    staple: STAPLES.has(e.id),
    odd: !STAPLES.has(e.id) && (ODD.test(n) || e.category === 'strongman' || (e.equipment === 'other' && !/dip|hyperextension|back extension|inverted row|pull-?up|chin|trap bar|plate raise/i.test(n))),
    risky: RISKY.test(n),
  };
}

const CACHE: Record<string, Traits> = Object.fromEntries(exercises.map((e) => [e.id, build(e)]));
export const traitsOf = (e: Exercise): Traits => CACHE[e.id] ?? build(e);

// Muscles as people say them.
const NICE: Record<string, string> = { abdominals: 'core', quadriceps: 'thighs', 'middle back': 'upper back', lats: 'back', 'lower back': 'lower back', traps: 'upper back', hamstrings: 'hamstrings' };
export const sayMuscle = (m: string) => NICE[m] ?? m;

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('reco traits: ' + m); };
export function selfCheck() {
  const t = (id: string) => { assert(!!byId[id], `exercise ${id} exists`); return traitsOf(byId[id]); };
  assert(t('Barbell_Squat').pattern === 'squat' && t('Barbell_Squat').compound && t('Barbell_Squat').region === 'lower', 'squat');
  assert(t('Dumbbell_Lunges').pattern === 'lunge' && t('Dumbbell_Lunges').unilateral, 'lunge is one side at a time');
  assert(t('Romanian_Deadlift').pattern === 'hinge' && t('Romanian_Deadlift').face === 'back', 'hinge');
  assert(t('Dumbbell_Bench_Press').pattern === 'push' && t('Dumbbell_Bench_Press').side === 'push', 'bench is a push');
  assert(t('Seated_Cable_Rows').pattern === 'row' && t('Seated_Cable_Rows').side === 'pull' && t('Seated_Cable_Rows').supported, 'cable row');
  assert(t('Wide-Grip_Lat_Pulldown').pattern === 'pulldown', 'pulldown');
  assert(t('Side_Lateral_Raise').pattern === 'arms' && !t('Side_Lateral_Raise').compound, 'raises are single-joint');
  assert(t('Plank').hold && t('Plank').pattern === 'core' && t('Plank').ownWeight, 'plank is a hold');
  assert(t('Freehand_Jump_Squat').impact && t('wg_burpee').impact && !t('Bodyweight_Squat').impact, 'impact');
  assert(t('wg_high-knees').kind === 'cardio' && t('March_In_Place').kind === 'cardio' && t('Walking_Treadmill').kind === 'cardio', 'conditioning moves are cardio');
  assert(t('Cat_Stretch').kind === 'mobility' && t('Kegel_Long_Hold').kind === 'special' && t('Front_Box_Jump').kind === 'power', 'kinds');
  assert(t('wg_pistol-squat').hardness === 2 && t('wg_dragon-flag').hardness === 2 && t('Pullups').hardness >= 1, 'hard bodyweight moves are marked hard');
  assert(t('wg_knee-push-up').hardness === 0 && t('wg_knee-push-up').easedOwnWeight && t('wg_wall-push-up').easedOwnWeight, 'eased push-ups');
  assert(t('Goblet_Squat').staple && t('Bench_Press_with_Chains').odd && !t('Goblet_Squat').odd, 'staples and specialist moves');
  assert(t('Standing_Barbell_Press_Behind_Neck').risky, 'behind-the-neck pressing is risky');
  for (const e of exercises) { const x = traitsOf(e); assert(!!x.kind && !!x.pattern, `traits for ${e.id}`); }
}
