// Builds src/data/videos.json: real exercise videos from wger.de (CC BY-SA 4.0) matched to our exercise ids.
// Precision over recall, because a wrong video is worse than none: a hand-checked table by wger exercise id first,
// then only exact matches of the normalised English name. The app plays small H.264 copies from the `media`
// release, made from `source` by .github/workflows/media.yml.
// Usage: node scripts/build-videos.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://wger.de/api/v2/';
const REL = 'https://github.com/mahikshith/workout/releases/download/media/';
const CC_BY_SA_4 = 2; // wger licence id

// wger exercise id -> our id, checked against wger's English name, description and equipment.
const PICK = {
  12: 'Thigh_Adductor', // Seated Hip Adduction (machine)
  46: 'Barbell_Lunge', // Barbell Lunges Standing
  73: 'Barbell_Bench_Press_-_Medium_Grip', // Bench Press
  75: 'Dumbbell_Bench_Press', // Benchpress Dumbbells
  82: 'Seated_Bent-Over_Rear_Delt_Raise', // Bent-over Lateral Raises: seated on a bench, bent forward
  91: 'Barbell_Curl', // Biceps Curls With Barbell
  92: 'Dumbbell_Bicep_Curl', // Biceps Curls With Dumbbell
  95: 'Standing_Biceps_Cable_Curl', // Biceps Curl With Cable
  194: 'Parallel_Bar_Dip', // Dips
  205: 'Dumbbell_Lunges', // Dumbbell Lunges Standing
  206: 'wg_walking-lunge', // Dumbbell Lunges Walking
  211: 'Standing_Dumbbell_Triceps_Extension', // Dumbbell Triceps Extension: one dumbbell overhead, both hands
  222: 'Face_Pull', // Facepull
  245: 'Lying_Dumbbell_Tricep_Extension', // Skullcrusher Dumbbells
  246: 'EZ-Bar_Skullcrusher', // Skullcrusher SZ-bar
  257: 'Front_Barbell_Squat', // Front Squats
  272: 'Hammer_Curls', // Hammer Curls
  275: 'Cable_Hammer_Curls_-_Rope_Attachment', // Hammercurls on Cable
  294: 'Barbell_Hip_Thrust', // Hip Thrust
  341: 'Smith_Machine_Squat', // Squats on Multipress
  348: 'Side_Lateral_Raise', // Lateral Raises (dumbbells)
  349: 'wg_cable-lateral-raise', // Lateral Rows on Cable, One Armed: a one-arm cable lateral raise
  365: 'Lying_Leg_Curls', // Leg Curls (laying)
  366: 'Seated_Leg_Curl', // Leg Curls (sitting)
  367: 'Standing_Leg_Curl', // Leg Curls (standing)
  371: 'Leg_Press', // Leg Press
  465: 'Preacher_Curl', // Preacher Curls (EZ bar)
  475: 'Pullups', // Pull-ups
  507: 'Romanian_Deadlift', // Romanian Deadlift (barbell)
  512: 'Seated_Cable_Rows', // Rowing seated, narrow grip
  537: 'Incline_Dumbbell_Press', // Incline Bench Press - Dumbbell
  538: 'Barbell_Incline_Bench_Press_-_Medium_Grip', // Incline Bench Press - Barbell
  543: 'Machine_Shoulder_Military_Press', // Shoulder Press, on Machine
  567: 'Dumbbell_Shoulder_Press', // Shoulder Press, Dumbbells
  584: 'One_Arm_Dumbbell_Preacher_Curl', // Single-arm Preacher Curl
  590: 'Seated_Calf_Raise', // Sitting Calf Raises
  622: 'Standing_Calf_Raises', // Standing Calf Raises
  655: 'Tricep_Dumbbell_Kickback', // Tricep Dumbbell Kickback
  659: 'Triceps_Pushdown', // Triceps Extensions on Cable: a bar pushdown
  802: 'Barbell_Walking_Lunge', // Barbell Lunges Walking
};
// Left out on purpose (no exact match here, or too unclear to check): 374 Leg Presses (wide), 375 Leg Press on
// Hackenschmidt Machine, 477 Pull Ups on Machine, 570 Shoulder Shrug, 575 Shrugs on Multipress, 803 One Arm Triceps
// Extensions on Cable.

const norm = (s) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').map((w) => w.replace(/s$/, '')).sort().join(' ');
const ours = JSON.parse(readFileSync(new URL('../src/data/exercises.json', import.meta.url), 'utf8'));
const ids = new Set(ours.map((e) => e.id));
const byName = new Map(ours.map((e) => [norm(e.name), e.id]));
const get = async (path) => {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`${r.status} ${API + path}`);
  return r.json();
};

const videos = (await get('video/?limit=1000')).results.filter((v) => v.license === CC_BY_SA_4);
// One clip per exercise: the smallest file at a usable height.
const odd = (v) => v.height < 480 || v.height > 1080;
const best = new Map();
for (const v of [...videos].sort((a, b) => odd(a) - odd(b) || a.size - b.size)) if (!best.has(v.exercise)) best.set(v.exercise, v);

const out = {};
for (const [wid, v] of [...best].sort((a, b) => a[0] - b[0])) {
  const info = await get(`exerciseinfo/${wid}/`);
  const name = info.translations.find((t) => t.language === 2)?.name ?? '';
  const id = PICK[wid] ?? byName.get(norm(name));
  if (!id) { console.log(`skip  ${wid} ${name}`); continue; }
  if (!ids.has(id)) throw new Error(`unknown exercise id ${id} for wger ${wid}`);
  if (out[id]) { console.log(`dupe  ${wid} ${name} -> ${id}, keeping the first`); continue; }
  out[id] = { url: `${REL}${id}.mp4`, source: v.video, author: v.license_author || 'wger.de', license: 'CC BY-SA 4.0' };
  console.log(`match ${wid} ${name} -> ${id}`);
}
const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync(new URL('../src/data/videos.json', import.meta.url), JSON.stringify(sorted, null, 2) + '\n');
console.log(`${Object.keys(out).length} videos written to src/data/videos.json`);
