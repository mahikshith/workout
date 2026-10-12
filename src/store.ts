import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { alternatives, available, byId, type Place } from './data/exercises';
import type { Diet } from './data/foods';
import { planById, type Day } from './data/plans';
import { dayKey, lastSets, parseReps } from './calc';
import { gate } from './engine';
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
  place: Place | 'both';
  gear: string[];
  daysPerWeek: number;
  diet: Diet;
  reminder: { hour: number; minute: number; on: boolean }; // setup's first reminder; the full list lives in State.reminders
  concerns?: Concern[]; // "What's going on for you right now?" (optional)
  women?: Women;
  gentle?: boolean; // no-numbers mode: hides calories, weight and BMI
  accent?: AccentId;
};

export type Concern = 'stressed' | 'breakup' | 'lose-weight' | 'tone' | 'food' | 'back' | 'knee' | 'desk' | 'thyroid';
// mode 'cycle': periodStart = first day of the last period. 'pregnant': date = due date. 'postpartum': date = birth date.
export type Women = { mode: 'none' | 'cycle' | 'pregnant' | 'postpartum'; periodStart?: string; cycleLength?: number; date?: string };
export type Mood = 1 | 2 | 3 | 4; // drained, meh, good, fired up
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
// days: 0 = Sunday ... 6 = Saturday; empty = every day.
export type Reminder = { id: string; kind: 'workout' | 'meal' | 'custom'; hour: number; minute: number; days: number[]; on: boolean; label?: string };
export type Interval = { on: boolean; every: number; from: number; to: number }; // every N minutes between hours from..to
export type NudgePrefs = { missed: boolean; streak: boolean; recap: boolean; quietFrom: number; quietTo: number };
export type MediaPref = 'drawing' | 'photo' | 'video';

export type SetLog = { reps: number; weight: number; done: boolean };
export type Item = { exId: string; target: string; rest: number; sets: SetLog[]; swappedFrom?: string };
export type Session = { id: string; title: string; planId?: string; dayIndex?: number; place: Place; startedAt: number; endedAt?: number; items: Item[] };
export type Meal = { id: string; day: string; name: string; kcal: number; protein: number; slot?: MealSlot };

type State = {
  profile: Profile; // name === '' means the user hasn't set up a profile yet; the app works anyway
  planId: string;
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
  nudges: NudgePrefs;
  supplements: { picked: string[]; taken: Record<string, string[]> }; // taken: dayKey -> names
  dismissed: Record<string, string>; // insight id -> dayKey it was dismissed
  mediaPref: MediaPref;
  checkIn: (m: Mood) => void;
  setReminders: (r: Reminder[]) => void;
  setHydration: (h: Interval) => void;
  setBreaks: (b: Interval) => void;
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
  finish: () => Session | null;
  discard: () => void;
  deleteSession: (id: string) => void;
  logWeight: (kg: number) => void;
  addMeal: (m: Omit<Meal, 'id' | 'day'>) => void; // pass slot to file it under a meal
  removeMeal: (id: string) => void;
  addWater: (n: number) => void;
  reset: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

function seedSets(exId: string, target: string, sets: number, history: Session[]): SetLog[] {
  const prev = lastSets(history, exId);
  return Array.from({ length: sets }, (_, k) => {
    const p = prev?.[Math.min(k, prev.length - 1)];
    return { reps: p?.reps ?? parseReps(target), weight: p?.weight ?? 0, done: false };
  });
}

// Guest defaults: the app is usable straight away and personalizes once the user fills these in.
export const GUEST: Profile = {
  name: '', gender: 'other', age: 30, heightCm: 170, weightKg: 70, goalWeightKg: 70, goal: 'stay fit', level: 'beginner',
  place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false },
};

