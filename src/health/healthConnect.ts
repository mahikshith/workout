// Android Health Connect: read what watches, bands, rings and scales share (Fitbit, Pixel, Samsung, Garmin, Whoop,
// Amazfit, Oura, Gadgetbridge, openScale...) and write our finished gym workouts back. The native module is required
// lazily and only on Android, so web and iOS never load it; there every call reports 'unavailable'.
import { Platform } from 'react-native';
import type * as HCLib from 'react-native-health-connect';
import { isTimed } from '../calc';
import { byId } from '../data/exercises';
import { useStore, type Session } from '../store';
import { useTracker, type DailyMetrics, type HrDay, type ImportedWorkout, type SleepNight } from '../tracker';
import { hrMaxFor, zoneOf } from './readiness';
import { cardioType, matchSession, setsText, SET_LEAD_MS, splitHr, type HrSample } from './parse';

type HC = typeof HCLib;
type RecordType = HCLib.RecordType;

let lib: HC | null | undefined;
function hc(): HC | null {
  if (lib !== undefined) return lib;
  lib = null;
  if (Platform.OS !== 'android') return lib;
  try { lib = require('react-native-health-connect') as HC; } catch { lib = null; }
  return lib;
}

export type HcStatus = 'available' | 'needs_update' | 'not_installed' | 'unavailable';

export const HC_PLAY_URL = 'market://details?id=com.google.android.apps.healthdata';
export const HC_PLAY_WEB = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

// The record types we read, with a short label for the "data types on" line. Skin temperature is not in
// react-native-health-connect 3.5.3, so it is left out.
export const READ_TYPES: { type: RecordType; label: string }[] = [
  { type: 'Steps', label: 'Steps' },
  { type: 'Distance', label: 'Distance' },
  { type: 'HeartRate', label: 'Heart rate' },
  { type: 'RestingHeartRate', label: 'Resting HR' },
  { type: 'HeartRateVariabilityRmssd', label: 'HRV' },
  { type: 'OxygenSaturation', label: 'SpO2' },
  { type: 'RespiratoryRate', label: 'Breathing' },
  { type: 'Vo2Max', label: 'VO2 max' },
  { type: 'SleepSession', label: 'Sleep' },
  { type: 'ExerciseSession', label: 'Workouts' },
  { type: 'ActiveCaloriesBurned', label: 'Active kcal' },
  { type: 'TotalCaloriesBurned', label: 'Total kcal' },
  { type: 'Weight', label: 'Weight' },
];
const WRITE_KEY = 'write:ExerciseSession';

