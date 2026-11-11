// Readiness and effort from watch data, in our own words and with our own formulas (no vendor scores).
//
// Readiness (0-100, each morning): last night's HRV (RMSSD) and resting heart rate against your own 28-day baseline,
// plus last night's sleep length and how regular your sleep times were this week. Each input becomes a z-score
// (how far from your usual, in your usual spread); a weighted sum goes through the normal curve, so a day exactly at
// your baseline scores 50 and one clearly better than usual 80+. HRV is compared on a log scale because it is
// log-normal. Breathing rate well above your usual and low blood oxygen are shown as flags and pull the score down.
// Ideas checked against published sports-science practice and MIT-licensed open-source work (unstrapped,
// geniemax-core): ln-RMSSD z-scores vs a personal baseline, Banister TRIMP for load. No code was copied.
//
// Effort (0-100 per workout and per day): Banister's training impulse (TRIMP) from average heart rate, time and your
// heart-rate reserve, squashed so an easy hour lands near 30 and a very hard one near 90. Workouts without heart rate
// get a small time-based estimate and are marked as estimated.
//
// Pure functions only (no React, no stores), so scripts/selfcheck.mjs can run selfCheck() under Node.
import type { DailyMetrics, SessionHr, SleepNight } from '../tracker';

export type Level = 'high' | 'mid' | 'low';
export type FactorKey = 'hrv' | 'rhr' | 'sleep' | 'regular';
export type Factor = { key: FactorKey; label: string; value: string; vs: string; effect: -1 | 0 | 1 };
export type Readiness = {
  day: string;
  score: number | null; // null while there aren't enough nights to compare against
  level: Level | null;
  nights: number; // nights with HRV or resting HR in the baseline window
  factors: Factor[];
  flags: string[]; // e.g. "Breathing rate is up"
  sleep?: SleepNight;
};

export const BASELINE_DAYS = 28;
export const MIN_NIGHTS = 4; // nights of HRV or resting HR needed before a score shows
export const SLEEP_NEED_MIN = 450; // 7.5 h

const W = { hrv: 0.45, rhr: 0.25, sleep: 0.2, regular: 0.1 };

const pad = (n: number) => String(n).padStart(2, '0');
// 'YYYY-MM-DD' of the local day `n` days before `day`. Noon avoids DST edges.
export const dayBefore = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// Standard normal CDF (Abramowitz-Stegun 7.1.26 erf), good to about 1e-7.
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export type Inputs = { daily: Record<string, DailyMetrics>; strapHrv?: Record<string, number> };

const hrvOf = (i: Inputs, day: string) => i.daily[day]?.hrvMs ?? i.strapHrv?.[day];

// The values of one metric over the `BASELINE_DAYS` before `day` (today never counts toward its own baseline).
function window(i: Inputs, day: string, get: (d: string) => number | undefined): number[] {
  const out: number[] = [];
  for (let k = 1; k <= BASELINE_DAYS; k++) {
    const v = get(dayBefore(day, k));
    if (v !== undefined && Number.isFinite(v) && v > 0) out.push(v);
  }
  return out;
}

const zOf = (x: number, base: number[], floor: number) => clamp((x - mean(base)) / Math.max(sd(base), floor), -3, 3);

// Minutes after 18:00 of a night's middle, so a 23:00-07:00 night and a 01:00-09:00 night compare on one line.
const midOf = (n: SleepNight) => {
  const m = new Date((Date.parse(n.start) + Date.parse(n.end)) / 2);
  return ((m.getHours() - 18 + 24) % 24) * 60 + m.getMinutes();
};

