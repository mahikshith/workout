// Pure parsers for history files people export from other apps: Garmin .FIT and Garmin export zips, Fitbit Google
// Takeout, GPX and TCX (also what Gadgetbridge and OpenTracks export). They work on bytes and strings only, with no
// React Native imports, so `scripts/selfcheck.mjs` can run them under plain Node.
// The FIT decoder (./fit) is our own and follows the public FIT protocol.

import { gunzipSync, inflateSync, strFromU8 } from 'fflate';
import type { DailyMetrics, ImportedWorkout, SleepNight } from '../tracker';
import { decodeFit, isFitHeader } from './fit';

export type ImportResult = {
  daily: DailyMetrics[];
  workouts: ImportedWorkout[];
  files: number; // files that gave us something
  skipped: number; // files we did not understand
};

export type ImportOptions = {
  now?: number; // for tests
  keepDays?: number; // daily rows older than this are dropped (the tracker keeps 400 days)
  maxWorkouts?: number; // newest first
  pause?: () => Promise<void>; // called between files inside a zip so the UI can breathe
};

const KEEP_DAYS = 400;
const MAX_WORKOUTS = 2000;
const FITBIT = 'com.fitbit.FitbitMobile';
const GARMIN = 'com.garmin.android.apps.connectmobile';

// ---------- small helpers ----------

const pad = (n: number) => String(n).padStart(2, '0');
export const localDay = (t: number | string | Date) => {
  const x = new Date(t);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const words = (s: string) => {
  const w = s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return w ? w[0].toUpperCase() + w.slice(1) : 'Workout';
};
const decodeXml = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const tag = (xml: string, name: string) => {
  const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml);
  return m ? decodeXml(m[1]) : undefined;
};
const tagAll = (xml: string, name: string) => {
  const out: string[] = [];
  const re = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'g');
  for (let m; (m = re.exec(xml)); ) out.push(m[1]);
  return out;
};
const minuteIso = (t: number) => new Date(Math.floor(t / 60000) * 60000).toISOString();
// Imported workouts share one id space, keyed by start minute, so the same activity imported as .FIT and as .GPX
// (or twice) is stored once.
export const workoutId = (startMs: number) => `file:${minuteIso(startMs)}`;

// Fitbit dates: 'MM/DD/YY HH:mm:ss'. Minute series are in UTC, logged entries (exercise, weight) in local time.
const fitbitTime = (s: string, utc: boolean): number | undefined => {
  const m = /^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/.exec(s);
  if (!m) return undefined;
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const a = [y, +m[1] - 1, +m[2], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)] as const;
  return utc ? Date.UTC(...a) : new Date(...a).getTime();
};
const fitbitDay = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{2,4})/.exec(s);
  return m ? `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[1]}-${m[2]}` : undefined;
};

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function csv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((x) => x.trim()));
  }
  return rows;
}

// ---------- the accumulator every parser writes into ----------

type Sum = { n: number; sum: number };
// Lower rank wins when two files describe the same workout: a .FIT has the device's own numbers.
const RANK: Record<string, number> = { fit: 0, tcx: 1, gpx: 2, json: 3 };

class Acc {
  days: Record<string, DailyMetrics> = {};
  sums: Record<string, { steps?: number; distanceM?: number; totalKcal?: number; hr?: Sum }> = {};
  workouts: Record<string, ImportedWorkout & { rank: number }> = {};
  fitbitWeights: { day: string; v: number }[] = [];
  fitbitPounds = false;
  files = 0;
  skipped = 0;
  since: string;
  until: string;
  constructor(since: string, until: string) { this.since = since; this.until = until; }

