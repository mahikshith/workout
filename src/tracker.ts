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

// Heart rate during one of our own workouts, read from Health Connect after it ends (src/health/healthConnect.ts).
// `sets` has the same shape as the session's items and sets; it and `rest` are left out when the source is sparse.
export type HrStat = { avg: number; max: number };
export type SessionHr = HrStat & { sets?: (HrStat | null)[][]; rest?: HrStat; sparse?: boolean; origin?: string; readAt: string };
// Calories the watch counted during one of our own workouts (Health Connect, summed over the workout's time window).
// Either number can be missing: not every watch app shares both. No numbers at all means "read, nothing there".
export type SessionKcal = { activeKcal?: number; totalKcal?: number; origin?: string[]; readAt: string };

// Today's heart rate from Health Connect, for the Tracker screen: average bpm per `stepMin` bucket from midnight (null
// where the watch wrote nothing), and minutes per heart-rate zone 0-5 (src/health/readiness.ts zoneOf).
export type HrDay = { date: string; stepMin: number; bpm: (number | null)[]; min: number; max: number; avg: number; zoneMin: number[]; origin?: string; readAt: string };

export type HrDevice = { id: string; name: string; lastConnected?: string };
// A paired Colmi smart ring (src/health/colmiDevice.ts).
export type RingDevice = { id: string; name: string; lastSync?: string; battery?: number; charging?: boolean };

type TrackerState = {
  daily: Record<string, DailyMetrics>;
  workouts: Record<string, ImportedWorkout>;
  hc: { connected: boolean; granted: string[]; lastSync?: string; changesToken?: string };
  strap: HrDevice | null;
  // Post-workout and morning HRV worked out from a strap's beat-to-beat intervals (RMSSD, ms), by day.
  strapHrv: Record<string, number>;
  ring: RingDevice | null;
  // Per-session extras, keyed by our session id. setTimes: when each set was ticked (epoch ms, 0 unknown), recorded by
  // src/health/index.ts because sets carry no timestamp. hcWritten: the clientRecordVersion of our Health Connect record.
  setTimes: Record<string, number[][]>;
  sessionHr: Record<string, SessionHr>;
  sessionKcal: Record<string, SessionKcal>;
  hcWritten: Record<string, number>;
  // Watch workouts merged into one of our sessions (linkedSessionId set), by workout id. They live here instead of
  // `workouts`, so every list of imported workouts leaves them out without knowing about merging.
  merged: Record<string, ImportedWorkout>;
  hrDay: HrDay | null;
  setHrDay: (d: HrDay | null) => void;
  upsertDaily: (rows: DailyMetrics[]) => void;
  upsertWorkouts: (rows: ImportedWorkout[]) => void;
  setHc: (patch: Partial<TrackerState['hc']>) => void;
  setStrap: (d: HrDevice | null) => void;
  logStrapHrv: (day: string, ms: number) => void;
  setRing: (patch: Partial<RingDevice> | null) => void;
  disconnectHc: (removeWritten?: boolean) => void;
  setSetTimes: (id: string, times: number[][]) => void;
  putSessionHr: (id: string, hr: SessionHr) => void;
  putSessionKcal: (id: string, kcal: SessionKcal) => void;
  markWritten: (id: string, version: number) => void;
  merge: (workoutId: string, sessionId: string, patch?: Partial<ImportedWorkout>) => void;
  forgetSession: (id: string) => void;
};