export async function isAvailable(): Promise<HcStatus> {
  const m = hc();
  if (!m) return 'unavailable';
  try {
    const s = await m.getSdkStatus();
    if (s === m.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (s === m.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs_update';
    return 'not_installed';
  } catch {
    return 'unavailable';
  }
}

async function ready(): Promise<HC | null> {
  const m = hc();
  if (!m) return null;
  try { return (await m.initialize()) ? m : null; } catch { return null; }
}

const keyOf = (p: { accessType: string; recordType: string }) => (p.accessType === 'write' ? `write:${p.recordType}` : p.recordType);

// Opens the Health Connect permission screen. Returns the granted list ('Steps', ..., 'write:ExerciseSession').
// `history: false` leaves out reading data older than 30 days, so it can be asked as its own step (requestHistory).
export async function requestPermissions(history = true): Promise<string[]> {
  const m = await ready();
  if (!m) return [];
  const granted = await m.requestPermission([
    ...READ_TYPES.map((t) => ({ accessType: 'read' as const, recordType: t.type })),
    { accessType: 'write', recordType: 'ExerciseSession' },
    // Without this Health Connect only returns data from ~30 days before the first grant.
    ...(history ? [{ accessType: 'read' as const, recordType: 'ReadHealthDataHistory' as const }] : []),
  ]);
  const keys = [...new Set(granted.map(keyOf))];
  useTracker.getState().setHc({ connected: keys.some((k) => !k.startsWith('write:')), granted: keys });
  return keys;
}

// The separate "older history" step: asks only for data from before the first grant. True when it is on.
export async function requestHistory(): Promise<boolean> {
  const m = await ready();
  if (!m) return false;
  try {
    await m.requestPermission([{ accessType: 'read', recordType: 'ReadHealthDataHistory' }]);
  } catch { return false; }
  const keys = await grantedNow(m);
  useTracker.getState().setHc({ granted: keys });
  return keys.includes('ReadHealthDataHistory');
}

async function grantedNow(m: HC): Promise<string[]> {
  try { return [...new Set((await m.getGrantedPermissions()).map(keyOf))]; } catch { return useTracker.getState().hc.granted; }
}

// --- helpers
const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (iso: string | number) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const r1 = (x: number | undefined) => (x === undefined ? undefined : Math.round(x * 10) / 10);

async function readAll<T extends RecordType>(m: HC, type: T, startTime: string, endTime: string) {
  const out: HCLib.RecordResult<T>[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await m.readRecords(type, { timeRangeFilter: { operator: 'between', startTime, endTime }, pageSize: 1000, pageToken });
    out.push(...res.records);
    if (!res.pageToken) break;
    pageToken = res.pageToken;
  }
  return out;
}

const exerciseName = (m: HC, t: number) => {
  const k = Object.entries(m.ExerciseType).find(([, v]) => v === t)?.[0] ?? 'OTHER_WORKOUT';
  const s = k.toLowerCase().replace(/_/g, ' ');
  return s === 'other workout' ? 'Workout' : s[0].toUpperCase() + s.slice(1);
};

let syncing: Promise<boolean> | null = null;

// Reads the last `days` days into the tracker store, one DailyMetrics row per local day, plus exercise sessions as
// ImportedWorkouts. Each type is read on its own so one denied or failing type never stops the rest.
export function sync(days = 30): Promise<boolean> {
  if (!syncing) syncing = doSync(days).finally(() => { syncing = null; });
  return syncing;
}

async function doSync(days: number): Promise<boolean> {
  const m = await ready();
  if (!m) return false;
  const granted = await grantedNow(m);
  const has = (t: RecordType) => granted.includes(t);
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  t0.setDate(t0.getDate() - (days - 1));
  const startTime = t0.toISOString();
  const endTime = new Date().toISOString();
  const rows: Record<string, DailyMetrics> = {};
  const row = (day: string) => (rows[day] ??= { date: day, origin: [] });
  const addOrigin = (day: string, o?: string | string[]) => {
    for (const x of Array.isArray(o) ? o : o ? [o] : []) if (x && !row(day).origin!.includes(x)) row(day).origin!.push(x);
  };
  const safe = async (f: () => Promise<void>) => { try { await f(); } catch (e) { if (__DEV__) console.warn('health connect', e); } };

  // Day totals: Health Connect de-duplicates overlapping sources (phone + watch) inside its aggregates.
  const daily = async <T extends HCLib.AggregateResultRecordType>(type: T, put: (d: DailyMetrics, r: HCLib.AggregateResult<T>) => void) => {
    if (!has(type)) return;
    await safe(async () => {
      const groups = await m.aggregateGroupByDuration({ recordType: type, timeRangeFilter: { operator: 'between', startTime, endTime }, timeRangeSlicer: { duration: 'DAYS', length: 1 } });
      for (const g of groups) {
        const day = localDay(new Date(g.startTime).getTime() + 3600000); // an hour in, so a DST shift never lands on the day before
        put(row(day), g.result);
        addOrigin(day, g.result.dataOrigins);
      }
    });
  };
  await daily('Steps', (d, r) => { if (r.COUNT_TOTAL) d.steps = Math.round(r.COUNT_TOTAL); });
  await daily('Distance', (d, r) => { if (r.DISTANCE?.inMeters) d.distanceM = Math.round(r.DISTANCE.inMeters); });
  await daily('ActiveCaloriesBurned', (d, r) => { if (r.ACTIVE_CALORIES_TOTAL?.inKilocalories) d.activeKcal = Math.round(r.ACTIVE_CALORIES_TOTAL.inKilocalories); });
  await daily('TotalCaloriesBurned', (d, r) => { if (r.ENERGY_TOTAL?.inKilocalories) d.totalKcal = Math.round(r.ENERGY_TOTAL.inKilocalories); });
  await daily('HeartRate', (d, r) => { if (r.BPM_AVG) d.avgHr = Math.round(r.BPM_AVG); });

  // Point readings: grouped by local day, then latest or mean.
  const points = async <T extends RecordType>(type: T, value: (r: HCLib.RecordResult<T>) => number | undefined, put: (d: DailyMetrics, xs: number[]) => void) => {
    if (!has(type)) return;
    await safe(async () => {
      const by: Record<string, { t: string; v: number }[]> = {};
      for (const rec of await readAll(m, type, startTime, endTime)) {
        const t = (rec as { time?: string; startTime?: string }).time ?? (rec as { startTime?: string }).startTime;
        const v = value(rec);
        if (!t || v === undefined || !Number.isFinite(v)) continue;
        const day = localDay(t);
        (by[day] ??= []).push({ t, v });
        addOrigin(day, rec.metadata?.dataOrigin);
      }
      for (const [day, xs] of Object.entries(by)) put(row(day), xs.sort((a, b) => a.t.localeCompare(b.t)).map((x) => x.v));
    });
  };
  const last = (xs: number[]) => xs[xs.length - 1];
  await points('RestingHeartRate', (r) => r.beatsPerMinute, (d, xs) => { d.restingHr = Math.round(last(xs)); });
  await points('HeartRateVariabilityRmssd', (r) => r.heartRateVariabilityMillis, (d, xs) => { d.hrvMs = r1(mean(xs)); });
  await points('OxygenSaturation', (r) => r.percentage, (d, xs) => { d.spo2Pct = r1(mean(xs)); });
  await points('RespiratoryRate', (r) => r.rate, (d, xs) => { d.respRate = r1(mean(xs)); });
  await points('Vo2Max', (r) => r.vo2MillilitersPerMinuteKilogram, (d, xs) => { d.vo2max = r1(last(xs)); });
  await points('Weight', (r) => r.weight?.inKilograms, (d, xs) => { d.weightKg = r1(last(xs)); });

  // Sleep: a night belongs to the day it ends on; the longest session that day wins (naps lose).
  if (has('SleepSession')) await safe(async () => {
    const S = m.SleepStageType;
    for (const rec of await readAll(m, 'SleepSession', new Date(t0.getTime() - 86400000).toISOString(), endTime)) {
      const total = (Date.parse(rec.endTime) - Date.parse(rec.startTime)) / 60000;
      let stages: SleepNight['stages'];
      let awake = 0;
      if (rec.stages?.length) {
        const st = { deep: 0, light: 0, rem: 0, awake: 0 };
        for (const x of rec.stages) {
          const mins = (Date.parse(x.endTime) - Date.parse(x.startTime)) / 60000;
          if (x.stage === S.DEEP) st.deep += mins;
          else if (x.stage === S.REM) st.rem += mins;
          else if (x.stage === S.LIGHT || x.stage === S.SLEEPING) st.light += mins;
          else if (x.stage === S.AWAKE || x.stage === S.OUT_OF_BED) st.awake += mins;
        }
        stages = { deep: Math.round(st.deep), light: Math.round(st.light), rem: Math.round(st.rem), awake: Math.round(st.awake) };
        awake = st.awake;
      }
      const night: SleepNight = { start: rec.startTime, end: rec.endTime, minutes: Math.round(Math.max(0, total - awake)), stages };
      const day = localDay(rec.endTime);
      if (day < localDay(t0.getTime())) continue;
      const d = row(day);
      if (!d.sleep || night.minutes > d.sleep.minutes) d.sleep = night;
      addOrigin(day, rec.metadata?.dataOrigin);
    }
  });

  // Exercise sessions from other apps. Our own written-back sessions are skipped so they never show twice. A watch's
  // own gym session that overlaps one of ours gets its heart rate and calories read, then is merged into ours.
  const workouts: ImportedWorkout[] = [];
  const ours = useStore.getState().sessions;
  if (has('ExerciseSession')) await safe(async () => {
    for (const rec of await readAll(m, 'ExerciseSession', startTime, endTime)) {
      const id = rec.metadata?.id;
      if (!id || rec.metadata?.clientRecordId?.startsWith(CLIENT_PREFIX)) continue;
      const w: ImportedWorkout = {
        id: `health_connect:${id}`,
        source: 'health_connect',
        originApp: rec.metadata?.dataOrigin,
        type: exerciseName(m, rec.exerciseType),
        title: rec.title || undefined,
        start: rec.startTime,
        end: rec.endTime,
        durationS: Math.max(0, Math.round((Date.parse(rec.endTime) - Date.parse(rec.startTime)) / 1000)),
      };
      // Heart rate and calories for the Tracker's workout list too: kept from the last sync when we have them, read
      // for the last two weeks when we don't (two small aggregate reads each).
      const prev = useTracker.getState().workouts[w.id] ?? useTracker.getState().merged[w.id];
      if (prev && (prev.kcal !== undefined || prev.avgHr !== undefined) && !matchSession(w, ours)) Object.assign(w, { kcal: prev.kcal, avgHr: prev.avgHr, maxHr: prev.maxHr });
      else if (matchSession(w, ours) || Date.parse(w.start) > Date.now() - WORKOUT_NUMBERS_MS) await safe(() => watchNumbers(m, w, has));
      workouts.push(w);
    }
  });

  const t = useTracker.getState();
  const list = Object.values(rows).filter((r) => Object.keys(r).length > 2); // more than date + origin
  if (list.length) t.upsertDaily(list);
  if (workouts.length) t.upsertWorkouts(workouts);
  linkWorkouts();
  if (has('HeartRate')) await safe(() => readHrDay(m));
  if (has('ActiveCaloriesBurned') || has('TotalCaloriesBurned')) await safe(backfillKcal);
  t.setHc({ connected: granted.some((k) => !k.startsWith('write:')), granted, lastSync: new Date().toISOString() });
  return true;
}

const WORKOUT_NUMBERS_MS = 14 * 86400000;
const HR_STEP_MIN = 10;
const PHONE = ['android', 'com.google.android.apps.healthdata', 'com.google.android.apps.fitness'];

// Today's heart rate, midnight to now, from the app that wrote the most samples (a watch, not a phone's odd reading):
// 10-minute averages for the Tracker's chart, and minutes in each zone from the raw samples (each counts until the
// next one, at most 2 minutes, so gaps while the watch was off add nothing).
async function readHrDay(m: HC) {
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const by: Record<string, HrSample[]> = {};
  for (const rec of await readAll(m, 'HeartRate', t0.toISOString(), new Date().toISOString())) {
    const o = rec.metadata?.dataOrigin ?? '?';
    const list = (by[o] ??= []);
    for (const x of rec.samples ?? []) if (x.beatsPerMinute > 0) list.push({ t: Date.parse(x.time), bpm: x.beatsPerMinute });
  }
  const best = Object.entries(by).sort((a, b) => Number(PHONE.includes(a[0])) - Number(PHONE.includes(b[0])) || b[1].length - a[1].length)[0];
  const day = localDay(t0.getTime());
  if (!best || !best[1].length) { useTracker.getState().setHrDay(null); return; }
  const xs = best[1].sort((a, b) => a.t - b.t);
  const n = Math.ceil((Date.now() - t0.getTime()) / (HR_STEP_MIN * 60000));
  const sum = new Array(n).fill(0), cnt = new Array(n).fill(0);
  for (const x of xs) {
    const k = Math.floor((x.t - t0.getTime()) / (HR_STEP_MIN * 60000));
    if (k >= 0 && k < n) { sum[k] += x.bpm; cnt[k]++; }
  }
  const tr = useTracker.getState();
  const rhrs = Object.values(tr.daily).map((d) => d.restingHr).filter((v): v is number => !!v).slice(-28);
  const rest = tr.daily[day]?.restingHr ?? (rhrs.length ? Math.round(rhrs.reduce((a, b) => a + b, 0) / rhrs.length) : 60);
  const max = hrMaxFor(useStore.getState().profile.age);
  const zoneMin = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < xs.length; i++) {
    const dt = i + 1 < xs.length ? Math.min(120000, xs[i + 1].t - xs[i].t) : 60000;
    zoneMin[zoneOf(xs[i].bpm, rest, max)] += dt / 60000;
  }
  const bpms = xs.map((x) => x.bpm);
  const hrDay: HrDay = {
    date: day, stepMin: HR_STEP_MIN,
    bpm: sum.map((v, k) => (cnt[k] ? Math.round(v / cnt[k]) : null)),
    min: Math.min(...bpms), max: Math.max(...bpms), avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
    zoneMin: zoneMin.map((v) => Math.round(v)),
    origin: best[0] === '?' ? undefined : best[0], readAt: new Date().toISOString(),
  };
  tr.setHrDay(hrDay);
}

// Heart rate and active calories the watch recorded during one of its workouts, from that watch only.
async function watchNumbers(m: HC, w: ImportedWorkout, has: (t: RecordType) => boolean) {
  const timeRangeFilter = { operator: 'between' as const, startTime: w.start, endTime: w.end };
  const dataOriginFilter = w.originApp ? [w.originApp] : undefined;
  if (has('HeartRate')) {
    const hr = await m.aggregateRecord({ recordType: 'HeartRate', timeRangeFilter, dataOriginFilter });
    if (hr.MEASUREMENTS_COUNT > 0 && hr.BPM_AVG) { w.avgHr = Math.round(hr.BPM_AVG); w.maxHr = Math.round(hr.BPM_MAX); }
  }
  if (has('ActiveCaloriesBurned')) {
    const kc = await m.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter, dataOriginFilter });
    const v = kc.ACTIVE_CALORIES_TOTAL?.inKilocalories;
    if (v && v > 0) w.kcal = Math.round(v);
  }
}