  ok(day: string | undefined): day is string { return !!day && day >= this.since && day <= this.until; }
  day(day: string, origin: string) {
    const d = (this.days[day] ??= { date: day, origin: [] });
    if (!d.origin!.includes(origin)) d.origin!.push(origin);
    return d;
  }
  put(day: string | undefined, origin: string, f: (d: DailyMetrics) => void) { if (this.ok(day)) f(this.day(day, origin)); }
  add(day: string | undefined, origin: string, key: 'steps' | 'distanceM' | 'totalKcal', v: number | undefined) {
    if (!this.ok(day) || v === undefined) return;
    this.day(day, origin);
    const s = (this.sums[day] ??= {});
    s[key] = (s[key] ?? 0) + v;
  }
  hr(day: string | undefined, origin: string, bpm: number | undefined) {
    if (!this.ok(day) || !bpm || bpm < 25 || bpm > 250) return;
    this.day(day, origin);
    const s = ((this.sums[day] ??= {}).hr ??= { n: 0, sum: 0 });
    s.n++;
    s.sum += bpm;
  }
  sleep(day: string | undefined, origin: string, n: SleepNight) {
    this.put(day, origin, (d) => { if (n.minutes > 0 && (!d.sleep || n.minutes > d.sleep.minutes)) d.sleep = n; });
  }
  workout(w: Omit<ImportedWorkout, 'id'> & { startMs: number }, kind: keyof typeof RANK) {
    if (!(w.startMs > 0) || !(w.durationS > 0)) return;
    const { startMs, ...rest } = w;
    const id = workoutId(startMs);
    const next = { ...rest, id, rank: RANK[kind] } as ImportedWorkout & { rank: number };
    for (const [k, v] of Object.entries(next)) if (v === undefined) delete (next as Record<string, unknown>)[k];
    const prev = this.workouts[id];
    this.workouts[id] = !prev ? next : prev.rank <= next.rank ? { ...next, ...prev } : { ...prev, ...next };
  }
  result(maxWorkouts: number): ImportResult {
    for (const w of this.fitbitWeights) this.put(w.day, FITBIT, (d) => { d.weightKg = r1(this.fitbitPounds ? w.v * 0.45359237 : w.v); });
    for (const [day, s] of Object.entries(this.sums)) {
      const d = this.days[day];
      if (s.steps !== undefined && d.steps === undefined) d.steps = Math.round(s.steps);
      if (s.distanceM !== undefined && d.distanceM === undefined) d.distanceM = Math.round(s.distanceM);
      if (s.totalKcal !== undefined && d.totalKcal === undefined) d.totalKcal = Math.round(s.totalKcal);
      if (s.hr?.n && d.avgHr === undefined) d.avgHr = Math.round(s.hr.sum / s.hr.n);
    }
    const daily = Object.values(this.days).filter((d) => Object.keys(d).length > 2).sort((a, b) => a.date.localeCompare(b.date));
    const workouts = Object.values(this.workouts)
      .map(({ rank, ...w }) => w)
      .sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, maxWorkouts);
    return { daily, workouts, files: this.files, skipped: this.skipped };
  }
}

// ---------- GPX ----------

function gpxInto(xml: string, acc: Acc) {
  const creator = /<gpx\b[^>]*\bcreator="([^"]*)"/.exec(xml)?.[1];
  const ptRe = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  let found = false;
  for (const trk of tagAll(xml, 'trk')) {
    const head = trk.split(/<trkseg\b/)[0];
    let first = Infinity;
    let last = -Infinity;
    let dist = 0;
    let hrN = 0;
    let hrSum = 0;
    let hrMax = 0;
    for (const seg of tagAll(trk, 'trkseg')) {
      let prev: [number, number] | null = null;
      for (let m; (m = ptRe.exec(seg)); ) {
        const lat = num(/\blat="([^"]+)"/.exec(m[1])?.[1]);
        const lon = num(/\blon="([^"]+)"/.exec(m[1])?.[1]);
        const body = m[2] ?? '';
        const t = Date.parse(tag(body, 'time') ?? '');
        if (Number.isFinite(t)) { first = Math.min(first, t); last = Math.max(last, t); }
        const hr = num(/<(?:\w+:)?(?:hr|heartrate)>\s*(\d+)/i.exec(body)?.[1]);
        if (hr && hr > 25 && hr < 250) { hrN++; hrSum += hr; hrMax = Math.max(hrMax, hr); }
        if (lat !== undefined && lon !== undefined) {
          if (prev) dist += haversine(prev, [lat, lon]);
          prev = [lat, lon];
        }
      }
    }
    if (!Number.isFinite(first) || last <= first) continue;
    const type = tag(head, 'type');
    found = true;
    acc.workout({
      startMs: first, source: 'gpx', originApp: creator, type: type && !/^\d+$/.test(type) ? words(type) : 'Workout', title: tag(head, 'name') || undefined,
      start: new Date(first).toISOString(), end: new Date(last).toISOString(), durationS: Math.round((last - first) / 1000),
      distanceM: dist > 0 ? Math.round(dist) : undefined, avgHr: hrN ? Math.round(hrSum / hrN) : undefined, maxHr: hrMax || undefined,
    }, 'gpx');
  }
  found ? acc.files++ : acc.skipped++;
}

