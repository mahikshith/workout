// A small FIT decoder, written from the public FIT protocol description (file header, CRC-16, definition and data
// messages, compressed timestamp headers, developer fields). It reads only the messages the file importer needs and
// skips everything else by size. No BigInt: 64-bit fields are skipped. Pure, so selfcheck can run it under Node.

import { strFromU8 } from 'fflate';

export type FitSession = {
  start?: number; // ms since epoch
  sport?: string;
  subSport?: string;
  elapsedS?: number;
  timerS?: number;
  distanceM?: number;
  kcal?: number;
  avgHr?: number;
  maxHr?: number;
};
export type FitData = {
  fileType?: number;
  manufacturer?: number;
  productName?: string;
  sessions: FitSession[];
  restingHr: { t: number; bpm: number }[];
  weights: { t: number; kg: number }[];
  hrv: { t: number; ms: number }[];
};

const FIT_EPOCH_MS = 631065600000; // 1989-12-31T00:00:00Z

// Global message and field numbers from the FIT profile.
const MSG = { FILE_ID: 0, SESSION: 18, WEIGHT_SCALE: 30, MONITORING_HR_DATA: 211, HRV_STATUS_SUMMARY: 370 } as const;
const TIMESTAMP = 253;

const SPORTS: Record<number, string> = {
  0: 'generic', 1: 'running', 2: 'cycling', 4: 'fitnessEquipment', 5: 'swimming', 6: 'basketball', 7: 'soccer', 8: 'tennis',
  9: 'americanFootball', 10: 'training', 11: 'walking', 12: 'crossCountrySkiing', 13: 'alpineSkiing', 14: 'snowboarding', 15: 'rowing',
  16: 'mountaineering', 17: 'hiking', 18: 'multisport', 19: 'paddling', 21: 'eBiking', 25: 'golf', 30: 'inlineSkating', 31: 'rockClimbing',
  32: 'sailing', 33: 'iceSkating', 35: 'snowshoeing', 37: 'standUpPaddleboarding', 38: 'surfing', 41: 'kayaking', 47: 'boxing',
  48: 'floorClimbing', 49: 'baseball', 53: 'diving', 62: 'hiit', 64: 'racket', 67: 'meditation', 69: 'discGolf', 70: 'teamSport',
  71: 'cricket', 72: 'rugby', 73: 'hockey', 75: 'volleyball', 80: 'mixedMartialArts', 83: 'dance', 84: 'jumpRope', 86: 'mobility', 88: 'canoeing',
};
const SUB_SPORTS: Record<number, string> = {
  1: 'treadmill', 6: 'indoorCycling', 14: 'indoorRowing', 15: 'elliptical', 16: 'stairClimbing', 17: 'lapSwimming', 18: 'openWater',
  19: 'flexibilityTraining', 20: 'strengthTraining', 26: 'cardioTraining', 43: 'yoga', 44: 'pilates', 45: 'indoorRunning', 62: 'breathing',
  68: 'indoorClimbing', 69: 'bouldering', 70: 'hiit', 84: 'pickleball', 85: 'padel',
};

