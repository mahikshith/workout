// Muscle groups for the Exercises tab: what each does, its focus areas, and plain rules for dose, effort and calories.
// Everything is guessed from names and categories, so it stays approximate and easy to read.
import { available, type Exercise } from './exercises';

export type Focus = { label: string; about: string; test?: (e: Exercise) => boolean }; // the one without a test is the default
export type Group = { id: string; label: string; does: string; muscles?: string[]; cats?: string[]; focus: Focus[] };

const n = (re: RegExp) => (e: Exercise) => re.test(e.name);
const pm = (...ms: string[]) => (e: Exercise) => ms.includes(e.primary[0]);
const cat = (k: string) => (e: Exercise) => e.category === k;

export const GROUPS: Group[] = [
  { id: 'chest', label: 'Chest', muscles: ['chest'], does: 'Pushes your arms forward and across your body, like pushing a door open.', focus: [
    { label: 'Upper chest', about: 'The top of your chest, under the collarbone. Incline presses and flys hit it most.', test: n(/incline/i) },
    { label: 'Middle chest', about: 'The big middle part. Flat presses, push-ups and flys.' },
    { label: 'Lower chest', about: 'The lower edge. Decline presses and dips hit it most.', test: n(/decline|dip/i) },
  ] },
  { id: 'back', label: 'Back', muscles: ['lats', 'middle back', 'lower back', 'traps'], does: 'Pulls your arms down and back, and keeps you standing tall.', focus: [
    { label: 'Lats', about: 'The wide muscles down your sides that give the V shape. Pull-ups and pulldowns.', test: pm('lats') },
    { label: 'Mid back', about: 'The rhomboids between your shoulder blades that pull them together. Rows.', test: pm('middle back') },
    { label: 'Traps', about: 'The top of your back up to your neck. Shrugs and upright rows.', test: pm('traps') },
    { label: 'Lower back', about: 'The muscles along your spine that hold you upright. Back extensions and deadlifts.', test: pm('lower back') },
  ] },
  { id: 'shoulders', label: 'Shoulders', muscles: ['shoulders'], does: 'Lift your arms forward, out to the side and back.', focus: [
    { label: 'Front delts', about: 'The front of the shoulder. Overhead presses and front raises.' },
    { label: 'Side delts', about: 'The side of the shoulder that makes shoulders look wider. Lateral raises.', test: (e) => /lateral|side|upright/i.test(e.name) && !/bent|rear|lying|prone/i.test(e.name) },
    { label: 'Rear delts', about: 'The back of the shoulder, great for posture. Reverse flys and face pulls.', test: n(/rear|reverse fl|face pull|bent.?over|prone|external rotation/i) },
  ] },
  { id: 'biceps', label: 'Biceps', muscles: ['biceps'], does: 'Bend your elbow and turn your palm up.', focus: [
    { label: 'Long head', about: 'The outer part that makes the peak. Curls with your arms behind you, like incline curls.', test: (e) => /incline|drag|behind|lying/i.test(e.name) && !/hammer|reverse/i.test(e.name) },
    { label: 'Short head', about: 'The inner part that adds width. Curls with your arms in front, like preacher and concentration curls.', test: (e) => /preacher|concentration|spider|scott|overhead cable|high cable/i.test(e.name) && !/hammer|reverse/i.test(e.name) },
    { label: 'Brachialis', about: 'The brachialis and brachioradialis, under the biceps and along the forearm. Hammer and reverse curls.', test: n(/hammer|reverse|zottman|cross.?body|pinwheel/i) },
    { label: 'Both heads', about: 'Standard curls with your palms up work the whole biceps.' },
  ] },
  { id: 'triceps', label: 'Triceps', muscles: ['triceps'], does: 'Straighten your elbow. They do the work in every push.', focus: [
    { label: 'Long head', about: 'The biggest part, at the back of the arm. Moves with your arm overhead, like overhead extensions.', test: n(/overhead|french|skull|lying|incline|behind|tate|decline|pullover/i) },
    { label: 'Lateral and medial heads', about: 'The outer and lower parts near the elbow. Pushdowns, close-grip presses and dips.' },
  ] },
  { id: 'forearms', label: 'Forearms', muscles: ['forearms'], does: 'Grip, and bend and turn your wrists.', focus: [
    { label: 'Grip', about: 'Holding on. Carries, hangs and plate pinches.' },
    { label: 'Wrist flexors', about: 'The palm side of the forearm. Wrist curls with palms up.', test: (e) => /wrist curl|palms?-?up|finger curl|supination/i.test(e.name) && !/palms?-?down|reverse/i.test(e.name) },
    { label: 'Wrist extensors', about: 'The back of the forearm. Wrist curls with palms down.', test: n(/palms?-?down|reverse wrist|wrist extension|pronation|wrist roller/i) },
  ] },
  { id: 'abs', label: 'Abs and core', muscles: ['abdominals'], does: 'Brace and bend your middle, and protect your back.', focus: [
    { label: 'Upper abs', about: 'The top of the six-pack. Crunches and sit-ups.' },
    { label: 'Lower abs', about: 'Below the belly button. Leg raises and reverse crunches.', test: n(/leg raise|knee raise|reverse crunch|hanging|flutter|scissor|leg lift|tuck|jack.?knife|toes|v-?up|leg pull/i) },
    { label: 'Obliques', about: 'The sides of your waist. Twists, side planks and side bends.', test: n(/oblique|twist|side|russian|wood.?chop|windmill|bicycle|cross|rotation|saxon|landmine|air bike/i) },
    { label: 'Deep core', about: 'The deep muscles that brace your middle and protect your back. Planks and dead bugs.', test: n(/plank|hollow|dead bug|bird dog|rollout|roller|wheel|pallof|vacuum|hold|bear/i) },
  ] },
  { id: 'glutes', label: 'Glutes', muscles: ['glutes'], does: 'Push your hips forward and keep your knees and pelvis steady.', focus: [
    { label: 'Gluteus maximus', about: 'The big muscle of your bum. Hip thrusts, bridges and squats.' },
    { label: 'Gluteus medius', about: 'The side of your hip that keeps your knees and pelvis steady. Side-lying raises and band walks.', test: n(/abduct|side|clam|band walk|monster|lateral|hydrant|circle/i) },
  ] },
  { id: 'quads', label: 'Quads', muscles: ['quadriceps'], does: 'Straighten your knee: standing up, climbing stairs, jumping.', focus: [
    { label: 'Squats', about: 'Both legs together. Builds the whole front of your thigh.' },
    { label: 'Single leg', about: 'One leg at a time, for balance and even sides. Lunges, split squats and step-ups.', test: n(/lunge|split|step.?up|pistol|single.?leg|one.?leg|bulgarian/i) },
    { label: 'Knee extension', about: 'The front of the thigh just above the knee, on its own. Leg extensions.', test: n(/extension|sissy/i) },
  ] },
  { id: 'hamstrings', label: 'Hamstrings', muscles: ['hamstrings'], does: 'Bend your knee and drive your hips forward, as in running.', focus: [
    { label: 'Hip hinge', about: 'The upper hamstrings near your bum. Romanian deadlifts, good mornings and swings.' },
    { label: 'Leg curl', about: 'The lower hamstrings near the knee. Leg curls and Nordic curls.', test: n(/curl|glute.?ham|nordic/i) },
  ] },
  { id: 'calves', label: 'Calves', muscles: ['calves'], does: 'Push you up onto your toes in every step and jump.', focus: [
    { label: 'Gastrocnemius', about: 'The big upper calf. Works most with a straight knee, like standing raises.' },
    { label: 'Soleus', about: 'The flat muscle underneath. Works most with a bent knee, like seated raises.', test: n(/seated|bent.?knee/i) },
  ] },
  { id: 'hips', label: 'Inner and outer thigh', muscles: ['adductors', 'abductors'], does: 'Pull your legs together and apart, and keep your knees steady.', focus: [
    { label: 'Adductors', about: 'The inner thigh, which pulls your legs together.', test: pm('adductors') },
    { label: 'Abductors', about: 'The outer hip, which moves your leg out and steadies your pelvis.', test: pm('abductors') },
  ] },
  { id: 'neck', label: 'Neck', muscles: ['neck'], does: 'Hold up and turn your head. Helps a stiff neck from screens.', focus: [
    { label: 'Front and back', about: 'The muscles that nod your head. Chin tucks and front and back holds.' },
    { label: 'Sides', about: 'Tilting your head to each shoulder. Side holds and tilts.', test: n(/side|tilt|lateral/i) },
  ] },
  { id: 'mobility', label: 'Mobility', cats: ['stretching', 'mobility'], does: 'Stretches and easy moves that help you move freely and feel less stiff.', focus: [
    { label: 'Upper body', about: 'Chest, shoulders, arms, neck and jaw.', test: pm('chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'neck', 'traps', 'jaw') },
    { label: 'Back and spine', about: 'Loosens a back that is stiff from sitting.', test: pm('lats', 'middle back', 'lower back') },
    { label: 'Hips and legs', about: 'Hips, thighs and calves.' },
  ] },
  { id: 'cardio', label: 'Cardio', cats: ['cardio', 'plyometrics'], does: 'Gets your heart going and builds stamina.', focus: [
    { label: 'Steady', about: 'A pace you could still talk at. Builds stamina.' },
    { label: 'Jumps and power', about: 'Short, fast bursts. Builds speed and burns a lot in little time.', test: cat('plyometrics') },
  ] },
  { id: 'pelvic', label: 'Pelvic floor', cats: ['pelvic floor'], does: 'Supports your bladder and core. Helps with leaks, pregnancy and recovery after birth.', focus: [] },
  { id: 'desk', label: 'Eyes and desk', cats: ['eyes', 'desk', 'breathing'], does: 'Short breaks you can do at your desk to rest your eyes and ease stiffness.', focus: [
    { label: 'Desk', about: 'Stretches for the neck, back, wrists and hips after sitting.' },
    { label: 'Eyes', about: 'Breaks for tired eyes after screen time.', test: cat('eyes') },
    { label: 'Breathing', about: 'Slow breathing to calm down and reset.', test: cat('breathing') },
  ] },
];

// Muscle groups hold the strength-type moves; stretches and cardio have their own blocks.
const OWN = ['stretching', 'mobility', 'cardio'];
export const inGroup = (g: Group, e: Exercise) =>
  g.cats ? g.cats.includes(e.category) : !!g.muscles?.includes(e.primary[0]) && !OWN.includes(e.category);
// A muscle name from older links (e.g. Train's "Browse by muscle") to its block.
export const groupFor = (m: string) => GROUPS.find((g) => g.muscles?.includes(m) || g.cats?.includes(m))?.id ?? null;

export function focusOf(e: Exercise, gid?: string): Focus | null {
  const g = GROUPS.find((x) => x.id === gid) ?? GROUPS.find((x) => inGroup(x, e));
  return g?.focus.find((f) => f.test?.(e)) ?? g?.focus.find((f) => !f.test) ?? null;
}

// ponytail: guesses desk-friendly moves from the name; a per-exercise tag in the data would be exact.
const INHOUSE = ['desk', 'eyes', 'breathing', 'pelvic floor'];
export const office = (e: Exercise) => INHOUSE.includes(e.category) ||
  (available(e, 'home', []) && /seated|chair|desk|neck|wrist|calf raise|standing/i.test(e.name) &&
    !/jump|hop|lying|kneeling|floor|pull|chin|hang|dip|push|tuck|fold|toe touch/i.test(e.name));

// --- dose, effort, calories ---
const LV = { beginner: 0, intermediate: 1, expert: 2 };
const HEAVY = ['olympic weightlifting', 'strongman', 'powerlifting'];
const STRETCH = ['stretching', 'mobility'];
const isHold = (e: Exercise) => /plank|hold|wall sit|isometric|dead hang|l-sit|hollow|static/i.test(e.name) && !/jack|tap|push|walk|jump|up to/i.test(e.name);

export type Dose = { sets: number; reps: string; rest: number; secs: number }; // secs: working time per set
export function dose(e: Exercise): Dose {
  const sets = 3 - (e.level === 'beginner' ? 1 : 0);
  if (e.timed) return { sets: 1, reps: `10 x ${e.timed.hold} s`, rest: e.timed.rest, secs: 10 * (e.timed.hold + e.timed.rest) };
  if (STRETCH.includes(e.category)) return { sets: 2, reps: '30 s', rest: 15, secs: 30 };
  if (e.category === 'cardio') return { sets: 1, reps: `${10 + 10 * LV[e.level]} min`, rest: 0, secs: 600 + 600 * LV[e.level] };
  if (e.category === 'plyometrics') return { sets, reps: '20 s', rest: 60, secs: 20 };
  if (isHold(e)) return { sets, reps: e.level === 'beginner' ? '20-30 s' : '30-45 s', rest: 45, secs: 30 };
  if (HEAVY.includes(e.category)) return { sets, reps: '3-5', rest: 150, secs: 20 };
  if (e.mechanic === 'compound') return { sets, reps: '8-12', rest: e.equipment === 'barbell' ? 120 : 90, secs: 35 };
  return { sets, reps: '10-15', rest: 60, secs: 40 };
}
export const doseText = (d: Dose) => (d.sets > 1 ? `${d.sets} x ${d.reps}` : d.reps);
export const restText = (d: Dose) => (d.rest ? `${d.rest} s` : 'None');

// Rough MET values (Compendium of Physical Activities): an estimate, never a measurement.
const met = (e: Exercise) =>
  INHOUSE.includes(e.category) ? 1.3 : STRETCH.includes(e.category) ? 2.3 : e.category === 'cardio' ? 7 : e.category === 'plyometrics' ? 8
  : HEAVY.includes(e.category) ? 6 : isHold(e) ? 3.8 : e.mechanic === 'compound' ? 5 : 3.5;
export const kcalPerMin = (e: Exercise, kg: number) => (met(e) * 3.5 * kg) / 200;
// All sets of the dose, rests counted at a resting rate. Approximate.
export function kcal(e: Exercise, kg: number) {
  const d = dose(e);
  return Math.max(1, Math.round((d.sets * d.secs * kcalPerMin(e, kg) + (d.sets - 1) * d.rest * 1.3 * 3.5 * kg / 200) / 60));
}

export const EFFORT = ['Easy', 'Moderate', 'Hard'] as const;
const effortIdx = (e: Exercise) => {
  const m = met(e);
  const s = LV[e.level] + (m >= 6 ? 1 : 0) + (e.mechanic === 'compound' ? 1 : 0) - (m < 3 ? 2 : 0);
  return s <= 0 ? 0 : s <= 2 ? 1 : 2;
};
export const effort = (e: Exercise) => EFFORT[effortIdx(e)];

// Easiest first: level, then bodyweight and dumbbells before machines and barbells, then effort.
const GEAR: Record<string, number> = { 'body only': 0, dumbbell: 0, bands: 0, kettlebells: 1, cable: 1, machine: 2, barbell: 2, 'e-z curl bar': 2 };
export const ease = (e: Exercise) => LV[e.level] * 10 + (GEAR[e.equipment] ?? 1) * 2 + effortIdx(e);
export const harder = (a: Exercise, b: Exercise) => LV[a.level] > LV[b.level];

const NICE: Record<string, string> = { abdominals: 'abs', quadriceps: 'quads', 'middle back': 'mid back', diaphragm: 'breathing muscles' };
const nice = (ms: string[]) => ms.slice(0, 2).map((m) => NICE[m] ?? m).join(' and ');
export function benefit(e: Exercise) {
  const m = nice(e.primary);
  switch (e.category) {
    case 'stretching': case 'mobility': return `Loosens your ${m} so you move more freely and feel less stiff.`;
    case 'cardio': return 'Builds stamina and a stronger heart, and burns energy.';
    case 'plyometrics': return `Builds power and speed in your ${m}.`;
    case 'eyes': return 'Rests tired eyes after long screen time.';
    case 'breathing': return 'Slows your breathing to calm your body and mind.';
    case 'desk': return `Eases stiffness in your ${m} from sitting.`;
    case 'pelvic floor': return 'Trains the pelvic floor for bladder control and a steady core.';
  }
  if (isHold(e)) return `Builds steady strength and control in your ${m}.`;
  return e.mechanic === 'compound'
    ? `Builds strength in your ${m}${e.secondary.length ? `, with help from your ${nice(e.secondary)}` : ''}.`
    : `Works your ${m} directly to build strength and shape.`;
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
export function selfCheck(byId: Record<string, Exercise>) {
  const fo = (id: string) => focusOf(byId[id])?.label;
  assert(fo('Hammer_Curls') === 'Brachialis', 'hammer curl -> brachialis');
  assert(fo('Incline_Dumbbell_Curl') === 'Long head', 'incline curl -> long head');
  assert(fo('Preacher_Curl') === 'Short head', 'preacher -> short head');
  assert(fo('Preacher_Hammer_Dumbbell_Curl') === 'Brachialis', 'hammer beats preacher');
  assert(fo('Seated_Calf_Raise') === 'Soleus', 'seated calf -> soleus');
  assert(fo('Incline_Dumbbell_Press') === 'Upper chest', 'incline press -> upper chest');
  assert(fo('Triceps_Pushdown') === 'Lateral and medial heads', 'pushdown -> lateral head');
  assert(fo('Face_Pull') === 'Rear delts', 'face pull -> rear delts');
  assert(fo('Dumbbell_Lying_Rear_Lateral_Raise') === 'Rear delts', 'rear lateral -> rear delts');
  assert(doseText(dose(byId.Plank)) === '2 x 20-30 s', 'beginner plank is a short hold');
  assert(office(byId.Desk_Chin_Tuck) && !office(byId.Bodyweight_Squat), 'office filter');
  assert(ease(byId.Bodyweight_Squat) < ease(byId.Barbell_Squat), 'bodyweight is easier than barbell');
  assert(kcal(byId.Bodyweight_Squat, 70) > 0 && effort(byId.Plank) !== 'Hard', 'kcal and effort');
}