// ---------- TCX ----------

function tcxInto(xml: string, acc: Acc) {
  const creator = tag(tag(xml, 'Creator') ?? '', 'Name');
  let found = false;
  const actRe = /<Activity\b([^>]*)>([\s\S]*?)<\/Activity>/g;
  for (let a; (a = actRe.exec(xml)); ) {
    const sport = /\bSport="([^"]*)"/.exec(a[1])?.[1] ?? 'Other';
    const body = a[2];
    let start = Date.parse(tag(body, 'Id') ?? '');
    let timer = 0;
    let dist = 0;
    let kcal = 0;
    let hrW = 0;
    let hrT = 0;
    let hrMax = 0;
    const lapRe = /<Lap\b([^>]*)>([\s\S]*?)<\/Lap>/g;
    for (let l; (l = lapRe.exec(body)); ) {
      const ls = Date.parse(/\bStartTime="([^"]+)"/.exec(l[1])?.[1] ?? '');
      if (Number.isFinite(ls) && !(ls >= start)) start = ls;
      const head = l[2].split(/<Track\b/)[0];
      const secs = num(tag(head, 'TotalTimeSeconds')) ?? 0;
      timer += secs;
      dist += num(tag(head, 'DistanceMeters')) ?? 0;
      kcal += num(tag(head, 'Calories')) ?? 0;
      const avg = num(tag(tag(head, 'AverageHeartRateBpm') ?? '', 'Value'));
      if (avg) { hrW += avg * secs; hrT += secs; }
      hrMax = Math.max(hrMax, num(tag(tag(head, 'MaximumHeartRateBpm') ?? '', 'Value')) ?? 0);
    }
    let last = -Infinity;
    for (const t of tagAll(body, 'Time')) { const x = Date.parse(t); if (Number.isFinite(x)) last = Math.max(last, x); }
    if (!Number.isFinite(start)) continue;
    const end = Math.max(start + timer * 1000, last);
    if (!(end > start)) continue;
    found = true;
    acc.workout({
      startMs: start, source: 'gpx', originApp: creator, type: words(sport === 'Other' ? 'Workout' : sport),
      start: new Date(start).toISOString(), end: new Date(end).toISOString(), durationS: Math.round(timer || (end - start) / 1000),
      distanceM: dist > 0 ? Math.round(dist) : undefined, kcal: kcal > 0 ? Math.round(kcal) : undefined,
      avgHr: hrT ? Math.round(hrW / hrT) : undefined, maxHr: hrMax || undefined,
    }, 'tcx');
  }
  found ? acc.files++ : acc.skipped++;
}

// ---------- FIT ----------

export const isFit = (b: Uint8Array) => isFitHeader(b);

