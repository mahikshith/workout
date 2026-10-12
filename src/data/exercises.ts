import raw from './exercises.json';

export type Exercise = {
  id: string;
  name: string;
  equipment: string;
  primary: string[];
  secondary: string[];
  level: 'beginner' | 'intermediate' | 'expert';
  force: string | null;
  mechanic: string | null;
  category: string;
  steps: string[];
  timed?: { hold: number; rest: number };
  noImages?: boolean;
  art?: string; // workout-guide slug: line-art demo frames
  noPhoto?: boolean; // no free-exercise-db photos exist for this id
};

export const exercises = raw as Exercise[];
export const byId: Record<string, Exercise> = Object.fromEntries(exercises.map((e) => [e.id, e]));

const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
export const frames = (id: string) => [`${IMG}${id}/0.jpg`, `${IMG}${id}/1.jpg`];

// Pinned commit, same as scripts/build-exercises.mjs. White line art (CC BY-SA 4.0), drawn for dark backgrounds.
const WG = 'https://cdn.jsdelivr.net/gh/bryllim/workout-guide@aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/assets/';
export const artFrames = (slug: string) => [1, 2, 3].map((n) => `${WG}${slug}/frame-${n}.svg`);

export const HOME_GEAR = ['dumbbell', 'bands', 'kettlebells', 'pull-up bar', 'exercise ball', 'medicine ball', 'foam roll'] as const;

// The dataset files pull-ups and hangs under "body only", but they still need a bar.
const NEEDS_BAR = /pull-?up|chin-?up|hanging|inverted row|muscle.?up/i;

export type Place = 'gym' | 'home';

export function available(e: Exercise, place: Place, gear: string[]) {
  if (place === 'gym') return true;
  if (NEEDS_BAR.test(e.name)) return gear.includes('pull-up bar');
  return e.equipment === 'body only' || gear.includes(e.equipment);
}

const group = (e: Exercise) =>
  e.category === 'stretching' ? 'stretch' : e.category === 'cardio' ? 'cardio' : e.category === 'pelvic floor' ? 'pelvic' : 'strength';
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));

// Ranks swaps by shared muscle, movement and name; an exercise's best stand-ins come first.
export function alternatives(e: Exercise, place: Place = 'gym', gear: string[] = [], n = 3) {
  const w = words(e.name);
  return exercises
    .filter((x) => x.id !== e.id && x.primary[0] === e.primary[0] && group(x) === group(e) && available(x, place, gear))
    .map((x) => {
      let s = 0;
      if (x.force === e.force) s += 3;
      if (x.mechanic === e.mechanic) s += 2;
      if (x.level === e.level) s += 1;
      if (x.level === 'expert') s -= 2;
      s += x.secondary.filter((m) => e.secondary.includes(m)).length;
      for (const t of words(x.name)) if (w.has(t)) s += 1.5;
      return { x, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((a) => a.x);
}

export const MUSCLES = [
  'chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'middle back', 'lower back', 'traps',
  'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'neck', 'pelvic floor',
];

export const title = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
