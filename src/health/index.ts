// Watch and tracker integration, one entry point. The root layout mounts `useHealthSync()` once.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { dayKey } from '../calc';
import { useStore } from '../store';
import { useTracker } from '../tracker';
import { closeRrWindow, openRrWindow, reconnectSaved } from './ble';
import { reconnectRing } from './colmiDevice';
import { deleteSessionRecord, linkWorkouts, readSessionHr, sync, writeSession } from './healthConnect';
import { finishedTimes, trackDone } from './parse';

export * from './ble';
export * from './healthConnect';
export { useLiveHr } from './live';
export { parseHrMeasurement, rmssd } from './parse';

const RESYNC_MS = 30 * 60000; // at most every 30 minutes when the app comes back to the front
const HR_WINDOW_MS = 24 * 3600000; // watches (Garmin, Fitbit) can sync hours late: keep re-reading a workout's HR for a day
const HR_RETRY_MS = 5 * 60000; // and at most every 5 minutes, only when the app comes to the front

const hrTried = new Map<string, number>();
// Re-reads per-set heart rate for workouts that ended in the last 24 hours. `now` skips the wait for one session.
function refreshHr(now?: string) {
  if (!useTracker.getState().hc.connected) return;
  const t = Date.now();
  for (const s of useStore.getState().sessions) {
    if (!s.endedAt || t - s.endedAt > HR_WINDOW_MS) continue;
    if (s.id !== now && t - (hrTried.get(s.id) ?? 0) < HR_RETRY_MS) continue;
    hrTried.set(s.id, t);
    readSessionHr(s).catch(() => {});
  }
}

const sameTimes = (a?: number[][], b?: number[][]) => !!a && !!b && a.length === b.length && a.every((r, i) => r.length === b[i].length && r.every((x, j) => x === b[i][j]));

// Background glue: syncs Health Connect on launch and on return to the app, writes each finished gym workout back
// (and again after an edit), deletes our record when a workout is deleted, reads per-set heart rate after a workout,
// reconnects the saved strap, and turns the strap's beat-to-beat intervals during a workout into an HRV reading.
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
          if (times) tr.setSetTimes(s.id, finishedTimes(was.items, times));
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
    const unsubTracker = useTracker.subscribe((st, prev) => { if (st.workouts !== prev.workouts) linkWorkouts(); });
    return () => { if (boot) clearTimeout(boot); app?.remove(); unsub(); unsubTracker(); };
  }, []);
}
