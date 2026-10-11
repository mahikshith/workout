import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { alternatives, available, byId, type Place } from './data/exercises';
import type { Diet } from './data/foods';
import { planById, type Day } from './data/plans';
import { dayKey, lastSets, parseReps } from './calc';

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
  reminder: { hour: number; minute: number; on: boolean };
};

export type SetLog = { reps: number; weight: number; done: boolean };
export type Item = { exId: string; target: string; rest: number; sets: SetLog[]; swappedFrom?: string };
export type Session = { id: string; title: string; planId?: string; place: Place; startedAt: number; endedAt?: number; items: Item[] };
export type Meal = { id: string; day: string; name: string; kcal: number; protein: number };

type State = {
  profile: Profile | null;
  planId: string;
  nextDay: number; // rotation: the next session is the next day in the plan, however the week went
  sessions: Session[];
  active: Session | null;
  weights: { day: string; kg: number }[];
  meals: Meal[];
  water: Record<string, number>;
  setProfile: (p: Profile, planId?: string) => void;
  setPlan: (id: string) => void;
  start: (day: Day, place: Place, planId?: string) => void;
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
  addMeal: (m: Omit<Meal, 'id' | 'day'>) => void;
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

const initial = {
  profile: null, planId: 'full-body-gym', nextDay: 0, sessions: [], active: null, weights: [], meals: [], water: {},
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

      // Exercises the place can't support are swapped for the best available alternative up front.
      start: (day, place, planId) => {
        const { sessions, profile } = get();
        const gear = profile?.gear ?? [];
        const older = (profile?.age ?? 30) >= 55 || profile?.level === 'beginner';
        const items = day.slots.map((sl) => {
          let ex = byId[sl.id];
          let swappedFrom: string | undefined;
          if (!available(ex, place, gear)) {
            const alt = alternatives(ex, place, gear, 1)[0];
            if (alt) { swappedFrom = ex.id; ex = alt; }
          }
          const sets = older ? Math.max(2, sl.sets - 1) : sl.sets;
          return { exId: ex.id, target: sl.reps, rest: sl.rest, sets: seedSets(ex.id, sl.reps, sets, sessions), swappedFrom };
        });
        set({ active: { id: uid(), title: day.name, planId, place, startedAt: Date.now(), items } });
      },
      startSingle: (exId, place) =>
        set((s) => ({
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
        const advance = active.planId === planId && plan ? (nextDay + 1) % plan.days.length : nextDay;
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
      reset: () => set(initial),
    }),
    { name: 'gym-buddy', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);