const effectOf = (z: number, sign = 1): -1 | 0 | 1 => (z * sign > 0.5 ? 1 : z * sign < -0.5 ? -1 : 0);
const pct = (x: number, base: number) => `${x >= base ? '+' : '−'}${Math.abs(Math.round((x / base - 1) * 100))}%`;
const hm = (min: number) => { const t = Math.round(min), h = Math.floor(t / 60), m = t % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`; }; // never "0h 10m" or "7h 60m"

export function levelOf(score: number): Level {
  return score >= 67 ? 'high' : score >= 34 ? 'mid' : 'low';
}

export function computeReadiness(i: Inputs, day: string): Readiness {
  const d = i.daily[day];
  const factors: Factor[] = [];
  const flags: string[] = [];
  const terms: { w: number; z: number }[] = [];

  const hrvBase = window(i, day, (x) => hrvOf(i, x));
  const rhrBase = window(i, day, (x) => i.daily[x]?.restingHr);
  const nights = Array.from({ length: BASELINE_DAYS }, (_, k) => dayBefore(day, k + 1)).filter((x) => hrvOf(i, x) !== undefined || i.daily[x]?.restingHr !== undefined).length;

  const hrv = hrvOf(i, day);
  if (hrv !== undefined && hrvBase.length >= MIN_NIGHTS) {
    const z = zOf(Math.log(hrv), hrvBase.map(Math.log), 0.12); // day-to-day ln-RMSSD varies ~10%: a narrower spread overreacts
    terms.push({ w: W.hrv, z });
    const avg = Math.exp(mean(hrvBase.map(Math.log)));
    factors.push({ key: 'hrv', label: 'HRV', value: `${Math.round(hrv)} ms`, vs: `${pct(hrv, avg)} vs usual`, effect: effectOf(z) });
  }
  const rhr = d?.restingHr;
  if (rhr !== undefined && rhrBase.length >= MIN_NIGHTS) {
    const z = zOf(rhr, rhrBase, 2.5);
    terms.push({ w: W.rhr, z: -z });
    const avg = mean(rhrBase);
    const diff = Math.round(rhr - avg);
    factors.push({ key: 'rhr', label: 'Resting HR', value: `${Math.round(rhr)} bpm`, vs: diff === 0 ? 'Same as usual' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} vs usual`, effect: effectOf(-z) });
  }
  const sleep = d?.sleep;
  if (sleep && Number.isFinite(sleep.minutes) && sleep.minutes >= 60) {
    const z = clamp((sleep.minutes - SLEEP_NEED_MIN) / 60, -2, 1);
    terms.push({ w: W.sleep, z });
    factors.push({ key: 'sleep', label: 'Sleep', value: hm(sleep.minutes), vs: sleep.minutes >= SLEEP_NEED_MIN ? 'Enough' : `${hm(SLEEP_NEED_MIN - sleep.minutes)} short`, effect: effectOf(z) });
  }
  // Regular sleep times: spread of the night's middle over the last 7 nights.
  // A night without start/end times (some apps only send a length) can't say when you slept: skip it, never NaN.
  const mids = Array.from({ length: 7 }, (_, k) => i.daily[dayBefore(day, k)]?.sleep)
    .filter((n): n is SleepNight => !!n && n.minutes >= 120 && Number.isFinite(Date.parse(n.start)) && Number.isFinite(Date.parse(n.end)))
    .map(midOf);
  if (mids.length >= 4) {
    const spread = sd(mids);
    const z = clamp((60 - spread) / 45, -2, 1);
    terms.push({ w: W.regular, z });
    factors.push({ key: 'regular', label: 'Sleep times', value: spread < 45 ? 'Regular' : spread < 90 ? 'A bit irregular' : 'Irregular', vs: `±${Math.round(spread)} min`, effect: effectOf(z) });
  }

  // Flags: breathing well above usual (often the first sign of a cold), low blood oxygen.
  let penalty = 0;
  const resp = d?.respRate;
  const respBase = window(i, day, (x) => i.daily[x]?.respRate);
  if (resp !== undefined && respBase.length >= MIN_NIGHTS && resp > mean(respBase) + Math.max(1, 2 * sd(respBase))) {
    flags.push('Breathing rate is up');
    penalty += 8;
  }
  if (d?.spo2Pct !== undefined && d.spo2Pct < 93) {
    flags.push('Blood oxygen is low');
    penalty += 5;
  }

  const core = terms.length && factors.some((f) => f.key === 'hrv' || f.key === 'rhr');
  if (!core) return { day, score: null, level: null, nights, factors, flags, sleep };
  const wsum = terms.reduce((a, t) => a + t.w, 0);
  const z = terms.reduce((a, t) => a + t.w * t.z, 0) / wsum;
  // A gentler curve than the raw normal (z / 1.25) and a floor of 5, so one rough night reads as low, not as zero.
  if (!Number.isFinite(z)) return { day, score: null, level: null, nights, factors, flags, sleep };
  const score = Math.round(clamp(100 * phi(z / 1.25) - penalty, 5, 99));
  return { day, score, level: levelOf(score), nights, factors, flags, sleep };
}