// Moves every imported workout that duplicates one of our logged sessions into the tracker's merged list, so it is
// shown as part of our session (Summary) and no longer as a second workout. No reads: safe to call any time.
export function linkWorkouts() {
  const sessions = useStore.getState().sessions;
  const t = useTracker.getState();
  for (const w of Object.values(t.workouts)) {
    const id = matchSession(w, sessions);
    if (id) t.merge(w.id, id);
  }
}

const HR_TAIL_MS = 5 * 60000;

// Heart rate per set for one of our finished workouts: the samples from start to end + 5 min, split by when each set
// was ticked (src/health/parse.ts splitHr). When several apps wrote HR, the one with the most samples wins, so a
// phone's odd reading never mixes with the watch's. Returns false when there is nothing (yet).
export async function readSessionHr(s: Session): Promise<boolean> {
  if (!s.endedAt || !useTracker.getState().hc.connected) return false;
  const m = await ready();
  if (!m || !(await grantedNow(m)).includes('HeartRate')) return false;
  const times = useTracker.getState().setTimes[s.id];
  const first = Math.min(...(times ?? []).flat().filter((x) => x > 0));
  // startedAt moves later by any paused time when a workout finishes, so the first ticked set can be earlier.
  const start = Math.min(s.startedAt, Number.isFinite(first) ? first - SET_LEAD_MS : Infinity);
  const end = s.endedAt;
  try {
    const by: Record<string, HrSample[]> = {};
    for (const rec of await readAll(m, 'HeartRate', new Date(start).toISOString(), new Date(end + HR_TAIL_MS).toISOString())) {
      const list = (by[rec.metadata?.dataOrigin ?? '?'] ??= []);
      for (const x of rec.samples ?? []) list.push({ t: Date.parse(x.time), bpm: x.beatsPerMinute });
    }
    const inside = (xs: HrSample[]) => xs.filter((x) => x.t >= start && x.t <= end).length;
    const best = Object.entries(by).sort((a, b) => inside(b[1]) - inside(a[1]))[0];
    if (!best) return false;
    const split = splitHr(best[1], start, end, times);
    if (!split) return false;
    useTracker.getState().putSessionHr(s.id, {
      avg: split.avg, max: split.max, sets: split.sets, rest: split.rest, sparse: split.sparse || undefined,
      origin: best[0] === '?' ? undefined : best[0], readAt: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('health connect hr', e);
    return false;
  }
}

// Calories the watch counted during one of our finished workouts: Health Connect's own sum of ActiveCaloriesBurned
// (and TotalCaloriesBurned) between its start and end. Health Connect de-duplicates sources inside an aggregate and
// gives a record that only partly overlaps the window its share by time. The phone's own step calories are left out:
// they are not a measurement of a gym workout. Stores a record even when there is nothing, so a later look knows the
// read happened. Returns true when a calorie number came back. Quiet when the permission is off.
export async function readSessionKcal(s: Session): Promise<boolean> {
  if (!s.endedAt || s.endedAt - s.startedAt < 60000 || !useTracker.getState().hc.connected) return false;
  const m = await ready();
  if (!m) return false;
  const granted = await grantedNow(m);
  const can = (['ActiveCaloriesBurned', 'TotalCaloriesBurned'] as const).filter((t) => granted.includes(t));
  if (!can.length) return false;
  const timeRangeFilter = { operator: 'between' as const, startTime: new Date(s.startedAt).toISOString(), endTime: new Date(s.endedAt).toISOString() };
  const fromWatch = (o?: string[]) => !o?.length || o.some((x) => !PHONE.includes(x));
  let activeKcal: number | undefined, totalKcal: number | undefined;
  const origin = new Set<string>();
  try {
    if (can.includes('ActiveCaloriesBurned')) {
      const r = await m.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter });
      const v = r.ACTIVE_CALORIES_TOTAL?.inKilocalories;
      if (v && v > 0 && fromWatch(r.dataOrigins)) { activeKcal = Math.round(v); r.dataOrigins?.forEach((x) => origin.add(x)); }
    }
    if (activeKcal === undefined && can.includes('TotalCaloriesBurned')) {
      const r = await m.aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter });
      const v = r.ENERGY_TOTAL?.inKilocalories;
      if (v && v > 0 && fromWatch(r.dataOrigins)) { totalKcal = Math.round(v); r.dataOrigins?.forEach((x) => origin.add(x)); }
    }
  } catch (e) {
    if (__DEV__) console.warn('health connect kcal', e);
    return false;
  }
  useTracker.getState().putSessionKcal(s.id, { activeKcal, totalKcal, origin: origin.size ? [...origin].filter((x) => !PHONE.includes(x)) : undefined, readAt: new Date().toISOString() });
  return activeKcal !== undefined || totalKcal !== undefined;
}

