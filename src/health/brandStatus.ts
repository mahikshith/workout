// What one brand's app has shared lately: the metrics present on days its package wrote to Health Connect, and the
// ones its app normally shares that haven't come in. Pure (types only), so it is cheap to call on every render.
import type { DailyMetrics, ImportedWorkout } from '../tracker';
import type { Guide, Metric } from './guides';

const FIELD: Record<Exclude<Metric, 'workouts'>, keyof DailyMetrics> = {
  steps: 'steps', sleep: 'sleep', hr: 'avgHr', rhr: 'restingHr', hrv: 'hrvMs', spo2: 'spo2Pct', resp: 'respRate',
};

export type BrandStatus = { arrived: Metric[]; missing: Metric[]; days: number };

export function brandStatus(
  g: Guide, daily: Record<string, DailyMetrics>, workouts: Record<string, ImportedWorkout>, merged: Record<string, ImportedWorkout>, now = Date.now(), within = 7,
): BrandStatus {
  const cutoff = new Date(now - within * 86400000).toISOString().slice(0, 10);
  const mine = (o?: string[] | string) => (Array.isArray(o) ? o : o ? [o] : []).some((x) => g.packages.includes(x));
  const rows = Object.values(daily).filter((d) => d.date >= cutoff && mine(d.origin));
  const arrived = new Set<Metric>();
  for (const d of rows) for (const [m, f] of Object.entries(FIELD) as [Metric, keyof DailyMetrics][]) if (d[f] !== undefined) arrived.add(m);
  const recentWorkout = [...Object.values(workouts), ...Object.values(merged)].some((w) => w.start.slice(0, 10) >= cutoff && mine(w.originApp));
  if (recentWorkout) arrived.add('workouts');
  // Health Connect rows are per day, not per app, so a day both a watch and another app wrote to holds both. With a
  // known list of what the brand shares, only those count as its own.
  const order = g.expects ?? [];
  return {
    arrived: order.length ? order.filter((m) => arrived.has(m)) : [...arrived],
    missing: order.filter((m) => !arrived.has(m)),
    days: rows.length,
  };
}
