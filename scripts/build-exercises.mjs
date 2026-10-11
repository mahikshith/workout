// Builds src/data/exercises.json from yuhonas/free-exercise-db (public domain) plus in-house pelvic-floor drills.
// Usage: node scripts/build-exercises.mjs [path/to/free-exercise-db/dist/exercises.json]
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
const raw = src
  ? JSON.parse(readFileSync(src, 'utf8'))
  : await (await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json')).json();

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