function fitInto(bytes: Uint8Array, acc: Acc) {
  let found = false;
  const m = (() => { try { return decodeFit(bytes); } catch { return null; } })();
  if (m) {
    const product = m.productName ?? (m.manufacturer === 1 ? 'Garmin' : undefined);
    for (const s of m.sessions) {
      const start = s.start;
      const elapsed = s.elapsedS ?? 0;
      const timer = s.timerS ?? elapsed;
      if (start === undefined || !(elapsed > 0 || timer > 0)) continue;
      const sport = s.sport ?? 'generic';
      const sub = s.subSport;
      found = true;
      acc.workout({
        startMs: start, source: 'fit', originApp: product, type: sport === 'generic' ? words(sub ?? 'Workout') : words(sub && sport === 'training' ? sub : sport),
        start: new Date(start).toISOString(), end: new Date(start + Math.max(elapsed, timer) * 1000).toISOString(), durationS: Math.round(timer || elapsed),
        kcal: s.kcal || undefined, distanceM: s.distanceM ? Math.round(s.distanceM) : undefined, avgHr: s.avgHr || undefined, maxHr: s.maxHr || undefined,
      }, 'fit');
    }
    // Wellness and scale files from the Garmin export.
    for (const h of m.restingHr) { found = true; acc.put(localDay(h.t), GARMIN, (d) => { d.restingHr = h.bpm; }); }
    for (const w of m.weights) if (w.kg > 20 && w.kg < 400) { found = true; acc.put(localDay(w.t), GARMIN, (d) => { d.weightKg = r1(w.kg); }); }
    for (const h of m.hrv) { found = true; acc.put(localDay(h.t), GARMIN, (d) => { d.hrvMs = r1(h.ms); }); }
  }
  found ? acc.files++ : acc.skipped++;
}

// ---------- Fitbit Takeout and Garmin export JSON / CSV ----------

const base = (path: string) => path.split('/').pop() ?? path;
const fileDate = (path: string) => /(\d{4}-\d{2}-\d{2})/.exec(base(path))?.[1];

// Takeout minute series come one file per month, named by their first day: skip whole files we would drop anyway.
const tooOld = (path: string, acc: Acc) => {
  const d = fileDate(path);
  return !!d && Date.parse(d + 'T00:00:00Z') + 32 * 86400000 < Date.parse(acc.since + 'T00:00:00Z');
};

type J = Record<string, any>;

