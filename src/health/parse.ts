// Pure parsing for Bluetooth heart rate (GATT Heart Rate Measurement, 0x2A37) and HRV. No React Native imports so
// `scripts/selfcheck.mjs` can run it under plain Node.

export type HrMeasurement = {
  bpm: number;
  contact: boolean | null; // null when the sensor does not report skin contact
  energyKj?: number; // cumulative energy expended
  rrMs: number[]; // beat-to-beat intervals in milliseconds
};

// Flags byte: bit0 HR is uint16, bits1-2 sensor contact (bit2 supported, bit1 detected), bit3 energy expended present,
// bit4 RR intervals present (uint16 each, 1/1024 s). Returns null for a packet too short to hold a heart rate.
export function parseHrMeasurement(bytes: ArrayLike<number>): HrMeasurement | null {
  if (!bytes || bytes.length < 2) return null;
  const u8 = (i: number) => bytes[i] & 0xff;
  const u16 = (i: number) => u8(i) | (u8(i + 1) << 8);
  const flags = u8(0);
  let i = 1;
  let bpm: number;
  if (flags & 0x01) {
    if (bytes.length < 3) return null;
    bpm = u16(i);
    i += 2;
  } else {
    bpm = u8(i);
    i += 1;
  }
  const contact = flags & 0x04 ? !!(flags & 0x02) : null;
  let energyKj: number | undefined;
  if (flags & 0x08) {
    if (i + 1 < bytes.length) energyKj = u16(i);
    i += 2;
  }
  const rrMs: number[] = [];
  if (flags & 0x10) {
    for (; i + 1 < bytes.length; i += 2) rrMs.push(Math.round((u16(i) * 1000) / 1024));
  }
  return { bpm, contact, energyKj, rrMs };
}

// RMSSD of beat-to-beat intervals (ms). Drops implausible beats (outside 300-2000 ms, or jumping more than 25% from the
// previous accepted beat) so a missed or doubled beat does not blow the number up. Needs at least 10 clean intervals.
export function rmssd(rrMs: number[]): number | null {
  const clean: number[] = [];
  for (const rr of rrMs) {
    if (!(rr >= 300 && rr <= 2000)) continue;
    const prev = clean[clean.length - 1];
    if (prev !== undefined && Math.abs(rr - prev) > prev * 0.25) continue;
    clean.push(rr);
  }
  if (clean.length < 10) return null;
  let sum = 0;
  for (let k = 1; k < clean.length; k++) sum += (clean[k] - clean[k - 1]) ** 2;
  return Math.round(Math.sqrt(sum / (clean.length - 1)) * 10) / 10;
}

// Base64 (what react-native-ble-plx hands us) to bytes, without Buffer or atob.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(s: string): number[] {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) continue; // padding, whitespace
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };

export function selfCheck() {
  // 8-bit HR, no contact support: flags 0x00, 72 bpm.
  const a = parseHrMeasurement([0x00, 72]);
  assert(!!a && a.bpm === 72 && a.contact === null && a.rrMs.length === 0, 'hr 8-bit');
  // 16-bit HR with contact supported+detected: flags 0x07, 300 bpm (0x012C).
  const b = parseHrMeasurement([0x07, 0x2c, 0x01]);
  assert(!!b && b.bpm === 300 && b.contact === true, 'hr 16-bit + contact');
  // Contact supported but not detected.
  assert(parseHrMeasurement([0x04, 60])?.contact === false, 'no contact');
  // 8-bit HR + energy (0x0102 = 258 kJ) + two RR: 1024/1024 s = 1000 ms, 512/1024 s = 500 ms. Flags 0x18.
  const d = parseHrMeasurement([0x18, 64, 0x02, 0x01, 0x00, 0x04, 0x00, 0x02]);
  assert(!!d && d.bpm === 64 && d.energyKj === 258 && d.rrMs.join() === '1000,500', 'energy + rr');
  // RR only (flags 0x10), one interval of 819/1024 s = 800 ms.
  assert(parseHrMeasurement([0x10, 75, 0x33, 0x03])?.rrMs.join() === '800', 'rr only');
  assert(parseHrMeasurement([0x01, 70]) === null && parseHrMeasurement([]) === null, 'short packets');
  // RMSSD: alternating 800/850 gives successive differences of 50, so RMSSD is 50.
  assert(rmssd([800, 850, 800, 850, 800, 850, 800, 850, 800, 850, 800]) === 50, 'rmssd alternating');
  assert(rmssd([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]) === 0, 'rmssd flat');
  // A missed beat (2000) and an artefact (200) are dropped.
  assert(rmssd([800, 850, 800, 2000, 850, 200, 800, 850, 800, 850, 800, 850, 800]) === 50, 'rmssd artefacts');
  assert(rmssd([800, 850]) === null, 'rmssd needs data');
  assert(base64ToBytes('EEAzAw==').join() === '16,64,51,3', 'base64');
}
