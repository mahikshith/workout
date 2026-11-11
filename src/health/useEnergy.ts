// Energy for our logged workouts, with the stores wired in (src/health/energy.ts holds the maths). The watch's numbers
// for a workout live in the tracker store: calories over its time window (sessionKcal), heart rate (sessionHr), when
// each set was ticked (setTimes), and the watch's own copy of the workout when there is one (merged).
import { useMemo } from 'react';
import { dayKey } from '../calc';
import { byId } from '../data/exercises';
import { useStore, type Profile, type Session } from '../store';
import { mergedFor, useTracker, type DailyMetrics, type ImportedWorkout, type SessionHr, type SessionKcal } from '../tracker';
import { dayBurn, sessionEnergy, type DayBurn, type SessionEnergy } from './energy';

export type EnergyData = {
  sessionKcal?: Record<string, SessionKcal>; sessionHr: Record<string, SessionHr>; setTimes: Record<string, number[][]>; merged: Record<string, ImportedWorkout>;
};

export function energyFor(s: Session, t: EnergyData, p: Profile): SessionEnergy {
  const k = t.sessionKcal?.[s.id], hr = t.sessionHr[s.id], w = mergedFor(t.merged, s.id);
  return sessionEnergy(s, { weightKg: p.weightKg, age: p.age, gender: p.gender, heightCm: p.heightCm }, byId, {
    activeKcal: k?.activeKcal ?? w?.kcal, // the window's own sum first, then the watch's copy of the workout
    totalKcal: k?.totalKcal,
    hr: hr ? { avg: hr.avg, max: hr.max, sets: hr.sets } : w?.avgHr ? { avg: w.avgHr, max: w.maxHr } : undefined,
    setTimes: t.setTimes[s.id],
  });
}

// Outside React (the calendar's pure helpers default to this).
export const energyOf = (s: Session) => energyFor(s, useTracker.getState(), useStore.getState().profile);

export function useEnergyData(): EnergyData {
  const sessionKcal = useTracker((t) => t.sessionKcal);
  const sessionHr = useTracker((t) => t.sessionHr);
  const setTimes = useTracker((t) => t.setTimes);
  const merged = useTracker((t) => t.merged);
  return useMemo(() => ({ sessionKcal, sessionHr, setTimes, merged }), [sessionKcal, sessionHr, setTimes, merged]);
}

export function useSessionEnergy(s: Session | undefined): SessionEnergy | null {
  const data = useEnergyData();
  const profile = useStore((st) => st.profile);
  return useMemo(() => (s && s.endedAt ? energyFor(s, data, profile) : null), [s, data, profile]);
}

// One day's burn from everything we know, each workout once (energy.ts dayBurn).
export function burnOn(day: DailyMetrics | undefined, watch: ImportedWorkout[], sessions: Session[], energy: (s: Session) => SessionEnergy = energyOf): DayBurn & { energies: Record<string, SessionEnergy> } {
  const energies: Record<string, SessionEnergy> = {};
  for (const s of sessions) if (s.endedAt) energies[s.id] = energy(s);
  return { ...dayBurn(day?.activeKcal, watch, Object.entries(energies).map(([id, e]) => ({ id, kcal: e.kcal, source: e.source }))), energies };
}

// Today, for Home: calories burned so far and where the number comes from.
export function useTodayBurn() {
  const sessions = useStore((st) => st.sessions);
  const profile = useStore((st) => st.profile);
  const daily = useTracker((t) => t.daily);
  const workouts = useTracker((t) => t.workouts);
  const data = useEnergyData();
  return useMemo(() => {
    const k = dayKey();
    const ours = sessions.filter((s) => s.endedAt && dayKey(s.startedAt) === k);
    const watch = Object.values(workouts).filter((w) => dayKey(Date.parse(w.start)) === k);
    return { ...burnOn(daily[k], watch, ours, (s) => energyFor(s, data, profile)), workouts: ours.length + watch.length, origin: daily[k]?.origin ?? [] };
  }, [sessions, profile, daily, workouts, data]);
}
