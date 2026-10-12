// Builds src/data/exercises.json from yuhonas/free-exercise-db (public domain), line-art demos from
// bryllim/workout-guide (CC BY-SA 4.0) and in-house pelvic-floor drills.
// Usage: node scripts/build-exercises.mjs [free-exercise-db/dist/exercises.json] [workout-guide/packages/workout-guide/manifest.json]
import { readFileSync, writeFileSync } from 'node:fs';

const load = async (path, url) => (path ? JSON.parse(readFileSync(path, 'utf8')) : (await fetch(url)).json());
const raw = await load(process.argv[2], 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json');
// Keep this commit in sync with WG in src/data/exercises.ts.
const wg = await load(process.argv[3], 'https://cdn.jsdelivr.net/gh/bryllim/workout-guide@aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/manifest.json');

const out = raw
  .filter((e) => e.images?.length >= 2)
  .map((e) => ({
    id: e.id,
    name: e.name,
    equipment: e.equipment ?? 'body only',
    primary: e.primaryMuscles,
    secondary: e.secondaryMuscles,
    level: e.level,
    force: e.force ?? null,
    mechanic: e.mechanic ?? null,
    category: e.category,
    steps: e.instructions,
  }));

// --- workout-guide line art -------------------------------------------------------------------------
// A wrong drawing is worse than a photo, so matching is exact on normalized names, plus a hand-checked alias list.
const EQ = { Barbell: 'barbell', Dumbbell: 'dumbbell', Cable: 'cable', Machine: 'machine', Kettlebell: 'kettlebells', 'Resistance Band': 'bands', 'Stability Ball': 'exercise ball', 'Pull-up Bar': 'pull-up bar', Plate: 'other', Cardio: 'other' };
const GEAR_WORD = { barbell: 'barbell', dumbbell: 'dumbbell', cable: 'cable', machine: 'machine', kettlebell: 'kettlebells', band: 'bands' };
const norm = (s) => s.toLowerCase().replace(/'/g, '').replace(/\bmedium grip\b/g, '')
  .replace(/\b(push|pull|chin|sit|step) ?-?ups?\b/g, '$1up')
  .split(/[^a-z0-9]+/).filter(Boolean)
  .map((w) => w.replace(/^fl(y|ye|yes|ys)$/, 'fly').replace(/^(tri|bi)ceps$/, '$1cep').replace(/ches$/, 'ch').replace(/([^s])s$/, '$1'));
// The gear word is dropped only when the equipment agrees, so "Dumbbell Shrug" never matches the barbell one.
const key = (name, eq) => norm(name).filter((w) => GEAR_WORD[w] !== eq).join(' ') + '|' + eq;
if (key('Pushups', 'body only') !== key('Push-up', 'body only') || key('Dumbbell Shrug', 'barbell') === key('Barbell Shrug', 'barbell')
  || key('Barbell Bench Press - Medium Grip', 'barbell') !== key('Bench Press', 'barbell')) throw new Error('name normalizer broke');
const feEq = (e) => e.equipment ?? 'body only';
const wgEq = (w) => EQ[w.equipment] ?? 'body only';

// Same movement, different name or equipment label. Checked against both datasets' instructions/art.
const ALIAS = {
  'machine-chest-press': ['Machine_Bench_Press', 'Leverage_Chest_Press'], 'pec-deck': ['Butterfly'], 'cable-fly': ['Cable_Crossover'],
  'overhead-press': ['Standing_Military_Press'], 'seated-dumbbell-press': ['Seated_Dumbbell_Press', 'Dumbbell_Shoulder_Press'],
  'lateral-raise': ['Side_Lateral_Raise'], 'reverse-pec-deck': ['Reverse_Machine_Flyes'], 'barbell-row': ['Bent_Over_Barbell_Row'],
  'dumbbell-bent-over-row': ['Bent_Over_Two-Dumbbell_Row'], 'close-grip-lat-pulldown': ['Close-Grip_Front_Lat_Pulldown'],
  'bulgarian-split-squat': ['Split_Squat_with_Dumbbells'], 'smith-machine-bulgarian-split-squat': ['Smith_Single-Leg_Split_Squat'],
  'glute-bridge': ['Butt_Lift_Bridge'], 'cable-curl': ['Standing_Biceps_Cable_Curl'],
  'wrist-curl': ['Palms-Up_Barbell_Wrist_Curl_Over_A_Bench', 'Seated_Palm-Up_Barbell_Wrist_Curl'],
  'overhead-tricep-extension': ['Cable_Rope_Overhead_Triceps_Extension', 'Triceps_Overhead_Extension_with_Rope'],
  'skull-crusher': ['EZ-Bar_Skullcrusher', 'Lying_Triceps_Press'], dip: ['Dips_-_Triceps_Version'], 'chest-dip': ['Dips_-_Chest_Version'],
  'side-plank': ['Side_Bridge'], 'ab-wheel': ['Ab_Roller'], running: ['Running_Treadmill'], walking: ['Walking_Treadmill'],
  cycling: ['Bicycling', 'Bicycling_Stationary'], rowing: ['Rowing_Stationary'], 'stair-climber': ['Stairmaster', 'Step_Mill'],
  elliptical: ['Elliptical_Trainer'], 'jump-rope': ['Rope_Jumping'], 'battle-ropes': ['Battling_Ropes'],
  'decline-dumbbell-press': ['Decline_Dumbbell_Bench_Press'], 'machine-shoulder-press': ['Machine_Shoulder_Military_Press', 'Leverage_Shoulder_Press'],
  'plate-front-raise': ['Front_Plate_Raise'], 'single-arm-cable-row': ['Seated_One-arm_Cable_Pulley_Rows'],
  'back-extension': ['Hyperextensions_Back_Extensions'], 'goblet-squat': ['Goblet_Squat'], 'trap-bar-deadlift': ['Trap_Bar_Deadlift'],
  'nordic-hamstring-curl': ['Natural_Glute_Ham_Raise', 'Floor_Glute-Ham_Raise'], 'single-leg-romanian-deadlift': ['Kettlebell_One-Legged_Deadlift'],
  'reverse-lunge': ['Dumbbell_Rear_Lunge'], 'cable-kickback': ['One-Legged_Cable_Kickback'], 'hip-abduction-machine': ['Thigh_Abductor'],
  'hip-adduction-machine': ['Thigh_Adductor'], 'cable-standing-hip-adduction': ['Cable_Hip_Adduction'],
  'smith-machine-romanian-deadlift': ['Smith_Machine_Stiff-Legged_Deadlift'], 'dumbbell-romanian-deadlift': ['Stiff-Legged_Dumbbell_Deadlift'],
  'dumbbell-sumo-squat': ['Plie_Dumbbell_Squat'], 'donkey-calf-raise': ['Donkey_Calf_Raises'],
  'leg-press-calf-raise': ['Calf_Press_On_The_Leg_Press_Machine', 'Calf_Press'], 'jump-squat': ['Freehand_Jump_Squat'],
  'ez-bar-curl': ['EZ-Bar_Curl'], 'spider-curl': ['Spider_Curl'], 'rope-hammer-curl': ['Cable_Hammer_Curls_-_Rope_Attachment'],
  'rope-tricep-pushdown': ['Triceps_Pushdown_-_Rope_Attachment'], 'dumbbell-skull-crusher': ['Lying_Dumbbell_Tricep_Extension'],
  'dumbbell-overhead-tricep-extension': ['Standing_Dumbbell_Triceps_Extension'],
  'single-arm-dumbbell-tricep-extension': ['Standing_One-Arm_Dumbbell_Triceps_Extension'], 'farmer-carry': ['Farmers_Walk'],
  'bicycle-crunch': ['Air_Bike'], 'cable-woodchop': ['Standing_Cable_Wood_Chop'], 'captains-chair-knee-raise': ['Knee_Hip_Raise_On_Parallel_Bars'],
  'weighted-crunch': ['Weighted_Crunches'], 'wide-push-up': ['Push-Up_Wide'], 'diamond-push-up': ['Push-Ups_-_Close_Triceps_Position'],
  'explosive-push-up': ['Plyo_Push-up'], 'single-leg-box-squat': ['Single-Leg_High_Box_Squat'], 'banded-monster-walk': ['Monster_Walk'],
  'banded-squat': ['Squats_-_With_Bands'], 'heel-tap': ['Alternate_Heel_Touchers'], 'cat-cow-stretch': ['Cat_Stretch'],
  'kneeling-hip-flexor-stretch': ['Kneeling_Hip_Flexor'], 'wall-calf-stretch': ['Calf_Stretch_Hands_Against_Wall'],
};
// Same name, different pose (e.g. the free-exercise-db hamstring stretch is lying with a band).
const NO_AUTO = new Set(['hamstring-stretch']);

const feByKey = {};
for (const e of out) (feByKey[key(e.name, feEq(e))] ??= []).push(e);
const feById = Object.fromEntries(out.map((e) => [e.id, e]));

const MUSCLE = {
  Chest: 'chest', Shoulders: 'shoulders', 'Rear Delts': 'shoulders', Triceps: 'triceps', Biceps: 'biceps', Forearms: 'forearms', Grip: 'forearms',
  Lats: 'lats', Back: 'middle back', 'Upper Back': 'middle back', 'Lower Back': 'lower back', Core: 'abdominals', Quads: 'quadriceps',
  Legs: 'quadriceps', Hamstrings: 'hamstrings', 'Posterior Chain': 'hamstrings', Glutes: 'glutes', Hips: 'glutes', Calves: 'calves',
  Adductors: 'adductors', Groin: 'adductors',
};

let matched = 0;
const added = [];
for (const w of wg) {
  const eq = wgEq(w);
  const meq = eq === 'pull-up bar' ? 'body only' : eq; // free-exercise-db files bar work under body only / other
  const hits = ALIAS[w.slug]?.map((id) => feById[id] ?? console.warn(`alias ${w.slug} -> ${id} not found`)).filter(Boolean)
    ?? (NO_AUTO.has(w.slug) ? [] : feByKey[key(w.name, meq)] ?? (meq === 'body only' ? feByKey[key(w.name, 'other')] : undefined) ?? []);
  const free = hits.filter((e) => !e.art);
  for (const e of free) e.art = w.slug;
  matched += free.length;
  if (hits.length) continue;
  const muscles = [w.primaryMuscle, ...w.secondaryMuscles].map((m) => MUSCLE[m]).filter(Boolean);
  const primary = MUSCLE[w.primaryMuscle] ?? muscles[0] ?? 'abdominals';
  added.push({
    id: 'wg_' + w.slug, name: w.name, equipment: eq, primary: [primary],
    secondary: [...new Set(muscles)].filter((m) => m !== primary), level: 'beginner', force: null, mechanic: null,
    category: w.isStretch ? 'stretching' : w.equipment === 'Cardio' ? 'cardio' : 'strength',
    steps: w.instructions ?? [], art: w.slug, noPhoto: true,
  });
}
out.push(...added);
console.log(`workout-guide: ${matched} exercises matched, ${added.length} added`);

// No dataset covers pelvic floor work, so these are written here and shown with a breathing guide instead of frames.
const pelvic = (id, name, steps, timed) => ({
  id, name, equipment: 'body only', primary: ['pelvic floor'], secondary: [], level: 'beginner',
  force: 'static', mechanic: 'isolation', category: 'pelvic floor', steps, timed, noImages: true,
});
out.push(
  pelvic('Kegel_Long_Hold', 'Kegel Long Hold', [
    'Lie on your back with knees bent, or sit tall. Breathe normally.',
    'Gently squeeze and lift the muscles you would use to stop the flow of urine.',
    'Hold the lift for the count while keeping your belly, thighs and glutes relaxed.',
    'Release fully and rest for the same time before the next hold.',
  ], { hold: 5, rest: 5 }),
  pelvic('Kegel_Quick_Flick', 'Kegel Quick Flicks', [
    'Get comfortable lying down or seated.',
    'Squeeze and lift the pelvic floor quickly, then let go straight away.',
    'Keep a steady rhythm and keep breathing.',
  ], { hold: 1, rest: 1 }),
  pelvic('Kegel_Elevator', 'Kegel Elevator', [
    'Imagine the pelvic floor as a lift going up three floors.',
    'Squeeze a little (floor 1), a bit more (floor 2), then fully (floor 3), pausing at each.',
    'Come down one floor at a time, then relax completely at the bottom.',
  ], { hold: 6, rest: 6 }),
  pelvic('Reverse_Kegel', 'Reverse Kegel (Relax)', [
    'Breathe in deeply through your nose and let your belly expand.',
    'As you inhale, gently let the pelvic floor drop and lengthen, like a slow release.',
    'Exhale and let it return to rest without squeezing.',
  ], { hold: 4, rest: 4 }),
  pelvic('Diaphragmatic_Breathing', '360° Breathing', [
    'Place one hand on your chest and one on your belly.',
    'Inhale slowly so your belly and lower ribs expand while the chest stays still.',
    'Exhale slowly and feel the belly fall. Keep the shoulders soft.',
  ], { hold: 4, rest: 6 }),
);

writeFileSync(new URL('../src/data/exercises.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} exercises`);