// On sync: calories for our workouts of the last 30 days that have none yet (a watch can sync hours late, and a
// workout logged before the watch was connected has never been read). At most 12 a sync, newest first; a workout
// that was read and had nothing is tried again only while it is under two days old.
async function backfillKcal() {
  const t = useTracker.getState();
  const now = Date.now();
  const todo = useStore.getState().sessions
    .filter((s) => s.endedAt && now - s.endedAt < 30 * 86400000)
    .filter((s) => { const k = t.sessionKcal?.[s.id]; return !k || (k.activeKcal === undefined && k.totalKcal === undefined && now - s.endedAt! < 2 * 86400000); })
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 12);
  for (const s of todo) await readSessionKcal(s);
}

const CLIENT_PREFIX = 'gymbuddy:';

const NOTES_MAX = 1000;

// The Health Connect exercise type for one of our sessions: strength training, unless every exercise is cardio, then
// the cardio machine or activity that took the most time.
function typeFor(m: HC, s: Session): number {
  const cardio = s.items.length > 0 && s.items.every((it) => byId[it.exId]?.category === 'cardio');
  if (!cardio) return m.ExerciseType.STRENGTH_TRAINING;
  const key = cardioType(s.items.map((it) => ({ name: byId[it.exId]?.name ?? it.exId, amount: it.sets.reduce((a, x) => a + (x.done ? x.reps : 0), 0) })));
  return (m.ExerciseType as Record<string, number>)[key] ?? m.ExerciseType.OTHER_WORKOUT;
}

