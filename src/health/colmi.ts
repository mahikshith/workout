// Colmi smart rings (R02-R12, H59, Yawell): the wire protocol, pure and unit-testable. No React Native imports so
// `scripts/selfcheck.mjs` can run it under plain Node.
//
// Written clean-room from public, MIT-licensed documentation: tahnok/colmi_r02_client (README, docs site
// tahnok.github.io/colmi_r02_client and its test fixtures, (c) 2024 Wesley Ellis, MIT) and the command notes at
// colmi.puxtril.com. No code from GPL/AGPL projects (e.g. Gadgetbridge) was used.
//
// Transport: a Nordic-UART-style service. We write 16-byte packets to RX and get 16-byte packets back on TX.
// Packet: [command, 14 bytes payload, checksum]. The checksum is the low byte of the sum of the first 15 bytes.
// (The prose docs say "modulo 255", but the reference implementation and every captured packet use `& 0xff`,
// i.e. modulo 256; e.g. the steps sample below sums to 425 and carries 0xA9 = 169 = 425 & 0xff.)
// A reply reuses the request's command byte; a set top bit (0x80) means the ring rejected that command.

export const COLMI_SERVICE = '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e';
export const COLMI_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // we write here
export const COLMI_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // ring notifies here

// Two GATT layouts. V1 is the Nordic-UART-style service above. Newer firmware also has V2 (UUIDs from the project's
// protocol study). Neither needs bonding. Both carry the same 16-byte V1 command packets.
// TODO: V2's 0xBC "big data v2" channel is not implemented.
export type Layout = { version: 1 | 2; service: string; write: string; notify: string };
export const LAYOUT_V1: Layout = { version: 1, service: COLMI_SERVICE, write: COLMI_RX, notify: COLMI_TX };
export const LAYOUT_V2: Layout = {
  version: 2,
  service: 'de5bf728-d711-4e47-af26-65e3012a5dc7',
  write: 'de5bf72a-d711-4e47-af26-65e3012a5dc7',
  notify: 'de5bf729-d711-4e47-af26-65e3012a5dc7',
};
// Picks the layout from the services the ring exposes after connecting. V1 wins when both are there because the
// public docs and sample packets are all for V1. null means this is not a Colmi ring.
export function pickLayout(serviceUuids: string[]): Layout | null {
  const ids = serviceUuids.map((u) => u.toLowerCase());
  if (ids.includes(LAYOUT_V1.service)) return LAYOUT_V1;
  if (ids.includes(LAYOUT_V2.service)) return LAYOUT_V2;
  return null;
}

// Advertised names: R02_, R03_, R06_, R07_, R09_, R10, R12, H59 (each optionally after "COLMI "), and Yawell R05/R10/R11.
// The model has to be followed by "_", a space or the end of the name, so "R100" or "H590" don't match.
const COLMI_NAME = /^(?:colmi[ _]?)?(?:r0[23679]|r1[02]|h59)(?:[_ ]|$)/i;
const YAWELL_NAME = /^yawell[ _]?r(?:05|10|11)(?:[_ ]|$)/i;
export const isColmiName = (name: string | null | undefined) => !!name && (COLMI_NAME.test(name.trim()) || YAWELL_NAME.test(name.trim()));

export const CMD = {
  setTime: 0x01,
  battery: 0x03,
  hrLog: 0x15, // 21, heart-rate history for one day
  steps: 0x43, // 67, activity detail for one day
  realTime: 0x69, // 105, start/continue a live reading
  realTimeStop: 0x6a, // 106
  // TODO, not implemented: 0x1e realtime HR (a "continue" form is documented, but there are no sample replies),
  // HRV 0x38/0x39 and stress 0x36/0x37. No public MIT-compatible docs or sample packets were found for these.
} as const;

export const READING = { heartRate: 1, spo2: 3 } as const;
const ACTION = { start: 1, pause: 2, continue: 3, stop: 4 } as const;

// --- Packets
export function checksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < Math.min(15, bytes.length); i++) sum += bytes[i] & 0xff;
  return sum & 0xff;
}

export function makePacket(command: number, payload: ArrayLike<number> = []): number[] {
  if (command < 0 || command > 255) throw new Error('bad command');
  if (payload.length > 14) throw new Error('payload too long');
  const p = new Array<number>(16).fill(0);
  p[0] = command;
  for (let i = 0; i < payload.length; i++) p[i + 1] = payload[i] & 0xff;
  p[15] = checksum(p);
  return p;
}