// FIT CRC-16, four bits at a time.
const CRC_TABLE = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
export function fitCrc(b: Uint8Array, start: number, end: number, crc = 0) {
  for (let i = start; i < end; i++) {
    const byte = b[i];
    let tmp = CRC_TABLE[crc & 0xf];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ CRC_TABLE[byte & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc;
}

export const isFitHeader = (b: Uint8Array, at = 0) =>
  b.length >= at + 12 && (b[at] === 12 || b[at] === 14) && b[at + 8] === 0x2e && b[at + 9] === 0x46 && b[at + 10] === 0x49 && b[at + 11] === 0x54;

type Field = { num: number; size: number; base: number };
type Def = { global: number; little: boolean; fields: Field[]; devSize: number };

// Reads one field value as a number (or string), or undefined when it holds the base type's invalid value.
function readField(v: DataView, b: Uint8Array, at: number, f: Field, little: boolean): number | string | undefined {
  const t = f.base & 0x1f;
  switch (t) {
    case 0: case 2: case 13: { const x = v.getUint8(at); return x === 0xff ? undefined : x; } // enum, uint8, byte
    case 1: { const x = v.getInt8(at); return x === 0x7f ? undefined : x; }
    case 10: { const x = v.getUint8(at); return x === 0 ? undefined : x; }
    case 3: if (f.size < 2) return undefined; { const x = v.getInt16(at, little); return x === 0x7fff ? undefined : x; }
    case 4: if (f.size < 2) return undefined; { const x = v.getUint16(at, little); return x === 0xffff ? undefined : x; }
    case 11: if (f.size < 2) return undefined; { const x = v.getUint16(at, little); return x === 0 ? undefined : x; }
    case 5: if (f.size < 4) return undefined; { const x = v.getInt32(at, little); return x === 0x7fffffff ? undefined : x; }
    case 6: if (f.size < 4) return undefined; { const x = v.getUint32(at, little); return x === 0xffffffff ? undefined : x; }
    case 12: if (f.size < 4) return undefined; { const x = v.getUint32(at, little); return x === 0 ? undefined : x; }
    case 8: if (f.size < 4) return undefined; { const x = v.getFloat32(at, little); return Number.isFinite(x) ? x : undefined; }
    case 9: if (f.size < 8) return undefined; { const x = v.getFloat64(at, little); return Number.isFinite(x) ? x : undefined; }
    case 7: { const s = b.subarray(at, at + f.size); const z = s.indexOf(0); return strFromU8(z >= 0 ? s.subarray(0, z) : s) || undefined; }
    default: return undefined; // 64-bit integers (14, 15, 16) and anything unknown
  }
}

const date = (sec: unknown) => (typeof sec === 'number' ? FIT_EPOCH_MS + sec * 1000 : undefined);
const n = (x: unknown) => (typeof x === 'number' ? x : undefined);
const scaled = (x: unknown, s: number) => (typeof x === 'number' ? x / s : undefined);

// Decodes a .FIT file (or several chained ones). Returns null when the header or a CRC is wrong.
export function decodeFit(bytes: Uint8Array): FitData | null {
  const out: FitData = { sessions: [], restingHr: [], weights: [], hrv: [] };
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  let any = false;
  while (pos < bytes.length && isFitHeader(bytes, pos)) {
    const hSize = bytes[pos];
    const dataSize = v.getUint32(pos + 4, true);
    const end = pos + hSize + dataSize;
    if (end + 2 > bytes.length) return null;
    if (hSize === 14) {
      const hc = v.getUint16(pos + 12, true);
      if (hc !== 0 && hc !== fitCrc(bytes, pos, pos + 12)) return null;
    }
    if (v.getUint16(end, true) !== fitCrc(bytes, pos, end)) return null;
    if (!readRecords(bytes, v, pos + hSize, end, out)) return null;
    any = true;
    pos = end + 2;
  }
  return any ? out : null;
}

function readRecords(b: Uint8Array, v: DataView, start: number, end: number, out: FitData): boolean {
  const defs: (Def | undefined)[] = [];
  let lastTs = 0;
  let p = start;
  while (p < end) {
    const h = b[p++];
    if (h & 0x80) {
      // Compressed timestamp header: a data message whose time is a 5-bit offset from the last full timestamp.
      const def = defs[(h >> 5) & 0x03];
      if (!def) return false;
      const off = h & 0x1f;
      lastTs = (lastTs & ~0x1f) + off + (off >= (lastTs & 0x1f) ? 0 : 0x20);
      const len = msgSize(def);
      if (p + len > end) return false;
      take(def, p, lastTs);
      p += len;
    } else if (h & 0x40) {
      // Definition message.
      if (p + 5 > end) return false;
      const little = b[p + 1] === 0;
      const global = v.getUint16(p + 2, little);
      const count = b[p + 4];
      p += 5;
      if (p + count * 3 > end) return false;
      const fields: Field[] = [];
      for (let i = 0; i < count; i++, p += 3) fields.push({ num: b[p], size: b[p + 1], base: b[p + 2] });
      let devSize = 0;
      if (h & 0x20) {
        if (p >= end) return false;
        const dc = b[p++];
        if (p + dc * 3 > end) return false;
        for (let i = 0; i < dc; i++, p += 3) devSize += b[p + 1];
      }
      defs[h & 0x0f] = { global, little, fields, devSize };
    } else {
      const def = defs[h & 0x0f];
      if (!def) return false;
      const len = msgSize(def);
      if (p + len > end) return false;
      const ts = take(def, p, undefined);
      if (ts !== undefined) lastTs = ts;
      p += len;
    }
  }
  return true;

  // Reads the fields we use from one data message and files it. Returns its timestamp field, if any.
  function take(def: Def, at: number, compressedTs: number | undefined): number | undefined {
    const wanted = def.global === MSG.FILE_ID || def.global === MSG.SESSION || def.global === MSG.WEIGHT_SCALE || def.global === MSG.MONITORING_HR_DATA || def.global === MSG.HRV_STATUS_SUMMARY;
    const f: Record<number, number | string | undefined> = {};
    let q = at;
    for (const fd of def.fields) {
      if (wanted || fd.num === TIMESTAMP) f[fd.num] = readField(v, b, q, fd, def.little);
      q += fd.size;
    }
    const tsField = n(f[TIMESTAMP]);
    const ts = date(tsField ?? compressedTs);
    switch (def.global) {
      case MSG.FILE_ID:
        out.fileType ??= n(f[0]);
        out.manufacturer ??= n(f[1]);
        if (typeof f[8] === 'string') out.productName ??= f[8];
        break;
      case MSG.SESSION:
        out.sessions.push({
          start: date(f[2]), sport: SPORTS[n(f[5]) ?? -1] ?? (f[5] === undefined ? undefined : 'generic'), subSport: SUB_SPORTS[n(f[6]) ?? -1],
          elapsedS: scaled(f[7], 1000), timerS: scaled(f[8], 1000), distanceM: scaled(f[9], 100), kcal: n(f[11]), avgHr: n(f[16]), maxHr: n(f[17]),
        });
        break;
      case MSG.WEIGHT_SCALE: {
        const kg = n(f[0]);
        if (ts !== undefined && kg !== undefined && kg < 0xfffe) out.weights.push({ t: ts, kg: kg / 100 }); // 0xFFFE means "calculating"
        break;
      }
      case MSG.MONITORING_HR_DATA: {
        const bpm = n(f[1]) ?? n(f[0]); // today's resting HR, else the 7-day average
        if (ts !== undefined && bpm) out.restingHr.push({ t: ts, bpm });
        break;
      }
      case MSG.HRV_STATUS_SUMMARY: {
        const ms = scaled(f[1], 128);
        if (ts !== undefined && ms) out.hrv.push({ t: ts, ms });
        break;
      }
    }
    return tsField;
  }
}

const msgSize = (d: Def) => d.fields.reduce((s, f) => s + f.size, 0) + d.devSize;
