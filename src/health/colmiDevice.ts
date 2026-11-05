// Colmi smart ring (R02-R12, H59, Yawell) over Bluetooth: scan, connect, set the clock, battery, today's steps and
// heart-rate log into the tracker store, and live heart rate during workouts. The wire format lives in ./colmi
// (pure). Like ./ble, the native module is required lazily and only on Android, so web and iOS never load it.
// react-native-ble-plx's BleManager is a singleton, so this shares the native manager with the strap adapter.
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager, Subscription } from 'react-native-ble-plx';
import { useStore } from '../store';
import { useTracker, type DailyMetrics } from '../tracker';
import {
  batteryPacket, bytesToBase64, CMD, HrLogParser, hrLogPacket, isColmiName, isErrorPacket,
  isValidPacket, localMidnightSeconds, parseBattery, parseRealTime, READING, realTimeContinuePacket, realTimeStartPacket,
  pickLayout, realTimeStopPacket, setTimePacket, StepsParser, stepsPacket, sumSteps, summariseHr, type Battery, type HrLog, type Layout,
  type StepSlot,
} from './colmi';
import { clearLive, pushLive } from './live';
import { base64ToBytes } from './parse';

// --- State shared with the card
export type RingStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'syncing' | 'off' | 'denied' | 'unavailable';
export type FoundRing = { id: string; name: string; rssi: number | null };
type RingState = { status: RingStatus; found: FoundRing[]; error?: string; live: boolean };

let state: RingState = { status: Platform.OS === 'android' ? 'idle' : 'unavailable', found: [], live: false };
const subs = new Set<(s: RingState) => void>();
const set = (patch: Partial<RingState>) => {
  state = { ...state, ...patch };
  for (const l of subs) l(state);
};
export const getRing = () => state;
export function useRing(): RingState {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    setS(state);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}

// --- Native manager and permissions
let mgr: BleManager | null | undefined;
function manager(): BleManager | null {
  if (mgr !== undefined) return mgr;
  mgr = null;
  if (Platform.OS !== 'android') return mgr;
  try {
    const { BleManager: M } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    mgr = new M();
  } catch {
    mgr = null;
  }
  return mgr;
}

const wanted = () => {
  const P = PermissionsAndroid.PERMISSIONS;
  return Number(Platform.Version) >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
};
async function askPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const want = wanted();
    const res = await PermissionsAndroid.requestMultiple(want);
    return want.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return false;
  }
}
async function hasPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    for (const p of wanted()) if (!(await PermissionsAndroid.check(p))) return false;
    return true;
  } catch {
    return false;
  }
}
async function poweredOn(m: BleManager): Promise<boolean> {
  try { return (await m.state()) === 'PoweredOn'; } catch { return false; }
}

// --- Scan by advertised name (see isColmiName in ./colmi)
let scanTimer: ReturnType<typeof setTimeout> | null = null;
export async function scanRings(seconds = 15): Promise<void> {
  const m = manager();
  if (!m) return set({ status: 'unavailable' });
  if (!(await askPermissions())) return set({ status: 'denied' });
  if (!(await poweredOn(m))) return set({ status: 'off' });
  stopRingScan();
  set({ status: 'scanning', found: [], error: undefined });
  const found = new Map<string, FoundRing>();
  m.startDeviceScan(null, { allowDuplicates: false }, (err, d) => {
    if (err) { set({ status: 'idle', error: err.message }); return; }
    const name = d ? d.name ?? d.localName : null;
    if (!d || !isColmiName(name)) return;
    found.set(d.id, { id: d.id, name: name!, rssi: d.rssi ?? null });
    set({ found: [...found.values()].sort((x, y) => (y.rssi ?? -999) - (x.rssi ?? -999)) });
  });
  scanTimer = setTimeout(() => { stopRingScan(); if (state.status === 'scanning') set({ status: 'idle' }); }, seconds * 1000);
}

export function stopRingScan() {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = null;
  try { manager()?.stopDeviceScan(); } catch {}
}

// --- Packet plumbing: one request at a time; replies are routed to the waiting request by command byte.
type Waiter = { cmd: number; onPacket: (p: number[]) => boolean; onError: (e: Error) => void };
let waiter: Waiter | null = null;
let queue: Promise<unknown> = Promise.resolve();
let deviceId: string | null = null;
let layout: Layout | null = null; // which GATT layout the connected ring exposes
let notifySub: Subscription | null = null;
let dropSub: Subscription | null = null;
let userClosed = false;