function jsonInto(path: string, text: string, acc: Acc) {
  const name = base(path).toLowerCase();
  let data: unknown;
  try { data = JSON.parse(text); } catch { acc.skipped++; return; }
  const rows: J[] = Array.isArray(data) ? data : [];
  let used = true;
  if (/^steps-\d/.test(name)) for (const r of rows) acc.add(day(r.dateTime, true), FITBIT, 'steps', num(r.value));
  else if (/^distance-\d/.test(name)) for (const r of rows) acc.add(day(r.dateTime, true), FITBIT, 'distanceM', (num(r.value) ?? 0) / 100); // centimetres
  else if (/^calories-\d/.test(name)) for (const r of rows) acc.add(day(r.dateTime, true), FITBIT, 'totalKcal', num(r.value));
  else if (/^heart_rate-\d/.test(name)) for (const r of rows) acc.hr(day(r.dateTime, true), FITBIT, num(r.value?.bpm));
  else if (/^resting_heart_rate-\d/.test(name)) {
    for (const r of rows) {
      const v = num(r.value?.value);
      if (v) acc.put(fitbitDay(r.value?.date ?? r.dateTime ?? ''), FITBIT, (d) => { d.restingHr = Math.round(v); });
    }
  } else if (/^sleep-\d/.test(name)) {
    for (const r of rows) {
      const st = r.levels?.summary;
      const stages = st?.deep ? { deep: st.deep.minutes ?? 0, light: st.light?.minutes ?? 0, rem: st.rem?.minutes ?? 0, awake: st.wake?.minutes ?? 0 } : undefined;
      const start = Date.parse(r.startTime);
      const end = Date.parse(r.endTime);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      acc.sleep(r.dateOfSleep ?? localDay(end), FITBIT, { start: new Date(start).toISOString(), end: new Date(end).toISOString(), minutes: Math.round(num(r.minutesAsleep) ?? 0), stages });
    }
  } else if (/^weight-\d/.test(name)) {
    for (const r of rows) { const v = num(r.weight); const d = fitbitDay(r.date ?? ''); if (v && d) acc.fitbitWeights.push({ day: d, v }); }
  } else if (/^exercise-\d/.test(name)) {
    for (const r of rows) {
      const start = fitbitTime(r.startTime ?? '', false);
      const ms = num(r.activeDuration) ?? num(r.duration);
      if (!start || !ms) continue;
      const dist = num(r.distance);
      const unit = String(r.distanceUnit ?? '').toLowerCase();
      acc.workout({
        startMs: start, source: 'takeout', originApp: FITBIT, type: words(r.activityName ?? 'Workout'),
        start: new Date(start).toISOString(), end: new Date(start + (num(r.duration) ?? ms)).toISOString(), durationS: Math.round(ms / 1000),
        kcal: num(r.calories) || undefined, avgHr: num(r.averageHeartRate) || undefined,
        distanceM: dist ? Math.round(dist * (unit.startsWith('mile') ? 1609.344 : unit.startsWith('kilo') ? 1000 : 1)) : undefined,
      }, 'json');
    }
  } else if (/udsfile/.test(name) || rows.some((r) => r?.calendarDate !== undefined && 'totalSteps' in r)) {
    // Garmin export daily summaries.
    for (const r of rows) {
      const d = typeof r.calendarDate === 'string' ? r.calendarDate.slice(0, 10) : r.calendarDate?.date?.slice?.(0, 10);
      acc.put(d, GARMIN, (x) => {
        if (num(r.totalSteps)) x.steps = Math.round(num(r.totalSteps)!);
        if (num(r.totalDistanceMeters)) x.distanceM = Math.round(num(r.totalDistanceMeters)!);
        if (num(r.activeKilocalories)) x.activeKcal = Math.round(num(r.activeKilocalories)!);
        if (num(r.totalKilocalories)) x.totalKcal = Math.round(num(r.totalKilocalories)!);
        if (num(r.restingHeartRate)) x.restingHr = Math.round(num(r.restingHeartRate)!);
      });
    }
  } else if (/sleepdata/.test(name)) {
    const gmt = (s?: string) => (s ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z') : NaN);
    for (const r of rows) {
      const start = gmt(r.sleepStartTimestampGMT);
      const end = gmt(r.sleepEndTimestampGMT);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const m = (k: string) => Math.round((num(r[k]) ?? 0) / 60);
      const stages = { deep: m('deepSleepSeconds'), light: m('lightSleepSeconds'), rem: m('remSleepSeconds'), awake: m('awakeSleepSeconds') };
      const asleep = stages.deep + stages.light + stages.rem;
      acc.sleep(r.calendarDate ?? localDay(end), GARMIN, {
        start: new Date(start).toISOString(), end: new Date(end).toISOString(), minutes: asleep || Math.round((end - start) / 60000), stages: asleep ? stages : undefined,
      });
    }
  } else if (/summarizedactivities/.test(name)) {
    // Garmin export activity list: times in ms, distance in cm. Calories are left out (their unit is not documented);
    // the original .FIT files in the same export fill them in.
    for (const r of rows.flatMap((x) => (Array.isArray(x?.summarizedActivitiesExport) ? x.summarizedActivitiesExport : [x]))) {
      const start = num(r.startTimeGmt);
      const ms = num(r.duration) ?? num(r.elapsedDuration);
      if (!start || !ms) continue;
      acc.workout({
        startMs: start, source: 'fit', originApp: GARMIN, type: words(String(r.activityType ?? r.sportType ?? 'Workout')), title: r.name || undefined,
        start: new Date(start).toISOString(), end: new Date(start + (num(r.elapsedDuration) ?? ms)).toISOString(), durationS: Math.round(ms / 1000),
        distanceM: num(r.distance) ? Math.round(num(r.distance)! / 100) : undefined, avgHr: num(r.avgHr) || undefined, maxHr: num(r.maxHr) || undefined,
      }, 'json');
    }
  } else used = false;
  used ? acc.files++ : acc.skipped++;

  function day(s: unknown, utc: boolean) {
    const t = typeof s === 'string' ? fitbitTime(s, utc) : undefined;
    return t === undefined ? undefined : localDay(t);
  }
}

function csvInto(path: string, text: string, acc: Acc) {
  const rows = csv(text);
  const head = (rows[0] ?? []).map((h) => h.toLowerCase());
  const col = (n: string) => head.indexOf(n);
  const lower = path.toLowerCase();
  const ts = col('timestamp');
  const each = (i: number, put: (d: DailyMetrics, v: number) => void) => {
    for (const r of rows.slice(1)) {
      const v = num(r[i]);
      const t = Date.parse(r[ts]);
      if (v !== undefined && Number.isFinite(t)) acc.put(/^\d{4}-\d{2}-\d{2}$/.test(r[ts]) ? r[ts] : localDay(t), FITBIT, (d) => put(d, v));
    }
  };
  let used = true;
  if (col('weight_unit') >= 0 && rows[1]) acc.fitbitPounds = /us|pound|lb/i.test(rows[1][col('weight_unit')] ?? ''); // Profile.csv
  else if (ts >= 0 && col('rmssd') >= 0) each(col('rmssd'), (d, v) => { if (v > 0) d.hrvMs = r1(v); });
  else if (ts >= 0 && col('daily_respiratory_rate') >= 0) each(col('daily_respiratory_rate'), (d, v) => { if (v > 0) d.respRate = r1(v); });
  else if (ts >= 0 && col('average_value') >= 0 && /spo2|oxygen/.test(lower)) each(col('average_value'), (d, v) => { if (v > 50) d.spo2Pct = r1(v); });
  else if (ts >= 0 && col('steps') >= 0) {
    for (const r of rows.slice(1)) { const t = Date.parse(r[ts]); if (Number.isFinite(t)) acc.add(localDay(t), FITBIT, 'steps', num(r[col('steps')])); }
  } else used = false;
  used ? acc.files++ : acc.skipped++;
}

// ---------- zip ----------

export const isZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const isGzip = (b: Uint8Array) => b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;

type Entry = { name: string; method: number; size: number; csize: number; offset: number };

// Reads the central directory only; each entry is inflated when it is needed, so a large Takeout never sits in memory
// fully unpacked. Handles stored and deflated entries and zip64 sizes.
export function zipEntries(b: Uint8Array): Entry[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (i: number) => v.getUint16(i, true);
  const u32 = (i: number) => v.getUint32(i, true);
  const u64 = (i: number) => u32(i) + u32(i + 4) * 2 ** 32;
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return [];
  let count = u16(eocd + 10);
  let cd = u32(eocd + 16);
  if ((cd === 0xffffffff || count === 0xffff) && eocd >= 20 && u32(eocd - 20) === 0x07064b50) {
    const z = u64(eocd - 12);
    if (u32(z) === 0x06064b50) { count = u64(z + 32); cd = u64(z + 48); }
  }
  const out: Entry[] = [];
  for (let n = 0, p = cd; n < count && p + 46 <= b.length && u32(p) === 0x02014b50; n++) {
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    let csize = u32(p + 20);
    let size = u32(p + 24);
    let offset = u32(p + 42);
    for (let e = p + 46 + nameLen; e + 4 <= p + 46 + nameLen + extraLen; e += 4 + u16(e + 2)) {
      if (u16(e) !== 0x0001) continue;
      let q = e + 4;
      if (size === 0xffffffff) { size = u64(q); q += 8; }
      if (csize === 0xffffffff) { csize = u64(q); q += 8; }
      if (offset === 0xffffffff) offset = u64(q);
    }
    out.push({ name: strFromU8(b.subarray(p + 46, p + 46 + nameLen)), method: u16(p + 10), size, csize, offset });
    p += 46 + nameLen + extraLen + u16(p + 32);
  }
  return out;
}

export function zipRead(b: Uint8Array, e: Entry): Uint8Array | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (e.offset + 30 > b.length || v.getUint32(e.offset, true) !== 0x04034b50) return null;
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const raw = b.subarray(start, start + e.csize);
  if (e.method === 0) return raw;
  if (e.method === 8) return inflateSync(raw, { out: new Uint8Array(e.size) });
  return null;
}

