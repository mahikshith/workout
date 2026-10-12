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

// No dataset covers these (pelvic floor, eyes, desk breaks, breathing), so they are written here in plain words
// and shown with a breathing guide instead of frames. Where a dataset exercise already fits (child's pose,
// shoulder circles, incline push-up, calf raise, neck stretch), the plans use that one instead.
const own = (category, primary, secondary = [], force = 'static') => (id, name, steps, timed) => ({
  id, name, equipment: 'body only', primary, secondary, level: 'beginner',
  force, mechanic: 'isolation', category, steps, timed, noImages: true,
});
const pelvic = own('pelvic floor', ['pelvic floor']);
const eyes = own('eyes', ['eyes']);
out.push(
  pelvic('Kegel_Long_Hold', 'Kegel Long Hold', [
    'Lie on your back with your knees bent, or sit up tall.',
    'Squeeze the muscles you use to stop peeing, and lift them up a little.',
    'Hold the squeeze. Keep your belly, bottom and legs soft, and keep breathing.',
    'Let go all the way. Rest as long as you held.',
  ], { hold: 5, rest: 5 }),
  pelvic('Kegel_Quick_Flick', 'Kegel Quick Flicks', [
    'Lie down or sit in a comfy spot.',
    'Squeeze the muscles you use to stop peeing, quickly.',
    'Let go straight away. Squeeze, let go, like a quick blink.',
    'Keep a steady beat and keep breathing.',
  ], { hold: 1, rest: 1 }),
  pelvic('Kegel_Elevator', 'Kegel Elevator', [
    'Picture a lift going up three floors inside you.',
    'Squeeze a little and pause. Squeeze more and pause. Squeeze all the way.',
    'Now let go a bit at a time, one floor at a time.',
    'At the bottom, let everything go soft.',
  ], { hold: 6, rest: 6 }),
  pelvic('Reverse_Kegel', 'Reverse Kegel (Relax)', [
    'Lie or sit comfortably. Let your belly go soft.',
    'Breathe in slowly through your nose and let your belly fill up.',
    'As you breathe in, let the muscles down below relax and drop, like starting to pee.',
    'Breathe out and let them settle. Do not squeeze.',
  ], { hold: 4, rest: 4 }),
  pelvic('Diaphragmatic_Breathing', 'Slow Belly Breathing', [
    'Sit or lie down. Put one hand on your chest and one on your belly.',
    'Breathe in slowly through your nose. Your belly hand rises, your chest hand stays still.',
    'Breathe out slowly. Feel your belly sink. Let your shoulders stay soft.',
  ], { hold: 4, rest: 6 }),

  eyes('Eye_20_20_20', '20-20-20 Eye Break', [
    'Look away from your screen.',
    'Find something far away, about 20 feet (6 metres) or more.',
    'Look at it softly for 20 seconds. Blink as you need.',
    'Do this about every 20 minutes of screen time.',
  ], { hold: 20, rest: 5 }),
  eyes('Eye_Palming', 'Eye Palming', [
    'Sit back and rest your elbows on the desk.',
    'Rub your palms together until they feel warm.',
    'Close your eyes and cup your palms over them. Do not press.',
    'Breathe slowly and enjoy the dark.',
  ], { hold: 4, rest: 6 }),
  eyes('Eye_Near_Far_Focus', 'Near and Far Focus', [
    'Hold your thumb up at arm\'s length.',
    'Look at your thumb until it is sharp.',
    'Now look at something far away until it is sharp.',
    'Switch slowly between near and far.',
  ], { hold: 5, rest: 5 }),
  eyes('Eye_Slow_Blinks', 'Slow Blinks', [
    'Sit back and relax your face.',
    'Close your eyes gently, like falling asleep.',
    'Pause with your eyes closed, then open them slowly.',
    'Do not squeeze your eyes shut.',
  ], { hold: 2, rest: 2 }),
  eyes('Eye_Circles', 'Eye Circles', [
    'Sit tall and keep your head still.',
    'Look up, then slowly roll your eyes to the right, down, and left.',
    'Make a few slow circles, then go the other way.',
    'Blink and rest your eyes when done.',
  ]),

  own('desk', ['neck'])('Desk_Neck_Tilt', 'Seated Neck Tilts', [
    'Sit tall with your feet flat and shoulders relaxed.',
    'Slowly tip your right ear toward your right shoulder.',
    'Come back to the middle, then tip to the left.',
    'Then drop your chin to your chest and lift it back up.',
  ]),
  own('desk', ['neck'])('Desk_Chin_Tuck', 'Chin Tucks', [
    'Sit or stand tall and look straight ahead.',
    'Slide your chin straight back, making a double chin. Do not tip your head down.',
    'Hold for a moment. Feel the back of your neck lengthen.',
    'Let go and repeat.',
  ], { hold: 3, rest: 3 }),
  own('desk', ['middle back'], ['abdominals', 'lower back'])('Desk_Seated_Twist', 'Seated Spinal Twist', [
    'Sit tall near the front of your chair, feet flat on the floor.',
    'Put your left hand on your right knee and your right hand on the chair back.',
    'Breathe in and sit tall. Breathe out and gently turn to the right.',
    'Hold and breathe, then come back slowly and switch sides.',
  ]),
  own('desk', ['forearms'])('Desk_Wrist_Stretch', 'Wrist and Finger Stretch', [
    'Hold your right arm out in front, palm facing away.',
    'With your left hand, gently pull your right fingers back toward you. Hold.',
    'Turn your right palm down and gently press the back of the hand toward you. Hold.',
    'Make a fist, then spread your fingers wide a few times. Switch hands.',
  ]),
  own('desk', ['glutes'])('Desk_Figure_Four', 'Seated Figure Four Stretch', [
    'Sit tall near the front of your chair, feet flat.',
    'Cross your right ankle over your left knee, making a "4" shape.',
    'Keep your back straight and lean forward a little until you feel a stretch.',
    'Hold and breathe, then switch legs.',
  ]),
  own('desk', ['quadriceps'], ['abdominals'], 'push')('Desk_Seated_Leg_Raise', 'Seated Leg Raises', [
    'Sit tall in your chair, feet flat, hands holding the seat.',
    'Straighten your right leg until it is level with the seat.',
    'Hold for a moment, then lower it slowly.',
    'Switch legs each time, or do all reps on one side first.',
  ], { hold: 3, rest: 2 }),

  own('mobility', ['jaw'])('Jaw_Open_Release', 'Jaw Opening', [
    'Sit tall and let your shoulders drop.',
    'Rest the tip of your tongue on the roof of your mouth, behind your top teeth.',
    'Open your mouth slowly, only as far as is comfortable.',
    'Hold for a moment, then close slowly. Let your teeth stay apart.',
  ], { hold: 3, rest: 3 }),
  own('breathing', ['diaphragm'])('Breath_Box', 'Box Breathing', [
    'Sit tall and let your shoulders drop.',
    'Breathe in through your nose for a count of 4.',
    'Hold your breath for 4. Breathe out slowly for 4.',
    'Hold empty for 4, then start again.',
  ], { hold: 4, rest: 4 }),
  own('mobility', ['glutes'], ['lower back', 'abdominals'], null)('Gentle_Hip_Circles', 'Gentle Hip Circles', [
    'Stand with your feet a bit wider than your hips, knees soft.',
    'Put your hands on your hips.',
    'Slowly draw big circles with your hips, as if using a hula hoop.',
    'Go one way a few times, then the other way.',
  ]),
  own('mobility', ['quadriceps'], ['calves', 'glutes'], null)('March_In_Place', 'March in Place', [
    'Stand tall with your arms by your sides.',
    'Lift your right knee, then put the foot down. Then your left knee.',
    'Swing your arms as you march, like walking.',
    'Keep a steady pace you can talk at.',
  ]),
);

// Photos that show a different variation than the drawing and guide (Flutter_Kicks photos are face-down on a bench).
for (const id of ['Flutter_Kicks']) { const e = out.find((x) => x.id === id); if (e?.art) e.noPhoto = true; }

writeFileSync(new URL('../src/data/exercises.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} exercises`);
