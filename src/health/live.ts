// Live heart rate from a paired Bluetooth strap or watch broadcast. A tiny module-level emitter: the BLE adapter
// pushes readings in, screens read them with useLiveHr(). Returns null when nothing is streaming (and always on web).
import { useEffect, useState } from 'react';

export type LiveSample = { bpm: number; at: number; contact: boolean | null; rrMs: number[] };
type Listener = (s: LiveSample | null) => void;

const STALE_MS = 5000; // no packet for 5 s means the strap went quiet
let current: LiveSample | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const emit = () => { for (const l of listeners) l(current); };

export function pushLive(s: LiveSample) {
  current = s;
  if (staleTimer) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => { current = null; emit(); }, STALE_MS);
  emit();
}

export function clearLive() {
  if (staleTimer) clearTimeout(staleTimer);
  staleTimer = null;
  current = null;
  emit();
}

export function getLive(): LiveSample | null {
  return current;
}

export function subscribeLive(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useLiveHr(): number | null {
  const [bpm, setBpm] = useState<number | null>(current && current.contact !== false && current.bpm > 0 ? current.bpm : null);
  useEffect(() => subscribeLive((s) => setBpm(s && s.contact !== false && s.bpm > 0 ? s.bpm : null)), []);
  return bpm;
}
