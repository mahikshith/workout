// What one brand's app has shared lately: the metrics present on days its package wrote to Health Connect, and the
// ones its app normally shares that haven't come in. Pure (types only), so it is cheap to call on every render.
import type { DailyMetrics, ImportedWorkout } from '../tracker';
import { NOT_READ, type Guide, type Metric } from './guides';

const FIELD: Record<Exclude<Metric, 'workouts'>, (keyof DailyMetrics)[]> = {
  steps: ['steps'], sleep: ['sleep'], hr: ['avgHr'], rhr: ['restingHr'], hrv: ['hrvMs'], spo2: ['spo2Pct'], resp: ['respRate'],
  kcal: ['activeKcal', 'totalKcal'], weight: ['weightKg'], vo2: ['vo2max'], temp: ['skinTempDelta'],
};

export type BrandStatus = { arrived: Metric[]; missing: Metric[]; days: number; last?: string }; // last: newest day with its data

// The metrics present in a set of day rows and workouts, from any of the given origins (all origins when null).
export function metricsFrom(
  origins: string[] | null, daily: Record<string, DailyMetrics>, workouts: ImportedWorkout[], now = Date.now(), within = 7,
): { arrived: Set<Metric>; days: number; last?: string } {
  const cutoff = new Date(now - within * 86400000).toISOString().slice(0, 10);
  const mine = (o?: string[] | string) => origins === null || (Array.isArray(o) ? o : o ? [o] : []).some((x) => origins.includes(x));
  const rows = Object.values(daily).filter((d) => d.date >= cutoff && mine(d.origin));
  const arrived = new Set<Metric>();
  for (const d of rows) for (const [m, fs] of Object.entries(FIELD) as [Metric, (keyof DailyMetrics)[]][]) if (fs.some((f) => d[f] !== undefined)) arrived.add(m);
  if (workouts.some((w) => w.start.slice(0, 10) >= cutoff && mine(w.originApp))) arrived.add('workouts');
  const last = rows.reduce<string | undefined>((a, d) => (!a || d.date > a ? d.date : a), undefined);
  return { arrived, days: rows.length, last };
}

export function brandStatus(
  g: Guide, daily: Record<string, DailyMetrics>, workouts: Record<string, ImportedWorkout>, merged: Record<string, ImportedWorkout>, now = Date.now(), within = 7,
): BrandStatus {
  const { arrived, days, last } = metricsFrom(g.packages, daily, [...Object.values(workouts), ...Object.values(merged)], now, within);
  // Health Connect rows are per day, not per app, so a day both a watch and another app wrote to holds both. With a
  // known list of what the brand shares, only those count as its own.
  const sure = (g.expects ?? g.shares ?? []).filter((m) => !NOT_READ.includes(m));
  const order = [...sure, ...(g.unsure ?? [])];
  return {
    arrived: order.length ? order.filter((m) => arrived.has(m)) : [...arrived],
    missing: sure.filter((m) => !arrived.has(m)),
    days,
    last,
  };
}