// Which zip entries are worth opening. Everything else (photos, other Google products, logs) is skipped unread.
const WANTED = /\.(fit|gpx|tcx|zip|gz)$|(^|\/)(steps|distance|calories|heart_rate|resting_heart_rate|sleep|weight|exercise)-[\d-]+\.json$|udsfile.*\.json$|sleepdata.*\.json$|summarizedactivities.*\.json$|\.csv$/i;
const CSV_WANTED = /profile\.csv$|heart rate variability|respiratory rate|spo2|oxygen|steps/i;

// ---------- entry point ----------

const newAcc = (o: ImportOptions = {}) => {
  const now = o.now ?? Date.now();
  return new Acc(localDay(now - (o.keepDays ?? KEEP_DAYS) * 86400000), localDay(now));
};

const yieldNow = () => Promise.resolve();

async function one(name: string, b: Uint8Array, acc: Acc, o: ImportOptions, depth: number): Promise<void> {
  const lower = name.toLowerCase();
  if (isZip(b)) {
    if (depth > 2) { acc.skipped++; return; }
    const entries = zipEntries(b).filter((e) => !e.name.endsWith('/') && WANTED.test(e.name) && (!/\.csv$/i.test(e.name) || CSV_WANTED.test(e.name)));
    // Profile and JSON summaries first, then the .FIT files, so their numbers win and Fitbit's weight unit is known.
    const order = (e: Entry) => (/profile\.csv$/i.test(e.name) ? 0 : /\.json$|\.csv$/i.test(e.name) ? 1 : 2);
    entries.sort((a, z) => order(a) - order(z));
    for (const e of entries) {
      if (/\.json$/i.test(e.name) && tooOld(e.name, acc)) continue;
      let data: Uint8Array | null = null;
      try { data = zipRead(b, e); } catch { data = null; }
      if (data) await one(e.name, data, acc, o, depth + 1);
      else acc.skipped++;
      await (o.pause ?? yieldNow)();
    }
    return;
  }
  if (isGzip(b)) {
    let raw: Uint8Array;
    try { raw = gunzipSync(b); } catch { acc.skipped++; return; }
    return one(name.replace(/\.gz$/i, ''), raw, acc, o, depth + 1);
  }
  if (isFit(b) || lower.endsWith('.fit')) { fitInto(b, acc); return; }
  const text = strFromU8(b.subarray(0, Math.min(b.length, 4096)));
  const head = text.replace(/^﻿/, '').trimStart();
  if (lower.endsWith('.gpx') || /<gpx\b/.test(head)) { gpxInto(strFromU8(b), acc); return; }
  if (lower.endsWith('.tcx') || /<TrainingCenterDatabase\b/.test(head)) { tcxInto(strFromU8(b), acc); return; }
  if (lower.endsWith('.json') || head.startsWith('[') || head.startsWith('{')) { jsonInto(name, strFromU8(b), acc); return; }
  if (lower.endsWith('.csv')) { csvInto(name, strFromU8(b), acc); return; }
  acc.skipped++;
}