// Readiness for each of the last `n` days ending with `day`, oldest first (null where there's no score).
export function readinessSeries(i: Inputs, day: string, n = 14): (number | null)[] {
  return Array.from({ length: n }, (_, k) => computeReadiness(i, dayBefore(day, n - 1 - k)).score);
}

export const LEVEL_WORD: Record<Level, string> = { high: 'Ready to push', mid: 'Train as planned', low: 'Take it easy' };

// One line of workout advice from today's readiness, or null when there is nothing worth saying.
export function readinessAdvice(r: Readiness | null | undefined): string | null {
  if (!r) return null;
  if (r.flags.includes('Breathing rate is up')) return 'Breathing rate is up: keep it light today';
  if (r.level === 'low') return 'Low readiness: take the easy version';
  if (r.level === 'high') return 'High readiness: a good day for a top set';
  return null;
}

// --- Effort

export const hrMaxFor = (age: number) => Math.round(208 - 0.7 * clamp(age || 30, 12, 90)); // Tanaka

// Banister TRIMP: minutes x heart-rate-reserve fraction x an exponential weighting (steeper for men).
export function trimp(avgHr: number, minutes: number, rest: number, max: number, female = false): number {
  if (!(avgHr > 0) || !(minutes > 0) || max <= rest) return 0;
  const x = clamp((avgHr - rest) / (max - rest), 0, 1);
  return minutes * x * (female ? 0.86 * Math.exp(1.67 * x) : 0.64 * Math.exp(1.92 * x));
}
// No heart rate: a strength session counts as light-moderate work for its length.
export const trimpGuess = (minutes: number) => Math.max(0, minutes) * 0.6;
// 0-100, saturating: an easy hour about 30, a hard hour about 75, two hard hours 90+.
export const effortScore = (t: number) => Math.round(100 * (1 - Math.exp(-t / 120)));

// Heart-rate zones by % of heart-rate reserve: 1 (50-60) ... 5 (90+); 0 below 50%.
export function zoneOf(hr: number, rest: number, max: number): number {
  const x = (hr - rest) / Math.max(1, max - rest);
  return x >= 0.9 ? 5 : x >= 0.8 ? 4 : x >= 0.7 ? 3 : x >= 0.6 ? 2 : x >= 0.5 ? 1 : 0;
}
// Count of sets per zone (index 0-5) from one workout's per-set heart rate.
export function setZones(hr: SessionHr | undefined, rest: number, max: number): number[] {
  const z = [0, 0, 0, 0, 0, 0];
  for (const item of hr?.sets ?? []) for (const s of item) if (s) z[zoneOf(s.avg, rest, max)]++;
  return z;
}

export type EffortItem = { day: string; title: string; minutes: number; trimp: number; estimated: boolean; avgHr?: number };

export type Load = { today: number; week: number[]; acute: number; chronic: number; trend: 'up' | 'down' | 'steady' | null };
// Daily load (TRIMP) for the 28 days ending `day`, and how this week compares with the four-week average.
export function loadOf(items: EffortItem[], day: string): Load {
  const by: Record<string, number> = {};
  for (const it of items) by[it.day] = (by[it.day] ?? 0) + it.trimp;
  const days = Array.from({ length: 28 }, (_, k) => by[dayBefore(day, 27 - k)] ?? 0);
  const acute = mean(days.slice(-7));
  const chronic = mean(days);
  const enough = items.some((it) => it.day <= dayBefore(day, 14));
  const ratio = chronic > 0 ? acute / chronic : 1;
  return {
    today: by[day] ?? 0, week: days.slice(-7), acute, chronic,
    trend: !enough || chronic === 0 ? null : ratio > 1.3 ? 'up' : ratio < 0.7 ? 'down' : 'steady',
  };
}