function onNotify(b64: string | null | undefined) {
  if (!b64) return;
  const p = base64ToBytes(b64);
  if (!isValidPacket(p)) return;
  if (p[0] === CMD.realTime && live && p[1] === READING.heartRate) { onLivePacket(p); return; }
  if (waiter && isErrorPacket(p) && (p[0] & 0x7f) === waiter.cmd) { waiter.onError(new Error('Ring rejected the request')); return; }
  if (waiter && p[0] === waiter.cmd) waiter.onPacket(p);
}

async function write(bytes: number[]) {
  const m = manager();
  if (!m || !deviceId || !layout) throw new Error('Not connected');
  await m.writeCharacteristicWithoutResponseForDevice(deviceId, layout.service, layout.write, bytesToBase64(bytes));
}

// Sends `packet` and feeds replies with the same command byte to `handle` until it returns a value (or times out,
// in which case `fallback` decides what to return). Requests are serialised.
function request<R>(packet: number[], handle: (p: number[]) => R | null, timeoutMs = 4000, fallback?: () => R | null): Promise<R> {
  const run = () => new Promise<R>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const done = (fn: () => void) => { clearTimeout(timer); waiter = null; fn(); };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const f = fallback?.();
        done(() => (f != null ? resolve(f) : reject(new Error('Ring did not answer'))));
      }, timeoutMs);
    };
    waiter = {
      cmd: packet[0],
      onPacket: (p) => {
        const r = handle(p);
        if (r !== null) { done(() => resolve(r)); return true; }
        arm(); // multi-packet reply: give each packet its own time window
        return false;
      },
      onError: (e) => done(() => reject(e)),
    };
    arm();
    write(packet).catch((e) => done(() => reject(e)));
  });
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

// --- Commands
export async function ringSetTime(now = new Date()): Promise<void> {
  // The reply is a capability list we don't need; wait for it briefly so it doesn't land on the next request.
  await request(setTimePacket(now), () => true, 1500, () => true);
}

export async function ringBattery(): Promise<Battery> {
  const b = await request(batteryPacket(), (p) => parseBattery(p));
  useTracker.getState().setRing({ battery: b.level, charging: b.charging });
  return b;
}

async function ringSteps(dayOffset = 0): Promise<StepSlot[]> {
  const parser = new StepsParser();
  return request<StepSlot[]>(stepsPacket(dayOffset), (p) => {
    const r = parser.push(p);
    return r === 'none' ? [] : r;
  }, 4000, () => parser.partial());
}

async function ringHrLog(day: Date): Promise<HrLog | null> {
  const parser = new HrLogParser();
  const r = await request<HrLog | 'none'>(hrLogPacket(localMidnightSeconds(day)), (p) => parser.push(p), 4000, () => parser.result() ?? 'none');
  return r === 'none' ? null : r;
}

