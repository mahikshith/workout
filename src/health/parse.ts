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

// ---------- Heart rate per set (round 11) ----------
// A watch's HR samples for one workout, split across its sets by the time each set was ticked done.

export type HrSample = { t: number; bpm: number }; // epoch ms
export type HrStat = { avg: number; max: number };
export type HrSplit = HrStat & {
  sparse: boolean; // median gap over 20 s: only the session numbers are kept
  sets?: (HrStat | null)[][]; // same shape as the session's items and sets
  rest?: HrStat; // everything outside the set windows
};

export const SPARSE_GAP_MS = 20000;
export const SET_LEAD_MS = 45000; // a set's window opens this long before it was ticked
export const SET_LAG_MS = 15000; // and stays open a little after, because HR peaks just after the effort

const stat = (xs: number[]): HrStat | null =>
  xs.length ? { avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), max: Math.round(Math.max(...xs)) } : null;

export function medianGap(ts: number[]): number {
  if (ts.length < 2) return Infinity;
  const s = [...ts].sort((a, b) => a - b);
  const gaps = s.slice(1).map((t, i) => t - s[i]).sort((a, b) => a - b);
  const m = gaps.length >> 1;
  return gaps.length % 2 ? gaps[m] : (gaps[m - 1] + gaps[m]) / 2;
}

// doneAt[i][j] is when set j of item i was ticked (epoch ms; 0 or missing when unknown). Session numbers use the
// samples between start and end; set windows may reach a little past the end (the read goes to end + 5 min).
export function splitHr(samples: HrSample[], start: number, end: number, doneAt?: number[][]): HrSplit | null {
  const all = samples.filter((x) => Number.isFinite(x.t) && x.bpm > 20 && x.bpm < 250).sort((a, b) => a.t - b.t);
  const inside = all.filter((x) => x.t >= start && x.t <= end);
  const session = stat(inside.map((x) => x.bpm));
  if (!session) return null;
  const sparse = medianGap(inside.map((x) => x.t)) > SPARSE_GAP_MS;
  const marks: { i: number; j: number; t: number }[] = [];
  doneAt?.forEach((row, i) => row?.forEach((t, j) => { if (t > 0) marks.push({ i, j, t }); }));
  if (sparse || !marks.length) return { ...session, sparse };
  marks.sort((a, b) => a.t - b.t);
  const sets: (HrStat | null)[][] = doneAt!.map((row) => (row ?? []).map(() => null));
  const used = new Set<HrSample>();
  let open = start;
  marks.forEach((mk, k) => {
    const from = Math.max(open, mk.t - SET_LEAD_MS);
    const to = Math.max(from, Math.min(mk.t + SET_LAG_MS, marks[k + 1] ? marks[k + 1].t - 1 : Infinity));
    const xs = all.filter((x) => x.t >= from && x.t <= to);
    xs.forEach((x) => used.add(x));
    sets[mk.i][mk.j] = stat(xs.map((x) => x.bpm));
    open = to + 1;
  });
  const rest = stat(inside.filter((x) => !used.has(x)).map((x) => x.bpm)) ?? undefined;
  return { ...session, sparse, sets, rest };
}

// ---------- Set done times ----------
// Sets carry no timestamp, so the tracker keeps one per set, in the same shape as the running workout's items.
type SetLike = { done: boolean };
type ItemLike = { sets: SetLike[] };

// Carries times across a store change. Unchanged sets keep the same object, so they are matched by identity first,
// then by position (an edited set gets a new object). A newly done set gets `now`, an undone one loses its time, and 0
// means done at an unknown time.
export function trackDone(prev: ItemLike[] | undefined, next: ItemLike[], times: number[][] | undefined, now: number): number[][] {
  return next.map((it, i) => {
    const before = prev?.[i]?.sets ?? [];
    const old = times?.[i] ?? [];
    const byRef = new Map(before.map((x, j) => [x, old[j] ?? 0] as const));
    return it.sets.map((x, j) => {
      if (!x.done) return 0;
      if (byRef.has(x)) return byRef.get(x)!; // unchanged (0 stays unknown)
      if (before[j]?.done) return old[j] ?? 0; // edited after it was ticked
      return now;
    });
  });
}

