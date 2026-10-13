// Achievements, levels and the weekly challenge: small, frequent wins that keep people coming back.
// All computed from what is already logged, so nothing extra is stored.
import type { Ionicons } from '@expo/vector-icons';
import { bestStreak, dayKey, doneSets, prs, targets, volume } from '../calc';
import type { Meal, Profile, Session } from '../store';

type Icon = keyof typeof Ionicons.glyphMap;
export type Badge = { id: string; icon: Icon; title: string; how: string; got: boolean; have: number; need: number };
type St = { profile: Profile; sessions: Session[]; meals: Meal[]; water: Record<string, number> };
const DAY = 86400000;

export function badges(s: St): Badge[] {
  const n = s.sessions.length;
  const sets = s.sessions.reduce((a, x) => a + doneSets(x), 0);
  const kg = s.sessions.reduce((a, x) => a + volume(x), 0);
  const best = bestStreak(s.sessions);
  const t = targets(s.profile);
  const waterDays = Object.values(s.water).filter((g) => g >= t.water).length;
  const mealDays = new Set(s.meals.map((m) => m.day)).size;
  const records = s.sessions.reduce((a, x, i) => a + prs(x, s.sessions.slice(0, i)).length, 0);
  const early = s.sessions.some((x) => new Date(x.startedAt).getHours() < 7);
  const late = s.sessions.some((x) => new Date(x.startedAt).getHours() >= 21);
  const home = s.sessions.some((x) => x.place === 'home');
  // have/need drive the progress ring on the journey path; yes/no badges count 0 or 1 of 1.
  const b = (id: string, icon: Icon, title: string, how: string, have: number | boolean, need = 1): Badge =>
    ({ id, icon, title, how, have: Math.min(Number(have), need), need, got: Number(have) >= need });
  return [
    b('first', 'flag', 'First step', 'Finish your first workout', n, 1),
    b('five', 'ribbon', 'Getting going', 'Finish 5 workouts', n, 5),
    b('twenty', 'medal', 'Regular', 'Finish 20 workouts', n, 20),
    b('fifty', 'trophy', 'Committed', 'Finish 50 workouts', n, 50),
    b('streak3', 'flame', 'On a roll', 'A 3-session streak', best, 3),
    b('streak10', 'bonfire', 'Unstoppable', 'A 10-session streak', best, 10),
    b('sets100', 'layers', '100 sets', 'Log 100 sets in total', sets, 100),
    b('ton', 'barbell', 'Tonne lifted', 'Lift 1,000 kg in total', Math.round(kg), 1000),
    b('pr', 'trending-up', 'Personal best', 'Beat one of your own records', records, 1),
    b('pr10', 'rocket', 'Record breaker', 'Beat 10 personal records', records, 10),
    b('water7', 'water', 'Hydrated', 'Hit your water goal on 7 days', waterDays, 7),
    b('meals7', 'restaurant', 'Fuelled', 'Log food on 7 days', mealDays, 7),
    b('early', 'sunny', 'Early bird', 'Train before 7 am', early),
    b('late', 'moon', 'Night owl', 'Train after 9 pm', late),
    b('home', 'home', 'No excuses', 'Finish a workout at home', home),
  ];
}

// Levels from experience points: 10 per workout, 1 per set. Each level needs a little more than the last.
export function level(s: St) {
  const xp = s.sessions.length * 10 + s.sessions.reduce((a, x) => a + doneSets(x), 0);
  let lvl = 1, need = 50, floor = 0;
  while (xp >= floor + need) { floor += need; lvl++; need = Math.round(need * 1.25); }
  const names = ['Rookie', 'Starter', 'Regular', 'Consistent', 'Dedicated', 'Strong', 'Athlete', 'Beast', 'Legend'];
  return { lvl, name: names[Math.min(lvl - 1, names.length - 1)], xp, into: xp - floor, need };
}

// This week's challenge: the plan's workouts plus water and food habits, Monday to Sunday.
export function challenge(s: St, now = Date.now()) {
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => dayKey(monday.getTime() + i * DAY));
  const t = targets(s.profile);
  const workouts = s.sessions.filter((x) => x.startedAt >= monday.getTime()).length;
  const water = days.filter((d) => (s.water[d] ?? 0) >= t.water).length;
  const fed = days.filter((d) => s.meals.filter((m) => m.day === d).length >= 3).length;
  const goals = [
    { label: `${s.profile.daysPerWeek} workouts`, have: workouts, need: s.profile.daysPerWeek },
    { label: '5 days of water', have: water, need: 5 },
    { label: '5 days of 3 meals', have: fed, need: 5 },
  ];
  return { goals, done: goals.every((g) => g.have >= g.need) };
}
