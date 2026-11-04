import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Data that comes from watches, bands, rings, scales and straps. Kept in its own saved store so the main app state
// (and its migrations) never change because of it, and so it can be wiped on Disconnect without touching workouts.

export type Source = 'health_connect' | 'ble' | 'fit' | 'takeout' | 'gpx' | 'manual';

export type SleepNight = { start: string; end: string; minutes: number; stages?: { deep: number; light: number; rem: number; awake: number } };

// One row per local day ('YYYY-MM-DD'). Every field is optional: each watch app shares a different set.
export type DailyMetrics = {
  date: string;
  steps?: number;
  distanceM?: number;
  activeKcal?: number;
  totalKcal?: number;
  restingHr?: number;
  avgHr?: number;
  hrvMs?: number; // RMSSD in milliseconds
  spo2Pct?: number;
  respRate?: number; // breaths per minute
  skinTempDelta?: number; // °C against the person's baseline
  vo2max?: number;
  weightKg?: number;
  sleep?: SleepNight;
  origin?: string[]; // apps the numbers came from, e.g. 'com.fitbit.FitbitMobile', 'nodomain.freeyourgadget.gadgetbridge'
};

export type ImportedWorkout = {
  id: string; // `${source}:${externalId}` so a re-sync never duplicates
  source: Source;
  originApp?: string;
  type: string;
  title?: string;
  start: string; // ISO
  end: string; // ISO
  durationS: number;
  kcal?: number;
  distanceM?: number;
  avgHr?: number;
  maxHr?: number;
  linkedSessionId?: string; // one of our own logged sessions covering the same time
};

export type HrDevice = { id: string; name: string; lastConnected?: string };

type TrackerState = {
  daily: Record<string, DailyMetrics>;
  workouts: Record<string, ImportedWorkout>;
  hc: { connected: boolean; granted: string[]; lastSync?: string; changesToken?: string };
  strap: HrDevice | null;
  // Post-workout and morning HRV worked out from a strap's beat-to-beat intervals (RMSSD, ms), by day.
  strapHrv: Record<string, number>;
  upsertDaily: (rows: DailyMetrics[]) => void;
  upsertWorkouts: (rows: ImportedWorkout[]) => void;
  setHc: (patch: Partial<TrackerState['hc']>) => void;
  setStrap: (d: HrDevice | null) => void;
  logStrapHrv: (day: string, ms: number) => void;
  disconnectHc: () => void;
};

const KEEP_DAYS = 400;

export const useTracker = create<TrackerState>()(
  persist(
    (set) => ({
      daily: {},
      workouts: {},
      hc: { connected: false, granted: [] },
      strap: null,
      strapHrv: {},
      upsertDaily: (rows) =>
        set((s) => {
          const daily = { ...s.daily };
          for (const r of rows) daily[r.date] = { ...daily[r.date], ...r, origin: [...new Set([...(daily[r.date]?.origin ?? []), ...(r.origin ?? [])])] };
          const keys = Object.keys(daily).sort();
          for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete daily[k];
          return { daily };
        }),
      upsertWorkouts: (rows) => set((s) => ({ workouts: { ...s.workouts, ...Object.fromEntries(rows.map((w) => [w.id, w])) } })),
      setHc: (patch) => set((s) => ({ hc: { ...s.hc, ...patch } })),
      setStrap: (strap) => set({ strap }),
      logStrapHrv: (day, ms) => set((s) => ({ strapHrv: { ...s.strapHrv, [day]: ms } })),
      disconnectHc: () =>
        set((s) => ({
          hc: { connected: false, granted: [] },
          daily: {},
          workouts: Object.fromEntries(Object.entries(s.workouts).filter(([, w]) => w.source !== 'health_connect')),
        })),
    }),
    { name: 'gym-buddy-tracker', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

// The latest day that has a given number, within the last `within` days.
export function latest<K extends keyof DailyMetrics>(daily: Record<string, DailyMetrics>, key: K, within = 3): DailyMetrics[K] | undefined {
  const keys = Object.keys(daily).sort().reverse();
  const cutoff = new Date(Date.now() - within * 86400000).toISOString().slice(0, 10);
  for (const k of keys) {
    if (k < cutoff) break;
    if (daily[k][key] !== undefined) return daily[k][key];
  }
  return undefined;
}

// A 0-100 sleep score from duration and deep+REM share. Simple and explainable: 8 h with a quarter deep+REM is 100.
export function sleepScore(n?: SleepNight): number | undefined {
  if (!n || n.minutes < 60) return undefined;
  const dur = Math.min(1, n.minutes / 480);
  const st = n.stages;
  const quality = st ? Math.min(1, (st.deep + st.rem) / Math.max(1, n.minutes) / 0.4) : 0.8;
  return Math.round(100 * (0.7 * dur + 0.3 * quality));
}