// The running workout's layout to the saved one: finishing keeps only done sets, and drops items with none.
export function finishedTimes(items: ItemLike[], times: number[][]): number[][] {
  return items
    .map((it, i) => it.sets.map((x, j) => (x.done ? times[i]?.[j] ?? 0 : -1)).filter((t) => t >= 0))
    .filter((row) => row.length);
}

// ---------- Health Connect write helpers ----------
// The sets as plain text for the record's notes: one line per exercise.
export function setsText(items: { name: string; timed: boolean; sets: { reps: number; weight: number; done: boolean }[] }[]): string {
  const secs = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} min` : `${n} s`);
  return items
    .map((it) => {
      const sets = it.sets.filter((x) => x.done).map((x) => (it.timed ? secs(x.reps) : x.weight ? `${x.weight} kg × ${x.reps}` : `${x.reps} reps`));
      return sets.length ? `${it.name}: ${sets.join(', ')}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

// A Health Connect ExerciseType key for a cardio-only session, from its exercise names. The item with the most time
// (or reps) wins when the session mixes machines.
export function cardioType(items: { name: string; amount: number }[]): string {
  const key = (n: string) => {
    const s = n.toLowerCase();
    if (/\brow/.test(s)) return 'ROWING_MACHINE';
    if (/elliptical/.test(s)) return 'ELLIPTICAL';
    if (/stair|step mill/.test(s)) return 'STAIR_CLIMBING_MACHINE';
    if (/(run|jog).*treadmill|treadmill.*(run|jog)/.test(s)) return 'RUNNING_TREADMILL';
    if (/run|jog|sprint/.test(s)) return 'RUNNING';
    if (/walk|hik/.test(s)) return /hik|trail/.test(s) ? 'HIKING' : 'WALKING';
    if (/stationary|recumbent|assault|spin/.test(s)) return 'BIKING_STATIONARY';
    if (/bik|bicycl|cycl/.test(s)) return 'BIKING';
    if (/rope/.test(s)) return 'JUMP_ROPE';
    if (/swim/.test(s)) return 'SWIMMING_POOL';
    if (/skat/.test(s)) return 'SKATING';
    return 'HIGH_INTENSITY_INTERVAL_TRAINING';
  };
  const best = [...items].sort((a, b) => b.amount - a.amount)[0];
  return best ? key(best.name) : 'OTHER_WORKOUT';
}

// ---------- Merging a watch's own gym session into ours ----------
export const isStrengthType = (type: string) => /strength|weight|lifting|calisthenic|cross ?(training|fit)|gym|^workout$|^other/i.test(type.trim());

// Share of the shorter of two time ranges that both cover (0..1).
export function overlapShare(a0: number, a1: number, b0: number, b1: number): number {
  const both = Math.min(a1, b1) - Math.max(a0, b0);
  const shorter = Math.min(a1 - a0, b1 - b0);
  return both > 0 && shorter > 0 ? both / shorter : 0;
}

// The id of our logged session that a watch workout duplicates: a strength (or untyped) workout covering at least
// half of the shorter of the two. The biggest overlap wins.
export function matchSession(w: { type: string; start: string; end: string }, sessions: { id: string; startedAt: number; endedAt?: number }[]): string | undefined {
  if (!isStrengthType(w.type)) return undefined;
  const a0 = Date.parse(w.start), a1 = Date.parse(w.end);
  let best: { id: string; share: number } | undefined;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const share = overlapShare(a0, a1, s.startedAt, s.endedAt);
    if (share >= 0.5 && (!best || share > best.share)) best = { id: s.id, share };
  }
  return best?.id;
}
