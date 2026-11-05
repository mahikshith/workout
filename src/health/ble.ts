// Bluetooth heart rate: any strap or watch that speaks the standard Heart Rate service (0x180D / 0x2A37). Polar,
// Wahoo, Coospo, Garmin and WHOOP "Broadcast heart rate", PineTime, Bangle.js and most Wear OS broadcaster apps.
// Device-specific protocols plug in later through `HrAdapter`. The native module is required lazily and only on
// Android, so web and iOS builds never load it.
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { useTracker } from '../tracker';
import { clearLive, pushLive } from './live';
import { base64ToBytes, parseHrMeasurement, rmssd, type HrMeasurement } from './parse';

const full = (short: string) => `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
export const HR_SERVICE = full('180d');
export const HR_MEASUREMENT = full('2a37');
// WHOOP 4.0 advertises its own service and may leave 0x180D out of the advert even though it exposes 180D/2A37
// after connecting (no bond needed), so scanning is unfiltered and this UUID or a "WHOOP" name also counts.
const WHOOP_SERVICE = '61080001-8d6d-82b8-614a-1c8cb0f8dcc6';

// --- Device adapters. Each one says which advertisements it recognises and how to read heart rate once connected.
export type ScanInfo = { name: string | null; serviceUUIDs: string[] | null };
export interface HrAdapter {
  id: string;
  label: string;
  matches(d: ScanInfo): boolean;
  service: string;
  characteristic: string;
  parse(bytes: number[]): HrMeasurement | null;
}

export const standardHr: HrAdapter = {
  id: 'gatt-hr',
  label: 'Heart rate',
  matches: (d) => {
    const ids = (d.serviceUUIDs ?? []).map((u) => u.toLowerCase());
    return ids.includes(HR_SERVICE) || ids.includes(WHOOP_SERVICE) || /^whoop/i.test(d.name ?? '');
  },
  service: HR_SERVICE,
  characteristic: HR_MEASUREMENT,
  parse: parseHrMeasurement,
};

const adapters: HrAdapter[] = [standardHr];
export function registerAdapter(a: HrAdapter) {
  if (!adapters.some((x) => x.id === a.id)) adapters.unshift(a);
}
const adapterFor = (d: ScanInfo) => adapters.find((a) => a.matches(d)) ?? null;

// --- State shared with the screen
export type BleStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'no-hr' | 'off' | 'denied' | 'unavailable';
export type Found = { id: string; name: string; rssi: number | null; adapter: string };
type BleState = { status: BleStatus; found: Found[]; deviceId: string | null; error?: string };

let state: BleState = { status: Platform.OS === 'android' ? 'idle' : 'unavailable', found: [], deviceId: null };
const subs = new Set<(s: BleState) => void>();
const set = (patch: Partial<BleState>) => {
  state = { ...state, ...patch };
  for (const l of subs) l(state);
};
export const getBle = () => state;
export function useBle(): BleState {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    setS(state);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}

// --- Native manager, created on first use
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

// Android 12+ asks for Nearby devices (scan + connect); older versions need location for a BLE scan.
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const P = PermissionsAndroid.PERMISSIONS;
  const want = Number(Platform.Version) >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  try {
    const res = await PermissionsAndroid.requestMultiple(want);
    return want.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return false;
  }
}

async function hasBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const P = PermissionsAndroid.PERMISSIONS;
  const want = Number(Platform.Version) >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  try {
    for (const p of want) if (!(await PermissionsAndroid.check(p))) return false;
    return true;
  } catch {
    return false;
  }
}

async function poweredOn(m: BleManager): Promise<boolean> {
  try { return (await m.state()) === 'PoweredOn'; } catch { return false; }
}

// --- Scan
let scanTimer: ReturnType<typeof setTimeout> | null = null;
export async function startScan(seconds = 15): Promise<void> {
  const m = manager();
  if (!m) return set({ status: 'unavailable' });
  if (!(await requestBlePermissions())) return set({ status: 'denied' });
  if (!(await poweredOn(m))) return set({ status: 'off' });
  stopScan();
  set({ status: 'scanning', found: [] });
  const found = new Map<string, Found>();
  // Unfiltered on purpose (see WHOOP note above); we keep only devices an adapter recognises.
  m.startDeviceScan(null, { allowDuplicates: true }, (err, d) => {
    if (err) { set({ status: 'idle', error: err.message }); return; }
    if (!d) return;
    const info = { name: d.name ?? d.localName, serviceUUIDs: d.serviceUUIDs };
    const a = adapterFor(info);
    if (!a) return;
    const prev = found.get(d.id);
    const next = { id: d.id, name: info.name || prev?.name || 'Heart-rate sensor', rssi: d.rssi ?? prev?.rssi ?? null, adapter: a.id };
    if (prev && prev.rssi === next.rssi && prev.name === next.name) return;
    found.set(d.id, next);
    set({ found: [...found.values()].sort((x, y) => (y.rssi ?? -999) - (x.rssi ?? -999)) });
  });
  scanTimer = setTimeout(() => { stopScan(); if (state.status === 'scanning') set({ status: 'idle' }); }, seconds * 1000);
}

export function stopScan() {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = null;
  try { manager()?.stopDeviceScan(); } catch {}
}

// --- Connect and stream
let monitor: Subscription | null = null;
let dropSub: Subscription | null = null;
let userClosed = false;
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// Beat-to-beat intervals collected while a window is open (a workout, or a morning reading).
let rrWindow: number[] | null = null;
const RR_CAP = 20000; // about 4-5 hours of beats

function onPacket(a: HrAdapter, b64: string | null) {
  if (!b64) return;
  const p = a.parse(base64ToBytes(b64));
  if (!p) return;
  pushLive({ bpm: p.bpm, at: Date.now(), contact: p.contact, rrMs: p.rrMs });
  if (rrWindow && p.rrMs.length && p.contact !== false && rrWindow.length < RR_CAP) rrWindow.push(...p.rrMs);
}

function cleanup() {
  monitor?.remove();
  dropSub?.remove();
  monitor = dropSub = null;
  clearLive();
}

export async function connect(id: string, name?: string): Promise<boolean> {
  const m = manager();
  if (!m) { set({ status: 'unavailable' }); return false; }
  stopScan();
  if (retryTimer) clearTimeout(retryTimer);
  userClosed = false;
  cleanup();
  set({ status: 'connecting', deviceId: id, error: undefined });
  let d: Device;
  try {
    d = await m.connectToDevice(id, { timeout: 12000, autoConnect: false });
    d = await d.discoverAllServicesAndCharacteristics();
  } catch (e) {
    set({ status: 'idle', error: (e as Error)?.message });
    scheduleRetry(id, name);
    return false;
  }
  const label = name || d.name || d.localName || 'Heart-rate sensor';
  // After connecting, the real service list decides: no 0x180D usually means the broadcast mode is off.
  const services = (await d.services().catch(() => [])).map((s) => s.uuid.toLowerCase());
  const a = adapters.find((x) => services.includes(x.service.toLowerCase()));
  if (!a) {
    set({ status: 'no-hr', deviceId: id });
    try { await m.cancelDeviceConnection(id); } catch {}
    return false;
  }
  retries = 0;
  dropSub = m.onDeviceDisconnected(id, () => {
    cleanup();
    if (userClosed) return;
    set({ status: 'idle' });
    scheduleRetry(id, label);
  });
  monitor = m.monitorCharacteristicForDevice(id, a.service, a.characteristic, (err, ch) => {
    if (err) return;
    onPacket(a, ch?.value ?? null);
  });
  useTracker.getState().setStrap({ id, name: label, lastConnected: new Date().toISOString() });
  set({ status: 'connected', deviceId: id });
  return true;
}

function scheduleRetry(id: string, name?: string) {
  if (userClosed || retries >= 5 || useTracker.getState().strap?.id !== id) return;
  retries++;
  retryTimer = setTimeout(() => { if (!userClosed && state.status !== 'connected') connect(id, name); }, Math.min(30000, 2000 * 2 ** retries));
}

// Quietly reconnects to the saved strap, without asking for permissions (only if they were granted before).
export async function reconnectSaved(): Promise<void> {
  const strap = useTracker.getState().strap;
  if (!strap || Platform.OS !== 'android' || state.status === 'connected' || state.status === 'connecting') return;
  const m = manager();
  if (!m || !(await hasBlePermissions()) || !(await poweredOn(m))) return;
  retries = 0;
  await connect(strap.id, strap.name);
}

export async function disconnectStrap(): Promise<void> {
  userClosed = true;
  if (retryTimer) clearTimeout(retryTimer);
  const id = state.deviceId;
  cleanup();
  set({ status: Platform.OS === 'android' ? 'idle' : 'unavailable', deviceId: null });
  if (id) try { await manager()?.cancelDeviceConnection(id); } catch {}
}

// Forget: drop the connection and the saved strap.
export async function forgetStrap(): Promise<void> {
  await disconnectStrap();
  useTracker.getState().setStrap(null);
}

// HRV window: open at workout start, close at the end; returns RMSSD (ms) or null if too few clean beats.
export function openRrWindow() {
  rrWindow = [];
}
export function closeRrWindow(): number | null {
  const rr = rrWindow;
  rrWindow = null;
  return rr ? rmssd(rr) : null;
}
