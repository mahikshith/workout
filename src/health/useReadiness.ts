// React hooks over src/health/readiness.ts: today's readiness, the 14-day trend, and workout effort/load. Narrow
// store selectors, memoised, safe on every platform (with no watch data they return empty states, never throw).
import { useMemo } from 'react';
import { dayKey } from '../calc';
import { useStore, type Session } from '../store';
import { c } from '../theme';
import { mergedFor, useTracker, type ImportedWorkout, type SessionHr } from '../tracker';
import {
  computeReadiness, effortScore, hrMaxFor, loadOf, readinessAdvice, readinessSeries, setZones, trimp, trimpGuess,
  type EffortItem, type Level, type Load, type Readiness,
} from './readiness';

export { readinessAdvice, LEVEL_WORD } from './readiness';
export type { Readiness } from './readiness';

export const levelColor = (l: Level | null) => (l === 'high' ? c.ok : l === 'low' ? c.warm : l === 'mid' ? c.blue : c.dim);

// Today's readiness (score null while warming up or without HRV/resting HR).
export function useReadiness(day = dayKey()): Readiness {
  const daily = useTracker((s) => s.daily);
  const strapHrv = useTracker((s) => s.strapHrv);
  return useMemo(() => computeReadiness({ daily, strapHrv }, day), [daily, strapHrv, day]);
}

// One line of advice for the workout screen, or null. Wire-in point for the session/Today screens.
export function useReadinessAdvice(): string | null {
  return readinessAdvice(useReadiness());
}

export function useReadinessTrend(n = 14, day = dayKey()): (number | null)[] {
  const daily = useTracker((s) => s.daily);
  const strapHrv = useTracker((s) => s.strapHrv);
  return useMemo(() => readinessSeries({ daily, strapHrv }, day, n), [daily, strapHrv, day, n]);
}

const minutesOf = (s: Session) => Math.max(0, ((s.endedAt ?? s.startedAt) - s.startedAt) / 60000);

// Effort items for our own finished workouts (their per-set HR if read, else a merged watch workout's average, else a
// time-based guess) plus watch-only workouts from Health Connect or files.
export function effortItems(
  sessions: Session[], sessionHr: Record<string, SessionHr>, workouts: Record<string, ImportedWorkout>, merged: Record<string, ImportedWorkout>,
  rest: number, max: number, female: boolean,
): EffortItem[] {
  const out: EffortItem[] = [];
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const mins = minutesOf(s);
    const avg = sessionHr[s.id]?.avg ?? mergedFor(merged, s.id)?.avgHr;
    const t = avg ? trimp(avg, mins, rest, max, female) : trimpGuess(mins);
    out.push({ day: dayKey(s.startedAt), title: s.title, minutes: Math.round(mins), trimp: t, estimated: !avg, avgHr: avg });
  }
  for (const w of Object.values(workouts)) {
    const mins = w.durationS / 60;
    const t = w.avgHr ? trimp(w.avgHr, mins, rest, max, female) : trimpGuess(mins);
    out.push({ day: dayKey(Date.parse(w.start)), title: w.title || w.type, minutes: Math.round(mins), trimp: t, estimated: !w.avgHr, avgHr: w.avgHr });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

export type Effort = {
  load: Load;
  todayScore: number;
  items: EffortItem[]; // last 28 days
  last?: EffortItem & { score: number; zones: number[] }; // the latest workout, with sets per heart-rate zone
  rest: number;
  max: number;
};

export function useEffort(day = dayKey()): Effort {
  const sessions = useStore((s) => s.sessions);
  const age = useStore((s) => s.profile.age);
  const female = useStore((s) => s.profile.gender === 'female');
  const sessionHr = useTracker((s) => s.sessionHr);
  const workouts = useTracker((s) => s.workouts);
  const merged = useTracker((s) => s.merged);
  const daily = useTracker((s) => s.daily);
  return useMemo(() => {
    const rhrs = Object.values(daily).map((d) => d.restingHr).filter((x): x is number => !!x).slice(-28);
    const rest = rhrs.length ? Math.round(rhrs.reduce((a, b) => a + b, 0) / rhrs.length) : 60;
    const max = hrMaxFor(age);
    const since = new Date(`${day}T12:00:00`).getTime() - 27 * 86400000;
    const items = effortItems(sessions.filter((s) => s.startedAt >= since), sessionHr, workouts, merged, rest, max, female)
      .filter((it) => it.day <= day && it.day >= dayKey(since));
    const load = loadOf(items, day);
    const lastSession = [...sessions].filter((s) => s.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0];
    const lastItem = items[items.length - 1];
    const last = lastItem
      ? { ...lastItem, score: effortScore(lastItem.trimp), zones: lastSession && lastItem.title === lastSession.title ? setZones(sessionHr[lastSession.id], rest, max) : [0, 0, 0, 0, 0, 0] }
      : undefined;
    return { load, todayScore: effortScore(load.today), items, last, rest, max };
  }, [sessions, age, female, sessionHr, workouts, merged, daily, day]);
}
