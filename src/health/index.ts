// Watch and tracker integration, one entry point. The root layout mounts `useHealthSync()` once.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { dayKey } from '../calc';
import { useStore, type Session } from '../store';
import { STRAP_ORIGIN, useTracker } from '../tracker';
import { closeRrWindow, openRrWindow, reconnectSaved } from './ble';
import { reconnectRing } from './colmiDevice';
import { deleteSessionRecord, linkWorkouts, readSessionHr, readSessionKcal, sync, writeSession } from './healthConnect';
import { subscribeLive } from './live';
import { finishedTimes, splitHr, trackDone, type HrSample } from './parse';

export * from './ble';
export * from './healthConnect';
export { useLiveHr } from './live';
export { parseHrMeasurement, rmssd } from './parse';

const RESYNC_MS = 30 * 60000; // at most every 30 minutes when the app comes back to the front
const HR_WINDOW_MS = 24 * 3600000; // watches (Garmin, Fitbit) can sync hours late: keep re-reading a workout's HR for a day
const HR_RETRY_MS = 5 * 60000; // and at most every 5 minutes, only when the app comes to the front

const hrTried = new Map<string, number>();
// Re-reads per-set heart rate and the watch's calories for workouts that ended in the last 24 hours. `now` skips the wait for one session.
function refreshHr(now?: string) {
  if (!useTracker.getState().hc.connected) return;
  const t = Date.now();
  for (const s of useStore.getState().sessions) {
    if (!s.endedAt || t - s.endedAt > HR_WINDOW_MS) continue;
    if (s.id !== now && t - (hrTried.get(s.id) ?? 0) < HR_RETRY_MS) continue;
    hrTried.set(s.id, t);
    readSessionHr(s).catch(() => {});
    readSessionKcal(s).catch(() => {});
  }
}

// Heart rate from a strap, ring or watch broadcast while a workout runs: one reading every 5 seconds, kept in memory
// and turned into the workout's heart rate (per set too) when it finishes. Health Connect's own reading replaces it
// later if the watch shares one. Lost if the app is closed mid-workout.
const STRAP_STEP_MS = 5000;
let strapLog: { id: string; xs: HrSample[] } | null = null;
function logStrap(bpm: number, at: number) {
  const a = useStore.getState().active;
  if (!a || !a.running || a.pausedAt) return;
  if (strapLog?.id !== a.id) strapLog = { id: a.id, xs: [] };
  const last = strapLog.xs[strapLog.xs.length - 1];
  if (!last || at - last.t >= STRAP_STEP_MS) strapLog.xs.push({ t: at, bpm });
}
function saveStrapHr(s: Session, times?: number[][]) {
  const log = strapLog;
  strapLog = null;
  if (!log || log.id !== s.id || !s.endedAt || log.xs.length < 12) return; // under a minute of readings says nothing
  const start = Math.min(s.startedAt, log.xs[0].t);
  const split = splitHr(log.xs, start, s.endedAt, times);
  if (!split) return;
  useTracker.getState().putSessionHr(s.id, { avg: split.avg, max: split.max, sets: split.sets, rest: split.rest, sparse: split.sparse || undefined, origin: STRAP_ORIGIN, readAt: new Date().toISOString() });
}

const sameTimes = (a?: number[][], b?: number[][]) => !!a && !!b && a.length === b.length && a.every((r, i) => r.length === b[i].length && r.every((x, j) => x === b[i][j]));

// Background glue: syncs Health Connect on launch and on return to the app, writes each finished gym workout back
// (and again after an edit), deletes our record when a workout is deleted, reads per-set heart rate after a workout,
// records a strap's heart rate during a workout, reconnects the saved strap, and turns the strap's beat-to-beat intervals during a workout into an HRV reading.
// Sets carry no timestamp, so this also records when each set is ticked (tracker setTimes), on every platform.
export function useHealthSync() {
  useEffect(() => {
    const ANDROID = Platform.OS === 'android';
    const maybeSync = () => {
      const { hc } = useTracker.getState();
      if (hc.connected && (!hc.lastSync || Date.now() - Date.parse(hc.lastSync) > RESYNC_MS)) sync().catch(() => {});
    };
    const front = () => { maybeSync(); refreshHr(); reconnectSaved().catch(() => {}); reconnectRing().catch(() => {}); };
    const boot = ANDROID ? setTimeout(front, 1500) : undefined;
    const app = ANDROID ? AppState.addEventListener('change', (s) => { if (s === 'active') front(); }) : undefined;

    let wasActive = !!useStore.getState().active;
    if (ANDROID && wasActive) openRrWindow();
    const unsub = useStore.subscribe((st, prev) => {
      const tr = useTracker.getState();
      // Set done times, in the running workout's layout.
      const a = st.active;
      if (a && a.items !== prev.active?.items) {
        const old = tr.setTimes[a.id];
        // A different workout before (or the app just loaded it): carry what is saved, never stamp old sets with now.
        const next = trackDone(prev.active?.id === a.id ? prev.active.items : a.items, a.items, old, Date.now());
        if (!sameTimes(next, old)) tr.setSetTimes(a.id, next);
      }

      const active = !!a;
      // Workout started: open the HRV window and bring the saved strap or watch broadcast back if it dropped.
      if (ANDROID && active && !wasActive) { openRrWindow(); reconnectSaved().catch(() => {}); }
      if (!active && wasActive && ANDROID) {
        const ms = closeRrWindow();
        if (ms !== null) tr.logStrapHrv(dayKey(), ms);
      }
      wasActive = active;

      if (st.sessions === prev.sessions) {
        if (prev.active && !a && tr.setTimes[prev.active.id]) tr.forgetSession(prev.active.id); // discarded
        return;
      }
      const before = new Map(prev.sessions.map((s) => [s.id, s]));
      const now = new Set(st.sessions.map((s) => s.id));
      for (const s of st.sessions) {
        const old = before.get(s.id);
        // Just finished (not imported from another app's history): turn its set times into the saved layout, write it
        // back and read its HR.
        const was = prev.active?.id === s.id ? prev.active : undefined;
        if (!old && was && s.endedAt) {
          const times = tr.setTimes[s.id];
          const saved = times ? finishedTimes(was.items, times) : undefined;
          if (saved) tr.setSetTimes(s.id, saved);
          saveStrapHr(s, saved);
          if (ANDROID) {
            writeSession(s).catch(() => {});
            refreshHr(s.id);
          }
        } else if (old && old !== s && s.endedAt && s.id in tr.hcWritten && ANDROID) {
          writeSession(s).catch(() => {}); // edited: same record, next version
        }
      }
      // Deleted: remove our Health Connect record first (it needs the written mark), then the extras. Only for a single
      // delete from History; a reset or a restored backup drops many at once and leaves Health Connect alone.
      const gone = [...before.keys()].filter((id) => !now.has(id));
      for (const id of gone) {
        const done = () => useTracker.getState().forgetSession(id);
        if (ANDROID && gone.length === 1) deleteSessionRecord(id).catch(() => false).finally(done);
        else done();
      }
      linkWorkouts();
    });
    // New imported workouts (sync or a file) that duplicate one of our sessions are merged into it.
    const unsubLive = subscribeLive((x) => { if (x && x.contact !== false && x.bpm > 0) logStrap(x.bpm, x.at); });
    const unsubTracker = useTracker.subscribe((st, prev) => { if (st.workouts !== prev.workouts) linkWorkouts(); });
    return () => { if (boot) clearTimeout(boot); app?.remove(); unsub(); unsubLive(); unsubTracker(); };
  }, []);
}