export const STRAP_ORIGIN = 'strap'; // SessionHr.origin for heart rate we recorded ourselves over Bluetooth
const KEEP_SESSIONS = 60; // set times and HR kept for this many recent sessions
const KEEP_KCAL = 500; // the calories are two numbers a workout, and the calendar shows them for old months too
const trim = <T,>(m: Record<string, T>, keep: string, max = KEEP_SESSIONS) => {
  const keys = Object.keys(m);
  if (keys.length <= max) return m;
  const out = { ...m };
  for (const k of keys.slice(0, keys.length - max)) if (k !== keep) delete out[k];
  return out;
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
      ring: null,
      setTimes: {},
      sessionHr: {},
      sessionKcal: {},
      hcWritten: {},
      merged: {},
      hrDay: null,
      setHrDay: (hrDay) => set({ hrDay }),
      upsertDaily: (rows) =>
        set((s) => {
          const daily = { ...s.daily };
          for (const r of rows) daily[r.date] = { ...daily[r.date], ...r, origin: [...new Set([...(daily[r.date]?.origin ?? []), ...(r.origin ?? [])])] };
          const keys = Object.keys(daily).sort();
          for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete daily[k];
          return { daily };
        }),
      // A re-synced workout that is already merged updates its merged copy and stays out of the list.
      upsertWorkouts: (rows) =>
        set((s) => {
          const workouts = { ...s.workouts };
          const merged = { ...s.merged };
          for (const w of rows) {
            if (merged[w.id]) merged[w.id] = { ...merged[w.id], ...w, linkedSessionId: merged[w.id].linkedSessionId };
            else workouts[w.id] = w;
          }
          return { workouts, merged };
        }),
      setHc: (patch) => set((s) => ({ hc: { ...s.hc, ...patch } })),
      setStrap: (strap) => set({ strap }),
      logStrapHrv: (day, ms) => set((s) => ({ strapHrv: { ...s.strapHrv, [day]: ms } })),
      // null forgets the ring; a patch with an id replaces it, without one it updates the saved ring.
      setRing: (patch) =>
        set((s) => ({ ring: patch === null ? null : patch.id && patch.id !== s.ring?.id ? { name: 'Ring', ...patch, id: patch.id } : s.ring ? { ...s.ring, ...patch } : null })),
      disconnectHc: (removeWritten) =>
        set((s) => ({
          hc: { connected: false, granted: [] },
          daily: {},
          workouts: Object.fromEntries(Object.entries(s.workouts).filter(([, w]) => w.source !== 'health_connect')),
          merged: Object.fromEntries(Object.entries(s.merged).filter(([, w]) => w.source !== 'health_connect')),
          // Heart rate recorded by a strap during a workout is ours, not Health Connect's: it stays.
          sessionHr: Object.fromEntries(Object.entries(s.sessionHr).filter(([, h]) => h.origin === STRAP_ORIGIN)),
          sessionKcal: {},
          hrDay: null,
          hcWritten: removeWritten ? {} : s.hcWritten,
        })),
      setSetTimes: (id, times) => set((s) => ({ setTimes: trim({ ...s.setTimes, [id]: times }, id) })),
      putSessionHr: (id, hr) => set((s) => ({ sessionHr: trim({ ...s.sessionHr, [id]: hr }, id) })),
      putSessionKcal: (id, kcal) => set((s) => ({ sessionKcal: trim({ ...(s.sessionKcal ?? {}), [id]: kcal }, id, KEEP_KCAL) })),
      markWritten: (id, v) => set((s) => ({ hcWritten: { ...s.hcWritten, [id]: v } })),
      merge: (workoutId, sessionId, patch) =>
        set((s) => {
          const w = s.workouts[workoutId] ?? s.merged[workoutId];
          if (!w) return {};
          const workouts = { ...s.workouts };
          delete workouts[workoutId];
          return { workouts, merged: { ...s.merged, [workoutId]: { ...w, ...patch, linkedSessionId: sessionId } } };
        }),
      // A deleted session: drop its extras, and give any watch workout merged into it back to the list.
      forgetSession: (id) =>
        set((s) => {
          const { [id]: _a, ...setTimes } = s.setTimes;
          const { [id]: _b, ...sessionHr } = s.sessionHr;
          const { [id]: _c, ...hcWritten } = s.hcWritten;
          const { [id]: _d, ...sessionKcal } = s.sessionKcal ?? {};
          const merged = { ...s.merged };
          const workouts = { ...s.workouts };
          for (const [k, w] of Object.entries(s.merged)) if (w.linkedSessionId === id) { delete merged[k]; workouts[k] = { ...w, linkedSessionId: undefined }; }
          return { setTimes, sessionHr, sessionKcal, hcWritten, merged, workouts };
        }),
    }),
    { name: 'gym-buddy-tracker', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

// The watch workout merged into one of our sessions, if any.
export function mergedFor(merged: Record<string, ImportedWorkout>, sessionId: string): ImportedWorkout | undefined {
  for (const w of Object.values(merged)) if (w.linkedSessionId === sessionId) return w;
  return undefined;
}

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