// Live SpO2 spot check (about 30 s, ring must be worn). Saves today's value. Returns null if no reading.
export async function ringSpo2(): Promise<number | null> {
  const seen: number[] = [];
  const v = await request<number>(realTimeStartPacket(READING.spo2), (p) => {
    const r = parseRealTime(p);
    if (!r || r.kind !== READING.spo2) return null;
    if (r.error) return 0;
    if (r.value >= 70 && r.value <= 100) seen.push(r.value);
    return seen.length >= 3 ? Math.max(...seen) : null;
  }, 15000, () => (seen.length ? Math.max(...seen) : 0)).catch(() => 0);
  write(realTimeStopPacket(READING.spo2)).catch(() => {});
  if (!v) return null;
  useTracker.getState().upsertDaily([{ date: localDay(new Date()), spo2Pct: v, origin: ['colmi'] }]);
  return v;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Clock, battery, today's steps and heart-rate log into the tracker. Each part is best-effort.
let syncing = false;
export async function syncRing(): Promise<boolean> {
  if (!deviceId || syncing) return false;
  syncing = true;
  set({ status: 'syncing', error: undefined });
  let ok = false;
  try {
    const now = new Date();
    await ringSetTime(now).catch(() => {});
    await ringBattery().catch(() => {});
    const row: DailyMetrics = { date: localDay(now), origin: ['colmi'] };
    const steps = await ringSteps(0).catch(() => null);
    if (steps) {
      ok = true;
      const today = sumSteps(steps).find((d) => d.date === row.date);
      if (today) Object.assign(row, { steps: today.steps, distanceM: today.distanceM, activeKcal: today.activeKcal });
    }
    const log = await ringHrLog(now).catch(() => undefined);
    if (log !== undefined) ok = true;
    if (log && log.date === row.date) {
      const s = summariseHr(log, now.getHours() * 60 + now.getMinutes() + 1);
      if (s) row.avgHr = s.avg;
    }
    if (ok) {
      useTracker.getState().upsertDaily([row]);
      useTracker.getState().setRing({ lastSync: now.toISOString() });
    }
  } finally {
    syncing = false;
    if (deviceId) set({ status: 'connected' });
  }
  if (!ok) set({ error: 'Sync failed' });
  return ok;
}

// --- Live heart rate: started while a workout runs (or on demand), fed into the same live stream as straps.
let live = false;
let keepAlive: ReturnType<typeof setInterval> | null = null;
function onLivePacket(p: number[]) {
  const r = parseRealTime(p);
  if (!r || r.kind !== READING.heartRate) return;
  if (r.error) { pushLive({ bpm: 0, at: Date.now(), contact: false, rrMs: [] }); return; }
  if (r.value > 0) pushLive({ bpm: r.value, at: Date.now(), contact: true, rrMs: [] });
}
export async function startRingLive(): Promise<void> {
  if (!deviceId || live) return;
  live = true;
  set({ live: true });
  try { await write(realTimeStartPacket(READING.heartRate)); } catch { stopLiveLocal(); return; }
  // The ring stops on its own after a while; "continue" keeps it measuring.
  keepAlive = setInterval(() => { write(realTimeContinuePacket(READING.heartRate)).catch(() => {}); }, 10000);
}
function stopLiveLocal() {
  const was = live;
  live = false;
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
  if (state.live) set({ live: false });
  if (was) clearLive(); // never clears a strap's stream

}
export async function stopRingLive(): Promise<void> {
  if (!live) return;
  stopLiveLocal();
  await write(realTimeStopPacket(READING.heartRate)).catch(() => {});
}

// Follow the workout: live heart rate on while one is active.
let storeUnsub: (() => void) | null = null;
function followWorkouts() {
  storeUnsub?.();
  let was = !!useStore.getState().active;
  if (was) startRingLive().catch(() => {});
  storeUnsub = useStore.subscribe((st) => {
    const now = !!st.active;
    if (now === was) return;
    was = now;
    if (now) startRingLive().catch(() => {});
    else stopRingLive().catch(() => {});
  });
}

// --- Connect
function teardown() {
  stopLiveLocal();
  storeUnsub?.();
  storeUnsub = null;
  notifySub?.remove();
  dropSub?.remove();
  notifySub = dropSub = null;
  if (waiter) waiter.onError(new Error('Disconnected'));
  deviceId = null;
  layout = null;
}

export async function connectRing(id: string, name?: string): Promise<boolean> {
  const m = manager();
  if (!m) { set({ status: 'unavailable' }); return false; }
  stopRingScan();
  teardown();
  userClosed = false;
  set({ status: 'connecting', error: undefined });
  try {
    let d = await m.connectToDevice(id, { timeout: 12000, autoConnect: false });
    d = await d.discoverAllServicesAndCharacteristics();
    const l = pickLayout((await d.services()).map((s) => s.uuid));
    if (!l) throw new Error('Not a Colmi ring');
    deviceId = id;
    layout = l;
    notifySub = m.monitorCharacteristicForDevice(id, l.service, l.notify, (err, ch) => { if (!err) onNotify(ch?.value); });
    dropSub = m.onDeviceDisconnected(id, () => {
      teardown();
      if (!userClosed) set({ status: 'idle' });
    });
    useTracker.getState().setRing({ id, name: name || d.name || d.localName || 'Ring' });
    set({ status: 'connected', found: [] });
    followWorkouts();
    syncRing().catch(() => {});
    return true;
  } catch (e) {
    teardown();
    try { await m.cancelDeviceConnection(id); } catch {}
    set({ status: 'idle', error: (e as Error)?.message || 'Could not connect' });
    return false;
  }
}

// Quietly reconnects to the saved ring (no permission prompts) and syncs. Call on app start or when the card mounts.
export async function reconnectRing(): Promise<void> {
  const ring = useTracker.getState().ring;
  if (!ring || Platform.OS !== 'android' || deviceId || state.status === 'connecting' || state.status === 'scanning') return;
  const m = manager();
  if (!m || !(await hasPermissions()) || !(await poweredOn(m))) return;
  await connectRing(ring.id, ring.name);
}

export async function disconnectRing(): Promise<void> {
  userClosed = true;
  const id = deviceId;
  await stopRingLive();
  teardown();
  set({ status: Platform.OS === 'android' ? 'idle' : 'unavailable' });
  if (id) try { await manager()?.cancelDeviceConnection(id); } catch {}
}

// Forget: drop the connection and the saved ring. The day rows it synced stay.
export async function forgetRing(): Promise<void> {
  await disconnectRing();
  useTracker.getState().setRing(null);
}