// --- Self-check (run by scripts/selfcheck.mjs)
export function selfCheck() {
  const assert = (ok: unknown, m: string) => { if (!ok) throw new Error('readiness: ' + m); };
  const today = '2026-11-05';
  const mk = (hrv: number, rhr: number, sleepMin = 470, k = 0) => {
    const d = dayBefore(today, k);
    const end = new Date(`${d}T07:00:00`);
    const start = new Date(end.getTime() - sleepMin * 60000);
    return { date: d, hrvMs: hrv, restingHr: rhr, sleep: { start: start.toISOString(), end: end.toISOString(), minutes: sleepMin } };
  };
  const base: Record<string, DailyMetrics> = {};
  for (let k = 1; k <= 20; k++) base[dayBefore(today, k)] = mk(50 + (k % 3) * 4 - 4, 55 + (k % 2), 470, k);

  assert(Math.abs(phi(0) - 0.5) < 1e-6 && Math.abs(phi(1.96) - 0.975) < 1e-3, 'phi');
  const same = computeReadiness({ daily: { ...base, [today]: mk(50, 55.5) } }, today);
  assert(same.score !== null && same.score >= 40 && same.score <= 65, `baseline day near 50 (got ${same.score})`);
  const good = computeReadiness({ daily: { ...base, [today]: mk(68, 51, 500) } }, today);
  assert(good.level === 'high', `high HRV, low RHR is high (got ${good.score})`);
  const bad = computeReadiness({ daily: { ...base, [today]: mk(34, 62, 300) } }, today);
  assert(bad.level === 'low' && readinessAdvice(bad) === 'Low readiness: take the easy version', `low HRV, high RHR is low (got ${bad.score})`);
  const few: Record<string, DailyMetrics> = { [dayBefore(today, 1)]: mk(50, 55, 470, 1), [today]: mk(60, 52) };
  const warm = computeReadiness({ daily: few }, today);
  assert(warm.score === null && warm.nights === 1, 'warming up: no score before 4 nights');
  // Strap HRV fills in when the watch shares none (e.g. WHOOP): RHR + strap HRV still score.
  const noHrv = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v, hrvMs: undefined }]));
  const strapHrv = Object.fromEntries(Object.keys(base).map((k) => [k, 50]));
  const viaStrap = computeReadiness({ daily: { ...noHrv, [today]: { ...mk(0, 55), hrvMs: undefined } }, strapHrv: { ...strapHrv, [today]: 70 } }, today);
  assert(viaStrap.factors.some((f) => f.key === 'hrv') && (viaStrap.score ?? 0) > 55, 'strap HRV used');
  // Breathing rate well above usual is flagged and lowers the score.
  const resp = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v, respRate: 14 + (k.endsWith('1') ? 0.4 : 0) }]));
  const ill = computeReadiness({ daily: { ...resp, [today]: { ...mk(50, 55.5), respRate: 17.5 } } }, today);
  assert(ill.flags.includes('Breathing rate is up') && (ill.score ?? 99) < (same.score ?? 0), 'breathing flag');
  assert(readinessSeries({ daily: { ...base, [today]: mk(50, 55) } }, today, 7).length === 7, 'series length');
  // A night with only a length (no start/end) never turns the score into NaN.
  const noTimes = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v, sleep: { minutes: 470 } as unknown as SleepNight }]));
  const nt = computeReadiness({ daily: { ...noTimes, [today]: { ...mk(50, 55.5), sleep: { minutes: 470 } as unknown as SleepNight } } }, today);
  assert(nt.score !== null && Number.isFinite(nt.score), `sleep without times scores (got ${nt.score})`);

  // Effort: monotonic in HR and time, zero without HR, saturating.
  const mx = hrMaxFor(30), rest = 55;
  assert(mx === 187, 'Tanaka');
  assert(trimp(150, 60, rest, mx) > trimp(120, 60, rest, mx) && trimp(120, 60, rest, mx) > trimp(120, 30, rest, mx), 'trimp monotonic');
  assert(trimp(0, 60, rest, mx) === 0 && effortScore(0) === 0 && effortScore(10000) === 100, 'effort bounds');
  const easy = effortScore(trimp(115, 60, rest, mx)), hard = effortScore(trimp(160, 60, rest, mx));
  assert(easy >= 20 && easy <= 45 && hard >= 65 && hard <= 90, `effort scale (easy ${easy}, hard ${hard})`);
  assert(zoneOf(rest + 0.95 * (mx - rest), rest, mx) === 5 && zoneOf(rest, rest, mx) === 0, 'zones');
  const L = loadOf([{ day: dayBefore(today, 20), title: 'a', minutes: 60, trimp: 50, estimated: false }, { day: today, title: 'b', minutes: 60, trimp: 200, estimated: false }], today);
  assert(L.today === 200 && L.trend === 'up', 'load trend');
}
