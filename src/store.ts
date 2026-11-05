import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { alternatives, available, byId, type Place } from './data/exercises';
import type { Diet } from './data/foods';
import { perWeek, planById, type Day } from './data/plans';
import { phasedDay, planWeek } from './data/program';
import { dayKey, lastSets, parseReps } from './calc';
import { gate } from './engine';
import { dose } from './data/muscles';
import { order } from './data/order';
import type { AccentId } from './theme';

export type Goal = 'lose fat' | 'build muscle' | 'get stronger' | 'stay fit';
export type Profile = {
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  goal: Goal;
  level: 'beginner' | 'intermediate' | 'advanced';
  place: Place | 'both' | 'office'; // 'office': short sessions at work, bodyweight only
  gear: string[];
  daysPerWeek: number;
  diet: Diet;
  reminder: { hour: number; minute: number; on: boolean }; // setup's first reminder; the full list lives in State.reminders
  concerns?: Concern[]; // "What's going on for you right now?" (optional)
  lifestyle?: Lifestyle; // what a normal day looks like: shapes quick sessions and break nudges
  women?: Women;
  gentle?: boolean; // no-numbers mode: hides calories, weight and BMI
  accent?: AccentId;
  body?: Body; // "How would you describe your body right now?" (optional; unset = prefer not to say)
};
export type Body = 'lean' | 'soft' | 'average' | 'extra' | 'more' | 'muscular';

export type Lifestyle = 'desk' | 'wfh' | 'standing' | 'active' | 'home' | 'parent' | 'driving' | 'travel' | 'shift' | 'student' | 'retired';
export type Concern = 'stressed' | 'anger' | 'calm' | 'anxious' | 'sleep' | 'confidence' | 'breakup' | 'lose-weight' | 'gain' | 'tone' | 'endurance' | 'run'
  | 'posture' | 'flexibility' | 'injury' | 'food' | 'back' | 'knee' | 'desk' | 'thyroid';
// mode 'cycle': periodStart = first day of the last period. 'pregnant': date = due date. 'postpartum': date = birth date.
export type Women = { mode: 'none' | 'cycle' | 'pregnant' | 'postpartum'; periodStart?: string; cycleLength?: number; date?: string };
export type Mood = 1 | 2 | 3 | 4; // drained, meh, good, fired up
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
// days: 0 = Sunday ... 6 = Saturday; empty = every day.
export type Reminder = { id: string; kind: 'workout' | 'meal' | 'custom'; hour: number; minute: number; days: number[]; on: boolean; label?: string };
export type Interval = { on: boolean; every: number; from: number; to: number }; // every N minutes between hours from..to
export type NudgePrefs = { missed: boolean; streak: boolean; recap: boolean; quietFrom: number; quietTo: number };
export type MediaPref = 'animated' | 'drawing' | 'photo' | 'video';

export type SetLog = { reps: number; weight: number; done: boolean };
export type Item = { exId: string; target: string; rest: number; sets: SetLog[]; swappedFrom?: string };
// A workout opens ready (running false) so it can be looked through; begin() starts the clock. pausedAt is set while paused; pausedMs adds up finished
// pauses. idx is the exercise on screen, and restUntil/restTotal the rest timer, kept here (not in the screen) so the
// mini bar can show them while the workout is minimised. restFrom is the exercise whose set started the rest (the screen
// moves on from it when the rest ends), lastAt when the last set was logged (a workout left open for hours saves itself).
export type Session = { id: string; title: string; planId?: string; dayIndex?: number; place: Place; startedAt: number; endedAt?: number; items: Item[];
  running?: boolean; pausedAt?: number; pausedMs?: number; idx?: number; restUntil?: number; restTotal?: number; restFrom?: number; lastAt?: number;
  source?: 'strong' | 'hevy' | 'fitnotes' | 'gymbuddy' }; // set on sessions imported from another app's CSV
// A day the person excused from training (one tap on Today): the missed-workout nudge skips it and doesn't count it.
export type Excuse = 'sick' | 'travel' | 'rest';
export type Meal = { id: string; day: string; name: string; kcal: number; protein: number; slot?: MealSlot };