const initial = {
  profile: GUEST, planId: 'full-body-gym', nextDay: 0, sessions: [] as Session[], active: null, weights: [], meals: [] as Meal[], water: {},
  checkins: {}, reminders: [] as Reminder[],
  hydration: { on: false, every: 90, from: 8, to: 21 }, breaks: { on: false, every: 60, from: 10, to: 18 },
  nudges: { missed: true, streak: true, recap: true, quietFrom: 22, quietTo: 7 },
  supplements: { picked: [] as string[], taken: {} as Record<string, string[]> }, dismissed: {}, mediaPref: 'drawing' as MediaPref,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      setProfile: (p, planId) =>
        set((s) => ({
          profile: p,
          planId: planId ?? s.planId,
          nextDay: planId && planId !== s.planId ? 0 : s.nextDay,
          weights: s.weights.length ? s.weights : [{ day: dayKey(), kg: p.weightKg }],
        })),
      setPlan: (id) => set({ planId: id, nextDay: 0 }),

      // Exercises the place can't support, or that are locked for this person (level or safety), are replaced
      // up front by the best alternative that is allowed.
      start: (day, place, planId, dayIndex) => {
        const { sessions, profile, active } = get();
        if (active) return; // an unfinished workout is resumed, never silently replaced
        const gear = profile?.gear ?? [];
        const older = (profile?.age ?? 30) >= 55 || profile?.level === 'beginner';
        const items = day.slots.map((sl) => {
          let ex = byId[sl.id];
          let swappedFrom: string | undefined;
          const ok = (e: typeof ex) => available(e, place, gear) && !gate(e, profile, sessions.length).locked;
          if (!ok(ex)) {
            const alt = alternatives(ex, place, gear, 12).find(ok);
            if (alt) { swappedFrom = ex.id; ex = alt; }
          }
          const sets = older ? Math.max(2, sl.sets - 1) : sl.sets;
          return { exId: ex.id, target: sl.reps, rest: sl.rest, sets: seedSets(ex.id, sl.reps, sets, sessions), swappedFrom };
        });
        set({ active: { id: uid(), title: day.name, planId, dayIndex, place, startedAt: Date.now(), items } });
      },
      startSingle: (exId, place) =>
        set((s) => s.active ? {} : ({
          active: { id: uid(), title: byId[exId].name, place, startedAt: Date.now(), items: [{ exId, target: '10', rest: 90, sets: seedSets(exId, '10', 3, s.sessions) }] },
        })),
      updateSet: (i, j, patch) =>
        set((s) => {
          if (!s.active) return {};
          const items = s.active.items.map((it, a) => (a !== i ? it : { ...it, sets: it.sets.map((x, b) => (b === j ? { ...x, ...patch } : x)) }));
          return { active: { ...s.active, items } };
        }),
      addSet: (i) =>
        set((s) => {
          if (!s.active) return {};
          const items = s.active.items.map((it, a) => {
            if (a !== i) return it;
            const last = it.sets[it.sets.length - 1] ?? { reps: parseReps(it.target), weight: 0 };
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
          const items = s.active.items.map((it, a) =>
            a !== i ? it : { ...it, exId, swappedFrom: it.swappedFrom ?? it.exId, sets: seedSets(exId, it.target, it.sets.length, s.sessions) });
          return { active: { ...s.active, items } };
        }),
      addItem: (exId) =>
        set((s) => s.active ? { active: { ...s.active, items: [...s.active.items, { exId, target: '10', rest: 90, sets: seedSets(exId, '10', 3, s.sessions) }] } } : {}),
      finish: () => {
        const { active, sessions, planId, nextDay } = get();
        if (!active) return null;
        const items = active.items.map((it) => ({ ...it, sets: it.sets.filter((x) => x.done) })).filter((it) => it.sets.length);
        if (!items.length) { set({ active: null }); return null; }
        const done = { ...active, items, endedAt: Date.now() };
        const plan = planById[planId];
        const advance = active.planId === planId && plan ? ((active.dayIndex ?? nextDay) + 1) % plan.days.length : nextDay;
        set({ sessions: [...sessions, done], active: null, nextDay: advance });
        return done;
      },
      discard: () => set({ active: null }),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
      logWeight: (kg) =>
        set((s) => ({ weights: [...s.weights.filter((w) => w.day !== dayKey()), { day: dayKey(), kg }], profile: s.profile && { ...s.profile, weightKg: kg } })),
      addMeal: (m) => set((s) => ({ meals: [...s.meals, { ...m, id: uid(), day: dayKey() }] })),
      removeMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
      addWater: (n) => set((s) => ({ water: { ...s.water, [dayKey()]: Math.max(0, (s.water[dayKey()] ?? 0) + n) } })),
      checkIn: (m) => set((s) => ({ checkins: { ...s.checkins, [dayKey()]: m } })),
      setReminders: (reminders) => set({ reminders }),
      setHydration: (hydration) => set({ hydration }),
      setBreaks: (breaks) => set({ breaks }),
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
      name: 'gym-buddy', version: 3, storage: createJSONStorage(() => AsyncStorage),
      // Older saves lack the newer fields: fill them from `initial`, and turn the single setup reminder into the list.
      migrate: (old) => {
        const o = old as Partial<State> & { profile?: Profile | null };
        const profile = o.profile ?? GUEST;
        const reminders = o.reminders ?? (profile.reminder?.on ? [{ id: 'setup', kind: 'workout' as const, ...profile.reminder, days: [] }] : []);
        return { ...initial, ...o, profile, reminders } as State;
      },
    },
  ),
);