// A reply worth parsing: 16 bytes with a valid checksum.
export const isValidPacket = (p: ArrayLike<number>) => !!p && p.length === 16 && checksum(p) === (p[15] & 0xff);
// The ring sets the top bit of the command byte when a request failed.
export const isErrorPacket = (p: ArrayLike<number>) => (p[0] & 0x80) !== 0;

export const toBcd = (n: number) => {
  if (n < 0 || n > 99) throw new Error('bcd range');
  return (Math.floor(n / 10) << 4) | n % 10;
};
export const fromBcd = (b: number) => ((b >> 4) & 0x0f) * 10 + (b & 0x0f);

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// --- Set time. We keep the ring on the phone's local wall-clock time, so the ring's "today" and its 15-minute
// step slots line up with the user's day (the heart-rate history request is also documented as local time).
// `utc` exists for tests against the reference fixture, which sets UTC.
export function setTimePacket(d: Date, utc = false): number[] {
  const y = utc ? d.getUTCFullYear() : d.getFullYear();
  if (y < 2000 || y > 2099) throw new Error('year range');
  const parts = utc
    ? [y % 100, d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    : [y % 100, d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
  return makePacket(CMD.setTime, [...parts.map(toBcd), 1 /* language: English */]);
}

// --- Battery
export const batteryPacket = () => makePacket(CMD.battery);
export type Battery = { level: number; charging: boolean };
export function parseBattery(p: ArrayLike<number>): Battery | null {
  if (!p || p.length < 3 || p[0] !== CMD.battery) return null;
  return { level: Math.min(100, p[1] & 0xff), charging: (p[2] & 0xff) !== 0 };
}

// --- Real-time heart rate and SpO2. Start, then send "continue" every few seconds to keep it running, then stop.
export type ReadingKind = (typeof READING)[keyof typeof READING];
export const realTimeStartPacket = (kind: ReadingKind) => makePacket(CMD.realTime, [kind, ACTION.start]);
export const realTimeContinuePacket = (kind: ReadingKind) => makePacket(CMD.realTime, [kind, ACTION.continue]);
export const realTimeStopPacket = (kind: ReadingKind) => makePacket(CMD.realTimeStop, [kind, 0, 0]);
export type RealTime = { kind: number; value: number; error: number };
// value 0 with no error means "still measuring"; a non-zero error means the ring gave up (usually not worn).
export function parseRealTime(p: ArrayLike<number>): RealTime | null {
  if (!p || p.length < 4 || p[0] !== CMD.realTime) return null;
  return { kind: p[1] & 0xff, error: p[2] & 0xff, value: p[3] & 0xff };
}

// --- Steps / activity detail for one day. `dayOffset` 0 is today on the ring's clock, 1 yesterday, and so on.
// The four trailing bytes are constants seen in the official app's requests.
export const stepsPacket = (dayOffset = 0) => makePacket(CMD.steps, [dayOffset & 0xff, 0x0f, 0x00, 0x5f, 0x01]);

export type StepSlot = { date: string; slot: number; steps: number; distanceM: number; calories: number }; // slot = 15-min index
// Reply: an optional header (byte1 0xF0, byte3 1 = calories in units of 10), then one packet per 15-minute slot:
// [0x43, yy, mm, dd (BCD), slot, index, count, cal lo, cal hi, steps lo, steps hi, dist lo, dist hi, ...].
// The last packet has index === count - 1. byte1 0xFF on the first packet means no data for that day.
export class StepsParser {
  private calX10 = false;
  private seen = 0;
  private slots: StepSlot[] = [];
  reset() { this.calX10 = false; this.seen = 0; this.slots = []; }
  // Returns null while more packets are expected, 'none' for no data, or the finished list.
  push(p: ArrayLike<number>): StepSlot[] | 'none' | null {
    if (!p || p.length < 13 || p[0] !== CMD.steps) return null;
    if (this.seen === 0 && p[1] === 0xff) { this.reset(); return 'none'; }
    if (this.seen === 0 && p[1] === 0xf0) { this.calX10 = p[3] === 1; this.seen++; return null; }
    const u16 = (i: number) => (p[i] & 0xff) | ((p[i + 1] & 0xff) << 8);
    this.slots.push({
      date: isoDay(2000 + fromBcd(p[1]), fromBcd(p[2]), fromBcd(p[3])),
      slot: p[4] & 0xff,
      calories: u16(7) * (this.calX10 ? 10 : 1),
      steps: u16(9),
      distanceM: u16(11),
    });
    this.seen++;
    if ((p[5] & 0xff) === (p[6] & 0xff) - 1) { const out = this.slots; this.reset(); return out; }
    return null;
  }
  partial(): StepSlot[] { return this.slots.slice(); }
}

export type DaySteps = { date: string; steps: number; distanceM: number; activeKcal: number };
// Totals per day. Calories come in small calories (cal), so kcal = cal / 1000.
export function sumSteps(slots: StepSlot[]): DaySteps[] {
  const by = new Map<string, DaySteps & { cal: number }>();
  for (const s of slots) {
    const d = by.get(s.date) ?? { date: s.date, steps: 0, distanceM: 0, activeKcal: 0, cal: 0 };
    d.steps += s.steps;
    d.distanceM += s.distanceM;
    d.cal += s.calories;
    by.set(s.date, d);
  }
  return [...by.values()].map(({ cal, ...d }) => ({ ...d, activeKcal: Math.round(cal / 1000) }));
}

// --- Heart-rate history for one day. The request carries that day's midnight as "local seconds" (Unix seconds
// shifted by the time-zone offset), little-endian uint32.
export function localMidnightSeconds(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 1000;
}
export function hrLogPacket(midnightLocalSec: number): number[] {
  const t = midnightLocalSec >>> 0;
  return makePacket(CMD.hrLog, [t & 0xff, (t >>> 8) & 0xff, (t >>> 16) & 0xff, (t >>> 24) & 0xff]);
}

export type HrLog = { date: string; start: number; intervalMin: number; bpm: number[] }; // start in local seconds; 0 = no reading
// Reply: sub 0 = [0x15, 0, packetCount, intervalMin]; sub 1 = [0x15, 1, ts(4, LE), 9 readings];
// sub 2..count-1 = [0x15, n, 13 readings]. sub 0xFF = no data.
export class HrLogParser {
  private size = 0;
  private interval = 5;
  private start: number | null = null;
  private raw: number[] = [];
  reset() { this.size = 0; this.interval = 5; this.start = null; this.raw = []; }
  push(p: ArrayLike<number>): HrLog | 'none' | null {
    if (!p || p.length < 15 || p[0] !== CMD.hrLog) return null;
    const sub = p[1] & 0xff;
    if (sub === 0xff) { this.reset(); return 'none'; }
    if (sub === 0) {
      this.reset();
      this.size = p[2] & 0xff;
      this.interval = (p[3] & 0xff) || 5;
      if (this.size === 0) return 'none';
      return null;
    }
    if (sub === 1) {
      this.start = ((p[2] & 0xff) | ((p[3] & 0xff) << 8) | ((p[4] & 0xff) << 16) | ((p[5] & 0xff) << 24)) >>> 0;
      for (let i = 6; i < 15; i++) this.raw[i - 6] = p[i] & 0xff;
    } else {
      const at = 9 + (sub - 2) * 13;
      for (let i = 2; i < 15; i++) this.raw[at + i - 2] = p[i] & 0xff;
    }
    if (this.size && sub === this.size - 1) { const out = this.result(); this.reset(); return out; }
    return null;
  }
  // What has arrived so far (used if the ring stops sending before the last packet).
  result(): HrLog | null {
    if (this.start === null) return null;
    const slots = Math.floor(1440 / this.interval);
    const bpm = Array.from({ length: slots }, (_, i) => this.raw[i] ?? 0);
    const d = new Date(this.start * 1000);
    return { date: isoDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), start: this.start, intervalMin: this.interval, bpm };
  }
}

// Average, min and max of the real readings. `untilMinute` drops slots in the future (today's log can hold
// stale bytes there).
export function summariseHr(log: HrLog, untilMinute = 1440): { avg: number; min: number; max: number; count: number } | null {
  const vals = log.bpm.filter((v, i) => v >= 30 && v <= 220 && i * log.intervalMin < untilMinute);
  if (!vals.length) return null;
  return {
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    min: Math.min(...vals),
    max: Math.max(...vals),
    count: vals.length,
  };
}

// --- base64 for the BLE bridge (writes)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] & 0xff, b = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0, c = i + 2 < bytes.length ? bytes[i + 2] & 0xff : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

// --- Self-checks with packets from the colmi_r02_client docs and test fixtures (MIT).
function assert(ok: boolean, msg: string) {
  if (!ok) throw new Error('colmi selfcheck failed: ' + msg);
}
const bin = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0)); // Python bytes literal (latin-1) to numbers