type State = {
  profile: Profile; // name === '' means the user hasn't set up a profile yet; the app works anyway
  planId: string;
  planStart?: number; // when the current plan was picked: its week (Learn, Build, Push, Deload) counts from here
  nextDay: number; // rotation: the next session is the next day in the plan, however the week went
  sessions: Session[];
  active: Session | null;
  weights: { day: string; kg: number }[];
  meals: Meal[];
  water: Record<string, number>;
  checkins: Record<string, Mood>; // dayKey -> mood
  reminders: Reminder[];
  hydration: Interval;
  breaks: Interval; // desk and eye breaks
  motivation: Interval; // motivation and tip nudges through the day
  nudges: NudgePrefs;
  supplements: { picked: string[]; taken: Record<string, string[]> }; // taken: dayKey -> names
  dismissed: Record<string, string>; // insight id -> dayKey it was dismissed
  mediaPref: MediaPref;
  periods: { start: string; end?: string }[]; // logged periods, newest last
  excuses: Record<string, Excuse>; // dayKey -> why; only the last 60 days are kept. Missed days are counted from sessions.
  excuse: (why: Excuse | null) => void; // excuses today, or clears today's excuse
  importSessions: (list: Session[]) => { added: number; skipped: number }; // skips days that already have a workout
  logPeriod: (what: 'start' | 'end') => void;
  setupSkipped: boolean; // true after Skip on first-launch setup: Today keeps a Personalize card
  skipSetup: (v: boolean) => void;
  checkIn: (m: Mood) => void;
  setReminders: (r: Reminder[]) => void;
  setHydration: (h: Interval) => void;
  setBreaks: (b: Interval) => void;
  setMotivation: (m: Interval) => void;
  setNudges: (n: NudgePrefs) => void;
  pickSupplement: (name: string, on: boolean) => void;
  takeSupplement: (name: string) => void;
  dismiss: (insightId: string) => void;
  setMediaPref: (m: MediaPref) => void;
  setProfile: (p: Profile, planId?: string) => void;
  setPlan: (id: string) => void;
  start: (day: Day, place: Place, planId?: string, dayIndex?: number) => void;
  startSingle: (exId: string, place: Place) => void;
  updateSet: (i: number, j: number, patch: Partial<SetLog>) => void;
  addSet: (i: number) => void;
  removeSet: (i: number, j: number) => void;
  swap: (i: number, exId: string) => void;
  addItem: (exId: string) => void;
  moveItem: (i: number, by: -1 | 1) => void;
  removeItem: (i: number) => void;
  setSetCount: (i: number, n: number) => void;
  replace: (day: Day, place: Place, planId?: string, dayIndex?: number) => void; // Change workout: logged sets stay
  begin: () => void;
  setIdx: (i: number) => void;
  setRest: (until: number | null, total?: number, from?: number) => void;
  pause: () => void;
  resume: () => void;
  finish: (at?: number) => Session | null; // at: when it ended (a workout left open ends at its last logged set)
  closeStale: (now?: number) => Session | 'dropped' | null; // saves (or drops) a started workout untouched for 3 hours
  discard: () => void;
  deleteSession: (id: string) => void;
  logWeight: (kg: number) => void;
  addMeal: (m: Omit<Meal, 'id' | 'day'>) => void; // pass slot to file it under a meal
  removeMeal: (id: string) => void;
  addWater: (n: number) => void;
  reset: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

function single(exId: string, history: Session[], profile?: Profile) {
  const d = dose(byId[exId]);
  return { exId, target: d.reps, rest: d.rest, sets: seedSets(exId, d.reps, d.sets, history, profile) };
}

// A first-time starting weight, so the first workout logs real kilos. Bodyweight moves, holds and drills start at 0
// (they count reps); loaded moves get a light, safe weight from the equipment, the person's level and body weight.
// Dumbbell and kettlebell weights are per hand. Last time's weight always wins once there is history.
const NO_LOAD = ['pelvic floor', 'stretching', 'mobility', 'eyes', 'desk', 'breathing', 'cardio', 'plyometrics'];
const BASE: Record<string, number> = {
  barbell: 20, 'e-z curl bar': 10, dumbbell: 6, kettlebells: 8, machine: 20, cable: 10, 'medicine ball': 4,
};
export function starterKg(exId: string, p?: Profile): number {
  const e = byId[exId];
  if (!e || NO_LOAD.includes(e.category) || !(e.equipment in BASE)) return 0;
  let kg = BASE[e.equipment];
  if (e.equipment !== 'barbell' || !/bench|squat|deadlift|row|press/i.test(e.name)) {
    const lvl = p?.level === 'advanced' ? 1.8 : p?.level === 'intermediate' ? 1.4 : 1;
    const body = Math.min(1.3, Math.max(0.7, (p?.weightKg ?? 70) / 75));
    const big = /squat|deadlift|leg press|hip thrust/i.test(e.name) ? 1.5 : /raise|fly|flye|curl|kickback|extension/i.test(e.name) ? 0.6 : 1;
    kg = kg * lvl * body * big;
  } else if (p && p.level !== 'beginner') kg = /deadlift/i.test(e.name) ? 60 : /squat/i.test(e.name) ? 50 : 40; // the empty bar for beginners
  const step = e.equipment === 'dumbbell' || e.equipment === 'kettlebells' || e.equipment === 'medicine ball' ? 2 : 2.5;
  return Math.max(step, Math.round(kg / step) * step);
}

function seedSets(exId: string, target: string, sets: number, history: Session[], profile?: Profile): SetLog[] {
  const prev = lastSets(history, exId);
  const kg = starterKg(exId, profile);
  return Array.from({ length: sets }, (_, k) => {
    const p = prev?.[Math.min(k, prev.length - 1)];
    return { reps: p?.reps ?? parseReps(target), weight: p?.weight ?? kg, done: false };
  });
}

// A day's exercises, ready to log. Exercises the place can't support, or that are locked for this person (level or
// safety), are replaced up front by the best alternative that is allowed. A plan day passed as written (not already set
// for this week) gets this week's sets and reps, the same numbers the plan page shows.
function itemsFor(st: Pick<State, 'sessions' | 'profile' | 'planStart' | 'planId'>, day: Day, place: Place, planId?: string, dayIndex?: number): Item[] {
  const { sessions, profile, planStart } = st;
  const gear = profile?.gear ?? [];
  const plan = planId ? planById[planId] : undefined;
  if (plan && dayIndex !== undefined && plan.days[dayIndex] === day)
    day = phasedDay(plan, dayIndex, planWeek(plan, planId === st.planId ? planStart : undefined, sessions));
  return order(day.slots).map((sl) => {
    let ex = byId[sl.id];
    let swappedFrom: string | undefined;
    const ok = (e: typeof ex) => available(e, place, gear) && !gate(e, profile, sessions.length).locked;
    if (!ok(ex)) {
      const alt = alternatives(ex, place, gear, 12).find(ok);
      if (alt) { swappedFrom = ex.id; ex = alt; }
    }
    return { exId: ex.id, target: sl.reps, rest: sl.rest, sets: seedSets(ex.id, sl.reps, sl.sets, sessions, profile), swappedFrom };
  });
}
const STALE_MS = 3 * 3600000;

// The weekly goal is the number of days the person chose. Setup and the planner always pick a plan with exactly that
// many days (src/planner.ts), so nothing changes then. Only a plan picked by hand with a different number of days moves
// the goal to that plan's days, so Today's ring and the plan agree. One-muscle add-on plans keep the person's own number.
const daysFor = (p: Profile, planId: string) => {
  const plan = planById[planId];
  if (!plan || plan.category === 'One muscle' || perWeek(plan) === p.daysPerWeek) return p;
  return { ...p, daysPerWeek: perWeek(plan) };
};

// Guest defaults: the app is usable straight away and personalizes once the user fills these in.
export const GUEST: Profile = {
  name: '', gender: 'other', age: 30, heightCm: 170, weightKg: 70, goalWeightKg: 70, goal: 'stay fit', level: 'beginner',
  place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false },
};