// Saves one of our finished workouts to Health Connect, with its sets as text in the notes. Safe to call again after
// an edit: the client record id makes Health Connect update the same record, and the version goes up by one each
// write so the update is never ignored.
export async function writeSession(s: Session): Promise<boolean> {
  if (!s.endedAt || !useTracker.getState().hc.connected) return false;
  const m = await ready();
  if (!m) return false;
  if (!(await grantedNow(m)).includes(WRITE_KEY)) return false;
  const end = Math.max(s.endedAt, s.startedAt + 60000);
  const version = (useTracker.getState().hcWritten[s.id] ?? 0) + 1;
  const notes = setsText(s.items.map((it) => ({ name: byId[it.exId]?.name ?? it.exId, timed: isTimed(it.target), sets: it.sets })));
  try {
    await m.insertRecords([{
      recordType: 'ExerciseSession',
      startTime: new Date(s.startedAt).toISOString(),
      endTime: new Date(end).toISOString(),
      exerciseType: typeFor(m, s),
      title: s.title,
      notes: notes ? (notes.length > NOTES_MAX ? notes.slice(0, NOTES_MAX - 1) + '…' : notes) : undefined,
      metadata: { clientRecordId: CLIENT_PREFIX + s.id, clientRecordVersion: version },
    }]);
    useTracker.getState().markWritten(s.id, version);
    return true;
  } catch (e) {
    if (__DEV__) console.warn('health connect write', e);
    return false;
  }
}

