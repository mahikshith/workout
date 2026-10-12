// Code-drawn exercise motion. A pose is two sets of joint angles (start = rest, end = peak effort); the figure
// interpolates every angle between them, so the movement is continuous instead of two photos swapping.
// Pure TS (no React Native imports): the geometry functions are worklets for the UI thread and plain functions
// for the self-check in Node.
//
// Side view, figure faces right. All angles in degrees.
//   spine     torso direction (pelvis -> neck): 0 upright, 90 leaning flat forward (face down), -90 lying face up
//   hip       thigh flexion vs torso: 0 in line, 90 thigh forward at a right angle, negative = behind
//   knee      flexion: 0 straight, bends the shin back
//   ankle     0 = foot at a right angle to the shin, positive = toes pointed, negative = toes pulled up
//   shoulder  flexion vs torso: 0 arm along the torso, 90 forward, 180 overhead, negative = behind
//   elbow     flexion: 0 straight, bends the forearm forward
// Front view: spine = sideways lean, hip/shoulder = abduction (out to the side), knee/elbow bend toward the midline.
// [near, far] pairs: near is drawn on top; in front view near is the left side of the screen.

export type Pair = [number, number];
export type Angles = {
  spine: number; neck: number; curve: number; shrug: number; // curve: + rounds the back, - arches it
  hip: Pair; knee: Pair; ankle: Pair; shoulder: Pair; elbow: Pair;
};
export type Key =
  | 'pelvis' | 'neck' | 'ctl' | 'head' | 'sh0' | 'sh1' | 'el0' | 'el1' | 'wr0' | 'wr1'
  | 'hp0' | 'hp1' | 'kn0' | 'kn1' | 'an0' | 'an1' | 'toe0' | 'toe1' | 'heel0' | 'heel1';
export type Pts = Record<Key, [number, number]>;
export type Pose = {
  view: 'side' | 'front';
  ground?: 'floor' | 'stand' | 'bench' | 'hang' | 'mat'; // mat = seen from above, no floor line
  prop?: 'dumbbell' | 'barbell' | 'kettlebell' | 'bar' | 'band' | 'none';
  one?: boolean; // prop in the near hand only
  start: Angles;
  end: Angles;
  fix?: Key; // the point that stays put (default: ankle standing, pelvis on the floor or bench, hand hanging)
  lock?: boolean; // keep `fix` exactly where it is at the start instead of re-resting on the floor every frame
  pin?: 'hands' | 'feet' | 'hand' | 'foot'; // these stay where they start (two-bone IK); singular = near side only
  box?: Key; // a block from the floor up to this point (step, bench, hands-on-bench)
  wall?: 'front' | 'back';
  line?: [number, number]; // band or cable: fixed end, relative to the near hand at the start
  lift?: number; // jump: rises this much at the end
  hop?: number; // jump: rises this much mid-way
  // Tempo rules, the same for every exercise: 'lift' = 1 s lift, 0.5 s pause at the top, 1.6 s lowering,
  // 0.2 s pause at the bottom; 'hold' (stretches, holds) = 1.8 s in, 1.2 s hold, 1.8 s out, 0.6 s rest;
  // 'cycle' (cardio, alternating) = smooth back and forth, `tempo` seconds each way.
  pace?: 'lift' | 'hold' | 'cycle';
  tempo?: number;
  con?: 'out' | 'back'; // which way is the lift: start -> end (default) or end -> start (squat, bench, push-up: lower first)
  guide?: Guide;
};
// Form guide: a faint alignment line through two points, and an angle arc at a joint at the key position (`at`, default the end).
export type Guide = { joint?: 'hp0' | 'kn0' | 'an0' | 'sh0' | 'el0'; axis?: [Key, Key]; at?: 0 | 1 };

export const L = { torso: 34, neck: 5, head: 8, upper: 19, fore: 17, thigh: 26, shin: 25, foot: 10, heel: 3 };
const FAR: [number, number] = [-2, -1.5]; // side view: far limbs sit a touch up and back for depth
export const R: Partial<Record<Key, number>> = {
  pelvis: 7.5, ctl: 8, neck: 8.5, head: 8, sh0: 8, sh1: 8, el0: 3.6, el1: 3.6, wr0: 3.3, wr1: 3.3,
  kn0: 4.6, kn1: 4.6, heel0: 3, heel1: 3, toe0: 2, toe1: 2,
};