const initial = {
  profile: GUEST, planId: 'full-body-gym', nextDay: 0, sessions: [] as Session[], active: null, weights: [], meals: [] as Meal[], water: {},
  checkins: {}, reminders: [] as Reminder[],
  hydration: { on: false, every: 90, from: 8, to: 21 }, breaks: { on: false, every: 60, from: 10, to: 18 },
  motivation: { on: true, every: 180, from: 9, to: 21 },
  nudges: { missed: true, streak: true, recap: true, quietFrom: 22, quietTo: 7 },
  supplements: { picked: [] as string[], taken: {} as Record<string, string[]> }, dismissed: {}, mediaPref: 'animated' as MediaPref, setupSkipped: false, periods: [] as { start: string; end?: string }[],
  excuses: {} as Record<string, Excuse>,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      setProfile: (p, planId) =>
        set((s) => {
          const fresh = !!planId && (planId !== s.planId || !s.planStart);
          return {
            profile: p, // the days chosen in setup or Profile stay the weekly goal, whatever plan comes with them
            planId: planId ?? s.planId,
            planStart: fresh ? Date.now() : s.planStart,
            nextDay: planId && planId !== s.planId ? 0 : s.nextDay,
            weights: s.weights.length ? s.weights : [{ day: dayKey(), kg: p.weightKg }],
          };
        }),
      setPlan: (id) => set((s) => ({ planId: id, nextDay: 0, planStart: Date.now(), profile: daysFor(s.profile, id) })),

      // Exercises the place can't support, or that are locked for this person (level or safety), are replaced
      // up front by the best alternative that is allowed.
      start: (day, place, planId, dayIndex) => {
        if (get().active) return; // an unfinished workout is resumed, never silently replaced
        const items = itemsFor(get(), day, place, planId, dayIndex);
        // Opens ready (clock not running) so the person can look through the exercises first; begin() starts the clock.
        set({ active: { id: uid(), title: day.name, planId, dayIndex, place, startedAt: Date.now(), items, running: false, idx: 0 } });
      },
      // Change workout: another day, a quick session or a different focus. A started workout keeps what was logged
      // (only the logged sets of those exercises) and the new exercises follow; the clock keeps running.
      replace: (day, place, planId, dayIndex) => {
        const a = get().active;
        if (!a) { get().start(day, place, planId, dayIndex); return; }
        const kept = a.running === false ? [] : a.items.map((it) => ({ ...it, sets: it.sets.filter((x) => x.done) })).filter((it) => it.sets.length);
        const items = [...kept, ...itemsFor(get(), day, place, planId, dayIndex)];
        set({ active: { ...a, title: day.name, planId, dayIndex, place, items, idx: Math.min(kept.length, items.length - 1), restUntil: undefined, restFrom: undefined } });
      },
      startSingle: (exId, place) =>
        set((s) => s.active ? {} : ({
          // A single exercise gets its own dose: minutes for cardio, seconds for holds, reps otherwise.
          active: { id: uid(), title: byId[exId].name, place, startedAt: Date.now(), running: false, idx: 0, items: [single(exId, s.sessions, s.profile)] },
        })),
      updateSet: (i, j, patch) =>
        set((s) => {
          if (!s.active) return {};
          const items = s.active.items.map((it, a) => (a !== i ? it : { ...it, sets: it.sets.map((x, b) => (b === j ? { ...x, ...patch } : x)) }));
          return { active: { ...s.active, items, lastAt: patch.done ? Date.now() : s.active.lastAt } };
        }),
      addSet: (i) =>
        set((s) => {
          if (!s.active) return {};
          const items = s.active.items.map((it, a) => {
            if (a !== i) return it;
            const last = it.sets[it.sets.length - 1] ?? { reps: parseReps(it.target), weight: starterKg(it.exId, s.profile) };
            return { ...it, sets: [...it.sets, { reps: last.reps, weight: last.weight, done: false }] };
          });
          return { active: { ...s.active, items } };
        }),
      removeSet: (i, j) =>
        set((s) => {
          if (!s.active) return {};
          const items = s.active.items.map((it, a) => (a !== i ? it : { ...it, sets: it.sets.filter((_, b) => b !== j) }));
          return { active: { ...s.active, items } };
        }),
      swap: (i, exId) =>
        set((s) => {
          if (!s.active) return {};
          const it = s.active.items[i];
          if (!it) return {};
          // Sets already logged stay with the exercise they were done on; the swap takes the sets that are left.
          const logged = it.sets.filter((x) => x.done);
          const fresh = { ...it, exId, swappedFrom: it.swappedFrom ?? it.exId, sets: seedSets(exId, it.target, Math.max(1, it.sets.length - logged.length), s.sessions, s.profile) };
          const items = [...s.active.items.slice(0, i), ...(logged.length ? [{ ...it, sets: logged }] : []), fresh, ...s.active.items.slice(i + 1)];
          const idx = logged.length && (s.active.idx ?? 0) >= i ? (s.active.idx ?? 0) + 1 : s.active.idx;
          return { active: { ...s.active, items, idx } };
        }),
      addItem: (exId) =>
        set((s) => s.active ? { active: { ...s.active, items: [...s.active.items, single(exId, s.sessions, s.profile)] } } : {}),
      // Edit workout. The exercise on screen stays on screen when others move or go.
      moveItem: (i, by) =>
        set((s) => {
          const a = s.active, j = i + by;
          if (!a || j < 0 || j >= a.items.length) return {};
          const items = [...a.items];
          [items[i], items[j]] = [items[j], items[i]];
          const at = (k?: number) => (k === i ? j : k === j ? i : k);
          return { active: { ...a, items, idx: at(a.idx ?? 0), restFrom: at(a.restFrom) } };
        }),
      removeItem: (i) =>
        set((s) => {
          const a = s.active;
          if (!a || a.items.length < 2 || !a.items[i]) return {};
          const items = a.items.filter((_, k) => k !== i);
          const shift = (k?: number) => (k === undefined || k < i ? k : k === i ? undefined : k - 1);
          const idx = Math.min(items.length - 1, (a.idx ?? 0) > i ? (a.idx ?? 0) - 1 : a.idx ?? 0);
          return { active: { ...a, items, idx, restFrom: shift(a.restFrom) } };
        }),
      // Never below the sets already logged; extra sets copy the last one, and unlogged sets go from the end.
      setSetCount: (i, n) =>
        set((s) => {
          const a = s.active, it = a?.items[i];
          if (!a || !it) return {};
          const want = Math.max(1, it.sets.filter((x) => x.done).length, Math.min(12, n));
          let sets = it.sets;
          while (sets.length < want) {
            const last = sets[sets.length - 1] ?? { reps: parseReps(it.target), weight: starterKg(it.exId, s.profile) };
            sets = [...sets, { reps: last.reps, weight: last.weight, done: false }];
          }
          while (sets.length > want) {
            const k = sets.map((x) => x.done).lastIndexOf(false);
            if (k < 0) break;
            sets = sets.filter((_, b) => b !== k);
          }
          return { active: { ...a, items: a.items.map((x, k) => (k === i ? { ...x, sets } : x)) } };
        }),
      begin: () => set((s) => (s.active && !s.active.running ? { active: { ...s.active, running: true, startedAt: Date.now(), pausedAt: undefined, pausedMs: 0 } } : {})),
      setIdx: (i) => set((s) => (s.active ? { active: { ...s.active, idx: Math.max(0, Math.min(i, s.active.items.length - 1)) } } : {})),
      setRest: (until, total, from) =>
        set((s) => (s.active ? { active: { ...s.active, restUntil: until ?? undefined, restTotal: total ?? s.active.restTotal, restFrom: until ? from ?? s.active.restFrom : undefined } } : {})),
      pause: () => set((s) => (s.active?.running && !s.active.pausedAt ? { active: { ...s.active, pausedAt: Date.now() } } : {})),
      resume: () =>
        set((s) => (s.active?.pausedAt ? { active: { ...s.active, pausedMs: (s.active.pausedMs ?? 0) + Date.now() - s.active.pausedAt, pausedAt: undefined } } : {})),
      finish: (at) => {
        const { active, sessions, planId, nextDay } = get();
        if (!active) return null;
        const items = active.items.map((it) => ({ ...it, sets: it.sets.filter((x) => x.done) })).filter((it) => it.sets.length);
        if (!items.length) { set({ active: null }); return null; }
        const start = active.startedAt + (active.pausedMs ?? 0);
        const end = Math.max(start + 60000, Math.min(at ?? Infinity, active.pausedAt ?? Date.now()));
        const done = { ...active, items, endedAt: end, startedAt: start, pausedAt: undefined, pausedMs: 0, running: false, idx: undefined,
          restUntil: undefined, restTotal: undefined, restFrom: undefined, lastAt: undefined };
        const plan = planById[planId];
        const advance = active.planId === planId && plan ? ((active.dayIndex ?? nextDay) + 1) % plan.days.length : nextDay;
        set({ sessions: [...sessions, done], active: null, nextDay: advance });
        return done;
      },
      // A started workout nobody has touched for 3 hours (no set logged since) was left open: it saves with the sets that
      // were logged, ending a minute after the last one, or goes if nothing was logged.
      closeStale: (now = Date.now()) => {
        const a = get().active;
        if (!a || a.running === false || now - (a.lastAt ?? a.startedAt) < STALE_MS) return null;
        if (!a.items.some((it) => it.sets.some((x) => x.done))) { set({ active: null }); return 'dropped'; }
        return get().finish((a.lastAt ?? a.startedAt) + 60000);
      },
      discard: () => set({ active: null }),
      // Imported history goes in date order; a day that already has a workout (ours or an earlier import) is skipped,
      // so importing the same file twice adds nothing. The plan rotation and the running workout are left alone.
      importSessions: (list) => {
        const { sessions } = get();
        const taken = new Set(sessions.map((x) => dayKey(x.startedAt)));
        const ids = new Set(sessions.map((x) => x.id));
        const fresh = list.filter((x) => !taken.has(dayKey(x.startedAt)) && !ids.has(x.id) && x.items.length);
        if (fresh.length) set({ sessions: [...sessions, ...fresh].sort((a, b) => a.startedAt - b.startedAt) });
        return { added: fresh.length, skipped: list.length - fresh.length };
      },
      excuse: (why) =>
        set((s) => {
          const today = dayKey(), cut = dayKey(Date.now() - 60 * 86400000);
          const excuses = Object.fromEntries(Object.entries(s.excuses).filter(([d]) => d >= cut && d !== today));
          return { excuses: why ? { ...excuses, [today]: why } : excuses };
        }),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
      logWeight: (kg) =>
        set((s) => ({ weights: [...s.weights.filter((w) => w.day !== dayKey()), { day: dayKey(), kg }], profile: s.profile && { ...s.profile, weightKg: kg } })),
      addMeal: (m) => set((s) => ({ meals: [...s.meals, { ...m, id: uid(), day: dayKey() }] })),
      removeMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
      addWater: (n) => set((s) => ({ water: { ...s.water, [dayKey()]: Math.max(0, (s.water[dayKey()] ?? 0) + n) } })),
      skipSetup: (setupSkipped) => set({ setupSkipped }),
      // A logged period start also becomes the profile's cycle anchor; the usual length is learned from past starts.
      logPeriod: (what) =>
        set((s) => {
          const today = dayKey();
          let periods = s.periods;
          if (what === 'start') periods = [...periods.filter((x) => x.start !== today), { start: today }];
          else if (periods.length) periods = [...periods.slice(0, -1), { ...periods[periods.length - 1], end: today }];
          const starts = periods.map((x) => Date.parse(x.start));
          const gaps = starts.slice(1).map((t, i) => Math.round((t - starts[i]) / 86400000)).filter((g) => g >= 21 && g <= 40);
          const cycleLength = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : s.profile.women?.cycleLength ?? 28;
          const women = { mode: 'cycle' as const, ...s.profile.women, periodStart: periods[periods.length - 1]?.start, cycleLength };
          return { periods, profile: { ...s.profile, women } };
        }),
      checkIn: (m) => set((s) => ({ checkins: { ...s.checkins, [dayKey()]: m } })),
      setReminders: (reminders) => set({ reminders }),
      setHydration: (hydration) => set({ hydration }),
      setBreaks: (breaks) => set({ breaks }),
      setMotivation: (motivation) => set({ motivation }),
      setNudges: (nudges) => set({ nudges }),
      pickSupplement: (name, on) =>
        set((s) => ({ supplements: { ...s.supplements, picked: on ? [...new Set([...s.supplements.picked, name])] : s.supplements.picked.filter((x) => x !== name) } })),
      takeSupplement: (name) =>
        set((s) => {
          const today = s.supplements.taken[dayKey()] ?? [];
          const next = today.includes(name) ? today.filter((x) => x !== name) : [...today, name];
          return { supplements: { ...s.supplements, taken: { ...s.supplements.taken, [dayKey()]: next } } };
        }),
      dismiss: (id) => set((s) => ({ dismissed: { ...s.dismissed, [id]: dayKey() } })),
      setMediaPref: (mediaPref) => set({ mediaPref }),
      reset: () => set(initial),
    }),
    {
      name: 'gym-buddy', version: 5, storage: createJSONStorage(() => AsyncStorage),
      // Older saves lack the newer fields: fill them from `initial`, and turn the single setup reminder into the list.
      migrate: (old) => {
        const o = old as Partial<State> & { profile?: Profile | null };
        const profile = o.profile ?? GUEST;
        const reminders = o.reminders ?? (profile.reminder?.on ? [{ id: 'setup', kind: 'workout' as const, ...profile.reminder, days: [] }] : []);
        // v4: the smooth animated figure becomes the default demo (the old 'drawing' value was only ever the default).
        const mediaPref = !o.mediaPref || o.mediaPref === 'drawing' ? 'animated' : o.mediaPref;
        // The weekly goal stays the days the person chose; plans are fitted to it (no longer lowered to the plan's days).
        return { ...initial, ...o, profile, reminders, mediaPref } as State;
      },
    },
  ),
);