// Removes the records we wrote for these sessions. Health Connect only lets an app delete its own records.
async function deleteWritten(m: HC, ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  try {
    for (let k = 0; k < ids.length; k += 100) await m.deleteRecordsByUuids('ExerciseSession', [], ids.slice(k, k + 100).map((id) => CLIENT_PREFIX + id));
    return true;
  } catch (e) {
    if (__DEV__) console.warn('health connect delete', e);
    return false;
  }
}

// A session deleted in the app: delete our record of it too, if we wrote one.
export async function deleteSessionRecord(id: string): Promise<boolean> {
  if (!(id in useTracker.getState().hcWritten) || !useTracker.getState().hc.connected) return false;
  const m = await ready();
  if (!m || !(await grantedNow(m)).includes(WRITE_KEY)) return false;
  return deleteWritten(m, [id]);
}

// Disconnect: forget the data we copied and, where the platform allows, drop our grants too. With `removeWritten`,
// first delete the workouts we saved to Health Connect (before the grants go, since that needs write access).
export async function disconnect(removeWritten = false): Promise<void> {
  if (removeWritten) {
    const m = await ready();
    if (m) {
      const ids = new Set([...Object.keys(useTracker.getState().hcWritten), ...useStore.getState().sessions.map((x) => x.id)]);
      await deleteWritten(m, [...ids]);
    }
  }
  useTracker.getState().disconnectHc(removeWritten);
  const m = hc();
  if (!m) return;
  try { await m.revokeAllPermissions(); } catch {}
}