// ---- geometry (worklets) ----
export function at(p: [number, number], deg: number, len: number): [number, number] {
  'worklet';
  const r = (deg * Math.PI) / 180;
  return [p[0] + Math.sin(r) * len, p[1] - Math.cos(r) * len];
}
export function angle(a: [number, number], b: [number, number]) {
  'worklet';
  return (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI;
}

export function mix(a: Angles, b: Angles, t: number): Angles {
  'worklet';
  const m = (x: number, y: number) => x + (y - x) * t;
  const mp = (x: Pair, y: Pair): Pair => [m(x[0], y[0]), m(x[1], y[1])];
  return {
    spine: m(a.spine, b.spine), neck: m(a.neck, b.neck), curve: m(a.curve, b.curve), shrug: m(a.shrug, b.shrug),
    hip: mp(a.hip, b.hip), knee: mp(a.knee, b.knee), ankle: mp(a.ankle, b.ankle), shoulder: mp(a.shoulder, b.shoulder), elbow: mp(a.elbow, b.elbow),
  };
}

// Joint positions with the pelvis at the origin.
export function fk(A: Angles, front: boolean): Pts {
  'worklet';
  const t = A.spine;
  const P: [number, number] = [0, 0];
  const N = at(P, t, L.torso);
  const mid: [number, number] = [N[0] / 2, N[1] / 2];
  const o: Partial<Pts> = { pelvis: P, neck: N, ctl: at(mid, t - 90, A.curve * 0.3), head: at(N, t + A.neck, L.neck + L.head - 1) };
  const S = at(P, t, L.torso - 4 + A.shrug);
  for (let s = 0; s < 2; s++) {
    const sg = s === 0 ? -1 : 1;
    let sh: [number, number], hp: [number, number];
    if (front) { sh = at(S, t + 90, sg * 10); hp = at(P, t + 90, sg * 5); }
    else { sh = s ? [S[0] + FAR[0], S[1] + FAR[1]] : S; hp = s ? [FAR[0], FAR[1]] : P; }
    const k = front ? sg : 1; // side view flexion turns clockwise; front view mirrors per side
    const th = t + 180 - k * A.hip[s];
    const kn = at(hp, th, L.thigh);
    const ts = th + k * A.knee[s];
    const an = at(kn, ts, L.shin);
    let toe: [number, number], heel: [number, number];
    if (front) { toe = at(an, ts - sg * 60, 6); heel = an; }
    else {
      const tf = ts - 90 + A.ankle[s];
      toe = at(at(an, tf, L.foot), tf + 90, 1);
      heel = at(at(an, tf, -L.heel), tf + 90, 2);
    }
    const tu = t + 180 - k * A.shoulder[s];
    const el = at(sh, tu, L.upper);
    const wr = at(el, tu - k * A.elbow[s], L.fore);
    const n = s ? '1' : '0';
    (o as Record<string, [number, number]>)['sh' + n] = sh;
    (o as Record<string, [number, number]>)['hp' + n] = hp;
    (o as Record<string, [number, number]>)['kn' + n] = kn;
    (o as Record<string, [number, number]>)['an' + n] = an;
    (o as Record<string, [number, number]>)['toe' + n] = toe;
    (o as Record<string, [number, number]>)['heel' + n] = heel;
    (o as Record<string, [number, number]>)['el' + n] = el;
    (o as Record<string, [number, number]>)['wr' + n] = wr;
  }
  return o as Pts;
}

const KEYS: Key[] = ['pelvis', 'neck', 'ctl', 'head', 'sh0', 'sh1', 'el0', 'el1', 'wr0', 'wr1', 'hp0', 'hp1', 'kn0', 'kn1', 'an0', 'an1', 'toe0', 'toe1', 'heel0', 'heel1'];

function shift(o: Pts, dx: number, dy: number) {
  'worklet';
  for (const k of KEYS) o[k] = [o[k][0] + dx, o[k][1] + dy];
}

// Floor is y = 0. Unlocked poses rest their lowest point on it with `fix` at x = 0.
function rest(o: Pts, fix: Key) {
  'worklet';
  let low = -1e9;
  for (const k of KEYS) { const r = R[k]; if (r !== undefined && o[k][1] + r > low) low = o[k][1] + r; }
  shift(o, -o[fix][0], -low);
}

// Two-bone IK: moves the middle joint so the chain root -> mid -> end reaches `target`, bending the way it already bends.
function ik(o: Pts, root: Key, mid: Key, end: Key, target: [number, number], l1: number, l2: number) {
  'worklet';
  const a = o[root];
  const dx = target[0] - a[0], dy = target[1] - a[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = angle(a, target);
  const off = (Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) * 180) / Math.PI;
  const m1 = at(a, base + off, l1), m2 = at(a, base - off, l1);
  const h = o[mid];
  const m = Math.hypot(m1[0] - h[0], m1[1] - h[1]) < Math.hypot(m2[0] - h[0], m2[1] - h[1]) ? m1 : m2;
  const e = at(a, base, d);
  if (end[0] === 'a') { // carry the foot round with the shin
    const turn = angle(m, e) - angle(o[mid], o[end]);
    const n = end[2];
    for (const f of ['toe' + n, 'heel' + n] as Key[]) {
      const v = o[f];
      o[f] = at(e, angle(o[end], v) + turn, Math.hypot(v[0] - o[end][0], v[1] - o[end][1]));
    }
  }
  o[mid] = m;
  o[end] = e;
}

export function fixOf(pose: Pose): Key {
  'worklet';
  return pose.fix ?? (pose.ground === 'hang' ? 'wr0' : pose.ground === 'stand' || !pose.ground ? 'an0' : 'pelvis');
}

// The start pose resting on the floor. Locked poses keep its fixed point (and pinned hands or feet) every frame.
export function base(pose: Pose): Pts {
  const o = fk(pose.start, pose.view === 'front');
  rest(o, fixOf(pose));
  if (pose.ground === 'bench') { // a bench holds the pelvis, so drop the floor below anything that swings under it
    let sink = 0;
    for (let i = 0; i <= 10; i++) { const f = solve(pose, o, i / 10); for (const k of KEYS) sink = Math.max(sink, f[k][1] + (R[k] ?? 0)); }
    shift(o, 0, -sink);
  }
  return o;
}

// breath (-1..1) lifts the shoulders a touch; nod tilts the head (head follow).
export function solve(pose: Pose, b: Pts, p: number, breath = 0, nod = 0): Pts {
  'worklet';
  const a = mix(pose.start, pose.end, p);
  a.shrug += 0.5 * breath;
  a.neck += nod;
  const o = fk(a, pose.view === 'front');
  const fix = fixOf(pose);
  if (pose.lock || pose.pin || pose.box || pose.ground === 'bench' || pose.ground === 'hang') {
    shift(o, b[fix][0] - o[fix][0], b[fix][1] - o[fix][1]);
    const pin = pose.pin;
    if (pin) {
      const sides = pin === 'hands' || pin === 'feet' ? ['0', '1'] : ['0'];
      for (const n of sides) {
        if (pin[0] === 'h') ik(o, ('sh' + n) as Key, ('el' + n) as Key, ('wr' + n) as Key, b[('wr' + n) as Key], L.upper, L.fore);
        else ik(o, ('hp' + n) as Key, ('kn' + n) as Key, ('an' + n) as Key, b[('an' + n) as Key], L.thigh, L.shin);
      }
    }
  } else rest(o, fix);
  const up = (pose.lift ?? 0) * p + (pose.hop ?? 0) * 4 * p * (1 - p);
  if (up) shift(o, 0, -up);
  return o;
}

export type Part = 'torso' | 'neck' | 'upper' | 'fore' | 'thigh' | 'shin' | 'foot';
export type Seg = { id: string; a: Key; b: Key; ra: number; rb: number; part: Part; side: 0 | 1; curved?: boolean };
export type MuscleSpec = [Part, number, number, number, number]; // segment, from, to (0..1 along it), offset (-1 back .. 1 front), width

// ---- path builders for the figure (worklets) ----
export function n2(v: [number, number]) {
  'worklet';
  return `${Math.round(v[0] * 10) / 10},${Math.round(v[1] * 10) / 10}`;
}
// Tapered capsule from a to b (optionally bowed through control point k): straight or curved sides, round ends.
export function cap(a: [number, number], b: [number, number], ra: number, rb: number, k?: [number, number]) {
  'worklet';
  const m: [number, number] = k ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const ta = angle(a, m), tb = angle(m, b), tm = angle(a, b), rm = (ra + rb) / 2;
  return `M${n2(at(a, ta + 90, ra))}Q${n2(at(m, tm + 90, rm))} ${n2(at(b, tb + 90, rb))}A${rb},${rb} 0 0 0 ${n2(at(b, tb - 90, rb))}`
    + `Q${n2(at(m, tm - 90, rm))} ${n2(at(a, ta - 90, ra))}A${ra},${ra} 0 0 0 ${n2(at(a, ta + 90, ra))}Z`;
}
export function circ(p: [number, number], r: number) {
  'worklet';
  return `M${n2([p[0] - r, p[1]])}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0Z`;
}
// Point and direction at fraction u along the quadratic a -> k -> b (u may run a little past either end).
function bez(a: [number, number], k: [number, number], b: [number, number], u: number): [[number, number], number] {
  'worklet';
  const v = 1 - u;
  const p: [number, number] = [v * v * a[0] + 2 * v * u * k[0] + u * u * b[0], v * v * a[1] + 2 * v * u * k[1] + u * u * b[1]];
  const d: [number, number] = [2 * v * (k[0] - a[0]) + 2 * u * (b[0] - k[0]), 2 * v * (k[1] - a[1]) + 2 * u * (b[1] - k[1])];
  return [p, (Math.atan2(d[0], -d[1]) * 180) / Math.PI];
}
// A muscle belly: a spindle along part of a segment, pushed toward its front or back edge.
export function spindle(o: Pts, s: Seg, m: MuscleSpec, front: boolean) {
  'worklet';
  const a = o[s.a], b = o[s.b];
  const k: [number, number] = s.curved ? o.ctl : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const fs = s.part === 'torso' || s.part === 'neck' ? 90 : -90; // which normal is the body's front
  const fm = (m[1] + m[2]) / 2;
  const off = (front && s.part !== 'torso' ? 0 : m[3]) * Math.max(0, s.ra + (s.rb - s.ra) * fm - m[4] / 2 - 0.4);
  const [p0, t0] = bez(a, k, b, m[1]), [p1, t1] = bez(a, k, b, m[2]), [pm, tm] = bez(a, k, b, fm);
  const q0 = at(p0, t0 + fs, off), q1 = at(p1, t1 + fs, off), mid = at(pm, tm + fs, off);
  return `M${n2(q0)}Q${n2(at(mid, tm + 90, m[4]))} ${n2(q1)}Q${n2(at(mid, tm - 90, m[4]))} ${n2(q0)}Z`;
}

// ---- body plan ----
export const leg = (n: 0 | 1): Seg[] => [
  { id: 'thigh' + n, a: `hp${n}`, b: `kn${n}`, ra: 6.8, rb: 4.5, part: 'thigh', side: n },
  { id: 'shin' + n, a: `kn${n}`, b: `an${n}`, ra: 4.6, rb: 2.7, part: 'shin', side: n },
  { id: 'foot' + n, a: `heel${n}`, b: `toe${n}`, ra: 2.9, rb: 1.9, part: 'foot', side: n },
];
export const arm = (n: 0 | 1): Seg[] => [
  { id: 'upper' + n, a: `sh${n}`, b: `el${n}`, ra: 4.4, rb: 3.2, part: 'upper', side: n },
  { id: 'fore' + n, a: `el${n}`, b: `wr${n}`, ra: 3.5, rb: 2.3, part: 'fore', side: n },
];
export const torso = (front: boolean): Seg => ({ id: 'torso', a: 'pelvis', b: 'neck', ra: front ? 9.5 : 7.4, rb: front ? 12.5 : 9, part: 'torso', side: 0, curved: true });
export const NECK: Seg = { id: 'neck', a: 'neck', b: 'head', ra: 3.5, rb: 3.3, part: 'neck', side: 0 };

export const SIDE_M: Record<string, MuscleSpec[]> = {
  chest: [['torso', 0.6, 0.88, 1, 7]],
  abdominals: [['torso', 0.1, 0.55, 1, 5.5]],
  shoulders: [['upper', -0.06, 0.34, 0, 8.6]],
  biceps: [['upper', 0.3, 0.86, 1, 4.6]],
  triceps: [['upper', 0.22, 0.86, -1, 5]],
  forearms: [['fore', 0.06, 0.6, 1, 5]],
  lats: [['torso', 0.38, 0.8, -0.35, 8]],
  'middle back': [['torso', 0.55, 0.88, -1, 6]],
  'lower back': [['torso', 0.08, 0.45, -1, 5]],
  traps: [['torso', 0.86, 1.04, -1, 6], ['neck', 0, 1, -1, 3]],
  glutes: [['thigh', -0.14, 0.25, -1, 9]],
  abductors: [['thigh', -0.06, 0.3, -0.3, 7]],
  adductors: [['thigh', 0.1, 0.55, 0.2, 6]],
  quadriceps: [['thigh', 0.12, 0.88, 1, 7]],
  hamstrings: [['thigh', 0.15, 0.88, -1, 6]],
  calves: [['shin', 0.06, 0.5, -1, 6]],
  neck: [['neck', 0, 1, 0, 4]],
};
export const FRONT_M: Record<string, MuscleSpec[]> = {
  chest: [['torso', 0.62, 0.88, 0.45, 8], ['torso', 0.62, 0.88, -0.45, 8]],
  abdominals: [['torso', 0.1, 0.55, 0, 8]],
  lats: [['torso', 0.4, 0.8, 1, 5], ['torso', 0.4, 0.8, -1, 5]],
  'middle back': [['torso', 0.55, 0.85, 0, 8]],
  'lower back': [['torso', 0.1, 0.4, 0, 6]],
  traps: [['torso', 0.9, 1.04, 0.5, 5], ['torso', 0.9, 1.04, -0.5, 5]],
  glutes: [['thigh', -0.1, 0.25, 0, 9]],
};

// ---- tempo ----
function ease(u: number) {
  'worklet';
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}
export function cycleSeconds(pose: Pose) {
  return pose.pace === 'cycle' ? 2 * (pose.tempo ?? 0.5) : pose.pace === 'hold' ? 5.4 : 3.3;
}
// t in [0, 1) is the position in one rep. Returns the pose mix p (0 = start, 1 = end) and the effort g (0.3..1),
// which builds while the muscle shortens, peaks at the top and eases off while lowering.
export function phase(pose: Pose, t: number): [number, number] {
  'worklet';
  if (pose.pace === 'cycle') return [0.5 - 0.5 * Math.cos(2 * Math.PI * t), 0.75 + 0.25 * Math.sin(2 * Math.PI * t)];
  const seg = pose.pace === 'hold' ? [1.8, 1.2, 1.8, 0.6] : [1.0, 0.5, 1.6, 0.2]; // lift, top pause, lower, bottom pause
  let s = t * (seg[0] + seg[1] + seg[2] + seg[3]);
  let q: number, g: number; // q: 0 relaxed .. 1 contracted
  if (s < seg[0]) { const u = s / seg[0]; q = ease(u); g = 0.3 + 0.7 * Math.min(1, u * 1.6); }
  else if ((s -= seg[0]) < seg[1]) { q = 1; g = 1 - 0.2 * (s / seg[1]); }
  else if ((s -= seg[1]) < seg[2]) { const u = s / seg[2]; q = 1 - ease(u); g = 0.8 - 0.5 * u; }
  else { q = 0; g = 0.3; }
  return [pose.con === 'back' ? 1 - q : q, g];
}

// ---- pose library ----
type In = number | Pair;
const pr = (x: In): Pair => (typeof x === 'number' ? [x, x] : x);
type More = Partial<Pick<Angles, 'neck' | 'curve' | 'shrug'>>;
const A = (spine: number, hip: In, knee: In, ankle: In, shoulder: In, elbow: In, more: More = {}): Angles =>
  ({ spine, neck: 0, curve: 0, shrug: 0, hip: pr(hip), knee: pr(knee), ankle: pr(ankle), shoulder: pr(shoulder), elbow: pr(elbow), ...more });
// Standing with feet flat: the ankle follows from the rest (ankle = hip - knee - spine).
const St = (spine: number, hip: In, knee: In, shoulder: In, elbow: In, more: More = {}) => {
  const h = pr(hip), k = pr(knee);
  return A(spine, h, k, [h[0] - k[0] - spine, h[1] - k[1] - spine], shoulder, elbow, more);
};
const side = (start: Angles, end: Angles, o: Partial<Pose> = {}): Pose => ({ view: 'side', ground: 'stand', prop: 'none', start, end, ...o });
const front = (start: Angles, end: Angles, o: Partial<Pose> = {}): Pose => ({ view: 'front', ground: 'stand', prop: 'none', start, end, ...o });
const swap = (x: Pair): Pair => [x[1], x[0]];
// Alternating movements (walking, cycling, kicks): the end is the start with near and far swapped.
const alt = (a: Angles): Angles => ({ ...a, hip: swap(a.hip), knee: swap(a.knee), ankle: swap(a.ankle), shoulder: swap(a.shoulder), elbow: swap(a.elbow) });
const CARDIO = { pace: 'cycle' as const };

// squats: torso leans as hips and knees fold together, feet flat, spine neutral
const squat = (sh0: number, el0: number, sh1: number, el1: number, o: Partial<Pose> = {}, depth = 112, lean = 38) =>
  side(St(3, 5, 5, sh0, el0), St(lean, depth, depth, sh1, el1), { con: 'back', guide: { joint: 'kn0', axis: ['pelvis', 'neck'] }, ...o });
// hinges: hips go back, knees stay soft, arms hang straight down (shoulder = spine)
const hinge = (spine: number, hip: number, knee: number, o: Partial<Pose> = {}) =>
  side(St(0, 0, 6, 0, 0), St(spine, hip, knee, spine, 0), { con: 'back', guide: { joint: 'hp0', axis: ['pelvis', 'neck'] }, ...o });
// lunges / split squats: near = front leg, both feet stay planted
const lunge = (sh: number, el: number, o: Partial<Pose> = {}) =>
  side(A(0, [25, -15], [8, 12], [17, 30], sh, el), A(3, [88, -8], [90, 108], [-5, -5], sh + 3, el), { fix: 'an0', pin: 'feet', con: 'back', guide: { joint: 'kn0', axis: ['an0', 'kn0'] }, ...o });
const LUNGE_BOTTOM = A(3, [88, -8], [90, 108], [-5, -5], -20, 100);
const curl = (o: Partial<Pose>) => side(St(0, 0, 3, 0, 8), St(0, 0, 3, 12, 140), { guide: { joint: 'el0', axis: ['sh0', 'el0'] }, ...o });
// flat bench: lying face up, head left, feet on the floor
const BL = { hip: -10, knee: 95, ankle: -15 };
const benchP = (sh0: number, el0: number, sh1: number, el1: number, o: Partial<Pose> = {}, spine = -90) => {
  const legs = spine === -90 ? BL : { hip: 40, knee: 85, ankle: 0 };
  return side(A(spine, legs.hip, legs.knee, legs.ankle, sh0, el0), A(spine, legs.hip, legs.knee, legs.ankle, sh1, el1), { ground: 'bench', con: 'back', guide: { joint: 'el0', axis: ['el0', 'wr0'] }, ...o });
};
const ohpFront = (o: Partial<Pose> = {}) => front(A(0, 5, 0, 0, 85, 95), A(0, 5, 0, 0, 165, 10), { prop: 'dumbbell', guide: { joint: 'el0', axis: ['el0', 'wr0'], at: 0 }, ...o });
const raise = (o: Partial<Pose> = {}) => front(A(0, 5, 0, 0, 8, 10), A(0, 5, 0, 0, 85, 15), { prop: 'dumbbell', guide: { joint: 'sh0' }, ...o });
const pushup = (o: Partial<Pose> = {}) =>
  side(A(73, 0, 0, 15, 73, 0), A(84, 0, 0, 8, 15, 85), { ground: 'floor', fix: 'toe0', pin: 'hands', con: 'back', guide: { joint: 'el0', axis: ['an0', 'sh0'] }, ...o });
const quad = (more: More = {}) => A(90, 90, 90, 90, 90, 0, more); // hands and knees
const bridge = (o: Partial<Pose> = {}) =>
  side(A(-90, 40, 105, 25, 0, 0), A(-108, 0, 95, 13, -18, 0, { neck: 18 }), { ground: 'floor', fix: 'sh0', pin: 'feet', guide: { joint: 'kn0', axis: ['sh0', 'kn0'] }, ...o });
const LYING = (hip: In, knee: In, ankle: In = 20, sh: In = 0, el: In = 0, more: More = {}) => A(-90, hip, knee, ankle, sh, el, more);
const walk = (spine: number, sh: Pair, el: Pair, o: Partial<Pose> = {}) =>
  side(A(spine, [22, -15], [5, 18], [-5, 20], sh, el), alt(A(spine, [22, -15], [5, 18], [-5, 20], sh, el)), { fix: 'pelvis', pace: 'cycle', tempo: 0.55, ...o });
const bike = (spine: number, sh: number, el: number) => {
  const a = A(spine, [100, 55], [110, 45], [10, 20], sh, el);
  return side(a, alt(a), { ground: 'bench', pace: 'cycle', tempo: 0.5 });
};
const hang = (start: Angles, end: Angles, o: Partial<Pose> = {}) => side(start, end, { ground: 'hang', prop: 'bar', ...o });
const calf = (sh: number, el: number, o: Partial<Pose> = {}) => side(St(0, 0, 0, sh, el), A(0, 0, 0, 35, sh, el), { fix: 'toe0', ...o });
const step = (endFar: [number, number], o: Partial<Pose> = {}) =>
  side(A(15, [70, -10], [85, 5], [-30, 10], 15, 0), A(0, [0, endFar[0]], [0, endFar[1]], [0, 15], 0, 0), { fix: 'an0', box: 'an0', ...o });

const BB_SQUAT = squat(-20, 155, -20, 155, { prop: 'barbell' });
const GOBLET = squat(20, 150, 20, 150, { prop: 'kettlebell' });
const BW_SQUAT = squat(5, 10, 128, 0);
const DB_SQUAT = squat(3, 0, 38, 0, { prop: 'dumbbell' });
const RDL = hinge(72, 82, 18, { prop: 'barbell' });
const BENCH = benchP(90, 0, -20, 110, { prop: 'barbell' });
const DB_BENCH = benchP(90, 0, -25, 105, { prop: 'dumbbell' });
const CLOSE_BENCH = benchP(90, 0, -35, 120, { prop: 'barbell' });
const INCLINE = benchP(90, 0, -20, 110, { prop: 'dumbbell' }, -45);
const MIL = side(St(0, 0, 3, 20, 150), St(0, 0, 3, 172, 5), { prop: 'barbell', guide: { axis: ['el0', 'wr0'] } });
const ROW = side(St(65, 70, 18, 65, 0), St(65, 70, 18, -40, 115), { prop: 'barbell', guide: { joint: 'el0', axis: ['pelvis', 'neck'] } });
const PULLUP = front(A(0, 3, 0, 15, 165, 5), A(0, 3, 0, 15, 100, 120), { ground: 'hang', prop: 'bar', guide: { joint: 'el0' } });
const CHINUP = hang(A(5, 10, 20, 15, 172, 5), A(5, 10, 20, 15, 30, 145), { guide: { joint: 'el0' } });
const CABLE_ROW = side(A(15, 100, 20, -15, 80, 0), A(-5, 80, 20, -15, -25, 100), { ground: 'bench', prop: 'band', line: [45, 0], guide: { joint: 'el0', axis: ['pelvis', 'neck'] } });
const BAND_ROW = side(St(0, 0, 5, 85, 0), St(0, 0, 5, -25, 100), { prop: 'band', line: [45, 0] });
const LEAN_ROW = (o: Partial<Pose>) => side(A(-28, 0, 0, 28, 75, 0), A(-10, 0, 0, 10, -15, 110), { fix: 'an0', pin: 'hands', ...o });
const PULLDOWN = front(A(0, 5, 0, 0, 160, 5), A(0, 5, 0, 0, 95, 115), { prop: 'band', line: [0, -30], guide: { joint: 'el0' } });
const PUSHDOWN = side(St(10, 10, 8, 15, 115), St(10, 10, 8, 15, 5), { prop: 'band', line: [4, -45], guide: { joint: 'el0', axis: ['sh0', 'el0'], at: 0 } });
const OH_EXT = side(St(0, 0, 3, 170, 145), St(0, 0, 3, 170, 10), { prop: 'dumbbell', one: true, guide: { joint: 'el0', axis: ['sh0', 'el0'] } });
const CRUNCH = side(LYING(50, 100, 22, 30, 140), A(-66, 74, 100, 22, 30, 140, { curve: 22, neck: 15 }), { ground: 'floor' });
const LEG_RAISE = side(LYING(8, 0), LYING(90, 0), { ground: 'floor' });
const PLANK = side(A(76, 0, 0, 14, 76, 90), A(75, 3, 0, 14, 75, 90), { ground: 'floor', fix: 'toe0', pace: 'hold', guide: { axis: ['an0', 'sh0'] } });
const DIPS = side(A(15, 10, 70, 20, 15, 0), A(25, 10, 70, 20, -50, 95), { ground: 'hang', prop: 'bar', con: 'back', guide: { joint: 'el0' } });
const SHRUG = side(St(0, 0, 3, 0, 0), St(0, 0, 3, 0, 0, { shrug: 5 }), { prop: 'barbell' });
const LUNGES = lunge(3, 0, { prop: 'dumbbell' });

export const POSES: Record<string, Pose> = {
  // legs
  Barbell_Squat: BB_SQUAT,
  Smith_Machine_Squat: BB_SQUAT,
  Goblet_Squat: GOBLET,
  Front_Squats_With_Two_Kettlebells: GOBLET,
  Front_Squat_Clean_Grip: squat(75, 150, 105, 150, { prop: 'barbell' }, 112, 25),
  Bodyweight_Squat: BW_SQUAT,
  Dumbbell_Squat: DB_SQUAT,
  Hack_Squat: side(St(-5, 0, 5, 20, 150), St(10, 100, 115, 20, 150), { con: 'back', guide: { joint: 'kn0' } }),
  Freehand_Jump_Squat: side(St(38, 112, 112, -30, 0), A(0, 0, 0, 25, 160, 5), { lift: 12, pace: 'cycle', tempo: 0.6 }),
  Front_Box_Jump: side(St(38, 112, 112, -30, 0), A(0, 20, 30, 25, 120, 10), { lift: 16, pace: 'cycle', tempo: 0.6 }),
  Box_Jump_Multiple_Response: side(St(38, 112, 112, -30, 0), A(0, 20, 30, 25, 120, 10), { lift: 16, pace: 'cycle', tempo: 0.6 }),
  'wg_wall-sit': side(St(0, 90, 90, 40, 30), St(0, 88, 88, 40, 30), { wall: 'back', pace: 'hold', guide: { joint: 'kn0' } }),
  Plie_Dumbbell_Squat: front(A(0, 22, 0, 0, -12, 0), A(0, 55, 55, 0, -12, 0), { prop: 'dumbbell', one: true, con: 'back', }),
  Leg_Press: side(A(-50, 70, 10, -10, 20, 30), A(-50, 125, 105, -40, 20, 30), { ground: 'bench', con: 'back', guide: { joint: 'kn0' } }),
  Leg_Extensions: side(A(-5, 85, 90, 0, 15, 30), A(-5, 85, 5, 0, 15, 30), { ground: 'bench', guide: { joint: 'kn0' } }),
  Lying_Leg_Curls: side(A(90, 0, 5, 20, 150, 60), A(90, 0, 115, 20, 150, 60), { ground: 'bench', guide: { joint: 'kn0' } }),
  Seated_Leg_Curl: side(A(-10, 90, 10, 0, 20, 30), A(-10, 90, 100, 0, 20, 30), { ground: 'bench', guide: { joint: 'kn0' } }),
  Dumbbell_Lunges: LUNGES,
  Dumbbell_Rear_Lunge: LUNGES,
  Barbell_Lunge: lunge(-20, 155, { prop: 'barbell' }),
  Barbell_Walking_Lunge: lunge(-20, 155, { prop: 'barbell' }),
  Split_Squat_with_Dumbbells: LUNGES,
  Bodyweight_Walking_Lunge: lunge(-20, 100),
  Scissors_Jump: side(LUNGE_BOTTOM, alt(LUNGE_BOTTOM), { fix: 'pelvis', hop: 10, pace: 'cycle', tempo: 0.45 }),
  Kneeling_Hip_Flexor: side(A(0, [80, -5], [80, 95], [0, 80], 0, 0), A(-3, [65, -25], [60, 78], [8, 80], 0, 0), { ground: 'floor', fix: 'kn1', pin: 'foot', pace: 'hold' }),
  Dumbbell_Step_Ups: step([10, 30], { prop: 'dumbbell' }),
  Barbell_Step_Ups: step([10, 30], { prop: 'barbell' }),
  'Step-up_with_Knee_Raise': step([95, 95]),
  Standing_Calf_Raises: calf(20, 150),
  'wg_calf-raise': calf(-20, 100),
  Calf_Raise_On_A_Dumbbell: calf(-20, 100),
  Seated_Calf_Raise: side(A(0, 90, 90, -15, 45, 40), A(0, 90, 90, 25, 45, 40), { ground: 'bench' }),
  // hinges and glutes
  Romanian_Deadlift: RDL,
  'Stiff-Legged_Dumbbell_Deadlift': hinge(78, 85, 5, { prop: 'dumbbell' }),
  Good_Morning: side(St(0, 0, 6, -20, 155), St(70, 80, 15, -20, 155), { prop: 'barbell', con: 'back', guide: { joint: 'hp0', axis: ['pelvis', 'neck'] } }),
  Barbell_Deadlift: hinge(58, 100, 70, { prop: 'barbell' }),
  Sumo_Deadlift: hinge(45, 95, 70, { prop: 'barbell' }),
  'wg_kettlebell-swing': side(St(55, 80, 25, 30, 0), St(0, 0, 3, 90, 0), { prop: 'kettlebell', pace: 'cycle', tempo: 0.7 }),
  Barbell_Hip_Thrust: side(A(-62, 60, 120, 2, 0, 20), A(-90, 0, 90, 0, 0, 20), { ground: 'floor', fix: 'sh0', pin: 'feet', box: 'sh0', prop: 'barbell', guide: { joint: 'kn0', axis: ['sh0', 'kn0'] } }),
  Butt_Lift_Bridge: bridge(),
  Hip_Lift_with_Band: bridge(),
  Pelvic_Tilt_Into_Bridge: bridge({ pace: 'hold' }),
  Single_Leg_Glute_Bridge: side(A(-90, [40, 40], [105, 0], [25, 20], 0, 0), A(-108, [0, 0], [95, 0], [13, 20], -18, 0, { neck: 18 }), { ground: 'floor', fix: 'sh0', pin: 'foot' }),
  'One-Legged_Cable_Kickback': side(St(15, 15, 5, 60, 10), A(15, [-30, 15], [10, 5], [20, -5], 60, 10), { fix: 'an1' }),
  Hyperextensions_With_No_Hyperextension_Bench: side(A(160, 70, 0, 0, 20, 150), A(90, 0, 0, 0, 20, 150), { ground: 'floor', fix: 'kn0', box: 'kn0' }),
  'wg_banded-standing-hip-abduction': front(A(0, 3, 0, 0, 10, 0), A(0, [3, 30], 0, 0, 10, 0)),
  Thigh_Abductor: front(A(0, 8, 0, 0, 15, 10), A(0, 30, 0, 0, 15, 10), { ground: 'bench' }),
  Thigh_Adductor: front(A(0, 30, 0, 0, 15, 10), A(0, 6, 0, 0, 15, 10), { ground: 'bench' }),
  wg_clamshell: front(A(-90, 0, 0, 0, [180, 10], [20, 0]), A(-90, [0, 30], [0, 50], 0, [180, 10], [20, 0]), { ground: 'floor' }),
  // chest and push
  'Barbell_Bench_Press_-_Medium_Grip': BENCH,
  'Bench_Press_-_Powerlifting': BENCH,
  Dumbbell_Bench_Press: DB_BENCH,
  'Close-Grip_Barbell_Bench_Press': CLOSE_BENCH,
  Incline_Dumbbell_Press: INCLINE,
  Dumbbell_Flyes: benchP(90, 10, -40, 20, { prop: 'dumbbell' }),
  Cable_Crossover: front(A(0, 5, 0, 0, 115, 20), A(0, 5, 0, 0, 25, 15), { prop: 'band', line: [-12, -30] }),
  Pushups: pushup(),
  'Push-Ups_-_Close_Triceps_Position': pushup(),
  'wg_knee-push-up': side(A(62, 0, 80, 30, 62, 0), A(75, 0, 80, 30, 10, 85), { ground: 'floor', fix: 'kn0', pin: 'hands', con: 'back', guide: { joint: 'el0', axis: ['kn0', 'sh0'] } }),
  'Incline_Push-Up': side(A(50, 0, 0, 0, 50, 0), A(62, 0, 0, -5, 5, 90), { ground: 'floor', fix: 'toe0', pin: 'hands', box: 'wr0', con: 'back', guide: { joint: 'el0', axis: ['an0', 'sh0'] } }),
  'wg_wall-push-up': side(St(18, 0, 0, 110, 0), St(30, 0, 0, 70, 100), { fix: 'an0', pin: 'hands', wall: 'front', con: 'back', guide: { joint: 'el0', axis: ['an0', 'sh0'] } }),
  'Dips_-_Chest_Version': DIPS,
  'Dips_-_Triceps_Version': side(A(0, 10, 70, 20, 0, 0), A(5, 10, 70, 20, -60, 95), { ground: 'hang', prop: 'bar', con: 'back', guide: { joint: 'el0' } }),
  Bench_Dips: side(A(0, 80, 60, 0, -40, 0), A(0, 80, 60, 0, -70, 85), { fix: 'wr0', box: 'wr0', pin: 'feet', con: 'back', guide: { joint: 'el0' } }),
  // shoulders
  Standing_Military_Press: MIL,
  Seated_Barbell_Military_Press: MIL,
  Dumbbell_Shoulder_Press: ohpFront(),
  Seated_Dumbbell_Press: ohpFront(),
  Standing_Dumbbell_Press: ohpFront(),
  'Dumbbell_One-Arm_Shoulder_Press': ohpFront({ one: true }),
  Arnold_Dumbbell_Press: front(A(0, 5, 0, 0, 20, 150), A(0, 5, 0, 0, 165, 10), { prop: 'dumbbell' }),
  Side_Lateral_Raise: raise(),
  Seated_Side_Lateral_Raise: raise(),
  Front_Dumbbell_Raise: side(St(0, 0, 3, 5, 5), St(0, 0, 3, 90, 5), { prop: 'dumbbell' }),
  Front_Plate_Raise: side(St(0, 0, 3, 5, 5), St(0, 0, 3, 90, 5), { prop: 'barbell' }),
  Band_Pull_Apart: front(A(0, 5, 0, 0, 30, 5), A(0, 5, 0, 0, 88, 5), { prop: 'band' }),
  Reverse_Machine_Flyes: front(A(0, 5, 0, 0, 30, 5), A(0, 5, 0, 0, 88, 5)),
  Face_Pull: side(St(0, 0, 3, 85, 5), St(0, 0, 3, 80, 130), { prop: 'band', line: [40, 0] }),
  Upright_Barbell_Row: side(St(0, 0, 3, 0, 5), St(0, 0, 3, 75, 150, { shrug: 2 }), { prop: 'barbell' }),
  Barbell_Shrug: SHRUG,
  Dumbbell_Shrug: { ...SHRUG, prop: 'dumbbell' },
  Shoulder_Circles: side(St(0, 0, 3, -10, 0), St(0, 0, 3, 10, 0, { shrug: 4 }), { pace: 'cycle', tempo: 0.8 }),
  Arm_Circles: front(A(0, 5, 0, 0, 80, 0), A(0, 5, 0, 0, 100, 0), { pace: 'cycle', tempo: 0.4 }),
  Side_Neck_Stretch: front(A(0, 5, 0, 0, 5, 5), A(0, 5, 0, 0, 5, 5, { neck: 28 }), { pace: 'hold' }),
  // back
  Bent_Over_Barbell_Row: ROW,
  'T-Bar_Row_with_Handle': ROW,
  'Bent_Over_Two-Dumbbell_Row': { ...ROW, prop: 'dumbbell' },
  'One-Arm_Dumbbell_Row': side(St(75, 80, 25, 75, 0), St(75, 80, 25, [-45, 75], [110, 0]), { prop: 'dumbbell', one: true }),
  Seated_Cable_Rows: CABLE_ROW,
  'wg_banded-row': BAND_ROW,
  'wg_towel-row': LEAN_ROW({ prop: 'band', line: [6, 0] }),
  'wg_doorway-row': LEAN_ROW({ wall: 'front' }),
  Inverted_Row: side(A(-78, 0, 0, 15, 90, 0), A(-70, 0, 0, 15, -10, 110), { ground: 'floor', fix: 'heel0', pin: 'hands', prop: 'bar' }),
  Pullups: PULLUP,
  'Wide-Grip_Rear_Pull-Up': PULLUP,
  'Chin-Up': CHINUP,
  'Wide-Grip_Lat_Pulldown': PULLDOWN,
  'V-Bar_Pulldown': PULLDOWN,
  'Close-Grip_Front_Lat_Pulldown': PULLDOWN,
  'Straight-Arm_Pulldown': side(St(25, 25, 15, 140, 5), St(25, 25, 15, 20, 5), { prop: 'band', line: [15, -30] }),
  // arms
  Barbell_Curl: curl({ prop: 'barbell' }),
  'EZ-Bar_Curl': curl({ prop: 'barbell' }),
  Reverse_Barbell_Curl: curl({ prop: 'barbell' }),
  Dumbbell_Bicep_Curl: curl({ prop: 'dumbbell' }),
  Dumbbell_Alternate_Bicep_Curl: curl({ prop: 'dumbbell' }),
  Hammer_Curls: curl({ prop: 'dumbbell' }),
  'Cable_Hammer_Curls_-_Rope_Attachment': curl({ prop: 'band', line: [6, 30] }),
  Incline_Dumbbell_Curl: side(A(-40, 45, 85, 0, -40, 5), A(-40, 45, 85, 0, -35, 140), { ground: 'bench', prop: 'dumbbell' }),
  Concentration_Curls: side(A(40, 95, 90, -35, 40, 5), A(40, 95, 90, -35, 40, 135), { ground: 'bench', prop: 'dumbbell', one: true }),
  Preacher_Curl: side(A(10, 90, 90, -10, 60, 10), A(10, 90, 90, -10, 60, 130), { ground: 'bench', prop: 'barbell' }),
  Triceps_Pushdown: PUSHDOWN,
  Triceps_Overhead_Extension_with_Rope: side(St(25, 25, 10, 175, 125), St(25, 25, 10, 175, 10), { prop: 'band', line: [-35, 25] }),
  Standing_Dumbbell_Triceps_Extension: OH_EXT,
  Lying_Triceps_Press: benchP(90, 0, 105, 115, { prop: 'barbell' }),
  Tricep_Dumbbell_Kickback: side(St(70, 75, 20, -60, 100), St(70, 75, 20, -60, 0), { prop: 'dumbbell', one: true }),
  Farmers_Walk: walk(0, [0, 0], [0, 0], { prop: 'dumbbell', tempo: 0.6 }),
  // core
  Plank: PLANK,
  Dead_Bug: side(LYING(90, 90, 20, 90), LYING([90, 10], [90, 0], 20, [170, 90]), { ground: 'floor', fix: 'pelvis' }),
  Cable_Crunch: side(A(10, 10, 90, 90, 160, 140), A(55, 55, 90, 90, 140, 140, { curve: 25, neck: 15 }), { ground: 'floor', fix: 'kn0', lock: true, prop: 'band', line: [0, -45] }),
  Crunches: CRUNCH,
  'Sit-Up': side(LYING(50, 100, 22, 30, 140), A(-15, 125, 100, 22, 30, 140, { curve: 10 }), { ground: 'floor', fix: 'heel0' }),
  Decline_Crunch: CRUNCH,
  'Cross-Body_Crunch': CRUNCH,
  Oblique_Crunches: CRUNCH,
  'Oblique_Crunches_-_On_The_Floor': CRUNCH,
  Reverse_Crunch: side(LYING(90, 90), A(-100, 130, 120, 20, -10, 0, { curve: 15 }), { ground: 'floor' }),
  'Leg_Pull-In': side(LYING(8, 0), LYING(110, 120), { ground: 'floor' }),
  Flat_Bench_Lying_Leg_Raise: LEG_RAISE,
  Flutter_Kicks: side(LYING([22, 6], 0), LYING([6, 22], 0), { ground: 'floor', pace: 'cycle', tempo: 0.5 }),
  Air_Bike: side(A(-70, [100, 30], [100, 10], 20, 160, 140, { neck: 15, curve: 15 }), A(-70, [30, 100], [10, 100], 20, 160, 140, { neck: 15, curve: 15 }), { ground: 'floor', pace: 'cycle', tempo: 0.7 }),
  Alternate_Heel_Touchers: side(A(-72, 50, 100, 22, 10, 0, { neck: 15, curve: 15 }), A(-68, 50, 100, 22, 0, 0, { neck: 18, curve: 18 }), { ground: 'floor', pace: 'cycle', tempo: 0.8 }),
  Russian_Twist: side(A(-35, 95, 85, 20, 60, 30, { curve: 10 }), A(-38, 95, 85, 20, 35, 60, { curve: 10 }), { ground: 'floor', pace: 'cycle', tempo: 0.7 }),
  'wg_hanging-knee-raise': hang(A(0, 0, 0, 15, 180, 0), A(0, 105, 95, 15, 180, 0, { curve: 15 })),
  Hanging_Leg_Raise: hang(A(0, 0, 0, 15, 180, 0), A(0, 95, 0, 15, 180, 0, { curve: 15 })),
  Hanging_Pike: hang(A(0, 0, 0, 15, 180, 0), A(0, 95, 0, 15, 180, 0, { curve: 15 })),
  'wg_bird-dog': side(quad(), A(90, [90, 0], [90, 0], [90, 20], [180, 90], 0), { ground: 'floor', fix: 'kn0' }),
  'wg_banded-pallof-press': side(St(0, 0, 5, 20, 150), St(0, 0, 5, 90, 0), {}),
  Mountain_Climbers: side(A(74, [100, -10], [145, 0], [20, 15], 74, 0), A(74, [-10, 100], [0, 145], [15, 20], 74, 0), { ground: 'floor', fix: 'wr0', pin: 'hands', pace: 'cycle', tempo: 0.4 }),
  'wg_bear-crawl': side(A(88, [110, 85], [80, 70], [30, 30], [95, 75], 0), A(88, [85, 110], [70, 80], [30, 30], [75, 95], 0), { ground: 'floor', fix: 'pelvis', pace: 'cycle', tempo: 0.6 }),
  wg_burpee: side(A(80, 130, 130, 10, 80, 0), A(72, 0, 0, 15, 72, 0), { ground: 'floor', fix: 'wr0', pace: 'cycle', tempo: 0.6 }),
  Superman: side(A(90, 0, 0, 30, 175, 0), A(80, -12, 0, 30, 185, 0, { curve: -15, neck: -10 }), { ground: 'floor' }),
  // cardio
  Walking_Treadmill: walk(0, [-15, 15], [15, 15]),
  'wg_treadmill-incline-walk': walk(8, [-15, 15], [15, 15]),
  Running_Treadmill: side(A(10, [45, -20], [40, 70], [-5, 25], [-35, 40], 90), alt(A(10, [45, -20], [40, 70], [-5, 25], [-35, 40], 90)), { fix: 'pelvis', pace: 'cycle', tempo: 0.35 }),
  Elliptical_Trainer: walk(5, [30, -10], [60, 30], { tempo: 0.6 }),
  Bicycling_Stationary: bike(20, 65, 20),
  Recumbent_Bike: bike(-25, 30, 40),
  Rowing_Stationary: side(A(25, 130, 130, -40, 85, 0), A(-20, 52, 0, 20, -20, 100), { ground: 'floor', fix: 'an0', lock: true, prop: 'band', line: [55, -4], pace: 'cycle', tempo: 0.9 }),
  Battling_Ropes: side(St(20, 45, 45, [30, 75], [40, 20]), St(20, 45, 45, [75, 30], [20, 40]), { prop: 'band', line: [45, 18], pace: 'cycle', tempo: 0.3 }),
  'wg_jumping-jack': front(A(0, 3, 0, 0, 10, 5), A(0, 20, 0, 0, 165, 10), { hop: 5, pace: 'cycle', tempo: 0.35 }),
  // stretches and mobility
  Calf_Stretch_Hands_Against_Wall: side(A(20, [0, 40], [0, 45], [-20, -25], 75, 25), A(30, [0, 50], [0, 60], [-30, -40], 65, 35), { fix: 'an0', pin: 'hands', wall: 'front', pace: 'hold' }),
  'wg_hamstring-stretch': side(A(5, [30, -5], [0, 15], [-35, -25], 40, 10), A(45, [70, 30], [0, 30], [-35, -45], 40, 10), { fix: 'an1', pace: 'hold' }),
  Cat_Stretch: side(quad({ curve: -15, neck: -25 }), quad({ curve: 22, neck: 30 }), { ground: 'floor', fix: 'kn0', pin: 'hands', pace: 'hold' }),
  Childs_Pose: side(quad(), A(105, 150, 145, 90, 175, 0, { curve: 20, neck: 20 }), { ground: 'floor', fix: 'kn0', pin: 'hands', pace: 'hold' }),
  Standing_Pelvic_Tilt: side(St(0, 5, 10, 0, 0, { curve: -12 }), St(-2, 0, 10, 0, 0, { curve: 12 }), {}),
  Hug_Knees_To_Chest: side(LYING(70, 100, 20, 60, 50), LYING(125, 130, 25, 50, 95, { curve: 12 }), { ground: 'floor', pace: 'hold' }),
  Knee_Across_The_Body: front(A(-90, 0, 0, 0, [20, 90], 0), A(-90, [-35, 0], [80, 0], 0, [20, 90], 0), { ground: 'mat', pace: 'hold' }),
  IT_Band_and_Glute_Stretch: front(A(-90, 0, 0, 0, [20, 90], 0), A(-90, [-40, 0], 0, 0, [20, 90], 0), { ground: 'mat', pace: 'hold' }),
};

export const hasPose = (id: string) => id in POSES;

// Every pose has all its angles, in sane ranges; locked poses can reach their pinned hands or feet all the way through.
export function selfCheck() {
  const RANGE: Record<string, [number, number]> = {
    spine: [-180, 180], neck: [-45, 45], curve: [-30, 30], shrug: [0, 8],
    // joint limits (side-view projections; kneeling feet lie flat behind, so the ankle goes to 90)
    hip: [-40, 150], knee: [0, 150], ankle: [-45, 90], shoulder: [-75, 190], elbow: [0, 155],
  };
  const bad: string[] = [];
  for (const [id, pose] of Object.entries(POSES)) {
    for (const a of [pose.start, pose.end])
      for (const [k, [lo, hi]] of Object.entries(RANGE)) {
        const v = (a as unknown as Record<string, number | Pair>)[k];
        const vs = typeof v === 'number' ? [v] : Array.isArray(v) && v.length === 2 ? v : [NaN];
        if (vs.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x < lo || x > hi)) bad.push(`${id}.${k}=${JSON.stringify(v)}`);
      }
    const b = base(pose);
    for (let i = 0; i <= 10; i++) {
      const o = solve(pose, b, i / 10);
      if (KEYS.some((k) => !o[k].every(Number.isFinite))) { bad.push(`${id}: NaN at ${i / 10}`); break; }
      if (pose.pin) {
        const n = pose.pin === 'hands' || pose.pin === 'feet' ? ['0', '1'] : ['0'];
        const end = pose.pin[0] === 'h' ? 'wr' : 'an';
        const miss = Math.max(...n.map((s) => Math.hypot(o[(end + s) as Key][0] - b[(end + s) as Key][0], o[(end + s) as Key][1] - b[(end + s) as Key][1])));
        if (miss > 1.5) { bad.push(`${id}: pinned ${end} slips ${miss.toFixed(1)} at ${i / 10}`); break; }
      }
      if (pose.ground !== 'hang' && pose.ground !== 'mat') {
        const sink = Math.max(...KEYS.map((k) => o[k][1] + (R[k] ?? 0)));
        if (sink > 2.5) { bad.push(`${id}: sinks ${sink.toFixed(1)} into the floor at ${i / 10}`); break; }
      }
    }
    if (pose.guide?.axis?.some((k) => !KEYS.includes(k))) bad.push(`${id}: bad guide axis`);
    // tempo: p stays in 0..1 and never jumps, including the wrap from the end of one rep to the next
    let last = phase(pose, 0.999)[0];
    for (let i = 0; i <= 400; i++) {
      const [p, g] = phase(pose, i / 400);
      if (p < 0 || p > 1 || g < 0.29 || g > 1 || Math.abs(p - last) > 0.05) { bad.push(`${id}: tempo jumps at ${i / 400}`); break; }
      last = p;
    }
  }
  if (bad.length) throw new Error('poses: ' + bad.join('; '));
  return Object.keys(POSES).length;
}