export function selfCheck() {
  // Checksum: documented sample.
  assert(checksum(bin('\x15\x00\x18\x05\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')) === 0x32, 'checksum sample');
  // Low byte, not modulo 255: the steps packet sums to 425 and carries 0xA9.
  const stepPkt = bin('C#\x08\x13\x10\x00\x05\xc8\x000\x00\x1b\x00\x00\x00\xa9');
  assert(isValidPacket(stepPkt) && checksum(stepPkt) === 0xa9, 'checksum low byte');
  assert(!isValidPacket(bin('\x03@\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00D')), 'bad checksum');
  assert(isErrorPacket([0x83]) && !isErrorPacket([0x03]), 'error bit');

  // Packet building.
  const bat = batteryPacket();
  assert(bat.length === 16 && bat[0] === 3 && bat[15] === 3 && bat.slice(1, 15).every((x) => x === 0), 'battery packet');
  const p = makePacket(1, [1, 2, 3]);
  assert(p.slice(0, 4).join() === '1,1,2,3' && p[15] === 7, 'make packet payload');
  let threw = false;
  try { makePacket(1, new Array(15).fill(0)); } catch { threw = true; }
  assert(threw, 'payload too long');
  assert(toBcd(0) === 0 && toBcd(10) === 0x10 && toBcd(99) === 0x99 && fromBcd(0x24) === 24, 'bcd');

  // Set time: 2024-01-01 00:00:00 UTC.
  assert(setTimePacket(new Date(Date.UTC(2024, 0, 1)), true).join() === bin('\x01$\x01\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00(').join(), 'set time');
  // Fixture for 2024-01-01 00:00 at UTC-4, which the reference writes as 04:00 UTC.
  assert(setTimePacket(new Date(Date.UTC(2024, 0, 1, 4)), true).join() === bin('\x01$\x01\x01\x04\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00,').join(), 'set time tz');

  // Battery: 64 %, not charging.
  const b = parseBattery(bin('\x03@\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00C'));
  assert(!!b && b.level === 64 && !b.charging, 'battery parse');

  // Real time: packet shapes and checksums, then a heart-rate reading of 78 and an error reply.
  const rs = realTimeStartPacket(READING.heartRate);
  assert(rs[0] === 105 && rs[1] === 1 && rs[2] === 1 && rs[15] === 107, 'rt start');
  const rc = realTimeContinuePacket(READING.spo2);
  assert(rc[1] === 3 && rc[2] === 3 && rc[15] === 111, 'rt continue');
  const rx = realTimeStopPacket(READING.heartRate);
  assert(rx[0] === 106 && rx[1] === 1 && rx[2] === 0 && rx[15] === 107, 'rt stop');
  const hr = parseRealTime(bin('i\x01\x00N\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xb8'));
  assert(!!hr && hr.kind === 1 && hr.error === 0 && hr.value === 78, 'rt hr');
  const err = parseRealTime(bin('i\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00k'));
  assert(!!err && err.error === 1, 'rt error');

  // Steps request for today.
  const sp = stepsPacket(0);
  assert(sp.slice(0, 6).join() === '67,0,15,0,95,1' && isValidPacket(sp), 'steps packet');
  // Steps: single slot (header says calories x10).
  const s1 = new StepsParser();
  assert(s1.push(bin('C\xf0\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x005')) === null, 'steps header');
  const r1 = s1.push(bin('C$\x10\x15\\\x00\x01y\x00\x15\x00\x10\x00\x00\x00\x87'));
  assert(Array.isArray(r1) && r1.length === 1 && r1[0].date === '2024-10-15' && r1[0].slot === 92 && r1[0].calories === 1210 && r1[0].steps === 21 && r1[0].distanceM === 16, 'steps single');
  // Steps: five slots on 2023-08-13.
  const multi = [
    'C\xf0\x05\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x009',
    'C#\x08\x13\x10\x00\x05\xc8\x000\x00\x1b\x00\x00\x00\xa9',
    'C#\x08\x13\x14\x01\x05\xb6\x18\xaa\x04i\x03\x00\x00\x83',
    'C#\x08\x13\x18\x02\x058\x04\xe1\x00\x95\x00\x00\x00R',
    'C#\x08\x13\x1c\x03\x05\x05\x02l\x00H\x00\x00\x00`',
    'C#\x08\x13L\x04\x05\xef\x01c\x00D\x00\x00\x00m',
  ].map(bin);
  assert(multi.every(isValidPacket), 'steps checksums');
  const s2 = new StepsParser();
  let r2: ReturnType<StepsParser['push']> = null;
  for (const pk of multi) r2 = s2.push(pk);
  assert(Array.isArray(r2) && r2.length === 5, 'steps multi count');
  const slots = r2 as StepSlot[];
  assert(slots.map((x) => x.steps).join() === '48,1194,225,108,99' && slots.map((x) => x.distanceM).join() === '27,873,149,72,68', 'steps multi values');
  assert(slots.map((x) => x.calories).join() === '2000,63260,10800,5170,4950' && slots[4].slot === 76, 'steps multi calories');
  const tot = sumSteps(slots);
  assert(tot.length === 1 && tot[0].date === '2023-08-13' && tot[0].steps === 1674 && tot[0].distanceM === 1189 && tot[0].activeKcal === 86, 'steps sum');
  assert(new StepsParser().push(bin('C\xff\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00B')) === 'none', 'steps no data');

  // Heart-rate log request for 2024-08-10 (local seconds 1723248000 = 0x66B6AD80).
  const hq = hrLogPacket(1723248000);
  assert(hq.slice(0, 5).join() === '21,128,173,182,102' && isValidPacket(hq), 'hr log packet');
  // Heart-rate log: 24 packets, 5-minute slots, 2024-08-10.
  const subs: Record<number, string> = {
    0: '\x15\x00\x18\x05\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x002',
    1: '\x15\x01\x80\xad\xb6f\x00\x00\x00\x00\x00\x00\x00\x00\x00_',
    15: '\x15\x0f\x00\x00Y\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00}',
    16: '\x15\x10\x00k\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x90',
    17: '\x15\x11`\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00k\xf1',
    19: '\x15\x13\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00P\x00\x00x',
    20: '\x15\x14\x00\x00\x00\x00\x00\x00\x00\x00\x00F\x00\x00\x00o',
  };
  const hrPackets = Array.from({ length: 24 }, (_, i) => {
    if (subs[i]) return bin(subs[i]);
    const z = new Array(16).fill(0);
    z[0] = 0x15; z[1] = i; z[15] = (0x15 + i) & 0xff; // empty packets, as in the fixture
    return z;
  });
  assert(hrPackets.every(isValidPacket), 'hr checksums');
  const hp = new HrLogParser();
  let log: ReturnType<HrLogParser['push']> = null;
  hrPackets.forEach((pk, i) => {
    log = hp.push(pk);
    if (i < 23) assert(log === null, 'hr log waits for the last packet');
  });
  const L = log as HrLog | null;
  assert(!!L && L.date === '2024-08-10' && L.start === 1723248000 && L.intervalMin === 5 && L.bpm.length === 288, 'hr log header');
  // Sub n >= 2 starts at slot 9 + (n - 2) * 13, so sub 15 byte 4 is slot 180 (15:00).
  assert([180, 192, 204, 216, 240, 252].map((i) => L!.bpm[i]).join() === '89,107,96,107,80,70', 'hr log slots');
  const sum = summariseHr(L!);
  assert(!!sum && sum.count === 6 && sum.min === 70 && sum.max === 107 && sum.avg === 92, 'hr summary');
  assert(summariseHr(L!, 15 * 60) === null, 'hr summary ignores future slots');
  assert(new HrLogParser().push(bin('\x15\xff\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x14')) === 'none', 'hr no data');

  // Names.
  for (const n of ['R02_341C', 'r03_0a1b', 'R06_AB12', 'COLMI R07_1F2E', 'R07_1F2E', 'R09_C0DE', 'R10_AB12', 'R10', 'COLMI R10 ring', 'R12_9F00', 'H59_1234', 'colmi h59', 'Yawell R05', 'YAWELL_R10_77', 'yawell r11'])
    assert(isColmiName(n), 'name ' + n);
  for (const n of ['Polar H10', 'R100', 'H590_1', 'R04_1234', 'COLMI', 'Yawell R06', 'WHOOP 4C0', '', null, undefined])
    assert(!isColmiName(n), 'not name ' + n);
  // Layout selection after connecting.
  const std = ['00001800-0000-1000-8000-00805f9b34fb', '0000180a-0000-1000-8000-00805f9b34fb'];
  assert(pickLayout([...std, '6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E'])?.version === 1, 'layout v1 (upper case)');
  const v2 = pickLayout([...std, 'DE5BF728-D711-4E47-AF26-65E3012A5DC7']);
  assert(v2?.version === 2 && v2.write === 'de5bf72a-d711-4e47-af26-65e3012a5dc7' && v2.notify === 'de5bf729-d711-4e47-af26-65e3012a5dc7', 'layout v2');
  assert(pickLayout([LAYOUT_V2.service, LAYOUT_V1.service])?.version === 1, 'both layouts prefer v1');
  assert(pickLayout(std) === null && pickLayout([]) === null, 'no layout');
  // base64.
  assert(bytesToBase64([16, 64, 51, 3]) === 'EEAzAw==' && bytesToBase64([1, 2, 3]) === 'AQID' && bytesToBase64([1, 2]) === 'AQI=', 'base64');
}