// Single-format entry points, for callers that already know what they hold.
const single = (f: (acc: Acc) => void, o?: ImportOptions) => { const acc = newAcc(o); f(acc); return acc.result(o?.maxWorkouts ?? MAX_WORKOUTS); };
export const parseGpx = (xml: string, o?: ImportOptions) => single((a) => gpxInto(xml, a), o);
export const parseTcx = (xml: string, o?: ImportOptions) => single((a) => tcxInto(xml, a), o);
export const parseFit = (bytes: Uint8Array, o?: ImportOptions) => single((a) => fitInto(bytes, a), o);
export const parseTakeoutJson = (path: string, text: string, o?: ImportOptions) => single((a) => jsonInto(path, text, a), o);
export const parseTakeoutCsv = (path: string, text: string, o?: ImportOptions) => single((a) => csvInto(path, text, a), o);

// Parses any number of picked files (each may be a zip of many) into tracker rows.
export async function parseFiles(files: { name: string; data: ArrayBuffer | Uint8Array }[], o: ImportOptions = {}): Promise<ImportResult> {
  const acc = newAcc(o);
  for (const f of files) await one(f.name, f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data), acc, o, 0);
  return acc.result(o.maxWorkouts ?? MAX_WORKOUTS);
}

// Drops imported workouts that another source (Health Connect, an earlier import) already has, starting within two
// minutes of each other. Same-id rows are kept so a re-import refreshes them.
export function newWorkouts(existing: Record<string, ImportedWorkout>, incoming: ImportedWorkout[]) {
  const starts = Object.values(existing).map((w) => ({ id: w.id, t: Date.parse(w.start) }));
  return incoming.filter((w) => {
    const t = Date.parse(w.start);
    return !starts.some((x) => x.id !== w.id && Math.abs(x.t - t) <= 120000);
  });
}