export function openHcSettings(): boolean {
  const m = hc();
  if (!m) return false;
  try { m.openHealthConnectSettings(); return true; } catch { return false; }
}

// What the "Connect your watch" check reads: a few key types, newest first, one small page each.
const CHECK_TYPES: { type: RecordType; label: string }[] = [
  { type: 'Steps', label: 'steps' },
  { type: 'SleepSession', label: 'sleep' },
  { type: 'HeartRate', label: 'heart rate' },
  { type: 'RestingHeartRate', label: 'resting HR' },
  { type: 'ExerciseSession', label: 'workouts' },
  { type: 'Weight', label: 'weight' },
];

export type DataCheck = {
  granted: number; // read types allowed
  sources: { origin: string; types: string[] }[]; // apps that wrote data in the window, most types first
};

// After "Allow access": which apps have shared what in the last `days` days, by each record's data origin. Our own
// written-back workouts are left out. Null when Health Connect can't be reached (web, iOS, not installed).
export async function checkData(days = 7): Promise<DataCheck | null> {
  const m = await ready();
  if (!m) return null;
  const granted = await grantedNow(m);
  const timeRangeFilter = { operator: 'between' as const, startTime: new Date(Date.now() - days * 86400000).toISOString(), endTime: new Date().toISOString() };
  const by: Record<string, string[]> = {};
  for (const t of CHECK_TYPES) {
    if (!granted.includes(t.type)) continue;
    try {
      const res = await m.readRecords(t.type, { timeRangeFilter, pageSize: 200, ascendingOrder: false });
      for (const rec of res.records) {
        const md = rec.metadata;
        if (!md?.dataOrigin || md.clientRecordId?.startsWith(CLIENT_PREFIX)) continue;
        const list = (by[md.dataOrigin] ??= []);
        if (!list.includes(t.label)) list.push(t.label);
      }
    } catch (e) {
      if (__DEV__) console.warn('health connect check', e);
    }
  }
  const sources = Object.entries(by).map(([origin, types]) => ({ origin, types })).sort((a, b) => b.types.length - a.types.length);
  return { granted: granted.filter((k) => !k.startsWith('write:') && k !== 'ReadHealthDataHistory').length, sources };
}
