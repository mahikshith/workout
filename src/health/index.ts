// Watch and tracker integration, one entry point. The root layout mounts `useHealthSync()` once.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { dayKey } from '../calc';
import { useStore } from '../store';
import { useTracker } from '../tracker';
import { closeRrWindow, openRrWindow, reconnectSaved } from './ble';
import { sync, writeSession } from './healthConnect';

export * from './ble';
export * from './healthConnect';
export { useLiveHr } from './live';
export { parseHrMeasurement, rmssd } from './parse';

const RESYNC_MS = 30 * 60000; // at most every 30 minutes when the app comes back to the front

// Background glue: syncs Health Connect on launch and on return to the app, writes each finished gym workout back,
// reconnects the saved strap, and turns the strap's beat-to-beat intervals during a workout into an HRV reading.
export function useHealthSync() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const maybeSync = () => {
      const { hc } = useTracker.getState();
      if (hc.connected && (!hc.lastSync || Date.now() - Date.parse(hc.lastSync) > RESYNC_MS)) sync().catch(() => {});
    };
    const boot = setTimeout(() => { maybeSync(); reconnectSaved().catch(() => {}); }, 1500);
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') { maybeSync(); reconnectSaved().catch(() => {}); } });

    // Finished workouts: write back the ones that end while the app is open, and log the strap's HRV for them.
    let prevList = useStore.getState().sessions;
    let prevIds = new Set(prevList.map((s) => s.id));
    let wasActive = !!useStore.getState().active;
    if (wasActive) openRrWindow();
    const unsub = useStore.subscribe((st) => {
      const active = !!st.active;
      if (active && !wasActive) openRrWindow();
      if (!active && wasActive) {
        const ms = closeRrWindow();
        if (ms !== null) useTracker.getState().logStrapHrv(dayKey(), ms);
      }
      wasActive = active;
      if (st.sessions === prevList) return;
      prevList = st.sessions;
      for (const s of st.sessions) if (!prevIds.has(s.id) && s.endedAt) writeSession(s).catch(() => {});
      prevIds = new Set(st.sessions.map((s) => s.id));
    });
    return () => { clearTimeout(boot); app.remove(); unsub(); };
  }, []);
}
