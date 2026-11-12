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
  prop?: 'dumbbell' | 'barbell' | 'kettlebell' | 'bar' | 'band' | 'plate' | 'ball' | 'none'; // plate: held on the head (neck work); ball: medicine ball or ab wheel
  one?: boolean; // prop in the near hand only
  start: Angles;
  end: Angles;
  fix?: Key; // the point that stays put (default: ankle standing, pelvis on the floor or bench, hand hanging)
  lock?: boolean; // keep `fix` exactly where it is at the start instead of re-resting on the floor every frame
  pin?: 'hands' | 'feet' | 'hand' | 'foot'; // these stay where they start (two-bone IK); singular = near side only
  box?: Key; // a block from the floor up to this point (step, bench, hands-on-bench)
  wall?: 'front' | 'back' | 'feet'; // feet (3D only): behind the soles at the start
  machine?: 'treadmill' | 'sled' | 'bike'; // treadmill under the feet; sled = the leg-press plate the feet push; bike = handlebar post
  rack?: 'back' | 'front' | 'zercher' | 'straddle'; // the barbell rests across the upper back, not in the hands (3D only: on the front of the shoulders, in the crooks of the elbows, or held between the legs running front to back)
  flex?: [number, number]; // wrist curls: the hand tips from start to end (degrees from the forearm line, + = clockwise)
  incline?: number; // degrees the treadmill belt or the ground slopes up toward the front (the body stays upright)
  line?: [number, number]; // band or cable: fixed end, relative to the near hand at the start
  lift?: number; // jump: rises this much at the end
  land?: number; // box jump: travels this far forward and lands on a box `lift` high
  under?: { at: Key; mid?: Key; r: number; fixed?: boolean }; // a ball under this point (or halfway to `mid`), on the floor (exercise ball rolls with it; fixed = foam roller that stays put)
  hop?: number; // jump: rises this much mid-way
  // Tempo rules, the same for every exercise: 'lift' = 1 s lift, 0.5 s pause at the top, 1.6 s lowering,
  // 0.2 s pause at the bottom; 'hold' (stretches, holds) = 1.8 s in, 1.2 s hold, 1.8 s out, 0.6 s rest;
  // 'cycle' (cardio, alternating) = smooth back and forth, `tempo` seconds each way.
  pace?: 'lift' | 'hold' | 'cycle' | 'spin'; // spin: p runs 0..1 and wraps (pedalling goes round, never back)
  tempo?: number;
  con?: 'out' | 'back'; // which way is the lift: start -> end (default) or end -> start (squat, bench, push-up: lower first)
  guide?: Guide;
  weak?: boolean; // borrowed from a different movement: the app shows the photo instead
  pad?: false; // on a bench: no back or chest pad along the torso (sitting free, e.g. concentration curls)
  sit?: boolean; // front view, seated facing the camera: the thighs point at the viewer, so they are drawn short
  // Only the 3D figure can show these. A movement that needs one is marked `weak` for the flat figure and `d3` for the 3D one.
  d3?: boolean;
  twist?: [number, number]; // side view: the upper body turns about the spine at the start and the end, + = to the figure's left
  tilt?: number; // front view: the trunk tips forward this much (bent-over raises); on a bench or the floor the whole body leans or lies chest down
  clasp?: boolean; // side view: both hands meet in the middle (one handle, palms together)
  splay?: [number, number]; // side view: the near thigh opens out to the side (fire hydrant)
  swing?: [number, number]; // side view: the near forearm turns out about the upper arm (shoulder rotation)
  // extra turns after the flat pose is made: [parts, line, start, end] in degrees. Parts: body, trunk, head, or arm, fore, hand, leg,
  // shank, foot (both sides, mirrored) or with R (near) / L (far) in front; several joined by commas. Line: x (left-right), y (front-back),
  // z (up) in the room, px py pz the same on the pelvis, spine, bone (the part's own long line), up (the line of the part above it),
  // or cone (the part leans `start` degrees off its line and that lean goes round; `end` = where on the circle it begins).
  turn?: [string, 'x' | 'y' | 'z' | 'px' | 'py' | 'pz' | 'spine' | 'bone' | 'up' | 'cone', number, number][];
  tilt2?: number; // tilt at the end of the move, when it changes
  rise?: [number, number]; // height of the pelvis above the floor, when the flat pose cannot know it (lying on the side)
  sway?: [number, number]; // the whole body shifts sideways
  slide?: [number, number]; // the whole body shifts forward
  rest?: { on: string[]; r: number; roller?: boolean; along?: boolean; fixed?: boolean; dx?: number; dy?: number }; // a ball or foam roller on the floor under the middle of these 3D segments
  kit?: 'wheel' | 'stick' | 'footbar' | 'door' | 'rollbars' | 'midbox' | 'preacher' | 'landmine' | 'tbar' | 'abwheel' | 'smallbar' | 'hammer' | 'tire' | 'backplate' | 'prowler' | 'seatbox'; // a plate held like a steering wheel, a roller stick in the hands, a machine bar at the feet, a doorway
  pass?: boolean; // one kettlebell, handed from the near hand to the far hand half way
  orbit?: number; // the hips draw a level circle this wide while the feet stay put
  az?: number; el?: number; // where the 3D camera starts
  cord?: Cord; // the cable, band or rope the 3D figure pulls on
  decline?: number; // 3D only: the whole body tips head-down this many degrees on a decline board
};
// A cable, band or rope in the 3D view. `on` = what it is tied to: each hand (hands), the near hand, one bar, rope or
// V handle held in both hands, both hands on one handle, an ankle cuff, a loop round both ankles or knees, the neck, the
// hips, the ends of the barbell, or a skipping rope. The fixed end: `to` = [forward, out to the side, height above the
// floor] in body units, measured from where the handle starts (side: + = away from the body for a hand, the near side
// for one handle; height -1 = level with the handle); `under` = stood on; `drop` = straight below on the floor.
export type Cord = {
  kind?: 'cable' | 'band' | 'rope' | 'strap';
  on?: 'hands' | 'hand' | 'bar' | 'rope' | 'vbar' | 'both' | 'ankle' | 'ankleL' | 'feet' | 'ankles' | 'knees' | 'neck' | 'hips' | 'barends' | 'assist' | 'skip';
  to?: [number, number, number]; under?: boolean; drop?: boolean;
  tail?: boolean; // the rope hangs on down to the floor
  bare?: boolean; // no pulley post
  wide?: number; // how far a bar sticks out past the hands
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
export function fk(A: Angles, front: boolean, sit = false): Pts {
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
    let kn = at(hp, th, L.thigh);
    if (front && sit) kn = [kn[0], hp[1] + 8]; // seated toward the camera: the knee sits just below the hip, as far out as the thigh opens
    const ts = front && sit ? t + 180 : th + k * A.knee[s];
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
  const o = fk(pose.start, pose.view === 'front', pose.sit);
  rest(o, fixOf(pose));
  if (pose.ground === 'bench') { // a bench holds the pelvis, so drop the floor below anything that swings under it
    let sink = 0;
    for (let i = 0; i <= 10; i++) { const f = solve(pose, o, i / 10); for (const k of KEYS) sink = Math.max(sink, f[k][1] + (R[k] ?? 0)); }
    shift(o, 0, -sink);
    // and a bench has legs: when the body lies on the floor (nothing hangs down to it), lift it to bench height
    let low: Key = 'pelvis';
    for (const k of KEYS) if (o[k][1] + (R[k] ?? 0) > o[low][1] + (R[low] ?? 0)) low = k;
    const seat = o.pelvis[1] + (R.pelvis ?? 7) + 2.6;
    if ((!/^(an|heel|toe)/.test(low) || o[low][1] - o.pelvis[1] < 15) && seat > -18) shift(o, 0, -(seat + 18));
  }
  return o;
}

// Declared before solve(): Reanimated compiles worklets to consts, so a worklet must exist before one that calls it.
// Bike crank from the base pose (feet on opposite pedals): centre, radius, and the near pedal's starting angle.
export function crankOf(b: Pts): [[number, number], number, number] {
  'worklet';
  const c: [number, number] = [(b.an0[0] + b.an1[0]) / 2, (b.an0[1] + b.an1[1]) / 2];
  return [c, Math.hypot(b.an0[0] - c[0], b.an0[1] - c[1]), angle(c, b.an0)];
}
// breath (-1..1) lifts the shoulders a touch; nod tilts the head (head follow).
export function solve(pose: Pose, b: Pts, p: number, breath = 0, nod = 0): Pts {
  'worklet';
  const a = mix(pose.start, pose.end, p);
  a.shrug += 0.5 * breath;
  a.neck += nod;
  const o = fk(a, pose.view === 'front', pose.sit);
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
  if (pose.machine === 'bike') { // pedals go round the crank, half a turn apart
    const [c, r, t0] = crankOf(b);
    for (const n of ['0', '1']) ik(o, ('hp' + n) as Key, ('kn' + n) as Key, ('an' + n) as Key, at(c, t0 + 360 * p + (n === '1' ? 180 : 0), r), L.thigh, L.shin);
  }
  const up = (pose.lift ?? 0) * p + (pose.hop ?? 0) * 4 * p * (1 - p);
  if (up || pose.land) shift(o, (pose.land ?? 0) * p, -up);
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
  return pose.pace === 'cycle' || pose.pace === 'spin' ? 2 * (pose.tempo ?? 0.5) : pose.pace === 'hold' ? 5.4 : 3.3;
}
// t in [0, 1) is the position in one rep. Returns the pose mix p (0 = start, 1 = end) and the effort g (0.3..1),
// which builds while the muscle shortens, peaks at the top and eases off while lowering.
export function phase(pose: Pose, t: number): [number, number] {
  'worklet';
  if (pose.pace === 'cycle') return [0.5 - 0.5 * Math.cos(2 * Math.PI * t), 0.75 + 0.25 * Math.sin(2 * Math.PI * t)];
  if (pose.pace === 'spin') return [t, 0.75 + 0.25 * Math.sin(4 * Math.PI * t)];
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
// Bikes: the start legs put the feet on opposite pedals; solve() then turns the crank and the legs follow by IK.
const bike = (spine: number, sh: number, el: number) => {
  const a = A(spine, [100, 55], [110, 45], [10, 20], sh, el);
  return side(a, a, { ground: 'bench', machine: 'bike', pace: 'spin', tempo: 0.5, guide: { joint: 'kn0' } });
};
// Running gaits, from an easy jog to a sprint: longer stride, higher knees, bigger arm swing and a faster cadence.
const gait = (spine: number, hip: Pair, knee: Pair, sh: Pair, tempo: number, o: Partial<Pose> = {}) => {
  const a = A(spine, hip, knee, [-5, 25], sh, 90);
  return side(a, alt(a), { fix: 'pelvis', pace: 'cycle', tempo, guide: { axis: ['pelvis', 'neck'] }, ...o });
};
const JOG = (o: Partial<Pose> = {}) => gait(5, [30, -12], [30, 55], [-25, 30], 0.42, o);
const RUN = (o: Partial<Pose> = {}) => gait(10, [45, -20], [40, 75], [-35, 40], 0.35, o);
const SPRINT = (o: Partial<Pose> = {}) => gait(16, [72, -25], [60, 105], [-55, 65], 0.27, o);
const TREAD = { machine: 'treadmill' as const };
const hang = (start: Angles, end: Angles, o: Partial<Pose> = {}) => side(start, end, { ground: 'hang', prop: 'bar', ...o });
const calf = (sh: number, el: number, o: Partial<Pose> = {}) => side(St(0, 0, 0, sh, el), A(0, 0, 0, 35, sh, el), { fix: 'toe0', ...o });
const step = (endFar: [number, number], o: Partial<Pose> = {}, sh: [number, number] = [15, 0], el: [number, number] = [0, 0]) =>
  side(A(15, [70, -10], [85, 5], [-30, 10], sh[0], el[0]), A(0, [0, endFar[0]], [0, endFar[1]], [0, 15], sh[1], el[1]), { fix: 'an0', box: 'an0', ...o });

const BB_SQUAT = squat(-15, 155, -15, 155, { prop: 'barbell', rack: 'back' });
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
const PLANK = side(A(83, 0, 0, 8, 83, 90), A(82, 2, 0, 8, 82, 90), { ground: 'floor', fix: 'toe0', pace: 'hold', guide: { axis: ['an0', 'sh0'] } });
const DIPS = side(A(15, 10, 70, 20, 15, 0), A(25, 10, 70, 20, -50, 95), { ground: 'hang', prop: 'bar', con: 'back', guide: { joint: 'el0' } });
const SHRUG = side(St(0, 0, 3, 0, 0), St(0, 0, 3, 0, 0, { shrug: 5 }), { prop: 'barbell' });
const LUNGES = lunge(3, 0, { prop: 'dumbbell' });

// Box jump: from a quarter squat with the arms back, up and forward onto a box, landing soft with the feet flat.
const BOX_JUMP = side(St(30, 75, 75, -15, 0), St(12, 35, 35, 150, 10), { lift: 20, hop: 16, land: 24, pace: 'cycle', tempo: 0.6, guide: { joint: 'kn0' } });
// Movements only the 3D figure can show (see Pose.d3): the flat figure keeps treating them as borrowed.
const D3 = (p: Pose): Pose => ({ ...p, weak: true, d3: true });
// rear-delt raises: arms lift out to the sides while the trunk is bent over, or lies chest down on a bench
const REAR = (tilt: number, o: Partial<Pose> = {}, one = false) =>
  D3(front(A(0, 5, 0, 0, 6, 10), A(0, 5, 0, 0, one ? [86, 6] : 86, 15), { prop: 'dumbbell', one, tilt, guide: { joint: 'sh0' }, ...o }));
// shoulder rotation: elbow tucked in and bent to a right angle, the forearm sweeps like a gate
const ROT = (a: number, b: number) => D3(side(St(0, 0, 3, 5, 90), St(0, 0, 3, 5, 90), { swing: [a, b], guide: { joint: 'el0' } }));
const HYDRANT = D3(side(quad(), quad(), { ground: 'floor', fix: 'kn1', lock: true, pin: 'hands', splay: [0, 65], guide: { joint: 'hp0' } }));
// lying on the side: the flat pose is made lying on the back, then the whole body rolls onto its far side (near limbs on top)
const ON_SIDE = (start: Angles, end: Angles, o: Partial<Pose> = {}) =>
  D3(side(start, end, { ground: 'floor', fix: 'pelvis', rise: [10, 10], az: 75, el: 0.5, ...o, turn: [...(o.turn ?? []), ['body', 'pz', 90, 90]] }));
const INC_SHRUG = (prop: Pose['prop']) => side(A(-45, 40, 85, 0, 135, 12), A(-45, 40, 85, 0, 135, 0), { ground: 'bench', prop, guide: { axis: ['sh0', 'wr0'] } });
export const POSES: Record<string, Pose> = {
  // legs
  Barbell_Squat: BB_SQUAT,
  Smith_Machine_Squat: BB_SQUAT,
  Goblet_Squat: GOBLET,
  Front_Squats_With_Two_Kettlebells: GOBLET,
  Front_Squat_Clean_Grip: ((p: Pose): Pose => ({ ...p, rack: 'front' }))(squat(75, 150, 105, 150, { prop: 'barbell' }, 112, 25)),
  Bodyweight_Squat: BW_SQUAT,
  Dumbbell_Squat: DB_SQUAT,
  Hack_Squat: side(St(-5, 0, 5, 20, 150), St(10, 100, 115, 20, 150), { con: 'back', guide: { joint: 'kn0' } }),
  Freehand_Jump_Squat: side(St(38, 112, 112, -30, 0), A(0, 0, 0, 25, 160, 5), { lift: 12, pace: 'cycle', tempo: 0.6 }),
  Front_Box_Jump: BOX_JUMP,
  Box_Jump_Multiple_Response: BOX_JUMP,
  'wg_wall-sit': side(St(0, 90, 90, 40, 30), St(0, 88, 88, 40, 30), { wall: 'back', pace: 'hold', guide: { joint: 'kn0' } }),
  Plie_Dumbbell_Squat: front(A(0, 22, 0, 0, -12, 0), A(0, 55, 55, 0, -12, 0), { prop: 'dumbbell', one: true, con: 'back', }),
  Leg_Press: side(A(-50, 70, 10, -10, 20, 30), A(-50, 125, 105, -40, 20, 30), { ground: 'bench', machine: 'sled', con: 'back', guide: { joint: 'kn0' } }),
  Leg_Extensions: side(A(-5, 85, 90, 0, 15, 30), A(-5, 85, 5, 0, 15, 30), { ground: 'bench', guide: { joint: 'kn0' } }),
  Lying_Leg_Curls: side(A(90, 0, 5, 20, 150, 60), A(90, 0, 115, 20, 150, 60), { ground: 'bench', guide: { joint: 'kn0' } }),
  Seated_Leg_Curl: side(A(-10, 90, 10, 0, 20, 30), A(-10, 90, 100, 0, 20, 30), { ground: 'bench', guide: { joint: 'kn0' } }),
  Dumbbell_Lunges: LUNGES,
  Dumbbell_Rear_Lunge: LUNGES,
  Barbell_Lunge: lunge(-15, 155, { prop: 'barbell', rack: 'back' }),
  Barbell_Walking_Lunge: lunge(-15, 155, { prop: 'barbell', rack: 'back' }),
  Split_Squat_with_Dumbbells: LUNGES,
  Bodyweight_Walking_Lunge: lunge(-20, 100),
  Scissors_Jump: side(LUNGE_BOTTOM, alt(LUNGE_BOTTOM), { fix: 'pelvis', hop: 10, pace: 'cycle', tempo: 0.45 }),
  Kneeling_Hip_Flexor: side(A(0, [80, -5], [80, 95], [0, 80], 0, 0), A(-3, [65, -25], [60, 78], [8, 80], 0, 0), { ground: 'floor', fix: 'kn1', pin: 'foot', pace: 'hold' }),
  Dumbbell_Step_Ups: step([10, 30], { prop: 'dumbbell' }),
  Barbell_Step_Ups: step([10, 30], { prop: 'barbell', rack: 'back' }, [-15, -15], [155, 155]),
  'Step-up_with_Knee_Raise': step([95, 95]),
  Standing_Calf_Raises: calf(20, 150),
  'wg_calf-raise': calf(-20, 100),
  Calf_Raise_On_A_Dumbbell: calf(-20, 100),
  Seated_Calf_Raise: side(A(0, 90, 90, -15, 45, 40), A(0, 90, 90, 25, 45, 40), { ground: 'bench' }),
  // hinges and glutes
  Romanian_Deadlift: RDL,
  'Stiff-Legged_Dumbbell_Deadlift': hinge(78, 85, 5, { prop: 'dumbbell' }),
  Good_Morning: side(St(0, 0, 6, -15, 155), St(70, 80, 15, -15, 155), { prop: 'barbell', rack: 'back', con: 'back', guide: { joint: 'hp0', axis: ['pelvis', 'neck'] } }),
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
  Dumbbell_Flyes: benchP(90, 10, 15, 25, { prop: 'dumbbell', guide: { joint: 'sh0' } }),
  f_incline_fly: benchP(90, 10, 15, 25, { prop: 'dumbbell', guide: { joint: 'sh0' } }, -45),
  f_floor_press: side(LYING(50, 100, 22, 90, 0), LYING(50, 100, 22, 10, 80), { ground: 'floor', prop: 'barbell', con: 'back', guide: { joint: 'el0', axis: ['el0', 'wr0'] } }),
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
  Front_Plate_Raise: side(St(0, 0, 3, 5, 5), St(0, 0, 3, 90, 5), { kit: 'wheel' }),
  Band_Pull_Apart: front(A(0, 5, 0, 0, 30, 5), A(0, 5, 0, 0, 88, 5), { prop: 'band' }),
  Reverse_Machine_Flyes: D3(side(A(0, 90, 90, 0, 88, 5), A(0, 90, 90, 0, 88, 5), { ground: 'bench', pad: false, turn: [['arm', 'z', 5, 95]], guide: { joint: 'sh0' } })), // seated, straight arms sweep back from the front
  g_rev_fly_stand: front(A(0, 5, 0, 0, 30, 5), A(0, 5, 0, 0, 88, 5)),
  Face_Pull: side(St(0, 0, 3, 85, 5), St(0, 0, 3, 80, 130), { prop: 'band', line: [40, 0] }),
  Upright_Barbell_Row: side(St(0, 0, 3, 0, 5), St(0, 0, 3, 75, 150, { shrug: 2 }), { prop: 'barbell' }),
  Barbell_Shrug: SHRUG,
  Dumbbell_Shrug: { ...SHRUG, prop: 'dumbbell' },
  Shoulder_Circles: side(St(0, 0, 3, -10, 0), St(0, 0, 3, 10, 0, { shrug: 4 }), { pace: 'cycle', tempo: 0.8 }),
  Arm_Circles: front(A(0, 5, 0, 0, 80, 0), A(0, 5, 0, 0, 100, 0), { pace: 'cycle', tempo: 0.4 }),
  Side_Neck_Stretch: front(A(0, 5, 0, 0, 5, 5), A(0, 5, 0, 0, 5, 5, { neck: 28 }), { pace: 'hold' }),
  // Neck work: the head moves against a hand, a plate or a harness while the body stays still.
  Chin_To_Chest_Stretch: side(A(0, 90, 0, 0, 155, 150), A(5, 90, 0, 0, 150, 150, { neck: 40 }), { ground: 'floor', pace: 'hold', guide: { axis: ['neck', 'head'] } }),
  'Isometric_Neck_Exercise_-_Front_And_Back': side(St(0, 0, 3, 125, 120), St(0, 0, 3, 125, 120, { neck: -4 }), { pace: 'hold', guide: { axis: ['neck', 'head'] } }),
  'Isometric_Neck_Exercise_-_Sides': front(A(0, 5, 0, 0, [150, 5], [135, 5]), A(0, 5, 0, 0, [150, 5], [135, 5], { neck: -4 }), { pace: 'hold' }),
  Lying_Face_Down_Plate_Neck_Resistance: side(A(90, 0, 0, 30, 165, 120, { neck: 40 }), A(90, 0, 0, 30, 165, 120, { neck: -30 }), { ground: 'bench', prop: 'plate', guide: { axis: ['neck', 'head'] } }),
  Lying_Face_Up_Plate_Neck_Resistance: side(A(-90, 0, 0, 30, 165, 120, { neck: -35 }), A(-90, 0, 0, 30, 165, 120, { neck: 40 }), { ground: 'bench', prop: 'plate', guide: { axis: ['neck', 'head'] } }),
  // ---- families drawn for exercises that used to borrow a different movement (f_ keys are not dataset ids) ----
  // Wrist curls: seated, forearms along the thighs, only the hand moves.
  f_wrist_curl: side(A(15, 75, 90, 0, 30, 75), A(15, 75, 90, 0, 30, 75), { ground: 'bench', prop: 'dumbbell', flex: [60, -45], guide: { axis: ['el0', 'wr0'] } }),
  f_wrist_behind: side(St(0, 0, 3, -12, 0), St(0, 0, 3, -12, 0), { prop: 'barbell', flex: [0, 45] }),
  f_dead_hang: hang(A(0, 0, 0, 15, 180, 0), A(0, 0, 0, 15, 180, 0, { shrug: 3 }), { pace: 'hold' }),
  f_grip_hold: side(St(0, 0, 3, 0, 0), St(0, 0, 3, 0, 0, { shrug: 1 }), { prop: 'dumbbell', pace: 'hold' }),
  // Olympic lifts and kettlebell cleans: from the floor or the hang to the shoulders or overhead.
  f_clean: side(St(58, 100, 70, 58, 0), St(10, 45, 45, 85, 150), { prop: 'barbell', guide: { axis: ['pelvis', 'neck'] } }),
  f_hang_clean: side(St(35, 45, 25, 35, 0), St(10, 45, 45, 85, 150), { prop: 'barbell', guide: { axis: ['pelvis', 'neck'] } }),
  f_snatch: side(St(58, 100, 70, 58, 0), St(8, 50, 50, 175, 5), { prop: 'barbell', guide: { axis: ['el0', 'wr0'] } }),
  f_hang_snatch: side(St(35, 45, 25, 35, 0), St(8, 50, 50, 175, 5), { prop: 'barbell', guide: { axis: ['el0', 'wr0'] } }),
  f_pull: side(St(58, 100, 70, 58, 0), A(-4, 0, 0, 30, -4, 0, { shrug: 5 }), { prop: 'barbell', fix: 'toe0' }),
  f_high_pull: side(St(50, 95, 75, 50, 0), St(0, 0, 3, 75, 150, { shrug: 3 }), { prop: 'kettlebell' }),
  f_kb_clean: side(St(55, 80, 25, 30, 0), St(0, 0, 3, 20, 150), { prop: 'kettlebell', one: true }),
  f_kb_snatch: side(St(55, 80, 25, 30, 0), St(0, 0, 3, 175, 5), { prop: 'kettlebell', one: true, guide: { axis: ['el0', 'wr0'] } }),
  f_clean_press: side(St(10, 45, 45, 85, 150), St(0, 0, 3, 172, 5), { prop: 'barbell', guide: { axis: ['el0', 'wr0'] } }),
  f_thruster: side(St(35, 110, 110, 85, 150), St(0, 0, 3, 172, 5), { prop: 'kettlebell', guide: { joint: 'kn0' } }),
  f_snatch_balance: side(St(0, 0, 3, -15, 155), St(30, 110, 110, 165, 5), { prop: 'barbell', guide: { axis: ['el0', 'wr0'] } }),
  // Side bends and windmills, seen from the front.
  f_side_bend: front(A(0, 5, 0, 0, 5, 5), A(22, [-17, 27], 0, 0, 5, 5), { prop: 'dumbbell', one: true, guide: { axis: ['pelvis', 'neck'] } }),
  f_windmill: front(A(0, 12, 0, 0, [175, 5], [5, 5]), A(-45, [57, -33], 0, 0, [175, 5], [5, 5]), { prop: 'kettlebell', one: true, pace: 'hold' }),
  // Pullovers: lying on a bench, arms sweep from behind the head to over the chest.
  f_pullover: benchP(90, 10, 185, 10, { prop: 'dumbbell', guide: { joint: 'sh0' } }),
  f_pullover_bent: benchP(90, 60, 185, 60, { prop: 'barbell', guide: { joint: 'sh0' } }),
  // Upside-down pressing.
  f_pike_pushup: side(A(135, 110, 0, 35, 140, 15), A(142, 108, 0, 40, 100, 95), { ground: 'floor', fix: 'toe0', pin: 'hands', con: 'back', guide: { joint: 'el0' } }),
  f_handstand_pushup: side(A(180, 0, 0, 30, 180, 0), A(180, 0, 0, 30, 140, 110), { ground: 'floor', fix: 'wr0', pin: 'hands', wall: 'back', con: 'back', guide: { joint: 'el0' } }),
  // Medicine ball throws and slams.
  f_slam: side(St(-5, 0, 3, 175, 10), St(55, 90, 60, 75, 0), { prop: 'ball', pace: 'cycle', tempo: 0.6 }),
  f_chest_pass: side(St(5, 10, 15, 40, 130), St(15, 15, 20, 90, 5), { prop: 'ball', pace: 'cycle', tempo: 0.5 }),
  f_scoop_throw: side(St(40, 110, 100, 30, 0), A(-5, 0, 0, 30, 165, 10), { prop: 'ball', fix: 'toe0', pace: 'cycle', tempo: 0.6 }),
  f_overhead_throw: side(St(-8, 0, 10, 185, 40), St(10, 5, 10, 120, 5), { prop: 'ball', pace: 'cycle', tempo: 0.5 }),
  f_supine_throw: side(LYING(50, 100, 22, 180, 10), A(-55, 74, 100, 22, 110, 10, { curve: 15 }), { ground: 'floor', prop: 'ball', pace: 'cycle', tempo: 0.6 }),
  // Core on the knees, on bars, on a bench.
  f_rollout: side(A(55, 55, 90, 90, 55, 0), A(80, 15, 90, 90, 160, 0), { ground: 'floor', fix: 'kn0', lock: true, kit: 'abwheel', con: 'back', guide: { axis: ['kn0', 'sh0'] } }),
  f_lsit: side(A(5, 90, 0, 30, 5, 0), A(5, 92, 0, 30, 5, 0), { ground: 'hang', prop: 'bar', pace: 'hold', guide: { joint: 'hp0' } }),
  f_bar_knee_raise: side(A(10, 10, 70, 20, 10, 0), A(15, 100, 90, 20, 10, 0, { curve: 12 }), { ground: 'hang', prop: 'bar', guide: { joint: 'hp0' } }),
  f_dragon_flag: side(A(-150, 0, 0, 30, 165, 40), A(-110, 0, 0, 30, 165, 40), { ground: 'floor', fix: 'sh0', con: 'back', guide: { axis: ['sh0', 'an0'] } }),
  f_pallof: side(St(0, 0, 5, 20, 150), St(0, 0, 5, 90, 0), { prop: 'band', line: [0, 0], pace: 'hold' }),
  // Fast feet in place.
  f_high_knees: gait(2, [92, -5], [95, 10], [-30, 30], 0.3),
  f_butt_kicks: gait(6, [15, -5], [135, 10], [-20, 20], 0.3),
  f_donkey_kick: side(quad(), A(90, [-15, 90], [95, 90], [10, 90], 90, 0), { ground: 'floor', fix: 'kn1', lock: true, pin: 'hands', guide: { joint: 'hp0' } }),
  f_prone_y: side(A(90, 0, 0, 60, 175, 0), A(86, -4, 0, 60, 185, 0, { neck: -8 }), { ground: 'floor', pace: 'hold' }),
  // Stretches.
  f_quad_stretch: side(St(0, 0, 3, 0, 0), A(0, [-12, 0], [145, 3], [40, -3], [-35, 0], [0, 0]), { fix: 'an1', pace: 'hold', guide: { joint: 'kn0' } }),
  f_triceps_stretch: side(St(0, 0, 3, 0, 0), St(0, 0, 3, [175, 150], [150, 100]), { pace: 'hold', guide: { joint: 'el0' } }),
  f_reach_up: side(St(0, 0, 3, 0, 0), St(-4, 0, 3, 180, 0, { curve: -6 }), { fix: 'toe0', pace: 'hold' }),
  f_lateral_stretch: front(A(0, 5, 0, 0, [5, 5], [5, 5]), A(-20, [25, -15], 0, 0, [170, 5], [15, 5]), { pace: 'hold' }),
  f_arms_back: side(St(0, 0, 3, 0, 0), St(0, 0, 3, -55, 60, { curve: -6 }), { pace: 'hold' }),
  f_butterfly_stretch: front(A(0, 50, 135, 0, [20, 20], [20, 20]), A(0, 62, 135, 0, [20, 20], [20, 20]), { ground: 'floor', pace: 'hold' }),
  f_ghr: side(A(0, 0, 90, 90, 10, 140), A(65, 0, 90, 90, 10, 140), { ground: 'floor', fix: 'kn0', lock: true, con: 'back', guide: { axis: ['kn0', 'neck'] } }),
  f_seated_tuck: side(A(-35, 25, 10, 20, -35, 10), A(-30, 115, 120, 20, -30, 10, { curve: 10 }), { ground: 'bench', pad: false, guide: { joint: 'hp0' } }),
  f_spider_curl: side(A(45, 45, 90, 0, 45, 0), A(45, 45, 90, 0, 45, 130), { ground: 'bench', prop: 'barbell', guide: { joint: 'el0', axis: ['sh0', 'el0'] } }),
  f_incline_row: side(A(45, 45, 90, 0, 45, 0), A(45, 45, 90, 0, -30, 110), { ground: 'bench', prop: 'barbell', guide: { joint: 'el0' } }),
  f_drag_curl: side(St(0, 0, 3, 0, 8), St(0, 0, 3, -35, 125), { prop: 'barbell', guide: { joint: 'el0' } }),
  f_overhead_curl: front(A(0, 5, 0, 0, 90, 5), A(0, 5, 0, 0, 90, 125), { guide: { joint: 'el0' } }),
  f_wrist_roller: side(St(0, 0, 3, 90, 0), St(0, 0, 3, 90, 0), { prop: 'barbell', flex: [35, -35], pace: 'cycle', tempo: 0.5 }),
  f_stone: side(St(55, 110, 95, 60, 40), St(0, 0, 3, 35, 125), { prop: 'ball', guide: { axis: ['pelvis', 'neck'] } }),
  f_rope_climb: hang(A(0, [10, 40], [10, 50], 15, [175, 145], [5, 60]), A(0, [40, 10], [50, 10], 15, [145, 175], [60, 5]), { pace: 'cycle', tempo: 0.8 }),
  f_arm_drill: side(A(0, 0, 90, 90, [-40, 50], 90), A(0, 0, 90, 90, [50, -40], 90), { ground: 'floor', fix: 'kn0', lock: true, pace: 'cycle', tempo: 0.3 }),
  f_leg_swing: side(A(0, [-25, 0], [5, 3], [10, -3], [10, -10], 10), A(0, [60, 0], [5, 3], [0, -3], [-10, 10], 10), { fix: 'an1', lock: true, pace: 'cycle', tempo: 0.7 }),
  f_hip_flexion: side(St(0, 0, 3, 5, 5), A(0, [60, 0], [10, 3], [10, -3], 5, 5), { fix: 'an1', lock: true, guide: { joint: 'hp0' } }),
  f_landmine: side(St(15, 15, 15, 60, 125), St(20, 15, 15, 135, 5), { kit: 'landmine', guide: { joint: 'el0' } }),
  f_fast_feet: gait(15, [30, 10], [45, 30], [-20, 20], 0.18),
  f_crucifix: front(A(0, 5, 0, 0, 88, 5), A(0, 5, 0, 0, 86, 5), { prop: 'dumbbell', pace: 'hold', guide: { joint: 'sh0' } }),
  // Lateral lunge seen from the front: the near knee bends and the hips sit toward it, the far leg stays long.
  f_side_lunge: front(A(0, 22, 0, 0, 80, 140), A(-5, [50, 30], [50, 0], 0, 80, 140), { pin: 'feet', prop: 'barbell', con: 'back', guide: { joint: 'kn0' } }),
  f_standing_adduction: front(A(0, [3, 28], 0, 0, 10, 0), A(0, [3, -6], 0, 0, 10, 0), { guide: { joint: 'hp0' } }),
  f_side_leg_raise: front(A(-90, 0, 0, 0, [180, 10], [20, 0]), A(-90, [0, 40], 0, 0, [180, 10], [20, 0]), { ground: 'floor' }),
  f_standing_cable_crunch: side(St(0, 0, 8, 165, 145), St(42, 32, 15, 165, 145, { curve: 20, neck: 15 }), { prop: 'band', line: [0, -35], guide: { joint: 'hp0' } }),
  f_hollow: side(A(-72, 30, 0, 25, 165, 0, { curve: 14, neck: 20 }), A(-74, 28, 0, 25, 168, 0, { curve: 15, neck: 20 }), { ground: 'floor', pace: 'hold', guide: { joint: 'hp0' } }),
  f_jump_rope: front(A(0, 3, 4, 5, 22, 45), A(0, 3, 12, 15, 24, 45), { hop: 5, pace: 'cycle', tempo: 0.22 }),
  f_overhead_squat: squat(180, 0, 188, 0, { prop: 'barbell' }, 105, 25),
  f_barbell_hack: squat(0, 0, 18, 0, { prop: 'barbell' }, 100, 18),
  f_seated_fold: side(A(0, 92, 0, 0, 70, 0), A(48, 140, 0, 0, 95, 0, { curve: 15, neck: 10 }), { ground: 'floor', fix: 'pelvis', pace: 'hold', guide: { joint: 'hp0' } }),
  // drawn for moves that had fallen back to the photo
  // side plank seen from the front: far forearm on the floor, near hand on the hip, hips lift off the floor
  f_side_bridge: front(A(70, [12, -12], 0, 0, [5, 70], [10, 95]), A(78, [4, -4], 0, 0, [5, 78], [10, 95]), { ground: 'floor', fix: 'el1', lock: true, pace: 'hold', guide: { axis: ['an0', 'neck'] } }),
  // lying on the side, the top arm raises the bell from the thigh to straight up
  f_side_raise: front(A(90, 0, 0, 0, [0, 170], [10, 60]), A(90, 0, 0, 0, [90, 170], [5, 60]), { ground: 'floor', prop: 'dumbbell', one: true, guide: { joint: 'sh0' } }),
  f_seated_cable_press: side(A(-8, 98, 90, 0, -50, 125), A(-8, 98, 90, 0, 82, 0), { ground: 'bench', prop: 'band', line: [-50, 0], con: 'out', guide: { joint: 'el0', axis: ['el0', 'wr0'] } }),
  f_incline_cable_press: benchP(90, 0, -20, 110, { prop: 'band', line: [0, 50] }, -45),
  f_standing_cable_press: side(St(5, [20, -10], [5, 5], -30, 110), St(10, [20, -10], [5, 5], 85, 0), { fix: 'an0', prop: 'band', line: [-50, 0], guide: { joint: 'el0', axis: ['el0', 'wr0'] } }),
  f_iso_row: side(A(10, 85, 90, -15, 80, 0), A(5, 80, 90, -15, -35, 110), { ground: 'bench', guide: { joint: 'el0', axis: ['pelvis', 'neck'] } }),
  f_high_row: side(A(5, 85, 90, -10, 140, 0), A(0, 80, 90, -10, -5, 120), { ground: 'bench', guide: { joint: 'el0', axis: ['pelvis', 'neck'] } }),
  f_chest_row: side(St(45, 50, 25, 45, 0), St(45, 50, 25, -35, 110), { prop: 'barbell', guide: { joint: 'el0', axis: ['pelvis', 'neck'] } }),
  f_lying_cable_curl: benchP(140, 0, 140, 125, { prop: 'band', line: [-30, -30], con: 'out' }),
  // prone over a high bench, legs hang down and swing up behind
  f_rev_hyper: side(A(90, 90, 0, 20, 90, 0), A(90, -12, 0, 20, 90, 0), { ground: 'bench', guide: { joint: 'hp0' } }),
  f_susp_crunch: side(A(73, 0, 0, 15, 73, 0), A(112, 118, 115, 25, 112, 0, { curve: 15 }), { ground: 'floor', fix: 'wr0', lock: true, pin: 'hands', guide: { joint: 'hp0' } }),
  f_bosu_crunch: side(A(-45, 55, 100, 0, 160, 150), A(5, 105, 100, 0, 160, 150, { curve: 15 }), { ground: 'bench', pad: false, prop: 'band', line: [-45, -10], guide: { joint: 'hp0' } }),
  // lying on the back, one leg up: knee straightens (90/90, leg-up hamstring stretch)
  f_lying_ham: side(LYING([90, 0], [90, 0], [30, 0], [40, 0], [50, 0]), LYING([100, 0], [5, 0], [30, 0], [70, 0], [10, 0]), { ground: 'floor', pace: 'hold', guide: { joint: 'kn0' } }),
  f_prone_quad: side(A(88, 0, [10, 0], [70, 70], [-20, 170], [0, 40]), A(86, 0, [145, 0], [40, 70], [-50, 170], [0, 40]), { ground: 'floor', pace: 'hold', guide: { joint: 'kn0' } }),
  f_inchworm: side(St(135, 135, 0, 170, 5), A(73, 0, 0, 15, 73, 0), { fix: 'toe0', pace: 'cycle', tempo: 1.4, guide: { joint: 'hp0' } }),
  f_greatest: side(A(15, [90, -40], [75, 0], [0, 75], [15, 15], [0, 0]), A(65, [140, 10], [75, 0], [0, 75], [65, 185], [0, 0]), { fix: 'an0', pin: 'feet', pace: 'hold', guide: { joint: 'hp0' } }),
  f_seated_toe: side(A(5, 95, 0, 0, 60, 0), A(40, 132, 0, -25, 100, 0, { curve: 12 }), { ground: 'floor', fix: 'pelvis', pace: 'hold', guide: { joint: 'an0' } }),
  f_upper_back: side(St(0, 0, 3, 90, 0), St(0, 0, 3, 95, 0, { curve: 22, neck: 30 }), { pace: 'hold' }),
  f_wall_lat: side(St(0, 0, 0, [165, 0], [5, 0]), A(8, 0, 0, -8, [175, 0], [0, 0]), { fix: 'an0', pin: 'hand', wall: 'front', pace: 'hold', guide: { joint: 'sh0' } }),
  f_one_hang: hang(A(0, 5, 5, 15, [178, 0], [0, 0]), A(3, 5, 5, 15, [180, 0], [0, 0], { shrug: 3 }), { pace: 'hold', one: true }),
  f_overhead_lat: side(A(0, 90, 0, 0, 150, 140), A(-3, 90, 0, 0, 175, 145, { curve: -8 }), { ground: 'floor', fix: 'pelvis', pace: 'hold', guide: { joint: 'sh0' } }),
  f_side_reach: front(A(-90, 0, 0, 0, [180, 20], [10, 0]), A(-90, [0, -12], 0, 0, [180, 175], [10, 0]), { ground: 'floor', pace: 'hold' }),
  f_ankle_circles: side(A(0, [22, 0], [45, 0], [60, 0], 0, 0), A(0, [26, 0], [48, 0], [40, 0], 0, 0), { fix: 'an1', pace: 'cycle', tempo: 0.8 }),
  f_knee_circles: side(St(38, 58, 45, 26, 0), St(33, 48, 55, 24, 0), { pace: 'cycle', tempo: 0.8 }),
  f_chair_reach: side(A(0, 90, 90, 0, [5, 5], [10, 10]), A(8, 98, 90, 0, [175, 5], [0, 10], { curve: -5 }), { ground: 'bench', pad: false, pace: 'hold', guide: { joint: 'sh0' } }),
  f_sled_drag: walk(25, [40, -30], [70, 70]),
  // on the back, heels on an exercise ball, hips up: the knees pull the ball in
  f_ball_curl: side(A(-112, 0, 0, 10, -22, 0), A(-130, 35, 105, 10, -40, 0, { neck: 30 }), { ground: 'floor', fix: 'sh0', lock: true, under: { at: 'heel0', r: 19 }, guide: { joint: 'kn0' } }),
  // foam rolling: hands (or feet) stay planted and the body rolls over a roller that stays put
  f_smr_calves: side(A(-50, 40, 0, 15, -50, 0), A(-55, 35, 0, 15, -75, 0), { ground: 'floor', fix: 'wr0', lock: true, pin: 'hands', under: { at: 'kn0', mid: 'an0', r: 7.5, fixed: true }, pace: 'cycle', tempo: 1.2 }),
  f_smr_hamstrings: side(A(-50, 40, 0, 15, -50, 0), A(-55, 35, 0, 15, -75, 0), { ground: 'floor', fix: 'wr0', lock: true, pin: 'hands', under: { at: 'hp0', mid: 'kn0', r: 7.5, fixed: true }, pace: 'cycle', tempo: 1.2 }),
  f_smr_back: side(A(-96, 16, 105, 7, 150, 140), A(-96, 7, 66, 37, 150, 140), { ground: 'floor', fix: 'an0', lock: true, pin: 'feet', under: { at: 'pelvis', mid: 'neck', r: 5, fixed: true }, pace: 'cycle', tempo: 1.2 }),
  f_smr_quads: side(A(78, -5, 0, 20, 78, 90), A(84, -4, 0, 20, 50, 124), { ground: 'floor', fix: 'el0', lock: true, under: { at: 'hp0', mid: 'kn0', r: 6, fixed: true }, pace: 'cycle', tempo: 1.2 }),
  // ---- round 14: postures that used to borrow a standing (or lying) figure ----
  // pulldown seen from the side, so it can be done kneeling under a high pulley
  f_pulldown_side: side(St(-5, 0, 3, 168, 8), St(-10, 0, 3, 45, 135), { prop: 'band', line: [4, -42], guide: { joint: 'el0' } }),
  f_seated_crunch: side(A(-5, 85, 90, 0, 150, 140), A(40, 130, 90, 0, 150, 140, { curve: 20, neck: 12 }), { ground: 'bench', pad: false, guide: { joint: 'hp0' } }),
  f_seated_cable_crunch: side(A(-5, 85, 90, 0, 150, 140), A(40, 130, 90, 0, 150, 140, { curve: 20, neck: 12 }), { ground: 'bench', pad: false, prop: 'band', line: [-14, -38], guide: { joint: 'hp0' } }),
  f_dip_machine: side(A(0, 90, 90, 0, -35, 105), A(0, 90, 90, 0, -5, 5), { ground: 'bench', guide: { joint: 'el0' } }),
  f_machine_press: side(A(-8, 98, 90, 0, -50, 125), A(-8, 98, 90, 0, 82, 0), { ground: 'bench', guide: { joint: 'el0', axis: ['el0', 'wr0'] } }),
  f_pad_extension: side(A(10, 90, 90, -10, 60, 130), A(10, 90, 90, -10, 60, 10), { ground: 'bench', guide: { joint: 'el0' } }),
  f_calf_press: side(A(-50, 70, 10, -10, 20, 30), A(-50, 70, 10, 28, 20, 30), { ground: 'bench', machine: 'sled', guide: { joint: 'an0' } }),
  f_incline_raise: side(A(-40, 45, 85, 0, -40, 5), A(-40, 45, 85, 0, 60, 5), { ground: 'bench', prop: 'dumbbell', guide: { joint: 'sh0' } }),
  f_incline_skull: benchP(90, 0, 105, 115, { prop: 'barbell' }, -45),
  f_seated_kickback: side(A(55, 145, 90, 0, -50, 105), A(55, 145, 90, 0, -50, 0), { ground: 'bench', pad: false, prop: 'dumbbell', guide: { joint: 'el0' } }),
  f_seated_gm: side(A(0, 90, 90, 0, -15, 155), A(55, 145, 90, 0, -15, 155), { ground: 'bench', pad: false, prop: 'barbell', rack: 'back', con: 'back', guide: { joint: 'hp0', axis: ['pelvis', 'neck'] } }),
  f_chair_ham: side(A(0, [62, 90], [0, 90], [-20, 0], 5, 10), A(38, [100, 128], [0, 90], [-20, 0], 60, 5, { curve: 8 }), { ground: 'bench', pad: false, pace: 'hold', guide: { joint: 'hp0' } }),
  f_kneel_squat: side(A(5, 5, 90, 90, -15, 155), A(25, 75, 140, 90, -15, 155), { ground: 'floor', fix: 'kn0', lock: true, prop: 'barbell', rack: 'back', con: 'back', guide: { joint: 'hp0' } }),
  f_kneel_jump: side(A(5, 5, 90, 90, -15, 155), St(38, 112, 112, -15, 155), { ground: 'floor', prop: 'barbell', rack: 'back', pace: 'cycle', tempo: 0.7, guide: { joint: 'kn0' } }),
  f_gorilla: hang(A(5, 10, 20, 15, 172, 5), A(5, 100, 100, 15, 40, 140, { curve: 12 }), { guide: { joint: 'hp0' } }),
  f_prone_row: side(A(90, 0, 0, 20, 90, 0), A(90, 0, 0, 20, -25, 110), { ground: 'bench', prop: 'barbell', guide: { joint: 'el0' } }),
  f_standing_leg_curl: side(A(5, [0, 5], [5, 5], [-10, -5], 40, 30), A(5, [0, 5], [110, 5], [20, -5], 40, 30), { fix: 'an1', lock: true, guide: { joint: 'kn0' } }),
  f_hip_flexor_stand: side(A(0, [25, -15], [8, 12], [17, 30], -10, 60), A(-4, [55, -28], [58, 30], [0, 20], -10, 60), { fix: 'an0', pin: 'feet', pace: 'hold', guide: { joint: 'hp0' } }),
  // on the back, hips up, the heels walk (or slide) away and back
  f_ham_walkout: side(A(-108, 0, 95, 13, -18, 0, { neck: 18 }), A(-99, 4, 30, -10, -9, 0, { neck: 9 }), { ground: 'floor', fix: 'sh0', guide: { joint: 'kn0' } }),
  f_fallout: side(A(20, 0, 0, -20, 75, 0), A(58, 0, 0, -45, 165, 0), { fix: 'toe0', guide: { axis: ['an0', 'sh0'] } }),
  f_renegade: side(A(73, 0, 0, 15, 73, 0), A(73, 0, 0, 15, [-20, 73], [110, 0]), { ground: 'floor', fix: 'toe0', lock: true, prop: 'dumbbell', guide: { joint: 'el0', axis: ['an0', 'sh0'] } }),
  f_stand_twist: front(A(0, 8, 0, 0, [60, -25], [15, 70]), A(0, 8, 0, 0, [-25, 60], [70, 15]), { prop: 'ball', pace: 'cycle', tempo: 0.8 }),
  f_low_row_one: side(St(5, 5, 10, [80, 5], [0, 10]), St(5, 5, 10, [-25, 5], [100, 10]), { prop: 'band', line: [45, 22], guide: { joint: 'el0' } }),
  f_svend: side(St(0, 0, 3, 45, 130), St(0, 0, 3, 88, 5), { guide: { joint: 'el0' } }),
  f_antigravity: side(A(45, 45, 90, 0, 110, 125), A(45, 45, 90, 0, 172, 5), { ground: 'bench', prop: 'barbell', guide: { joint: 'el0' } }),
  // kneeling beside a bench, forearms across it, hands off the edge
  f_wrist_bench: side(A(15, 15, 90, 90, 30, 75), A(15, 15, 90, 90, 30, 75), { ground: 'floor', fix: 'kn0', lock: true, box: 'el0', prop: 'dumbbell', flex: [60, -45], guide: { axis: ['el0', 'wr0'] } }),
  f_high_plank: side(A(73, 0, 0, 15, 73, 0), A(72, 2, 0, 15, 72, 0), { ground: 'floor', fix: 'toe0', pace: 'hold', guide: { axis: ['an0', 'sh0'] } }),
  f_swim: side(A(88, [-6, 6], 0, 60, [178, 20], [5, 10], { neck: -12 }), A(88, [6, -6], 0, 60, [20, 178], [10, 5], { neck: -12 }), { ground: 'floor', pace: 'cycle', tempo: 0.7 }),
  Seated_Head_Harness_Neck_Resistance: side(A(40, 130, 95, 0, 45, 5, { neck: 40 }), A(40, 130, 95, 0, 45, 5, { neck: -25 }), { ground: 'bench', pad: false, guide: { axis: ['neck', 'head'] } }),
  // back
  Bent_Over_Barbell_Row: ROW,
  'T-Bar_Row_with_Handle': { ...ROW, kit: 'tbar', prop: 'none' },
  'Bent_Over_Two-Dumbbell_Row': { ...ROW, prop: 'dumbbell' },
  'One-Arm_Dumbbell_Row': side(St(75, 80, 25, 75, 0), St(75, 80, 25, [-45, 75], [110, 0]), { prop: 'dumbbell', one: true, box: 'wr1' }),
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
  Concentration_Curls: side(A(40, 95, 90, -35, 40, 5), A(40, 95, 90, -35, 40, 135), { ground: 'bench', pad: false, prop: 'dumbbell', one: true }),
  Preacher_Curl: ((p: Pose): Pose => ({ ...p, kit: 'preacher' }))(side(A(10, 90, 90, -10, 60, 10), A(10, 90, 90, -10, 60, 130), { ground: 'bench', prop: 'barbell' })),
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
  Flat_Bench_Lying_Leg_Raise: { ...LEG_RAISE, ground: 'bench' },
  Flutter_Kicks: side(LYING([22, 6], 0), LYING([6, 22], 0), { ground: 'floor', pace: 'cycle', tempo: 0.5 }),
  Air_Bike: side(A(-70, [100, 30], [100, 10], 20, 160, 140, { neck: 15, curve: 15 }), A(-70, [30, 100], [10, 100], 20, 160, 140, { neck: 15, curve: 15 }), { ground: 'floor', pace: 'cycle', tempo: 0.7 }),
  Alternate_Heel_Touchers: side(A(-72, 50, 100, 22, 10, 0, { neck: 15, curve: 15 }), A(-68, 50, 100, 22, 0, 0, { neck: 18, curve: 18 }), { ground: 'floor', pace: 'cycle', tempo: 0.8 }),
  Russian_Twist: side(A(-35, 95, 85, 20, 60, 30, { curve: 10 }), A(-38, 95, 85, 20, 60, 30, { curve: 10 }), { ground: 'floor', twist: [-45, 45], clasp: true, pace: 'cycle', tempo: 0.7 }),
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
  // Each treadmill and outdoor variant has its own gait: walk, incline walk (leaning in, shorter quicker steps on a
  // sloped belt), jog, run, sprint, trail and hill walking, stairs.
  Walking_Treadmill: walk(0, [-15, 15], [15, 15], TREAD),
  'wg_treadmill-incline-walk': side(A(10, [32, -8], [12, 18], [-12, 18], [-12, 12], 15), alt(A(10, [32, -8], [12, 18], [-12, 18], [-12, 12], 15)),
    { fix: 'pelvis', pace: 'cycle', tempo: 0.6, incline: 10, ...TREAD, guide: { axis: ['pelvis', 'neck'] } }),
  Jogging_Treadmill: JOG(TREAD),
  Running_Treadmill: RUN(TREAD),
  Trail_Running_Walking: JOG({ incline: 6 }),
  wg_hiking: side(A(12, [38, -8], [20, 18], [-12, 18], [-10, 15], 20), alt(A(12, [38, -8], [20, 18], [-12, 18], [-10, 15], 20)),
    { fix: 'pelvis', pace: 'cycle', tempo: 0.7, incline: 12, guide: { axis: ['pelvis', 'neck'] } }),
  Wind_Sprints: hang(A(0, [95, 0], [95, 10], 15, 180, 0, { curve: 10 }), A(0, [0, 95], [10, 95], 15, 180, 0, { curve: 10 }), { pace: 'cycle', tempo: 0.6, guide: { joint: 'hp0' } }),
  Bench_Sprint: SPRINT(),
  'Single-Cone_Sprint_Drill': SPRINT(),
  Prowler_Sprint: gait(45, [80, -10], [80, 40], [70, 70], 0.4, { kit: 'prowler', guide: { axis: ['an1', 'neck'] } }),
  Stairmaster: side(A(5, [70, 0], [85, 5], [-10, 15], [-15, 15], 30), alt(A(5, [70, 0], [85, 5], [-10, 15], [-15, 15], 30)), { fix: 'pelvis', pace: 'cycle', tempo: 0.65 }),
  Step_Mill: side(A(8, [75, 0], [90, 5], [-10, 15], [-15, 15], 30), alt(A(8, [75, 0], [90, 5], [-10, 15], [-15, 15], 30)), { fix: 'pelvis', pace: 'cycle', tempo: 0.6 }),
  Elliptical_Trainer: walk(5, [30, -10], [60, 30], { tempo: 0.6 }),
  Bicycling_Stationary: bike(20, 65, 20),
  Recumbent_Bike: bike(-25, 5, 50),
  Rowing_Stationary: side(A(25, 130, 130, -40, 85, 0), A(-20, 52, 0, 20, -20, 100), { ground: 'floor', fix: 'an0', lock: true, prop: 'band', line: [55, -4], pace: 'cycle', tempo: 0.9 }),
  Battling_Ropes: side(St(20, 45, 45, [30, 75], [40, 20]), St(20, 45, 45, [75, 30], [20, 40]), { prop: 'band', line: [45, 18], pace: 'cycle', tempo: 0.3 }),
  'wg_jumping-jack': front(A(0, 3, 0, 0, 10, 5), A(0, 20, 0, 0, 165, 10), { hop: 5, pace: 'cycle', tempo: 0.35 }),
  // stretches and mobility
  Calf_Stretch_Hands_Against_Wall: side(A(20, [0, 40], [0, 45], [-20, -25], 75, 25), A(30, [0, 50], [0, 60], [-30, -40], 65, 35), { fix: 'an0', pin: 'hands', wall: 'front', pace: 'hold' }),
  'wg_hamstring-stretch': side(A(5, [30, -5], [0, 15], [-35, -25], 40, 10), A(45, [70, 30], [0, 30], [-35, -45], 40, 10), { fix: 'an1', pace: 'hold' }),
  Cat_Stretch: side(quad({ curve: -15, neck: -25 }), quad({ curve: 22, neck: 30 }), { ground: 'floor', fix: 'kn0', pin: 'hands', pace: 'hold' }),
  Childs_Pose: side(A(85, 95, 100, 90, 120, 0), A(100, 150, 140, 90, 169, 0, { curve: 12, neck: 30 }), { ground: 'floor', fix: 'kn0', lock: true, pace: 'hold' }),
  Standing_Pelvic_Tilt: side(St(0, 5, 10, 0, 0, { curve: -12 }), St(-2, 0, 10, 0, 0, { curve: 12 }), {}),
  Hug_Knees_To_Chest: side(LYING(70, 100, 20, 60, 50), LYING(125, 130, 25, 50, 95, { curve: 12 }), { ground: 'floor', pace: 'hold' }),
  Knee_Across_The_Body: front(A(-90, 0, 0, 0, [20, 90], 0), A(-90, [-35, 0], [80, 0], 0, [20, 90], 0), { ground: 'mat', pace: 'hold' }),
  IT_Band_and_Glute_Stretch: front(A(-90, 0, 0, 0, [20, 90], 0), A(-90, [-40, 0], 0, 0, [20, 90], 0), { ground: 'mat', pace: 'hold' }),
  // ---- movements that used to borrow another exercise's figure, each written from its own steps
  Barbell_Side_Bend: front(A(0, 5, 0, 0, 75, 120), A(22, [-17, 27], 0, 0, 75, 120), { prop: 'barbell', rack: 'back', guide: { axis: ['pelvis', 'neck'] } }),
  All_Fours_Quad_Stretch: side(quad(), A(90, [15, 90], [140, 90], [90, 90], [-35, 90], [15, 0]), { ground: 'floor', fix: 'kn1', lock: true, pace: 'hold', guide: { joint: 'kn0' } }),
  Ankle_On_The_Knee: side(LYING([60, 60], [100, 100], 20, 20, 20), LYING([118, 112], [105, 60], 20, 50, 70, { curve: 8 }), { ground: 'floor', pace: 'hold' }),
  'Anterior_Tibialis-SMR': side(A(20, 146, 105, 0, 62, 25), A(24, 150, 105, 0, 80, 8), { ground: 'floor', fix: 'pelvis', pace: 'cycle', tempo: 1.2 }),
  Backward_Drag: walk(-12, [35, 35], [15, 15], { prop: 'band', line: [45, 4] }),
  Balance_Board: side(St(2, 8, 14, 25, 20), St(5, 14, 24, 35, 25), { pace: 'hold' }),
  Barbell_Curls_Lying_Against_An_Incline: side(A(-45, 40, 85, 0, -45, 5), A(-45, 40, 85, 0, -45, 130), { ground: 'bench', prop: 'barbell', guide: { joint: 'el0', axis: ['sh0', 'el0'] } }),
  Barbell_Incline_Shoulder_Raise: INC_SHRUG('barbell'),
  Smith_Incline_Shoulder_Raise: INC_SHRUG('barbell'),
  Dumbbell_Incline_Shoulder_Raise: INC_SHRUG('dumbbell'),
  Behind_Head_Chest_Stretch: side(A(0, 90, 0, 0, 150, 140), A(-3, 90, 0, 0, 172, 145, { curve: -8 }), { ground: 'floor', fix: 'pelvis', pace: 'hold', guide: { joint: 'sh0' } }),
  Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench: REAR(75),
  'Bent_Over_Low-Pulley_Side_Lateral': REAR(78, { prop: 'none' }, true),
  'Seated_Bent-Over_Rear_Delt_Raise': REAR(62, { ground: 'bench', sit: true }),
  'wg_bent-over-rear-delt-raise': REAR(70),
  Reverse_Flyes: REAR(55, { ground: 'bench' }),
  Reverse_Flyes_With_External_Rotation: REAR(60, { ground: 'bench' }),
  Dumbbell_Lying_Rear_Lateral_Raise: REAR(75, { ground: 'bench' }),
  Lying_Rear_Delt_Raise: REAR(90, { ground: 'bench' }),
  'Dumbbell_Lying_One-Arm_Rear_Lateral_Raise': REAR(75, { ground: 'bench' }, true),
  'Lying_One-Arm_Lateral_Raise': REAR(90, { ground: 'bench' }, true),
  'wg_reverse-snow-angel': D3(front(A(0, 4, 0, 0, 168, 5), A(0, 4, 0, 0, 20, 10), { ground: 'floor', tilt: 90 })),
  'Body-Up': side(A(83, 0, 0, 8, 83, 90), A(73, 0, 0, 15, 73, 0), { ground: 'floor', fix: 'toe0', guide: { joint: 'el0', axis: ['an0', 'sh0'] } }),
  Box_Skip: BOX_JUMP,
  Moving_Claw_Series: gait(10, [55, -20], [35, 120], [-45, 50], 0.35),
  'Butt-Ups': side(A(83, 0, 0, 8, 83, 90), A(104, 50, 0, 25, 106, 90), { ground: 'floor', fix: 'toe0', guide: { joint: 'hp0' } }),
  Cable_Internal_Rotation: ROT(45, -60),
  Internal_Rotation_with_Band: ROT(45, -60),
  External_Rotation_with_Band: ROT(-60, 45),
  External_Rotation_with_Cable: ROT(-60, 45),
  Standing_Cable_Wood_Chop: D3(side(St(0, 0, 8, 135, 10), St(12, 25, 25, 35, 10), { twist: [-50, 50], clasp: true })),
  'wg_banded-woodchop': D3(side(St(0, 0, 8, 135, 10), St(12, 25, 25, 35, 10), { twist: [-50, 50], clasp: true })),
  Standing_Cable_Lift: D3(side(St(12, 25, 25, 35, 10), St(0, 0, 8, 135, 10), { twist: [-50, 50], clasp: true })),
  Cable_Judo_Flip: D3(side(St(10, 20, 22, 40, 10), St(5, 10, 12, 95, 110), { twist: [-55, 50], clasp: true })),
  Landmine_180s: D3(side(St(0, 0, 8, 95, 15), St(0, 0, 8, 95, 15), { twist: [-55, 55], clasp: true, kit: 'landmine', pace: 'cycle', tempo: 0.9 })),
  Kettlebell_Pirate_Ships: D3(side(St(8, 15, 18, 25, 0), St(0, 0, 5, 105, 5), { prop: 'kettlebell', twist: [0, 60] })),
  Spell_Caster: D3(side(St(5, 10, 15, 30, 0), St(5, 10, 15, 30, 0), { prop: 'dumbbell', twist: [-60, 60], pace: 'cycle', tempo: 0.9 })),
  Torso_Rotation: D3(side(St(0, 0, 5, 90, 0), St(0, 0, 5, 90, 0), { prop: 'ball', twist: [-55, 55], pace: 'cycle', tempo: 0.9 })),
  Middle_Back_Stretch: D3(side(St(0, 0, 3, -25, 70), St(0, 0, 3, -25, 70), { twist: [-45, 45], pace: 'cycle', tempo: 1.4 })),
  'wg_torso-twist-stretch': D3(side(St(0, 0, 3, 80, 100), St(0, 0, 3, 80, 100), { twist: [-50, 50], pace: 'cycle', tempo: 1.4 })),
  Spinal_Stretch: D3(side(A(0, 90, 90, 0, 150, 140), A(0, 90, 90, 0, 150, 140), { ground: 'bench', pad: false, twist: [-45, 45], pace: 'cycle', tempo: 1.4 })),
  Dancers_Stretch: D3(side(A(0, [130, 92], [100, 0], 0, [-30, 40], [0, 10]), A(0, [130, 92], [100, 0], 0, [-30, 40], [0, 10]), { ground: 'floor', fix: 'pelvis', twist: [0, -55], pace: 'hold' })),
  Crossover_Reverse_Lunge: D3(lunge(40, 60, { twist: [0, -45] })),
  Carioca_Quick_Step: front(A(-4, [24, -10], 0, 0, [14, 30], 25), A(4, [-10, 24], 0, 0, [30, 14], 25), { hop: 3, pace: 'cycle', tempo: 0.35 }),
  'wg_lateral-shuffle': front(A(-5, [28, 4], 0, 0, 14, 25), A(5, [4, 28], 0, 0, 14, 25), { hop: 2, pace: 'cycle', tempo: 0.4 }),
  Chair_Upper_Body_Stretch: side(A(0, 90, 90, 0, -30, 10), A(22, 108, 90, 0, -62, 0, { curve: -6 }), { ground: 'bench', pad: false, pace: 'hold', guide: { joint: 'sh0' } }),
  Conans_Wheel: walk(-4, [45, 45], [115, 115]),
  Downward_Facing_Balance: side(A(78, 15, 10, 30, 80, 0), A(90, -6, 0, 30, 90, 0), { ground: 'floor', fix: 'wr0', lock: true, pin: 'hands', under: { at: 'pelvis', r: 13 }, pace: 'hold' }),
  Elbow_Circles: front(A(0, 3, 0, 0, 70, 155), A(0, 3, 0, 0, 115, 155), { pace: 'cycle', tempo: 0.9 }),
  'Exercise_Ball_Pull-In': side(A(86, 0, 0, 30, 86, 0), A(100, 100, 110, 30, 96, 0, { curve: 12 }), { ground: 'floor', fix: 'wr0', lock: true, pin: 'hands', under: { at: 'an0', r: 15 }, guide: { joint: 'hp0' } }),
  'Foot-SMR': side(A(0, 90, 82, 0, 20, 30), A(0, 90, 98, 0, 20, 30), { ground: 'bench', pad: false, under: { at: 'toe0', mid: 'heel0', r: 2.5, fixed: true }, pace: 'cycle', tempo: 1 }),
  Frog_Hops: side(St(15, 100, 110, 150, 140), St(5, 20, 25, 150, 140), { hop: 10, pace: 'cycle', tempo: 0.5, guide: { joint: 'kn0' } }),
  Gironda_Sternum_Chins: hang(A(-12, 0, 35, 15, 168, 5), A(-38, -5, 45, 15, -8, 140, { curve: -12 }), { guide: { joint: 'el0' } }),
  Mixed_Grip_Chin: CHINUP,
  Side_To_Side_Chins: front(A(0, 3, 0, 15, 165, 5), A(7, 3, 0, 15, [112, 92], [80, 135]), { ground: 'hang', prop: 'bar', guide: { joint: 'el0' } }),
  Groin_and_Back_Stretch: side(A(0, 140, 120, 0, 150, 140), A(10, 150, 120, 0, 150, 140, { curve: 26, neck: 20 }), { ground: 'floor', fix: 'pelvis', pace: 'hold' }),
  Groiners: side(A(72, 0, 0, 15, 72, 0), A(80, 130, 130, 10, 80, 0), { ground: 'floor', fix: 'wr0', pace: 'cycle', tempo: 0.6 }),
  'wg_fire-hydrant': HYDRANT,
  'wg_banded-fire-hydrant': HYDRANT,
  Hip_Circles_prone: HYDRANT,
  Standing_Hip_Circles: D3(side(St(0, [90, 0], [90, 0], 15, 15), St(0, [90, 0], [90, 0], 15, 15), { splay: [0, 60], fix: 'an1', pace: 'cycle', tempo: 1.2 })),
  Side_Leg_Raises: front(A(0, [3, 3], 0, 0, 12, 8), A(0, [45, 3], 0, 0, 12, 8), { pace: 'cycle', tempo: 0.7 }),
  'wg_leg-swings-stretch': side(A(0, [-22, 0], [12, 3], [10, 0], [25, -10], 10), A(0, [55, 0], [5, 3], [0, 0], [-15, 20], 10), { fix: 'an1', pace: 'cycle', tempo: 0.7 }),
  Lying_Crossover: front(A(-90, 0, 0, 0, [20, 90], 0), A(-90, [-35, 0], [80, 0], 0, [20, 90], 0), { ground: 'mat', pace: 'hold' }),
  One_Knee_To_Chest: side(LYING([25, 0], [35, 0], 20, 20, 10), LYING([122, 0], [128, 0], 20, 62, 62, { curve: 6 }), { ground: 'floor', pace: 'hold', guide: { joint: 'hp0' } }),
  Seated_Glute: side(A(-5, [140, 130], [105, 95], 0, 30, 20), A(8, [150, 142], [105, 95], 0, 50, 30, { curve: 18 }), { ground: 'floor', fix: 'pelvis', pace: 'hold' }),
  Lying_Bent_Leg_Groin: front(A(-90, 40, 100, 0, 25, 0), A(-90, 62, 105, 0, 25, 0), { ground: 'mat', pace: 'hold' }),
  Kneeling_Forearm_Stretch: side(quad(), A(88, 94, 96, 90, 86, 0), { ground: 'floor', fix: 'kn0', pin: 'hands', pace: 'hold' }),
  Linear_Acceleration_Wall_Drill: side(A(35, [40, 0], [70, 0], [0, -35], 85, 10), A(35, [95, 0], [100, 0], [0, -35], 85, 10), { fix: 'wr0', lock: true, pin: 'hands', wall: 'front', pace: 'cycle', tempo: 0.45 }),
  Looking_At_Ceiling: side(A(0, 0, 90, 90, -10, 0), A(-24, -20, 90, 90, -48, 0, { curve: -18, neck: -35 }), { ground: 'floor', fix: 'kn0', lock: true, pace: 'hold' }),
  Lower_Back_Curl: side(A(90, 0, 0, 60, 15, 0), A(74, -3, 0, 60, 15, 0, { curve: -14, neck: -10 }), { ground: 'floor' }),
  Lying_Cable_Curl: side(LYING(0, 0, 20, 0, 5), LYING(0, 0, 20, 0, 130), { ground: 'floor', prop: 'band', line: [40, -3], guide: { joint: 'el0', axis: ['sh0', 'el0'] } }),
  Lying_High_Bench_Barbell_Curl: side(A(90, 0, 0, 20, 90, 5), A(90, 0, 0, 20, 90, 130), { ground: 'bench', prop: 'barbell', guide: { joint: 'el0', axis: ['sh0', 'el0'] } }),
  Lying_Supine_Dumbbell_Curl: benchP(-75, 5, -75, 125, { prop: 'dumbbell', con: 'out', guide: { joint: 'el0', axis: ['sh0', 'el0'] } }),
  Straight_Raises_on_Incline_Bench: side(A(45, 45, 90, 0, 45, 0), A(45, 45, 90, 0, 150, 0), { ground: 'bench', prop: 'barbell', guide: { joint: 'sh0' } }),
  Supine_Chest_Throw: side(A(-90, 50, 100, 22, -15, 125), A(-90, 50, 100, 22, 90, 0), { ground: 'floor', prop: 'ball', guide: { joint: 'el0' } }),
  'Otis-Up': side(A(-90, 50, 100, 22, 15, 140), A(-12, 128, 100, 22, 165, 8, { curve: 8 }), { ground: 'floor', prop: 'ball', guide: { joint: 'hp0' } }),
  Platform_Hamstring_Slides: side(LYING(0, 0, 20), LYING([42, 0], [98, 0], [10, 20]), { ground: 'floor', guide: { joint: 'kn0' } }),
  Prone_Manual_Hamstring: side(A(90, 0, 0, 60, 160, 90), A(90, 0, [112, 0], 60, 160, 90), { ground: 'floor', guide: { joint: 'kn0' } }),
  Lying_Prone_Quadriceps: side(A(90, 0, 0, 60, 160, 90), A(90, 0, [135, 0], 60, 160, 90), { ground: 'floor', pace: 'hold', guide: { joint: 'kn0' } }),
  One_Half_Locust: side(A(90, 0, [100, 0], 60, [-25, 150], [10, 60]), A(82, [-14, 0], [118, 0], 60, [-45, 150], [10, 60], { curve: -12, neck: -8 }), { ground: 'floor', pace: 'hold' }),
  Pull_Through: side(St(58, 88, 25, 35, 0), St(0, 0, 5, 8, 0), { prop: 'band', line: [-30, 8], clasp: true, guide: { joint: 'hp0', axis: ['pelvis', 'neck'] } }),
  Rear_Leg_Raises: side(quad(), A(90, [5, 90], [5, 90], [60, 90], 90, 0), { ground: 'floor', fix: 'kn1', lock: true, pin: 'hands', guide: { joint: 'hp0' } }),
  Round_The_World_Shoulder_Stretch: side(St(0, 0, 3, -15, 0), St(8, 0, 3, -60, 0), { pace: 'hold', guide: { joint: 'sh0' } }),
  Scissor_Kick: side(LYING([55, 12], 5), LYING([12, 55], 5), { ground: 'floor', pace: 'cycle', tempo: 0.5 }),
  Toe_Touchers: side(LYING(88, 0, 20, 70, 0), A(-70, 106, 0, 20, 96, 0, { curve: 14, neck: 12 }), { ground: 'floor', guide: { joint: 'hp0' } }),
  Seated_Biceps: side(A(0, 140, 110, 0, -35, 0), A(0, 140, 110, 0, -68, 0), { ground: 'floor', fix: 'pelvis', pace: 'hold', guide: { joint: 'sh0' } }),
  Shoulder_Raise: front(A(0, 3, 0, 0, 6, 5), A(0, 3, 0, 0, 6, 5, { shrug: 4 }), {}),
  Shoulder_Stretch: front(A(0, 3, 0, 0, 8, 5), A(0, 3, 0, 0, [-82, 20], [0, -147]), { pace: 'hold' }),
  'wg_cross-body-shoulder-stretch': front(A(0, 3, 0, 0, 8, 5), A(0, 3, 0, 0, [-82, 20], [0, -147]), { pace: 'hold' }),
  Tricep_Side_Stretch: front(A(0, 3, 0, 0, 8, 5), A(0, 3, 0, 0, [172, 150], [150, 100]), { pace: 'hold' }),
  Side_Wrist_Pull: front(A(0, 3, 0, 0, [-25, -20], [30, 20]), A(0, 3, 0, 0, [-80, -35], [0, 60]), { pace: 'hold' }),
  'Single_Leg_Push-off': step([25, 35], { hop: 8, pace: 'cycle', tempo: 0.5 }),
  Sit_Squats: squat(5, 10, 85, 0, {}, 68, 26),
  Stomach_Vacuum: side(St(0, 0, 3, -22, 65), St(4, 0, 3, -22, 65, { curve: 9 }), { pace: 'hold' }),
  Isometric_Chest_Squeezes: side(St(0, 0, 3, 42, 100), St(0, 0, 3, 48, 95), { clasp: true, pace: 'hold' }),
  Wrist_Rotations_with_Straight_Bar: side(St(0, 0, 3, 55, 20), St(0, 0, 3, 55, 20), { prop: 'barbell', flex: [35, -35], pace: 'cycle', tempo: 0.6 }),
  // ---- only the 3D figure can show these
  On_Your_Side_Quad_Stretch: ON_SIDE(LYING([5, 80], [30, 90], 20, [10, 150], [10, 120]), LYING([-22, 80], [138, 90], 20, [-42, 150], [18, 120]), { pace: 'hold', guide: { joint: 'kn0' } }),
  Quad_Stretch: ON_SIDE(LYING([5, 30], [30, 30], 20, [10, 150], [10, 120]), LYING([-22, 30], [138, 30], 20, [-42, 150], [18, 120]), { pace: 'hold', guide: { joint: 'kn0' } }),
  Side_Lying_Groin_Stretch: ON_SIDE(LYING([20, 80], [30, 90], 20, [20, 150], [10, 120]), LYING([75, 80], [85, 90], 20, [50, 150], [35, 120]), { pace: 'hold', turn: [['Rleg', 'py', 0, 45], ['Rarm', 'py', 0, 30]] }),
  'Iliotibial_Tract-SMR': ON_SIDE(LYING([70, 0], [80, 0], 20, [30, 0], [40, 90]), LYING([70, 0], [80, 0], 20, [30, 0], [40, 90]), { rise: [15, 15], slide: [-4, 4], pace: 'cycle', tempo: 1.2, rest: { on: ['Lthigh', 'Lshank'], r: 5, roller: true, fixed: true }, turn: [['trunk', 'py', -42, -42], ['Larm', 'py', -48, -48], ['Rleg', 'py', -20, -20]] }),
  'Peroneals-SMR': ON_SIDE(LYING([70, 0], [80, 0], 20, [30, 0], [40, 90]), LYING([70, 0], [80, 0], 20, [30, 0], [40, 90]), { rise: [14, 14], slide: [-4, 4], pace: 'cycle', tempo: 1.2, rest: { on: ['Lshank', 'Lfoot'], r: 5, roller: true, fixed: true }, turn: [['trunk', 'py', -42, -42], ['Larm', 'py', -48, -48], ['Rleg', 'py', -20, -20]] }),
  'Brachialis-SMR': ON_SIDE(LYING([10, 0], [15, 5], 20, [20, 90], [30, 20]), LYING([10, 0], [15, 5], 20, [20, 90], [30, 20]), { rise: [12, 12.6], pace: 'hold', rest: { on: ['Lupper', 'Lfore'], r: 4, roller: true, along: true }, turn: [['trunk', 'py', -32, -32], ['Larm', 'spine', 18, 18]] }),
  'Latissimus_Dorsi-SMR': ON_SIDE(LYING([35, 20], [60, 40], 20, [20, 170], [60, 10]), LYING([35, 20], [60, 40], 20, [20, 170], [60, 10]), { rise: [11, 11], slide: [-2.5, 2.5], pace: 'cycle', tempo: 1.2, rest: { on: ['Lupper'], r: 4.5, roller: true, fixed: true, dy: 5 }, turn: [['trunk', 'py', -14, -14]] }),
  Adductor: D3(front(A(0, [75, 5], [85, 0], 0, 70, 115), A(0, [75, 5], [85, 0], 0, 70, 115), { ground: 'floor', tilt: 90, rise: [9, 9], sway: [-3, 3], az: -30, el: 0.9, pace: 'cycle', tempo: 1.2, rest: { on: ['Rthigh', 'Rshank'], r: 5, roller: true, along: true, fixed: true } })),
  External_Rotation: ON_SIDE(LYING(15, 25, 20, [5, 150], [90, 120]), LYING(15, 25, 20, [5, 150], [90, 120]), { ground: 'bench', rise: [42, 42], prop: 'dumbbell', one: true, swing: [-50, 55], guide: { joint: 'el0' } }),
  Dumbbell_Lying_Supination: ON_SIDE(LYING(15, 25, 20, [5, 150], [90, 120]), LYING(15, 25, 20, [5, 150], [90, 120]), { ground: 'bench', rise: [42, 42], prop: 'dumbbell', one: true, az: 35, turn: [['Rhand', 'up', -70, 70]], guide: { joint: 'el0' } }),
  Dumbbell_Lying_Pronation: D3(front(A(0, 4, 0, 0, [88, 15], [88, 10]), A(0, 4, 0, 0, [88, 15], [88, 10]), { ground: 'bench', tilt: 90, prop: 'dumbbell', one: true, el: 0.5, turn: [['Rfore', 'up', -90, -90], ['Rhand', 'up', -70, 70]] })),
  Wrist_Circles: D3(front(A(0, 3, 0, 0, 88, 0), A(0, 3, 0, 0, 88, 0), { pace: 'spin', tempo: 1.3, turn: [['hand', 'cone', 38, 0]] })),
  Car_Drivers: D3(side(St(0, 0, 3, [108, 76], 5), St(0, 0, 3, [76, 108], 5), { kit: 'wheel', pace: 'cycle', tempo: 0.9 })),
  Kettlebell_Pass_Between_The_Legs: D3(front(A(0, 24, 6, 0, [34, -6], 5), A(0, 24, 6, 0, [-6, 34], 5), { prop: 'kettlebell', pass: true, tilt: 52, pace: 'cycle', tempo: 0.8, turn: [['arm', 'x', -35, -35]] })),
  Kettlebell_Figure_8: D3(front(A(0, 28, 6, 0, [38, -6], 5), A(0, 28, 6, 0, [-6, 38], 5), { prop: 'kettlebell', pass: true, tilt: 58, pace: 'cycle', tempo: 0.8, turn: [['arm', 'x', -40, -40]] })),
  Bent_Press: D3(front(A(0, 8, 0, 0, [25, 8], [150, 5]), A(50, [-38, 62], [0, 20], 0, [130, 50], 0), { prop: 'kettlebell', one: true, guide: { joint: 'el0' } })),
  Windmills: D3(front(A(-90, 0, 0, 0, 90, 0), A(-90, 0, 0, 0, 90, 0), { ground: 'mat', pace: 'cycle', tempo: 0.9, turn: [['Lleg', 'px', 0, 112], ['Lleg', 'spine', 0, 62]] })),
  Iron_Crosses_stretch: D3(front(A(0, 4, 0, 0, 90, 0), A(0, [-35, 4], 0, 0, 90, 0), { ground: 'floor', tilt: 90, el: 0.7, pace: 'cycle', tempo: 0.9, turn: [['Rshank', 'px', 0, 80], ['pelvis,Rleg,Lleg', 'spine', 0, 35], ['lumbar', 'spine', 0, 15]] })),
  Lying_Glute: D3(side(LYING([90, 0], [90, 0], 20, 20, 10), LYING([95, 0], [90, 0], 20, 20, 10), { ground: 'floor', pace: 'hold', az: -60, el: 0.6, turn: [['Rleg', 'bone', 0, 55]] })),
  Adductor_Groin: D3(side(LYING(88, 0, 20, -5, 10), LYING(88, 0, 20, -5, 10), { ground: 'floor', pace: 'hold', az: -30, turn: [['leg', 'spine', 8, 42]] })),
  'wg_hip-airplane': D3(side(A(72, [72, 0], [12, 5], [-12, 20], 0, 0), A(72, [72, 0], [12, 5], [-12, 20], 0, 0), { fix: 'an0', pace: 'cycle', tempo: 1.4, turn: [['Rarm', 'py', 85, 85], ['Larm', 'py', -85, -85], ['pelvis,lumbar,chest,neck,head,Rarm,Larm,Lleg', 'spine', -32, 32]] })),
  'wg_prone-t-raise': D3(front(A(0, 4, 0, 0, 90, 0), A(0, 4, 0, 0, 90, 0), { ground: 'floor', tilt: 90, el: 0.6, turn: [['arm', 'z', 0, -22]], guide: { joint: 'sh0' } })),
  'wg_doorway-chest-stretch': D3(front(A(0, 3, 0, 0, 90, 90), A(0, 3, 0, 0, 90, 90), { kit: 'door', tilt: 1, tilt2: 11, pace: 'hold', turn: [['arm', 'z', 0, 18]] })),
  Seated_Front_Deltoid: D3(side(A(0, 130, 115, 0, 0, 0), A(0, 130, 115, 0, 0, 0), { ground: 'floor', fix: 'pelvis', pace: 'hold', turn: [['arm', 'py', 85, 85], ['arm', 'spine', 0, 32]] })),
  Chest_Stretch_on_Stability_Ball: D3(side(A(92, 92, 90, 90, [90, 90], [0, 10]), A(102, 100, 90, 90, [90, 75], [0, 70]), { ground: 'floor', fix: 'kn1', pace: 'hold', az: -50, el: 0.6, rest: { on: ['Rfore'], r: 13 }, turn: [['Rarm', 'spine', -80, -100]] })),
  Hug_A_Ball: D3(side(St(12, 122, 138, 50, 30), St(20, 128, 140, 56, 38, { curve: 14 }), { ground: 'floor', pace: 'hold', under: { at: 'kn0', r: 16 }, turn: [['leg', 'z', 30, 30], ['arm', 'z', 22, 22]] })),
  Pyramid: D3(side(A(122, 82, 12, 20, 168, 8), A(125, 90, 0, 20, 173, 0), { ground: 'floor', pace: 'hold', under: { at: 'pelvis', r: 16 } })),
  'Piriformis-SMR': D3(side(A(-55, [95, 55], [100, 115], 0, -62, 25), A(-55, [95, 55], [100, 115], 0, -62, 25), { ground: 'floor', rise: [15.5, 15.5], slide: [-2, 2], pace: 'cycle', tempo: 1.2, under: { at: 'pelvis', r: 4.5, fixed: true }, turn: [['Rleg', 'bone', 70, 70]] })),
  'Neck-SMR': D3(front(A(0, 3, 0, 0, 110, 150), A(0, 3, 0, 0, 110, 150), { kit: 'stick', pace: 'cycle', tempo: 1.4, az: -150, turn: [['arm', 'z', -25, -25], ['head', 'z', -35, 35]] })),
  Rack_Delivery: D3(side(St(0, 0, 3, 0, 0), St(0, 0, 3, 75, 150), { prop: 'barbell', turn: [['arm', 'py', 85, 10], ['fore', 'py', -110, 0]] })),
  Tate_Press: D3(benchP(90, 5, 90, 115, { prop: 'dumbbell', turn: [['arm', 'spine', -30, -30], ['fore', 'up', -90, -90]] })),
  Bodyweight_Flyes: D3(front(A(0, 3, 0, 0, 0, 0), A(0, 3, 0, 0, 0, 0), { ground: 'floor', tilt: 64, tilt2: 72, kit: 'rollbars', con: 'back', turn: [['arm', 'x', -64, -72], ['arm', 'z', 4, 45]] })),
  Isometric_Wipers: D3(front(A(0, 3, 0, 0, 0, 0), A(0, 3, 0, 0, 0, 0), { ground: 'floor', tilt: 65, sway: [-6, 6], pace: 'cycle', tempo: 1.1, turn: [['arm', 'x', -65, -65], ['Rarm,Larm', 'z', 11, -11]] })),
  Smith_Machine_Hip_Raise: D3(side(A(-90, 90, 0, -10, -5, 5), A(-112, 68, 0, -10, 17, 5, { curve: 10 }), { ground: 'bench', fix: 'sh0', kit: 'footbar', guide: { joint: 'hp0' } })),
  Dumbbell_Seated_Box_Jump: D3(side(A(8, 90, 90, 8, 35, 135), St(12, 35, 35, 35, 135), { ground: 'bench', pad: false, prop: 'dumbbell', one: true, clasp: true, lift: 20, land: 34, rise: [30, 66], pace: 'cycle', tempo: 0.7, guide: { joint: 'kn0' } })),
  Side_to_Side_Box_Shuffle: D3(front(A(0, [8, 40], [0, 45], 0, [14, 28], 25), A(0, [40, 8], [45, 0], 0, [28, 14], 25), { fix: 'pelvis', sway: [-19, 19], hop: 5, kit: 'midbox', pace: 'cycle', tempo: 0.5 })),
  Weighted_Ball_Side_Bend: D3(front(A(60, 0, 0, 0, 150, 140), A(30, [30, -30], 0, 0, 150, 140), { under: { at: 'pelvis', r: 13.5 } })),
  'On-Your-Back_Quad_Stretch': D3(side(A(-90, [-15, -10], [80, 95], [20, -15], [-15, 0], [5, 0]), A(-90, [-28, -10], [128, 95], [20, -15], [-38, 0], [12, 0]), { ground: 'bench', pace: 'hold', turn: [['Rleg', 'spine', 14, 14], ['Rarm', 'spine', 14, 14]], guide: { joint: 'kn0' } })),
  Desk_Neck_Tilt: D3(front(A(0, 20, 0, 0, 8, 10, { neck: -28 }), A(0, 20, 0, 0, 8, 10, { neck: 28 }), { ground: 'bench', sit: true, pace: 'cycle', tempo: 1.6 })),
  Desk_Seated_Twist: D3(side(A(0, 90, 90, 0, [35, -30], [30, 20]), A(0, 90, 90, 0, [35, -30], [30, 20]), { ground: 'bench', pad: false, twist: [0, -50], pace: 'hold' })),
  Desk_Wrist_Stretch: D3(side(A(0, 90, 90, 0, [80, 68], [0, 28]), A(0, 90, 90, 0, [80, 68], [0, 28]), { ground: 'bench', pad: false, clasp: true, pace: 'hold', turn: [['Rhand', 'x', 0, 65]] })),
  Desk_Figure_Four: D3(side(A(0, 90, [95, 90], 0, 25, 40), A(18, 106, [95, 90], 0, 30, 45, { curve: 5 }), { ground: 'bench', pad: false, pace: 'hold', turn: [['Rleg', 'bone', 75, 75]] })),
  Desk_Seated_Leg_Raise: D3(side(A(0, 90, 90, 0, -5, 10), A(0, 90, [5, 90], 0, -5, 10), { ground: 'bench', pad: false, guide: { joint: 'kn0' } })),
  Gentle_Hip_Circles: D3(side(St(0, 0, 6, -22, 75), St(0, 0, 6, -22, 75), { pace: 'spin', tempo: 1.6, orbit: 5, turn: [['leg', 'py', 8, 8]] })),
  March_In_Place: D3(side(A(0, [65, 0], [75, 0], [10, 0], [-20, 25], 30), A(0, [0, 65], [0, 75], [0, 10], [25, -20], 30), { fix: 'pelvis', pace: 'cycle', tempo: 0.6 })),
  wg_swimming: D3(side(A(90, [10, -6], [6, 18], 60, [172, 5], [5, 25]), A(90, [-6, 10], [18, 6], 60, [5, 172], [25, 5]), { ground: 'floor', fix: 'pelvis', rise: [22, 22], pace: 'cycle', tempo: 0.7 })),
  Skating: front(A(-12, [30, -5], [10, 60], 0, [35, -20], 30), A(12, [-5, 30], [60, 10], 0, [-20, 35], 30), { hop: 4, pace: 'cycle', tempo: 0.6, tilt: 22 }),
  Cable_Incline_Pushdown: side(A(-45, 40, 85, 0, 150, 5), A(-45, 40, 85, 0, 15, 5), { ground: 'bench', prop: 'band', line: [-28, -22], guide: { joint: 'sh0' } }),
  Sled_Row: side(St(-8, 8, 18, 80, 0), St(-8, 8, 18, -25, 100), { prop: 'band', line: [55, 22], guide: { joint: 'el0' } }),
  Suspended_Row: LEAN_ROW({ prop: 'band', line: [14, -75], guide: { joint: 'el0' } }),
  Bodyweight_Mid_Row: LEAN_ROW({ prop: 'band', line: [14, -75], guide: { joint: 'el0' } }),
  'wg_scapular-push-up': side(A(73, 0, 0, 15, 73, 0), A(74.5, 0, 0, 14, 74.5, 0), { ground: 'floor', fix: 'toe0', pin: 'hands', guide: { axis: ['an0', 'sh0'] } }),
  // ---- round 16: positions, movements and equipment that did not match the pictures
  g_incline_side_raise: ON_SIDE(LYING(15, 25, 20, [5, 150], [10, 120]), LYING(15, 25, 20, [5, 150], [10, 120]), { ground: 'bench', rise: [42, 42], prop: 'dumbbell', one: true, turn: [['Rarm', 'py', 0, 80], ['body', 'x', 28, 28]], guide: { joint: 'sh0' } }),
  g_prone_shrug: side(A(45, 45, 90, 0, 45, 0), A(45, 45, 90, 0, 45, 0, { shrug: 4 }), { ground: 'bench', prop: 'dumbbell' }),
  g_stand_conc: side(St(60, 70, 20, 60, 5), St(60, 70, 20, 60, 135), { prop: 'dumbbell', one: true, guide: { joint: 'el0', axis: ['sh0', 'el0'] } }),
  g_over_bench_curl: side(St(12, 12, 5, 55, 10), St(12, 12, 5, 55, 130), { prop: 'dumbbell', one: true, kit: 'preacher', guide: { joint: 'el0' } }),
  g_donkey_calf: side(St(78, 85, 2, 100, 5), A(78, 85, 2, 40, 100, 5), { fix: 'toe0', box: 'wr0' }),
  g_seated_bar_twist: D3(side(A(0, 90, 90, 0, -15, 155), A(0, 90, 90, 0, -15, 155), { ground: 'bench', pad: false, prop: 'barbell', rack: 'back', twist: [-45, 45], pace: 'cycle', tempo: 0.9 })),
  g_toe_touch: side(St(0, 0, 3, 0, 0), St(100, 104, 4, 100, 0), { guide: { joint: 'hp0' } }),
  g_side_jackknife: ON_SIDE(LYING(5, 5, 20, [160, 60], [130, 40]), LYING(5, 5, 20, [160, 60], [130, 40]), { turn: [['Rleg', 'py', 0, 45], ['trunk', 'py', 0, -22]] }),
  g_bear_plank: side(A(85, 100, 95, 35, 88, 0), A(84, 100, 95, 35, 87, 0), { ground: 'floor', fix: 'toe0', pace: 'hold' }),
  g_copenhagen: front(A(88, [0, -35], [0, 60], 0, [5, 88], [10, 95]), A(89, [0, -35], [0, 60], 0, [5, 89], [10, 95]), { ground: 'floor', fix: 'el1', lock: true, box: 'an0', pace: 'hold' }),
  g_standing_rollout: side(A(125, 120, 0, 25, 160, 0), A(80, 5, 0, 10, 155, 0), { ground: 'floor', fix: 'toe0', prop: 'barbell', kit: 'smallbar', con: 'back' }),
  g_pistol: side(A(3, [5, 30], [5, 0], [-3, 0], 60, 0), A(40, [125, 128], [125, 5], [-40, 0], 100, 0), { fix: 'an0', con: 'back', guide: { joint: 'kn0' } }),
  g_shrimp: side(A(3, [5, 0], [5, 90], [-3, 0], 20, 0), A(45, [115, 25], [120, 125], [-30, 0], 100, 0), { fix: 'an0', con: 'back', guide: { joint: 'kn0' } }),
  g_bulgarian: side(A(0, [20, -12], [6, 80], [14, 40], 3, 0), A(6, [92, 2], [95, 105], [-9, 40], 9, 0), { fix: 'an0', pin: 'feet', box: 'an1', con: 'back', guide: { joint: 'kn0', axis: ['an0', 'kn0'] } }),
  g_wall_walk: D3(side(A(73, 0, 0, 15, 73, 0), A(148, 0, 0, 30, 178, 0), { ground: 'floor', wall: 'feet', pace: 'cycle', tempo: 1.6 })),
  g_crab_walk: side(A(-58, [75, 60], [100, 85], [10, 5], [-50, -70], 0), A(-58, [60, 75], [85, 100], [5, 10], [-70, -50], 0), { ground: 'floor', fix: 'pelvis', pace: 'cycle', tempo: 0.6 }),
  g_body_tricep: side(A(35, 0, 0, -30, 125, 0), A(48, 0, 0, -43, 138, 105), { ground: 'floor', fix: 'toe0', pin: 'hands', prop: 'bar', con: 'back', guide: { joint: 'el0' } }),
  g_floor_leg_press: D3(side(LYING(125, 110, 0, 20, 30), LYING(88, 8, 0, 20, 30), { ground: 'floor', kit: 'footbar', con: 'back', guide: { joint: 'kn0' } })),
  g_pec_deck: D3(side(A(0, 90, 90, 0, 88, 90), A(0, 90, 90, 0, 88, 90), { ground: 'bench', turn: [['arm', 'z', 80, 8]], guide: { joint: 'sh0' } })),
  g_cable_rear_fly: D3(side(St(0, 0, 3, 88, 8), St(0, 0, 3, 88, 8), { turn: [['arm', 'z', -14, 92]], cord: { kind: 'cable', on: 'hands', to: [34, -34, 118] }, guide: { joint: 'sh0' } })),
  g_vup: side(LYING(3, 0, 20, 178, 0), A(-50, 80, 0, 20, 80, 0, { curve: 8 }), { ground: 'floor', guide: { joint: 'hp0' } }),
  g_hindu: side(A(135, 110, 0, 35, 165, 0), A(55, -15, 0, 60, 45, 0, { curve: -12, neck: -15 }), { ground: 'floor', fix: 'toe0', pace: 'cycle', tempo: 1.2 }),
  g_sissy: side(St(0, 0, 3, 20, 30), A(-35, 0, 85, 25, 20, 30), { fix: 'toe0', con: 'back', guide: { joint: 'kn0' } }),
  g_getup: side(LYING([45, 5], [90, 5], 20, [90, 15], 0), St(0, 0, 3, [178, 5], 0), { prop: 'kettlebell', one: true, pace: 'cycle', tempo: 1.8 }),
  g_raise_overhead: side(St(0, 0, 3, 5, 5), St(0, 0, 3, 172, 5), { prop: 'dumbbell', guide: { joint: 'sh0' } }),
  g_elbow_raise: front(A(0, 5, 0, 0, 8, -5), A(0, 5, 0, 0, 78, -80), { prop: 'dumbbell', guide: { joint: 'sh0' } }),
  g_side_to_front: D3(front(A(0, 5, 0, 0, 85, 10), A(0, 5, 0, 0, 85, 10), { prop: 'dumbbell', pace: 'cycle', tempo: 1.1, turn: [['arm', 'z', 0, -80]] })),
  g_tire: side(St(62, 112, 92, 62, 0), St(28, 25, 20, 110, 20), { kit: 'tire', slide: [0, 28], guide: { axis: ['pelvis', 'neck'] } }),
  g_frankenstein: squat(93, 0, 115, 0, { prop: 'barbell', rack: 'front' }, 112, 25),
  g_zercher: squat(25, 115, 50, 115, { prop: 'barbell', rack: 'zercher' }, 112, 30),
  g_jefferson: squat(3, 0, 38, 0, { prop: 'barbell', rack: 'straddle' }),
  g_landmine_squat: squat(20, 150, 20, 150, { kit: 'landmine', clasp: true }),
  g_bar_jump: side(St(38, 112, 112, -15, 155), A(0, 0, 0, 25, -15, 155), { lift: 12, pace: 'cycle', tempo: 0.6, prop: 'barbell', rack: 'back' }),
  g_shrug_behind: side(St(0, 0, 3, -14, 0), St(0, 0, 3, -14, 0, { shrug: 5 }), { prop: 'barbell' }),
  g_press_behind: side(St(0, 0, 3, 150, 125), St(0, 0, 3, 172, 5), { prop: 'barbell', guide: { axis: ['el0', 'wr0'] } }),
  g_goblet_db: squat(20, 150, 20, 150, { prop: 'dumbbell', clasp: true }),
  g_oh_kb_squat: squat(180, 0, 175, 0, { prop: 'kettlebell', one: true }, 105, 25),
  g_single_db_raise: side(St(0, 0, 3, 5, 5), St(0, 0, 3, 100, 5), { prop: 'dumbbell', clasp: true }),
  g_hammer: side(St(-8, 0, 5, 165, 60), St(40, 55, 30, 60, 10), { kit: 'hammer', clasp: true, pace: 'cycle', tempo: 0.7 }),
  g_overhead_walk: walk(0, [176, 176], [5, 5], { tempo: 0.6 }),
  g_ball_crunch: side(A(-70, 20, 90, 0, 30, 140), A(-42, 48, 90, 0, 30, 140, { curve: 18, neck: 10 }), { under: { at: 'pelvis', r: 11 }, guide: { joint: 'hp0' } }),
  g_crunch_legs_ball: side(LYING(90, 90, 20, 30, 140), A(-66, 114, 90, 20, 30, 140, { curve: 22, neck: 15 }), { ground: 'floor', under: { at: 'an0', mid: 'kn0', r: 11 } }),
  g_ball_twist: D3(side(A(-35, 55, 90, 0, 60, 30, { curve: 10 }), A(-38, 52, 90, 0, 60, 30, { curve: 10 }), { twist: [-45, 45], clasp: true, pace: 'cycle', tempo: 0.7, under: { at: 'pelvis', r: 11 } })),
  g_decline_pushup: side(A(82, 0, 0, 15, 80, 0), A(88, 0, 0, 8, 20, 88), { ground: 'floor', fix: 'toe0', pin: 'hands', box: 'toe0', con: 'back', guide: { joint: 'el0', axis: ['an0', 'sh0'] } }),
  g_ball_bridge: side(A(-62, 60, 120, 2, 0, 20), A(-90, 0, 90, 0, 0, 20), { ground: 'floor', fix: 'sh0', pin: 'feet', under: { at: 'sh0', r: 12 }, guide: { joint: 'kn0', axis: ['sh0', 'kn0'] } }),
  g_step_lunge: side(A(0, [35, -15], [22, 12], [13, 30], 3, 0), A(3, [95, -8], [95, 108], [-3, -5], 6, 0), { fix: 'an0', pin: 'feet', box: 'an0', con: 'back', prop: 'dumbbell', guide: { joint: 'kn0', axis: ['an0', 'kn0'] } }),
};

export const hasPose = (id: string) => id in POSES;

// Every other exercise borrows the closest hand-made pose by movement pattern (name first, then main muscle),
// with the prop swapped to its equipment. `matched` lets the screen say it shows the movement pattern.
type Ex = { id: string; name: string; category: string; equipment: string; primary: string[]; steps?: string[] };
const PROP: Record<string, Pose['prop']> = { barbell: 'barbell', 'e-z curl bar': 'barbell', dumbbell: 'dumbbell', kettlebells: 'kettlebell', 'medicine ball': 'ball' };
const HELD = ['dumbbell', 'barbell', 'kettlebell', 'ball'];
const withProp = (p: Pose, eq: string, name: string): Pose => {
  if (p.prop === 'bar' || p.prop === 'band' || p.prop === 'plate') return p;
  const one = /one[- ]arm|single[- ]arm|one[- ]handed/i.test(name) && p.prop !== 'none' ? { one: true } : {};
  if (/smith/i.test(name) && p.prop !== 'none') return { ...p, prop: 'barbell', ...one };
  const want = PROP[eq];
  if (want) return { ...p, prop: want, ...one };
  // A cable from a low pulley in front of a standing figure; on a bench or the floor the handle is simply not drawn.
  if (eq === 'cable' && HELD.includes(p.prop ?? 'none'))
    return p.view === 'side' && (p.ground ?? 'stand') === 'stand' ? { ...p, prop: 'band', line: [10, 26], one: false } : { ...p, prop: 'none', one: false };
  if (eq === 'bands' && HELD.includes(p.prop ?? 'none')) return { ...p, prop: 'none', one: false };
  return eq === 'body only' || eq === 'machine' ? { ...p, prop: 'none', one: false } : { ...p, ...one };
};
const P = POSES;

// An upper-body move keeps its arms and trunk when the instructions put the body somewhere else: the legs fold onto a
// bench, the floor or the knees. Only for poses whose legs and feet do nothing.
const legsStill = (p: Pose) => !p.pin && !p.lock && !p.box && !p.wall && !p.lift && !p.hop && !p.land && !p.machine && !p.under && !p.incline
  && [0, 1].every((i) => Math.abs(p.start.hip[i] - p.end.hip[i]) < 12 && Math.abs(p.start.knee[i] - p.end.knee[i]) < 12 && p.start.knee[i] < 40)
  && Math.abs(p.start.spine) <= 45 && Math.abs(p.end.spine) <= 55;
const legs = (a: Angles, hip: Pair, knee: In, ankle: In): Angles => ({ ...a, hip, knee: pr(knee), ankle: pr(ankle) });
function seated(p: Pose, where: 'bench' | 'floor'): Pose {
  const o = { ...p, ground: where, fix: undefined, pad: p.pad } as Pose;
  if (p.view === 'front') {
    const f = (a: Angles) => (where === 'bench' ? legs(a, [Math.max(a.hip[0], 20), Math.max(a.hip[1], 20)], 0, 0) : legs(a, [58, 58], 0, 0));
    return { ...o, sit: where === 'bench', start: f(p.start), end: f(p.end) };
  }
  const f = (a: Angles) => (where === 'bench' ? legs(a, pr(90 + a.spine), 90, 0) : legs(a, [84 + a.spine, 96 + a.spine], 6, -10));
  return { ...o, start: f(p.start), end: f(p.end) };
}
function kneeling(p: Pose, half: boolean): Pose {
  const f = (a: Angles) => (half ? legs(a, [90 + a.spine, a.spine], 90, [0, 90]) : legs(a, pr(a.spine), 90, 90));
  return { ...p, ground: 'floor', fix: half ? 'kn1' : 'kn0', start: f(p.start), end: f(p.end) };
}
function adapt(e: Ex, p: Pose): Pose {
  const w = wantPosture(e);
  if (!w || p.weak || (w !== 'seat' && w !== 'kneel') || !legsStill(p)) return p;
  const a = postureOf(p, 0), b = postureOf(p, 1);
  if (POSTURE_OK[w].includes(a) || POSTURE_OK[w].includes(b) || (a !== 'stand' && a !== 'bent')) return p;
  if (w === 'seat') return seated(p, /(sit|seated)( \w+){0,3} on (the|an?) (floor|mat|exercise mat)/.test((e.steps?.[0] ?? '').toLowerCase()) ? 'floor' : 'bench');
  return p.view === 'side' ? kneeling(p, /half/i.test(e.name)) : p;
}
// A rough stand-in from a different movement (often only the same muscle). The app hides these and shows the photo.
const W = (p: Pose): Pose => ({ ...p, weak: true });
// the same pose with both arms held one way from start to end
const armed = (p: Pose, sh: In, el: In, o: Partial<Pose> = {}): Pose => ({ ...p, start: { ...p.start, shoulder: pr(sh), elbow: pr(el) }, end: { ...p.end, shoulder: pr(sh), elbow: pr(el) }, ...o });
// Finishing touches by name, for hand-made and borrowed poses alike: what is held and where, and what the body rests on.
function tune(e: Ex, p: Pose): Pose {
  const n = e.name.toLowerCase(), has = (re: RegExp) => re.test(n), standing = (p.ground ?? 'stand') === 'stand';
  let q = p;
  if (e.id === 'wg_torso-twist-stretch') q = { ...POSES.Russian_Twist, clasp: false, kit: 'wheel' }; // drawn seated on the floor turning a plate
  if (q.kit === 'abwheel' && q.prop === 'barbell') q = { ...q, kit: 'smallbar' };
  if (q.kit && ['landmine', 'tbar', 'wheel', 'hammer', 'tire', 'abwheel'].includes(q.kit) && q.prop !== 'none') q = { ...q, prop: 'none' };
  if (has(/single-arm linear jammer/)) q = { ...q, one: true };
  if (!q.decline && q.view === 'side' && q.start.spine <= -62 && ((has(/decline/) && !has(/push|leverage/)) || has(/sit-ups - with bands/))) q = { ...q, decline: has(/reverse crunch|leg raise/) ? -22 : 22 };
  if (q.box === 'wr1' && q.one && !has(/dumbbell/)) q = { ...q, box: undefined };
  if (has(/smith/) && q.prop === 'none' && standing && q.view === 'side' && has(/calf|lunge|split squat/)) q = armed(q, -15, 155, { prop: 'barbell', rack: 'back' });
  if (has(/barbell calf raise|rocking standing calf/) && q.prop === 'barbell') q = armed(q, -15, 155, { rack: 'back' });
  if (has(/standing dumbbell calf raise|dumbbell lateral lunge/)) q = armed(q, 3, 3);
  if (has(/side split squat/) && q.prop === 'barbell') q = { ...q, rack: 'back' };
  if (has(/double|two-arm|two kettlebell/) && q.prop === 'kettlebell' && q.one) q = { ...q, one: false };
  if (has(/box squat|squat to a bench|chair squat/) && !q.kit && q.view === 'side') q = { ...q, kit: 'seatbox' };
  if (has(/sled overhead triceps/)) q = { ...q, prop: 'none', one: false, clasp: true };
  if (has(/seated one-leg calf/) && q.prop === 'dumbbell') q = { ...q, one: true };
  if (has(/flat bench leg pull-in/) && !has(/seated/)) q = { ...q, ground: 'bench' };
  return q;
}
function pattern(e: Ex): Pose {
  const n = e.name.toLowerCase(), m = e.primary[0], eq = e.equipment, has = (re: RegExp) => re.test(n);
  const byEq = (bar: Pose, db: Pose, kb: Pose, bw: Pose) => (eq === 'barbell' || eq === 'e-z curl bar' ? bar : eq === 'dumbbell' ? db : eq === 'kettlebells' ? kb : bw);
  // Foam rolling (SMR): drawn where the body rolls over the roller in profile; side-lying and seated ones show the photo.
  if (has(/-smr\b|foam roll/)) {
    if (has(/^calves/)) return P.f_smr_calves;
    if (has(/^hamstring/)) return P.f_smr_hamstrings;
    if (has(/^(rhomboids|lower back)/)) return P.f_smr_back;
    if (has(/^quadriceps/)) return P.f_smr_quads;
    return W(P.Childs_Pose);
  }
  if (e.category === 'stretching' || has(/stretch/)) {
    if (e.id === 'Hamstring_Stretch') return P.f_lying_ham; // the dataset's one lies on the back, leg up
    if (has(/chair leg extended/)) return P.f_chair_ham;
    if (has(/standing hip flexors/)) return P.f_hip_flexor_stand;
    if (has(/standing.*quad/)) return P.f_quad_stretch;
    if (has(/triceps stretch|overhead triceps/)) return P.f_triceps_stretch;
    if (has(/upward stretch|overhead stretch/)) return P.f_reach_up;
    if (has(/lateral stretch/)) return P.f_lateral_stretch;
    if (has(/elbows back|standing biceps stretch|dynamic chest stretch|chest and front of shoulder/)) return P.f_arms_back;
    if (has(/butterfly stretch/)) return P.f_butterfly_stretch;
    if (has(/split squats?$/)) return P.Bodyweight_Walking_Lunge;
    if (has(/front leg raise/)) return P.f_leg_swing;
    if (has(/90.90|leg-up hamstring|^lying hamstring|intermediate groin/)) return P.f_lying_ham;
    if (has(/inchworm/)) return P.f_inchworm;
    if (has(/greatest/)) return P.f_greatest;
    if (has(/leg grab/)) return P.f_seated_fold;
    if (has(/hip flexor and quad/)) return P.f_prone_quad;
    if (has(/ankle circles/)) return P.f_ankle_circles;
    if (has(/knee circles/)) return P.f_knee_circles;
    if (has(/seated calf stretch|peroneals stretch|posterior tibialis/)) return P.f_seated_toe;
    if (has(/chair lower back/)) return P.f_chair_reach;
    if (has(/dynamic back stretch/)) return P.f_reach_up;
    if (has(/^upper back stretch/)) return P.f_upper_back;
    if (has(/one arm against wall/)) return P.f_wall_lat;
    if (has(/one handed hang/)) return P.f_one_hang;
    if (has(/^overhead lat/)) return P.f_overhead_lat;
    if (has(/side-lying floor stretch/)) return P.f_side_reach;
    if (m === 'hamstrings')
      return has(/seated|straddle|forward fold|sit and reach/) ? P.f_seated_fold
        : has(/lying|leg-up|90|groin|leg grab|inchworm|greatest/) ? W(P['wg_hamstring-stretch']) : P['wg_hamstring-stretch'];
    if (m === 'calves') return has(/wall|standing|gastrocnemius|soleus/) ? P.Calf_Stretch_Hands_Against_Wall : W(P.Calf_Stretch_Hands_Against_Wall);
    if (m === 'quadriceps') return has(/intermediate|lying|side/) ? W(P.Kneeling_Hip_Flexor) : has(/hip flexor|kneeling|lunge/) ? P.Kneeling_Hip_Flexor : W(P.Kneeling_Hip_Flexor);
    if (m === 'neck' || m === 'traps') return has(/side|tilt|lateral/) ? P.Side_Neck_Stretch : W(P.Side_Neck_Stretch);
    if (m === 'lats' || m === 'middle back') return has(/child|kneeling|prayer|puppy/) ? P.Childs_Pose : W(P.Childs_Pose);
    if (m === 'abdominals') return W(P.Cat_Stretch);
    if (['chest', 'shoulders', 'biceps', 'triceps', 'forearms'].includes(m)) return W({ ...P.Band_Pull_Apart, prop: 'none', pace: 'hold' });
    return W(P.Knee_Across_The_Body);
  }
  if (e.category === 'cardio' || has(/\b(running|jogging|jog|sprints?|treadmill)\b/)) {
    if (has(/bike|cycl/)) return P.Bicycling_Stationary;
    if (has(/row/)) return P.Rowing_Stationary;
    if (has(/skierg/)) return P['Straight-Arm_Pulldown'];
    if (has(/rope|skip/)) return P.f_jump_rope;
    if (has(/jump|jack/)) return P['wg_jumping-jack'];
    if (has(/stair|step|climb/)) return P.Stairmaster;
    if (has(/ellip/)) return P.Elliptical_Trainer;
    if (has(/incline|hill|hik/)) return has(/treadmill/) ? P['wg_treadmill-incline-walk'] : P.wg_hiking;
    if (has(/lunge sprint/)) return P.Bodyweight_Walking_Lunge;
    if (has(/sprint/)) return P['Single-Cone_Sprint_Drill'];
    if (has(/jog/)) return has(/treadmill/) ? P.Jogging_Treadmill : P.Trail_Running_Walking;
    if (has(/walk/)) return has(/treadmill/) ? P.Walking_Treadmill : { ...P.Walking_Treadmill, machine: undefined };
    return has(/treadmill/) ? P.Running_Treadmill : { ...P.Running_Treadmill, machine: undefined };
  }
  if (has(/burpee/)) return P.wg_burpee;
  // round 16: positions, movements and equipment that did not match the pictures
  if (has(/^rear delt fly$/)) return REAR(72);
  if (has(/one-arm incline lateral raise/)) return P.g_incline_side_raise;
  if (has(/middle back shrug/)) return P.g_prone_shrug;
  if (has(/standing concentration curl/)) return P.g_stand_conc;
  if (has(/curl over incline bench/)) return P.g_over_bench_curl;
  if (has(/donkey calf/)) return P.g_donkey_calf;
  if (has(/seated barbell twist/)) return P.g_seated_bar_twist;
  if (has(/^toe touch$/)) return P.g_toe_touch;
  if (has(/side jackknife/)) return P.g_side_jackknife;
  if (has(/bear plank/)) return P.g_bear_plank;
  if (has(/copenhagen/)) return P.g_copenhagen;
  if (has(/^barbell ab rollout$/)) return P.g_standing_rollout;
  if (has(/machine glute kickback/)) return P['One-Legged_Cable_Kickback'];
  if (has(/pistol squat/)) return eq === 'kettlebells' ? armed(P.g_pistol, 20, 150) : has(/smith/) ? armed(P.g_pistol, -15, 155) : P.g_pistol;
  if (has(/shrimp squat|skater squat/)) return P.g_shrimp;
  if (has(/one leg barbell squat|single-leg split squat/)) return has(/barbell|smith/) ? armed(P.g_bulgarian, -15, 155, { prop: 'barbell', rack: 'back' }) : P.g_bulgarian;
  if (has(/wall walk/)) return P.g_wall_walk;
  if (has(/crab walk/)) return P.g_crab_walk;
  if (has(/body tricep press/)) return P.g_body_tricep;
  if (has(/smith machine leg press/)) return P.g_floor_leg_press;
  if (has(/^butterfly$|pec deck/)) return P.g_pec_deck;
  if (has(/cable rear delt fly/)) return P.g_cable_rear_fly;
  if (has(/jackknife sit-up|^v-up/)) return P.g_vup;
  if (has(/^lying leg raise/)) return LEG_RAISE;
  if (has(/hindu/)) return P.g_hindu;
  if (has(/squat thrust/)) return P.wg_burpee;
  if (has(/sissy squat/)) return P.g_sissy;
  if (has(/turkish get-up/)) return P.g_getup;
  if (has(/raise (above|over) head/)) return P.g_raise_overhead;
  if (has(/^dumbbell raise$/)) return P.g_elbow_raise;
  if (has(/side laterals to front raise/)) return P.g_side_to_front;
  if (has(/clean shrug|snatch shrug/)) return P.Barbell_Shrug;
  if (has(/tire flip/)) return P.g_tire;
  if (has(/frankenstein/)) return P.g_frankenstein;
  if (has(/front barbell squat/)) return P.Front_Squat_Clean_Grip;
  if (has(/zercher/)) return P.g_zercher;
  if (has(/jefferson/)) return P.g_jefferson;
  if (has(/landmine squat/)) return P.g_landmine_squat;
  if (has(/meadows row|one-arm long bar row/)) return { ...P['One-Arm_Dumbbell_Row'], kit: 'tbar', box: undefined };
  if (has(/^t-bar row$|two-arm long bar row/)) return { ...P.Bent_Over_Barbell_Row, kit: 'tbar' };
  if (has(/chest supported row|lying t-bar row/)) return { ...P.f_incline_row, kit: 'tbar' };
  if (has(/landmine romanian/)) return { ...P.Romanian_Deadlift, kit: 'landmine', clasp: true };
  if (has(/weighted jump squat/)) return P.g_bar_jump;
  if (has(/shrug behind the back|behind the back shrug/)) return P.g_shrug_behind;
  if (has(/press - behind the neck|press behind neck/)) return P.g_press_behind;
  if (has(/goblet/) && eq === 'dumbbell') return P.g_goblet_db;
  if (has(/one-arm overhead kettlebell squat/)) return P.g_oh_kb_squat;
  if (has(/reverse plate curl/)) return { ...P.Barbell_Curl, kit: 'wheel' };
  if (has(/plate twist/)) return { ...P.Russian_Twist, clasp: false, kit: 'wheel' };
  if (has(/single dumbbell raise/)) return P.g_single_db_raise;
  if (has(/single dumbbell skullcrusher/)) return { ...P.Lying_Triceps_Press, clasp: true };
  if (has(/sledgehammer/)) return P.g_hammer;
  if (has(/sled overhead backward/)) return P.g_overhead_walk;
  if (has(/weighted push-up/)) return { ...P.Pushups, kit: 'backplate' };
  if (has(/exercise ball crunch/)) return P.g_ball_crunch;
  if (has(/crunch - legs on exercise ball/)) return P.g_crunch_legs_ball;
  if (has(/cable russian twist/)) return P.g_ball_twist;
  if (has(/feet on an exercise ball/)) return { ...P.g_decline_pushup, box: undefined, under: { at: 'toe0', r: 12 } };
  if (has(/^decline push-up|push-ups with feet elevated/)) return P.g_decline_pushup;
  if (has(/physioball hip bridge/)) return P.g_ball_bridge;
  if (has(/front-foot elevated|deficit reverse lunge/)) return P.g_step_lunge;
  if (has(/svend/)) return { ...P.f_svend, kit: 'wheel' };
  // round 14 posture fixes: these names used to fall through to a figure standing, lying or sitting the wrong way
  const want = wantPosture(e);
  if (has(/kneeling.*(pulley row|pull-?down)/)) return P.f_pulldown_side;
  if (has(/kneeling cable crunch|^rope crunch/)) return P.Cable_Crunch;
  if (has(/kneeling jump squat/)) return P.f_kneel_jump;
  if (has(/kneeling squat/)) return P.f_kneel_squat;
  if (has(/gorilla chin/)) return P.f_gorilla;
  if (has(/push-up depth jump|^drop push/)) return has(/incline/) ? P['Incline_Push-Up'] : P.Pushups;
  if (has(/plank jack|shoulder tap/)) return P.f_high_plank;
  if (has(/renegade/)) return P.f_renegade;
  if (has(/wrist curl over a bench/)) return P.f_wrist_bench;
  if (has(/prone incline curl/)) return P.f_spider_curl;
  if (has(/incline row|chest.supported row|lying t-bar row/)) return P.f_incline_row;
  if (has(/lying cambered/)) return P.f_prone_row;
  if (has(/anti-gravity/)) return P.f_antigravity;
  if (has(/^reverse flyes/) && eq === 'dumbbell') return W(P.Band_Pull_Apart); // chest on an incline, arms out toward the camera
  if (has(/ball side bend/)) return W(P.f_side_bend);
  if (has(/seated box jump/)) return W(P.Front_Box_Jump);
  if (has(/front incline.*raise/)) return P.f_incline_raise;
  if (has(/incline (\w+ )*triceps extension/)) return P.f_incline_skull;
  if (has(/decline (\w+ )*triceps extension/)) return P.Lying_Triceps_Press;
  if (e.primary[0] === 'triceps' && want === 'supine' && has(/extension|press/) && !has(/bench press|floor press|press to chin|tate/)) return has(/extension/) ? P.Lying_Triceps_Press : P['Close-Grip_Barbell_Bench_Press'];
  if (has(/seated bent-over.*triceps/)) return P.f_seated_kickback;
  if (has(/seated good morning/)) return P.f_seated_gm;
  if (has(/dip machine/)) return P.f_dip_machine;
  if (has(/chair dip/)) return P.Bench_Dips;
  if (has(/ab crunch machine/)) return P.f_seated_crunch;
  if (has(/cable seated crunch|seated cable crunch/)) return P.f_seated_cable_crunch;
  if (has(/(leverage|machine) (\w+ )*(chest|bench) press/) && !has(/smith/)) return P.f_machine_press;
  if (has(/machine bicep/)) return P.Preacher_Curl;
  if (has(/machine triceps extension/)) return P.f_pad_extension;
  if (has(/^calf press/) && !has(/leg press/)) return P.f_calf_press;
  if (has(/machine row/)) return P.f_iso_row;
  if (has(/seated.*(leg pull-in|knee tuck)/)) return P.f_seated_tuck;
  if (has(/seated.*cable.*rows?/)) return P.Seated_Cable_Rows;
  if (has(/standing leg curl/)) return P.f_standing_leg_curl;
  if (has(/suspended fallout/)) return P.f_fallout;
  if (has(/shotgun row/)) return P.f_low_row_one;
  if (has(/full twist/)) return P.f_stand_twist;
  if (has(/svend/)) return P.f_svend;
  if (has(/^leg lift$/)) return P['One-Legged_Cable_Kickback'];
  if (has(/london bridges/)) return P.Inverted_Row;
  if (has(/hamstring walkout|towel hamstring curl/)) return P.f_ham_walkout;
  if (has(/stability ball hamstring curl/)) return P.f_ball_curl;
  if (has(/drag with press/)) return P.f_standing_cable_press;
  if (has(/^swimming/)) return P.f_swim;
  if (has(/skierg/)) return P['Straight-Arm_Pulldown'];
  if (has(/sled push|prowler/)) return P.Prowler_Sprint;
  if (has(/high pulley row/)) return P['Wide-Grip_Lat_Pulldown'];
  if (has(/lying close-grip bar curl on high pulley/)) return P.f_lying_cable_curl;
  if (has(/standing (cable )?chest press/)) return P.f_standing_cable_press;
  if (has(/on high pulley/)) return W(P.Pushups);
  if (has(/side bridge|side plank/) && !has(/push.?up/)) return P.f_side_bridge;
  if (has(/sled drag - harness/)) return P.f_sled_drag;
  if (has(/hollow/)) return P.f_hollow;
  if (has(/star jump/)) return P['wg_jumping-jack'];
  if (has(/rope jump|jump rope|skipping rope/)) return P.f_jump_rope;
  if (has(/side.lying leg raise|side.lying hip abduction/)) return P.f_side_leg_raise;
  if (has(/monster walk|band walk|lateral walk/)) return P['wg_banded-standing-hip-abduction'];
  if (has(/side split squat|side lunge|lateral lunge|cossack/)) return P.f_side_lunge;
  if (has(/floor press/)) return P.f_floor_press;
  if (has(/overhead squat/)) return P.f_overhead_squat;
  if (has(/barbell hack squat/)) return P.f_barbell_hack;
  if (has(/lying machine squat/)) return P.Leg_Press;
  if (has(/standing (rope|cable) crunch/)) return P.f_standing_cable_crunch;
  if (has(/glute kickback/) || (has(/kickback/) && eq === 'body only' && m !== 'triceps')) return P.f_donkey_kick;
  if (has(/ball leg curl/)) return P.f_ball_curl;
  if (has(/reverse hyperextension/)) return P.f_rev_hyper;
  if (has(/suspended reverse crunch/)) return P.f_susp_crunch;
  if (has(/bodyweight flyes/)) return W(P.Pushups); // hands slide apart: only readable from the front, lying face down
  if (has(/flat bench leg pull-in/)) return P['Leg_Pull-In'];
  if (has(/incline.*(fly|flye)/)) return P.f_incline_fly;
  if (has(/flat bench cable fl/)) return P.Dumbbell_Flyes;
  if (has(/back flyes?.*band/)) return P.Band_Pull_Apart;
  if (has(/rear.delt row/) && eq === 'cable') return P.Face_Pull;
  // Face-down rear-delt raises swing the arms out sideways toward the camera, which no view of the figure shows: photo.
  if (has(/(lying|incline).*(lateral|rear delt) raise/)) return has(/rear/) || e.id === 'Lying_One-Arm_Lateral_Raise' ? W(P.Side_Lateral_Raise) : P.f_side_raise; // that one lies chest down
  if (has(/leverage high row/)) return P.f_high_row;
  if (has(/leverage iso row/)) return P.f_iso_row;
  if (has(/lying t-bar row/)) return P.f_chest_row;
  if (has(/cable chest press/)) return has(/incline/) ? P.f_incline_cable_press : P.f_seated_cable_press;
  if (has(/bosu ball cable crunch/)) return P.f_bosu_crunch;
  if (has(/upright (\w+ )?row/)) return P.Upright_Barbell_Row;
  if (has(/bent.over.*triceps extension/)) return P.Tricep_Dumbbell_Kickback;
  if (has(/incline triceps extension|decline triceps extension/)) return P.Lying_Triceps_Press;
  if (has(/incline pushdown/)) return P.f_pullover;
  // families drawn for their own movement (see the f_ poses)
  if (has(/wrist curl|wrist extension|finger curl/)) return has(/behind/) ? P.f_wrist_behind : P.f_wrist_curl;
  if (has(/plate pinch|hand squeeze/)) return P.f_grip_hold;
  if (has(/dead hang|active hang/)) return P.f_dead_hang;
  if (has(/clean deadlift|snatch deadlift/)) return P.Barbell_Deadlift;
  if (has(/high pull/)) return P.f_high_pull;
  if (has(/clean pull|snatch pull/)) return P.f_pull;
  if (has(/snatch balance/)) return P.f_snatch_balance;
  if (has(/clean and (press|jerk)/)) return P.f_clean_press;
  if (has(/thruster/)) return P.f_thruster;
  if (has(/clean|snatch/) && !has(/rack/)) {
    const hang = has(/hang|blocks/);
    if (eq === 'kettlebells') return has(/snatch/) ? P.f_kb_snatch : P.f_kb_clean;
    return has(/snatch/) ? (hang ? P.f_hang_snatch : P.f_snatch) : hang ? P.f_hang_clean : P.f_clean;
  }
  if (has(/side bend/)) return P.f_side_bend;
  if (has(/windmill/) && eq === 'kettlebells') return P.f_windmill;
  if (has(/pullover/)) return has(/straight/) ? P.f_pullover : P.f_pullover_bent;
  if (has(/slam/)) return P.f_slam;
  if (has(/chest pass|chest push/)) return P.f_chest_pass;
  if (has(/scoop throw|backward medicine ball throw/)) return P.f_scoop_throw;
  if (has(/overhead throw/)) return has(/supine/) ? P.f_supine_throw : P.f_overhead_throw;
  if (has(/rollout|ab roller|fallout/)) return P.f_rollout;
  if (has(/l-sit/) && !has(/pull/)) return P.f_lsit;
  if (has(/raise on parallel/)) return P.f_bar_knee_raise;
  if (has(/dragon flag/)) return P.f_dragon_flag;
  if (has(/pallof/)) return P.f_pallof;
  if (has(/high knees|skipping/)) return P.f_high_knees;
  if (has(/butt kick/)) return P.f_butt_kicks;
  if (has(/donkey kick/)) return P.f_donkey_kick;
  if (has(/prone y/)) return P.f_prone_y;
  if (has(/frog pump/)) return P.Butt_Lift_Bridge;
  if (has(/glute.?ham raise/)) return P.f_ghr;
  if (has(/leg pull-in|leg tucks/) && !has(/ball/)) return P.f_seated_tuck;
  if (has(/spider curl/)) return P.f_spider_curl;
  if (has(/incline bench pull/)) return P.f_incline_row;
  if (has(/drag curl/)) return P.f_drag_curl;
  if (has(/overhead cable curl|high cable curl/)) return P.f_overhead_curl;
  if (has(/wrist roller/)) return P.f_wrist_roller;
  if (has(/atlas stone|keg load|sandbag load|tire flip/)) return P.f_stone;
  if (has(/log lift|circus bell/)) return P.f_clean_press;
  if (has(/rope climb/)) return P.f_rope_climb;
  if (has(/arm drill/)) return P.f_arm_drill;
  if (has(/leg swing/)) return P.f_leg_swing;
  if (has(/hip flexion/)) return P.f_hip_flexion;
  if (has(/hip extension/)) return P['One-Legged_Cable_Kickback'];
  if (has(/landmine (press|linear)|linear jammer/)) return P.f_landmine;
  if (has(/fast feet/)) return P.f_fast_feet;
  if (has(/crucifix/)) return P.f_crucifix;
  if (has(/chins?|pull ups/)) return has(/chin/) ? P['Chin-Up'] : P.Pullups;
  if (has(/behind (the )?neck/)) return has(/pulldown/) ? P['Wide-Grip_Lat_Pulldown'] : P.Standing_Military_Press;
  if (has(/machine.*(shoulder|military|overhead).*press|smith machine overhead/)) return P.Standing_Military_Press;
  if (has(/row to neck/)) return P.Face_Pull;
  if (has(/neck press|pin press/)) return P['Barbell_Bench_Press_-_Medium_Grip'];
  if (has(/jm press/)) return P['Close-Grip_Barbell_Bench_Press'];
  if (has(/press to chin/)) return P.Lying_Triceps_Press;
  if (has(/incline dumbbell bench/)) return P.Incline_Dumbbell_Press;
  if (has(/^dumbbell raise|single dumbbell raise|scaption/)) return P.Front_Dumbbell_Raise;
  if (has(/side laterals|power partials|^iron cross/)) return P.Side_Lateral_Raise;
  if (has(/cable iron cross|cross over - with bands|^butterfly$/)) return has(/butterfly/) ? { ...P.Cable_Crossover, prop: 'none', ground: 'bench' } : P.Cable_Crossover;
  if (has(/around the worlds/)) return P.Dumbbell_Flyes;
  if (has(/bent-knee hip raise|bottoms up/)) return P.Reverse_Crunch;
  if (has(/elbow to knee/)) return P.Crunches;
  if (has(/cocoons/)) return P['Leg_Pull-In'];
  if (has(/scissor kick/)) return P.Flutter_Kicks;
  if (has(/sprawl/)) return P.wg_burpee;
  if (has(/step-down|power stairs/)) return P['Step-up_with_Knee_Raise'];
  if (has(/sit squats/)) return P.Bodyweight_Squat;
  if (has(/frog hops/)) return P.Freehand_Jump_Squat;
  if (has(/quick leap/)) return P.Front_Box_Jump;
  if (has(/return push|drop push|heavy bag thrust/)) return P.f_chest_pass;
  if (has(/one knee to chest/)) return P.Hug_Knees_To_Chest;
  if (has(/banded clamshell/)) return P.wg_clamshell;
  if (has(/dead bug/)) return P.Dead_Bug;
  if (has(/lower back curl|half locust/)) return P.Superman;
  if (has(/speed band overhead triceps/)) return P.Triceps_Overhead_Extension_with_Rope;
  if (has(/crossover reverse lunge/)) return P.Bodyweight_Walking_Lunge;
  if (has(/3-part start/)) return P['Single-Cone_Sprint_Drill'];
  if (has(/mountain climber/)) return P.Mountain_Climbers;
  if (has(/\bjacks?\b/)) return P['wg_jumping-jack'];
  if (has(/chin-?up/)) return P['Chin-Up'];
  if (has(/pull-?up|muscle.?up/)) return P.Pullups;
  if (has(/pull-?down/)) return has(/straight/) ? P['Straight-Arm_Pulldown'] : P['Wide-Grip_Lat_Pulldown'];
  if (has(/face pull/)) return P.Face_Pull;
  if (has(/upright row/)) return P.Upright_Barbell_Row;
  if (has(/inverted row/)) return P.Inverted_Row;
  if (has(/\brows?\b|rowing/))
    return has(/one.arm|single|alternat/) ? P['One-Arm_Dumbbell_Row'] : eq === 'cable' || has(/seated|cable/) ? P.Seated_Cable_Rows
      : byEq(P.Bent_Over_Barbell_Row, P['Bent_Over_Two-Dumbbell_Row'], P['Bent_Over_Two-Dumbbell_Row'], eq === 'machine' ? P.Bent_Over_Barbell_Row : P['wg_doorway-row']);
  if (has(/shrug/)) return P.Barbell_Shrug;
  if (has(/swing/)) return P['wg_kettlebell-swing'];
  if (has(/jerk|push press/)) return P.Standing_Military_Press;
  if (has(/good morning/)) return P.Good_Morning;
  if (has(/superman/)) return P.Superman;
  if (has(/hyperextension|back extension/)) return P.Hyperextensions_With_No_Hyperextension_Bench;
  if (has(/romanian|stiff|\brdl\b/)) return P.Romanian_Deadlift;
  if (has(/deadlift|rack pull/)) return has(/sumo/) ? P.Sumo_Deadlift : P.Barbell_Deadlift;
  if (has(/hip thrust/)) return P.Barbell_Hip_Thrust;
  if (has(/bridge|glute lift|hip lift/)) return has(/single|one/) ? P.Single_Leg_Glute_Bridge : P.Butt_Lift_Bridge;
  if (has(/kickback/)) return m === 'triceps' ? P.Tricep_Dumbbell_Kickback : P['One-Legged_Cable_Kickback'];
  if (has(/abduct/)) return has(/standing|cable|band/) && !has(/seated|machine/) ? P['wg_banded-standing-hip-abduction'] : P.Thigh_Abductor;
  if (has(/adduct/)) return has(/standing|cable|band/) && !has(/seated|machine/) ? P.f_standing_adduction : P.Thigh_Adductor;
  if (has(/bear crawl/)) return P['wg_bear-crawl'];
  if (has(/leg press/) || (has(/sled/) && !has(/drag|push|row|walk|fly|flye|extension|swing/))) return P.Leg_Press;
  if (has(/leg extension/)) return P.Leg_Extensions;
  if (has(/leg curl|hamstring curl/)) return has(/seated/) ? P.Seated_Leg_Curl : P.Lying_Leg_Curls;
  if (has(/calf|calves|toe raise/)) return has(/seated/) ? P.Seated_Calf_Raise : P.Standing_Calf_Raises;
  if (has(/jump|\bhops?\b|\bbound/)) return has(/lunge|split|scissor/) ? P.Scissors_Jump : has(/box/) ? P.Front_Box_Jump : P.Freehand_Jump_Squat;
  if (has(/lunge|split squat/)) return byEq(P.Barbell_Lunge, P.Dumbbell_Lunges, P.Dumbbell_Lunges, P.Bodyweight_Walking_Lunge);
  if (has(/step.?up/)) return byEq(P.Barbell_Step_Ups, P.Dumbbell_Step_Ups, P.Dumbbell_Step_Ups, P['Step-up_with_Knee_Raise']);
  if (has(/hack/)) return P.Hack_Squat;
  if (has(/front squat/)) return P.Front_Squat_Clean_Grip;
  if (has(/wall sit/)) return P['wg_wall-sit'];
  if (has(/squat/)) return has(/plie|sumo/) ? P.Plie_Dumbbell_Squat : byEq(P.Barbell_Squat, P.Dumbbell_Squat, P.Goblet_Squat, P.Bodyweight_Squat);
  if (has(/\bfly|flye|crossover|pec deck/)) return has(/reverse|rear/) ? P.g_rev_fly_stand : eq === 'cable' || has(/cable|crossover/) ? P.Cable_Crossover : P.Dumbbell_Flyes;
  if (has(/push.?up/)) return has(/handstand/) ? P.f_handstand_pushup : has(/pike/) ? P.f_pike_pushup : has(/scapular|isometric|wiper/) ? W(P.Pushups) : has(/incline/) ? P['Incline_Push-Up'] : has(/knee/) ? P['wg_knee-push-up'] : P.Pushups;
  if (has(/\bdips?\b/)) return has(/bench/) ? P.Bench_Dips : P['Dips_-_Chest_Version'];
  if (m === 'triceps' && has(/triceps? press/) && !has(/lying|decline|bench/)) return P.Standing_Dumbbell_Triceps_Extension;
  if (has(/skull|lying triceps|french press|lying .*extension/)) return P.Lying_Triceps_Press;
  if (has(/push-?down|pressdown/)) return P.Triceps_Pushdown;
  if (m === 'triceps' && has(/extension/)) return eq === 'cable' ? P.Triceps_Overhead_Extension_with_Rope : P.Standing_Dumbbell_Triceps_Extension;
  if (has(/bench press|floor press|chest press|board press/) || (m === 'chest' && has(/press/)))
    return has(/close|narrow/) ? P['Close-Grip_Barbell_Bench_Press'] : has(/incline/) ? P.Incline_Dumbbell_Press
      : byEq(P['Barbell_Bench_Press_-_Medium_Grip'], P.Dumbbell_Bench_Press, P.Dumbbell_Bench_Press, P['Barbell_Bench_Press_-_Medium_Grip']);
  if (has(/arnold/)) return P.Arnold_Dumbbell_Press;
  if (has(/lateral.*raise|side raise|deltoid raise/)) return P.Side_Lateral_Raise;
  if (has(/front .*raise|front raise/)) return P.Front_Dumbbell_Raise;
  if (has(/rear delt|reverse fly|pull.?apart/)) return has(/pull.?apart/) ? P.Band_Pull_Apart : W(P.Band_Pull_Apart);
  if (has(/press/) && (m === 'shoulders' || m === 'triceps')) return has(/lying|jm |pin |tate|landmine|chin/) ? W(P.Dumbbell_Shoulder_Press) : eq === 'barbell' ? P.Standing_Military_Press : P.Dumbbell_Shoulder_Press;
  if (has(/preacher/)) return P.Preacher_Curl;
  if (has(/concentration/)) return P.Concentration_Curls;
  if (has(/curl/) && m !== 'hamstrings') {
    const p = has(/incline/) ? P.Incline_Dumbbell_Curl : byEq(P.Barbell_Curl, P.Dumbbell_Bicep_Curl, P.Dumbbell_Bicep_Curl, P.Barbell_Curl);
    return m === 'forearms' || has(/wrist|finger|lying|overhead|spider|drag|high cable/) ? W(p) : p;
  }
  if (has(/carry|walk|yoke|farmer/)) return P.Farmers_Walk;
  if (has(/plank|hollow/)) return P.Plank;
  if (has(/twist|russian|woodchop|rotation/)) return has(/twist|russian/) ? P.Russian_Twist : W(P.Russian_Twist);
  if (has(/flutter|scissor/)) return P.Flutter_Kicks;
  if (has(/bicycle|air bike/)) return P.Air_Bike;
  if (has(/hanging/)) return P.Hanging_Leg_Raise;
  if (has(/reverse crunch/)) return P.Reverse_Crunch;
  if (has(/leg raise|knee raise|knee tuck|leg lift|jackknife|v-up|pike/)) return P['Leg_Pull-In'];
  if (has(/sit.?up/)) return P['Sit-Up'];
  if (has(/crunch|toe touch/)) return P.Crunches;
  if (has(/bird.?dog|quadruped/)) return P['wg_bird-dog'];
  if (has(/crawl/)) return P['wg_bear-crawl'];
  if (has(/circle/)) return P.Arm_Circles;
  switch (m) {
    case 'quadriceps': return W(byEq(P.Barbell_Squat, P.Dumbbell_Squat, P.Goblet_Squat, P.Bodyweight_Squat));
    case 'hamstrings': return W(P.Romanian_Deadlift);
    case 'glutes': return W(P.Butt_Lift_Bridge);
    case 'calves': return W(P.Standing_Calf_Raises);
    case 'adductors': return W(P.Thigh_Adductor);
    case 'abductors': return W(P.Thigh_Abductor);
    case 'chest': return W(eq === 'body only' ? P.Pushups : byEq(P['Barbell_Bench_Press_-_Medium_Grip'], P.Dumbbell_Bench_Press, P.Dumbbell_Bench_Press, P.Dumbbell_Flyes));
    case 'shoulders': return W(eq === 'barbell' ? P.Standing_Military_Press : P.Dumbbell_Shoulder_Press);
    case 'lats': return W(eq === 'body only' || eq === 'pull-up bar' ? P.Pullups : P['Wide-Grip_Lat_Pulldown']);
    case 'middle back': return W(P.Bent_Over_Barbell_Row);
    case 'lower back': return W(P.Superman);
    case 'traps': return W(P.Barbell_Shrug);
    case 'biceps': case 'forearms': return W(P.Barbell_Curl);
    case 'triceps': return W(P.Triceps_Pushdown);
    case 'abdominals': return W(P.Crunches);
    case 'neck': return W(P.Side_Neck_Stretch);
    default: return W(P.Bodyweight_Squat);
  }
}
// ---- cables, bands and ropes for the 3D figure, by name. The first rule that fits wins.
const cb = (on: Cord['on'], to?: [number, number, number], more: Cord = {}): Cord => ({ on, to, ...more });
const CORDS: [RegExp, Cord][] = [
  [/rope climb/, { kind: 'rope', on: 'both', to: [0, 0, 190], tail: true }],
  [/rope jumping|jump rope|skipping rope/, { kind: 'rope', on: 'skip' }],
  [/battling ropes/, { kind: 'rope', on: 'hands' }],
  [/suspended (fallout|push-up)/, { kind: 'strap', on: 'hands', to: [0, 0, 190] }],
  [/suspended reverse crunch/, { kind: 'strap', on: 'feet', to: [0, 0, 190] }],
  [/suspended split squat/, { kind: 'strap', on: 'ankleL', to: [0, 0, 190] }],
  [/sled overhead triceps/, { kind: 'strap', on: 'both', to: [-70, 0, 12] }],
  [/sled (reverse flye|overhead backward)/, { kind: 'strap', on: 'hands', to: [80, 0, 12] }],
  [/suspended row|bodyweight mid row|towel row|sled row|backward drag|forward drag/, { kind: 'strap', on: 'hands' }],
  [/banded dead bug/, { kind: 'band', on: 'assist' }],
  [/low-pulley one-arm triceps/, cb('hand', [-30, 0, 3])],
  [/band assisted/, { kind: 'band', on: 'assist' }],
  [/reverse band/, { kind: 'band', on: 'barends', to: [0, 0, 130] }],
  [/(squat|deadlift|rack pull|curl) with bands?$|box squat with bands/, { kind: 'band', on: 'barends', drop: true }],
  [/bench press - with bands/, { kind: 'band', on: 'hands', drop: true }],
  [/(shoulder press|lateral raise|upright row|squats|calf raises) - with bands/, { kind: 'band', on: 'hands', under: true }],
  [/band good morning \(pull through\)/, cb('both', [-38, 0, 3])],
  [/band good morning/, { kind: 'band', on: 'neck', under: true }],
  [/low cable crossover/, cb('hands', [-4, 30, 3])],
  [/low-pulley side lateral/, cb('hand', [6, -50, 3])],
  [/cable (seated )?lateral raise|low-pulley deltoid raise/, cb('hands', [6, -48, 3])],
  [/cable rear delt fly/, cb('hands', [0, -55, 118])],
  [/cable .*shoulder press|cable shoulder press/, cb('hands', [0, 16, 3])],
  [/overhead cable curl|high cable curl/, cb('hands', [0, 42, 112])],
  [/high-pulley cable side bends/, cb('hand', [0, 28, 125])],
  [/hip adduction|hip adductions/, cb('ankleL', [0, 62, 3])],
  [/cable standing hip abduction/, cb('ankleL', [0, -70, 3])],
  [/monster walk|standing hip abduction|banded kickback/, { kind: 'band', on: 'ankles' }],
  [/lateral walk|seated hip abduction|clamshell|fire hydrant|banded glute bridge|banded hip thrust|frog pump|banded donkey/, { kind: 'band', on: 'knees' }],
  [/hip lift with band/, { kind: 'band', on: 'hips' }],
  [/internal rotation/, cb('hand', [0, 55, -1])],
  [/external rotation with/, cb('hand', [0, -60, -1])],
  [/wood ?chop/, cb('both', [0, 45, 125])],
  [/cable lift/, cb('both', [0, 45, 3])],
  [/judo flip/, cb('both', [0, 60, 50])],
  [/pallof/, cb('both', [0, 62, -1])],
  [/cable russian twist/, cb('both', [0, 62, -1])],
  [/hip flexion with band/, cb('ankle', [-42, 0, 3])],
  [/seated band hamstring curl/, cb('ankle', [48, 0, 30])],
  [/cable kickback|hip extension with bands|^leg lift$/, cb('ankle', [42, 0, 3])],
  [/band skull crusher|cable lying triceps|low cable triceps|cable incline triceps/, cb('bar', [-48, 0, 6], { wide: 60 })],
  [/cable preacher curl/, cb('bar', [30, 0, 5], { wide: 60 })],
  [/cable wrist curl|low-pulley wrist curl/, cb('bar', [26, 0, 5], { wide: 60 })],
  [/bench cable fl|incline cable fl/, cb('hands', [0, 45, 5])],
  [/cable reverse crunch/, cb('feet', [50, 0, 5])],
  [/sit-ups - with bands/, cb('neck', [-55, 0, 5])],
  [/rowing, stationary/, { kind: 'cable', on: 'bar', bare: true, wide: 40 }],
];
function cordFor(e: Ex, p: Pose): Cord | undefined {
  const n = e.name.toLowerCase(), has = (re: RegExp) => re.test(n);
  const kind: Cord['kind'] = e.equipment === 'bands' || has(/\bbands?\b|banded/) ? 'band' : 'cable';
  const loop = (c: Cord) => c.on === 'ankles' || c.on === 'knees' || c.on === 'hips';
  for (const [re, c] of CORDS) if (re.test(n) && c && (!loop(c) || kind === 'band')) return { kind, ...c };
  if (p.prop !== 'band') return undefined;
  if (!p.line) return { kind: 'band', on: 'hands' }; // stretched between the hands
  const one = p.one || has(/one.arm|single.arm|one-handed/);
  const on: Cord['on'] = has(/rope|face pull|crunch|pull through|hammer/) ? 'rope' : one ? 'hand' : has(/v-bar|close-grip front|cable rows|pulley row|shotgun/) ? 'vbar'
    : has(/pull-?down|push-?down|curl|shrug|upright|deadlift|straight-arm|skierg|row to neck|front cable raise|triceps extension|tricep extension|overhead triceps/) ? 'bar' : 'hands';
  return { kind, on, wide: has(/wide|lat pull|behind/) ? 170 : has(/pull-?down/) ? 110 : 60 };
}
const matchedCache: Record<string, Pose> = {};
export function poseFor(e: Ex): { pose: Pose; matched: boolean } {
  const corded = (p0: Pose): Pose => { const p = tune(e, p0); if (p.cord) return p; const c = cordFor(e, p); return c ? { ...p, cord: c } : p; };
  if (P[e.id]) return { pose: (matchedCache[e.id] ??= corded(adapt(e, P[e.id]))), matched: false };
  // Neck moves without their own pose (rollers, harness variants) never borrow the standing head tilt.
  const neck = e.primary[0] === 'neck' && !/stretch|tilt/i.test(e.name);
  return { pose: (matchedCache[e.id] ??= neck ? W(P.Side_Neck_Stretch) : corded(adapt(e, withProp(pattern(e), e.equipment, e.name)))), matched: true };
}

export function underX(u: NonNullable<Pose['under']>, o: Pts) {
  'worklet';
  return u.mid ? (o[u.at][0] + o[u.mid][0]) / 2 : o[u.at][0];
}
// Soft shadow under whatever is nearest the floor: centre x, half width, opacity. It shrinks and fades as the body
// leaves the ground. The figure draws it and the frame makes room for it.
export function shadowOf(o: Pts): [number, number, number] {
  'worklet';
  let low = -1e9;
  for (const k of KEYS) { const r = R[k]; if (r !== undefined) low = Math.max(low, o[k][1] + r); }
  let sw = 0, sx = 0, x0 = 1e9, x1 = -1e9;
  for (const k of KEYS) {
    const r = R[k];
    if (r === undefined) continue;
    const w = Math.max(0, 1 - (low - o[k][1] - r) / 10);
    if (w > 0) { sw += w; sx += w * o[k][0]; x0 = Math.min(x0, o[k][0]); x1 = Math.max(x1, o[k][0]); }
  }
  const up = Math.max(0, -low);
  const c = sx / sw, rx = ((x1 - x0) / 2 + 10) * (1 - Math.min(0.5, up / 50));
  const l = Math.max(c - rx, x0 - 6), r = Math.min(c + rx, x1 + 6); // weighted centre, but never past the body's own ends
  return [(l + r) / 2, (r - l) / 2, 0.6 * Math.max(0.25, 1 - up / 25)];
}
// The turning crank: two arms from the centre to the pedals (under the ankles), and the pedals.
export function crankPrims(o: Pts): Prim[] {
  'worklet';
  const c = [(o.an0[0] + o.an1[0]) / 2, (o.an0[1] + o.an1[1]) / 2];
  return [[c[0], c[1], o.an0[0], o.an0[1], 1.1], [c[0], c[1], o.an1[0], o.an1[1], 1.1], [o.an0[0] - 3, o.an0[1] + 1.5, o.an0[0] + 3, o.an0[1] + 1.5, 1.2], [o.an1[0] - 3, o.an1[1] + 1.5, o.an1[0] + 3, o.an1[1] + 1.5, 1.2]];
}
// Where the weight sits in hand n: at the wrist, or for wrist curls (`flex`) a hand's length past it, tipped by the wrist.
export function handAt(pose: Pose, o: Pts, n: 0 | 1, p: number): [number, number] {
  'worklet';
  const w = n ? o.wr1 : o.wr0;
  if (!pose.flex) return w;
  return at(w, angle(n ? o.el1 : o.el0, w) + pose.flex[0] + (pose.flex[1] - pose.flex[0]) * p, 5);
}
// Side-view barbell centre: in the near hand, or across the upper back behind the neck for back squats and lunges.
export function barAt(pose: Pose, o: Pts, p = 0): [number, number] {
  'worklet';
  if (pose.rack !== 'back') return handAt(pose, o, 0, p);
  const t = angle(o.pelvis, o.neck);
  return at(at(o.neck, t, -5), t - 90, 9);
}
// Leg-press plate: a board along the soles of the near foot, a little longer than the foot.
export function sledAt(o: Pts): [[number, number], [number, number]] {
  'worklet';
  const t = angle(o.heel0, o.toe0), m: [number, number] = [(o.heel0[0] + o.toe0[0]) / 2, (o.heel0[1] + o.toe0[1]) / 2];
  const a = at(m, t + 90, 3), b = at(m, t - 90, 3);
  const out = Math.hypot(a[0] - o.an0[0], a[1] - o.an0[1]) > Math.hypot(b[0] - o.an0[0], b[1] - o.an0[1]) ? a : b;
  return [at(out, t, -11), at(out, t, 11)];
}

export const anchorOf = (pose: Pose, b: Pts, n: 0 | 1): [number, number] | null => {
  if (!pose.line || (n === 1 && pose.view !== 'front')) return null;
  const w = b[`wr${n}` as Key];
  return [w[0] + (n === 1 ? -pose.line[0] : pose.line[0]), w[1] + pose.line[1]];
};

// ---- what is drawn, as plain geometry (worklets) ----
// A primitive is a circle [x, y, r] or a capsule [ax, ay, bx, by, r] (r = 0: a thin stroked line). The figure draws
// these and the frame below measures them, so the framing always matches what is on screen.
export type Prim = number[];
export function primPath(q: Prim) {
  'worklet';
  if (q.length === 3) return circ([q[0], q[1]], q[2]);
  if (q[4] === 0) return `M${n2([q[0], q[1]])}L${n2([q[2], q[3]])}`;
  return cap([q[0], q[1]], [q[2], q[3]], q[4], q[4]);
}
// Dumbbell, barbell, kettlebell or ball in hand n, the plate on the head, or the band/cable from the hand to its anchor.
export function gearPrims(pose: Pose, o: Pts, n: 0 | 1, p: number, anchor: [number, number] | null): Prim[] {
  'worklet';
  if (n === 1 && pose.one) return [];
  if (n === 1 && pose.under && !pose.under.fixed) return [[underX(pose.under, o), -pose.under.r, pose.under.r]]; // the ball rolls with the feet
  const front = pose.view === 'front', w = handAt(pose, o, n, p);
  switch (pose.prop) {
    case 'dumbbell': return [[w[0], w[1], 5]];
    case 'ball': {
      if (n === 1) return [];
      if (!front) return [[w[0], w[1], 6]];
      return [[(o.wr0[0] + o.wr1[0]) / 2, (o.wr0[1] + o.wr1[1]) / 2 - 3, 6]];
    }
    case 'kettlebell': { const c = at(w, angle(n ? o.el1 : o.el0, w), 5.5); return [[c[0], c[1], 5.5]]; }
    case 'barbell': {
      if (!front) { if (n === 1) return []; const c = barAt(pose, o, p); return [[c[0], c[1], pose.flex ? 4.5 : 9]]; }
      if (n === 1) return [];
      const t = angle(o.wr1, o.wr0), e0 = at(o.wr0, t, 12), e1 = at(o.wr1, t, -12);
      const a0 = at(e0, t + 90, 7), b0 = at(e0, t - 90, 7), a1 = at(e1, t + 90, 7), b1 = at(e1, t - 90, 7);
      return [[e0[0], e0[1], e1[0], e1[1], 1.1], [a0[0], a0[1], b0[0], b0[1], 2.6], [a1[0], a1[1], b1[0], b1[1], 2.6]];
    }
    case 'plate': { // edge-on plate across the top of the head
      if (n === 1) return [];
      const t = angle(o.neck, o.head), up = Math.cos(((t + 90) * Math.PI) / 180) > 0 ? t + 90 : t - 90, mid = at(o.head, up, L.head + 2);
      const a = at(mid, t, -9), c = at(mid, t, 9);
      return [[a[0], a[1], c[0], c[1], 2]];
    }
    case 'band':
      if (anchor) return [[w[0], w[1], anchor[0], anchor[1], 0]];
      return n === 0 && front ? [[o.wr0[0], o.wr0[1], o.wr1[0], o.wr1[1], 0]] : [];
  }
  return [];
}

// Fixed things, placed from the start pose: bench, box, wall, bar, treadmill, sloped ground. `d` is the path, `ext`
// its extent; a wall's path is drawn up to the top of the frame by the figure, so it only carries its x.
export type SceneItem = { k: string; kind: 'kit' | 'post' | 'belt' | 'dots' | 'slope' | 'bar' | 'wall'; d: string; ext: [number, number, number, number] };
export function scenery(pose: Pose, b: Pts): SceneItem[] {
  const out: SceneItem[] = [];
  const x = b.pelvis[0];
  const rot = (q: [number, number]): [number, number] => {
    if (!pose.incline) return q;
    const a = (-pose.incline * Math.PI) / 180, dx = q[0] - x, dy = q[1];
    return [x + dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const ext = (pts: [number, number][], r: number): [number, number, number, number] =>
    [Math.min(...pts.map((q) => q[0])) - r, Math.min(...pts.map((q) => q[1])) - r, Math.max(...pts.map((q) => q[0])) + r, Math.max(...pts.map((q) => q[1])) + r];
  const line = (k: string, kind: SceneItem['kind'], a: [number, number], c: [number, number], r = 0.8) =>
    out.push({ k, kind, d: `M${n2(a)}L${n2(c)}`, ext: ext([a, c], r) });
  const capsule = (k: string, kind: SceneItem['kind'], a: [number, number], c: [number, number], r: number) =>
    out.push({ k, kind, d: cap(a, c, r, r), ext: ext([a, c], r) });
  const rect = (k: string, x0: number, y0: number, w: number, h: number, r: number) => { // rounded, rotated with the incline
    const P = (px: number, py: number) => n2(rot([px, py]));
    const pts: [number, number][] = [rot([x0, y0]), rot([x0 + w, y0]), rot([x0 + w, y0 + h]), rot([x0, y0 + h])];
    out.push({
      k, kind: 'kit', ext: ext(pts, 0.4),
      d: `M${P(x0 + r, y0)}L${P(x0 + w - r, y0)}A${r},${r} 0 0 1 ${P(x0 + w, y0 + r)}L${P(x0 + w, y0 + h - r)}A${r},${r} 0 0 1 ${P(x0 + w - r, y0 + h)}`
        + `L${P(x0 + r, y0 + h)}A${r},${r} 0 0 1 ${P(x0, y0 + h - r)}L${P(x0, y0 + r)}A${r},${r} 0 0 1 ${P(x0 + r, y0)}Z`,
    });
  };
  if (pose.machine === 'treadmill') {
    // deck and belt (tilted for incline walks), front upright and the handrail the hands sit near
    rect('deck', x - 36, 0.6, 72, 4, 2);
    out.push({ k: 'belt', kind: 'belt', d: `M${n2(rot([x - 34, 0.6]))}L${n2(rot([x + 34, 0.6]))}`, ext: ext([rot([x - 34, 0.6]), rot([x + 34, 0.6])], 0.5) });
    out.push({ k: 'rollers', kind: 'dots', d: circ(rot([x - 34, 2.6]), 2) + circ(rot([x + 34, 2.6]), 2), ext: ext([rot([x - 34, 2.6]), rot([x + 34, 2.6])], 2) });
    line('upright', 'post', rot([x + 34, 0]), rot([x + 38, -58]));
    line('rail', 'post', rot([x + 38, -58]), rot([x + 22, -56]));
    rect('console', x + 32, -66, 12, 8, 2);
  } else if (pose.incline) {
    line('slope', 'slope', rot([x - 60, 0.4]), rot([x + 60, 0.4]), 0.6);
  }
  if (pose.ground === 'bench') {
    const P = b.pelvis, y = P[1] + (R.pelvis ?? 7) + 2.6, t = pose.start.spine, hw = pose.sit ? 22 : pose.view === 'front' ? 15 : 12;
    if (pose.machine !== 'bike') line('leg', 'post', [P[0], y], [P[0], 0]);
    capsule('seat', 'kit', [P[0] - hw, y], [P[0] + hw, y], 2.6);
    // a back pad (or a chest pad when leaning forward onto it) along the torso, unless the pose sits free
    if (pose.view === 'side' && Math.abs(t) >= 25 && pose.pad !== false) {
      const down = (d: number) => -Math.cos((d * Math.PI) / 180);
      const nrm = Math.abs(down(t + 90)) < 0.3 ? t - 90 : down(t + 90) > down(t - 90) ? t + 90 : t - 90;
      const e = at(at(P, t, L.torso - 2), nrm, 10);
      if (e[1] < -3 && pose.machine !== 'bike') line('leg2', 'post', e, [e[0], 0]);
      capsule('pad', 'kit', at(P, nrm, 10), e, 2.6);
    }
  }
  if (pose.land && pose.lift) { // the box the jump lands on, under the feet at the end
    const e = solve(pose, b, 1), x0 = Math.min(e.heel0[0], e.heel1[0]) - 5, x1 = Math.max(e.toe0[0], e.toe1[0]) + 5;
    rect('box', x0, -pose.lift, x1 - x0, pose.lift, 2);
  }
  if (pose.under?.fixed) { // a foam roller seen end-on: it stays put while the body rolls over it
    const u = pose.under, cx = (underX(u, solve(pose, b, 0)) + underX(u, solve(pose, b, 1))) / 2;
    out.push({ k: 'roller', kind: 'kit', d: circ([cx, -u.r], u.r), ext: [cx - u.r, -2 * u.r, cx + u.r, 0] });
  }
  if (pose.machine === 'bike') { // frame: seat tube to the crank, chainring, a foot on the floor, and the grips by the hands
    const [c, r] = crankOf(b), P = b.pelvis, sy = P[1] + (R.pelvis ?? 7) + 2.6, w = b.wr0;
    const ground = Math.max(...KEYS.map((k) => solve(pose, b, 0.25)[k][1]), c[1] + r + 4, 0);
    out.push({ k: 'ring', kind: 'kit', d: circ(c, r * 0.45), ext: [c[0] - r * 0.45, c[1] - r * 0.45, c[0] + r * 0.45, c[1] + r * 0.45] });
    line('seattube', 'post', [P[0], sy], c);
    line('stand', 'post', [c[0], c[1]], [c[0], ground]);
    line('base', 'post', [Math.min(P[0], c[0]) - 12, ground], [Math.max(P[0], c[0]) + 12, ground]);
    if (pose.start.spine >= 0) { // upright: a forward bar on a short stem up from the frame
      const s0: [number, number] = [w[0] - 6, w[1] + 12];
      line('downtube', 'post', c, s0);
      line('stem', 'post', s0, [w[0] - 2, w[1] + 1]);
      capsule('grip', 'kit', [w[0] - 3, w[1] + 1], [w[0] + 3, w[1] + 1], 1.8);
    } else { // recumbent: short handles beside the hips
      line('handle', 'post', [w[0], w[1] + 2], [w[0], sy]);
      capsule('grip', 'kit', [w[0] - 3, w[1] + 1], [w[0] + 3, w[1] + 1], 1.8);
    }
  }
  if (pose.box) {
    const p = b[pose.box], y = p[1] + (R[pose.box] ?? 3);
    if (y < -1) rect('box', p[0] - 11, y, 22, -y, 2);
  }
  if (pose.wall) {
    const wx = pose.wall === 'front' ? b.wr0[0] + 3.6 : Math.min(b.pelvis[0], b.neck[0]) - 9.5;
    out.push({ k: 'wall', kind: 'wall', d: '', ext: [wx - 0.8, 0, wx + 0.8, 0] });
  }
  if (pose.prop === 'bar') {
    const w = b.wr0;
    if (pose.view === 'front') line('bar', 'bar', [b.wr0[0] - 14, w[1]], [b.wr1[0] + 14, w[1]], 1.1);
    else if (w[1] > b.sh0[1]) line('bar', 'bar', [w[0] - 15, w[1] + 2.6], [w[0] + 15, w[1] + 2.6], 1.1); // parallel bars run along the view
    else { // a pull-up bar seen end-on, on a short bracket so it shows past the hand
      line('bracket', 'post', [w[0] - 3, w[1]], [w[0] - 17, w[1]]);
      out.push({ k: 'bar', kind: 'dots', d: circ(w, 2.8), ext: [w[0] - 2.8, w[1] - 2.8, w[0] + 2.8, w[1] + 2.8] });
    }
  }
  return out;
}

// Form guide: the joints whose angle changes (dotted), the main one (ringed), and the angle label at the key position.
const GUIDE_JOINTS: [keyof Angles, string][] = [['hip', 'hp'], ['knee', 'kn'], ['ankle', 'an'], ['shoulder', 'sh'], ['elbow', 'el']];
export const NB: Record<string, [Key, Key]> = { kn0: ['hp0', 'an0'], hp0: ['kn0', 'neck'], el0: ['sh0', 'wr0'], sh0: ['hp0', 'el0'], an0: ['kn0', 'toe0'] };
export function guideOf(pose: Pose, b: Pts) {
  const front = pose.view === 'front';
  const keys: { k: Key; d: number }[] = [];
  for (const [j, key] of GUIDE_JOINTS)
    for (const s of front ? [0, 1] : [0]) {
      const d = Math.abs((pose.end[j] as Pair)[s] - (pose.start[j] as Pair)[s]);
      if (d > 8) keys.push({ k: `${key}${s}` as Key, d });
    }
  const main = (pose.guide?.joint ?? [...keys].filter((x) => x.k.endsWith('0')).sort((x, y) => y.d - x.d)[0]?.k) as Key | undefined;
  const ks = keys.map((x) => x.k);
  if (main && !ks.includes(main)) ks.push(main);
  const j = (pose.guide?.joint ?? (main && main in NB ? main : 'hp0')) as Key;
  const key = pose.guide?.at ?? 1;
  const o = solve(pose, b, key);
  const [na, nb] = NB[j];
  const a1 = angle(o[j], o[na]), a2 = angle(o[j], o[nb]);
  const d = ((a2 - a1 + 540) % 360) - 180;
  return { keys: ks, main, label: { j, key, pos: at(o[j], a1 + d / 2, 18), deg: Math.round(Math.abs(d)) } };
}

// Body extent of one frame: every limb capsule, the bowed torso, head and hands.
export function bodyBox(o: Pts, front: boolean, bx: number[] = [1e9, 1e9, -1e9, -1e9]) {
  const grow = (q: [number, number], r: number) => { bx[0] = Math.min(bx[0], q[0] - r); bx[1] = Math.min(bx[1], q[1] - r); bx[2] = Math.max(bx[2], q[0] + r); bx[3] = Math.max(bx[3], q[1] + r); };
  for (const s of [...leg(0), ...leg(1), ...arm(0), ...arm(1), torso(front), NECK]) {
    grow(o[s.a], s.ra); grow(o[s.b], s.rb);
    if (s.curved) grow([0.25 * o[s.a][0] + 0.5 * o.ctl[0] + 0.25 * o[s.b][0], 0.25 * o[s.a][1] + 0.5 * o.ctl[1] + 0.25 * o[s.b][1]], (s.ra + s.rb) / 2);
  }
  grow(o.head, L.head); grow(o.wr0, 3); grow(o.wr1, 3);
  return bx;
}
export function primBox(q: Prim, bx: number[]) {
  const r = q.length === 3 ? q[2] : q[4];
  const xs = q.length === 3 ? [q[0]] : [q[0], q[2]], ys = q.length === 3 ? [q[1]] : [q[1], q[3]];
  bx[0] = Math.min(bx[0], ...xs.map((v) => v - r)); bx[1] = Math.min(bx[1], ...ys.map((v) => v - r));
  bx[2] = Math.max(bx[2], ...xs.map((v) => v + r)); bx[3] = Math.max(bx[3], ...ys.map((v) => v + r));
  return bx;
}

// The frame (SVG viewBox), normalised the same way for every pose: it is centred on what is solid, the body plus the
// amber equipment over the whole rep (every frame, so it never moves during the rep), so the figure sits in the middle
// of the pane and a move that travels (box jumps) starts left of centre and ends right of it. The angle label always
// fits (the frame grows evenly round that centre to take it in); a cable or band may run out past the edge toward its
// machine. The figure draws it with its origin at 0,0 (figure.tsx: react-native-svg misplaces a non-zero origin on phones).
export function viewBox(pose: Pose, b: Pts): [number, number, number, number] {
  const front = pose.view === 'front';
  const C = [1e9, 1e9, -1e9, -1e9], S = [1e9, -1e9]; // S: the floor shadow's x extent over the rep
  const X = [1e9, 1e9, -1e9, -1e9], ab = pose.guide?.axis ?? (['pelvis', 'neck'] as [Key, Key]); // X: the blue form-guide line
  for (let i = 0; i <= 24; i++) {
    const p = i / 24, o = solve(pose, b, p);
    bodyBox(o, front, C);
    const t = angle(o[ab[0]], o[ab[1]]); // drawn 12 past both points, like the figure's Axis
    for (const q of [at(o[ab[0]], t, -12), at(o[ab[1]], t, 12)]) primBox([q[0], q[1], 0], X);
    if (pose.prop !== 'band') for (const n of [0, 1] as const) for (const q of gearPrims(pose, o, n, p, null)) primBox(q, C);
    if (pose.machine === 'sled') { const [s0, s1] = sledAt(o); primBox([s0[0], s0[1], s1[0], s1[1], 1.6], C); }
    if (pose.under && !pose.under.fixed) primBox([underX(pose.under, o), -pose.under.r, pose.under.r], C);
    if (pose.machine === 'bike') for (const q of crankPrims(o)) primBox(q, C);
    if (pose.ground !== 'hang' && pose.ground !== 'mat') { const [sx, rx] = shadowOf(o); S[0] = Math.min(S[0], sx - rx); S[1] = Math.max(S[1], sx + rx); }
  }
  for (const it of scenery(pose, b)) {
    if (it.kind !== 'slope') { C[0] = Math.min(C[0], it.ext[0]); C[2] = Math.max(C[2], it.ext[2]); } // sloped ground runs wide on purpose,
    C[1] = Math.min(C[1], it.ext[1]); C[3] = Math.max(C[3], it.ext[3]); // but its low end must not touch the bottom edge
  }
  if (pose.ground !== 'hang' && pose.ground !== 'mat') C[3] = Math.max(C[3], 3.5); // the floor line and the shadow under the feet
  const cx = (C[0] + C[2]) / 2, cy = (C[1] + C[3]) / 2;
  let hw = (C[2] - C[0]) / 2, hh = (C[3] - C[1]) / 2;
  const lab = guideOf(pose, b).label.pos;
  hw = Math.max(hw, Math.abs(lab[0] - cx) + 7);
  hh = Math.max(hh, Math.abs(lab[1] - cy) + 6);
  const pad = 8; // the axis line may run into the padding, but stays 4 units clear of the edge
  hw = Math.max(hw, cx - X[0] + 4 - pad, X[2] - cx + 4 - pad);
  hh = Math.max(hh, cy - X[1] + 4 - pad, X[3] - cy + 4 - pad);
  if (S[0] < S[1]) hw = Math.max(hw, cx - S[0] - 7.5, S[1] - cx - 7.5); // the soft shadow may run into the padding, not past the edge
  const w = Math.max(2 * (hw + pad), 80), h = Math.max(2 * (hh + pad), 80);
  return [cx - w / 2, cy - h / 2, w, h].map((v) => Math.round(v * 10) / 10) as [number, number, number, number];
}

// Every pose has all its angles, in sane ranges; locked poses can reach their pinned hands or feet all the way through.
export function selfCheck(byId: Record<string, Ex & { noImages?: boolean }> = {}) {
  for (const e of Object.values(byId)) if (!e.noImages && !poseFor(e).pose?.start) throw new Error('poses: no pattern for ' + e.id);
  const RANGE: Record<string, [number, number]> = {
    spine: [-180, 180], neck: [-45, 45], curve: [-30, 30], shrug: [0, 8],
    // joint limits (side-view projections; kneeling feet lie flat behind, so the ankle goes to 90)
    hip: [-40, 150], knee: [0, 150], ankle: [-45, 90], shoulder: [-75, 190], elbow: [0, 155],
  };
  // seen from the front an arm may reach across the chest, and the forearm may fold across the body
  const FRONT_RANGE: Record<string, [number, number]> = { shoulder: [-95, 190], elbow: [-155, 155] };
  const bad: string[] = [];
  for (const [id, pose] of Object.entries(POSES)) {
    for (const a of [pose.start, pose.end])
      for (const [k, r] of Object.entries(RANGE)) {
        const [lo, hi] = (pose.view === 'front' && FRONT_RANGE[k]) || r;
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
      const jump = Math.abs(p - last), wrap = pose.pace === 'spin' ? Math.min(jump, 1 - jump) : jump;
      if (p < 0 || p > 1 || g < 0.29 || g > 1 || wrap > 0.05) { bad.push(`${id}: tempo jumps at ${i / 400}`); break; }
      last = p;
    }
  }
  const own = new Set<Pose>(Object.values(POSES));
  // posture: no shown figure (weak ones are hidden behind the photo) may sit, stand, kneel, hang or lie against what
  // the exercise's name and opening instructions ask for
  for (const e of Object.values(byId)) {
    if (e.noImages || poseFor(e).pose.weak) continue;
    const m = postureMismatch(e);
    if (m) bad.push('posture ' + m);
    // a pose re-seated or put on its knees for this exercise (adapt) is not in POSES: same joint limits and floor rule
    const { pose } = poseFor(e);
    if (own.has(pose) || pose.ground === 'hang' || pose.ground === 'mat') continue;
    own.add(pose);
    for (const a of [pose.start, pose.end])
      for (const k of ['hip', 'knee', 'ankle'] as const) if (a[k].some((x) => x < RANGE[k][0] || x > RANGE[k][1])) bad.push(`${e.id}.${k}=${JSON.stringify(a[k])}`);
    const b = base(pose);
    for (let i = 0; i <= 10; i++) {
      const o = solve(pose, b, i / 10), sink = Math.max(...KEYS.map((k) => o[k][1] + (R[k] ?? 0)));
      if (sink > 2.5) { bad.push(`${e.id}: sinks ${sink.toFixed(1)} into the floor at ${i / 10}`); break; }
    }
  }
  if (bad.length) throw new Error('poses: ' + bad.join('; '));
  return Object.keys(POSES).length;
}

// ---- posture audit ----
// What the body is doing at one end of the rep, read off the solved joints: this is what the owner sees. The audit
// (selfCheck) compares it with the posture the exercise's own name and first instructions ask for, so a seated move can
// never again borrow a standing figure (or the reverse).
export type Posture = 'stand' | 'bent' | 'seat' | 'recline' | 'lean' | 'kneel' | 'allfours' | 'plank' | 'supine' | 'prone' | 'side' | 'hang' | 'inverted';
export function postureOf(pose: Pose, p: 0 | 1): Posture {
  const o = solve(pose, base(pose), p), a = p ? pose.end : pose.start, s = a.spine;
  if (pose.ground === 'hang') return 'hang';
  const up = (k: Key) => -(o[k][1] + (R[k] ?? 0)); // clearance above the floor
  if (pose.view === 'front') {
    if (Math.abs(s) >= 60) return pose.ground === 'mat' ? 'supine' : 'side';
    return pose.ground === 'bench' || pose.sit || up('pelvis') < (pose.ground === 'floor' ? 25 : 12) ? 'seat' : 'stand';
  }
  if (Math.abs(s) > 150) return 'inverted';
  if (pose.ground === 'bench') return s <= -60 ? 'supine' : s >= 60 ? 'prone' : s <= -25 ? 'recline' : s >= 35 ? 'lean' : 'seat';
  if (s <= -60) return 'supine';
  const flatShin = (n: 0 | 1) => up(`kn${n}`) < 4 && Math.abs(o[`kn${n}`][1] - o[`an${n}`][1]) < 7;
  const kneeDown = flatShin(0) || flatShin(1) || pose.fix === 'kn0' || pose.fix === 'kn1';
  const held = HELD.includes(pose.prop ?? 'none') && !pose.lock; // a bar hanging near the floor is not a hand on the floor
  const handDown = (!held && Math.min(up('wr0'), up('wr1'), up('el0'), up('el1')) < 12) || pose.pin === 'hands' || pose.fix === 'wr0' || pose.fix === 'el0';
  if (s >= 55) {
    if (pose.box === 'kn0' || (up('pelvis') < 8 && up('neck') < 14)) return 'prone'; // flat on the floor, or face down over a pad
    if (kneeDown) return handDown ? 'allfours' : 'kneel';
    if (handDown && !pose.wall) return a.knee[0] > 60 && a.knee[1] > 60 ? 'allfours' : 'plank';
    return 'bent';
  }
  if (up('pelvis') < 12 || (s <= -25 && handDown && pose.ground === 'floor') || (pose.ground === 'floor' && !kneeDown && up('pelvis') < 24 && a.hip[0] - s >= 50)) return 'seat';
  if (kneeDown) return 'kneel';
  return s >= 40 ? 'bent' : 'stand';
}

// The posture an exercise asks for: its name first (explicit words), then the opening instructions.
const WANT_NAME: [RegExp, Posture, RegExp?][] = [
  [/hanging|pull-?ups?\b|chin-?ups?\b|\bchins\b|muscle.?up|dead hang|rope climb|parallel bar|^dips? |\bdips? - |ring dips|one handed hang|gorilla chin/, 'hang', /bench dip|pulldown|band|machine|deadlift|shrug|clean|snatch|good morning|stretch|press/],
  [/handstand/, 'inverted'],
  [/inverted row/, 'supine'],
  [/push-?ups?\b|plank|mountain climber|bear crawl|renegade|inchworm|^drop push/, 'plank', /wall|handstand|side|pike|knee|sled/],
  [/side bridge|side plank|side.lying|clamshell/, 'side', /push/],
  [/kneeling|on knees|\bknee push/, 'kneel'],
  [/chair squat|box squat|sit squats/, 'stand'],
  [/prone incline|incline.*(row|pull)|chest.supported|spider curl|lying t-bar/, 'lean'],
  [/leverage (incline|decline) chest/, 'seat'],
  [/incline/, 'recline', /treadmill|walk|push|hill|reverse|rear|face.?down|lateral|depth/],
  [/decline/, 'supine', /push/],
  [/seated|sitting|\bchair\b|preacher|pec deck|leg extension|recumbent|bicycling|\bbike\b|butterfly|concentration|russian twist|plate twist|lat pull-?down|\w+ pull-?downs?$|machine (shoulder|military|bench|chest|bicep|triceps|lateral|row)|leverage (\w+ )?(chest|shoulder|incline|decline|high|iso)|dip machine|calf press|rowing, stationary|reverse machine fl/, 'seat', /air bike|straight|kneel|band|smith|shrug|box jump|chair dip/],
  [/lying.*face.?down|face.?down|prone|superman|lying leg curl|lying cambered|hyperextension|back extension/, 'prone', /reverse hyper|incline/],
  [/lying|supine|floor press|skull|crunch|sit-?up|glute bridge|hip thrust|bench press|dead bug|flutter|pullover|ball leg curl|hamstring curl|walkout/, 'supine', /standing|cable crunch|rope crunch|kneel|hanging|seated|machine|side|rear|lateral|leverage|vertical|captain|suspended|bosu|\brow|ab crunch/],
  [/bent.over|romanian|stiff.leg|good morning|deadlift|kickback/, 'bent', /seated|lying|kneel|glute kickback|leg kickback|one-legged|bench|donkey/],
  [/standing|squat|lunge|\bwalk|running|jog|sprint|jump|shrug|clean|snatch|jerk|step.?up|calf raise|farmer|carry|swing|\bhops?\b|svend|front leg raise/, 'stand', /seated|lying|machine|leg press|smith|wind sprints|plank|sled/],
];
const WANT_STEP: [RegExp, Posture][] = [
  [/\b(sit|seated|sitting|seat yourself|take a seat)\b/, 'seat'],
  [/\bhang(ing)? from\b/, 'hang'],
  [/face ?down|on your stomach|\bprone\b|lie on your (stomach|chest|front)|chest (and stomach )?(down|pressing)/, 'prone'],
  [/lie (down )?(on (the|a|an) (floor|mat|bench|ground|exercise mat|flat bench)|flat|on your back|back|face up|supine)|lying (down )?on your back|lay (down )?(flat|on your back|on (the|a) (floor|bench))|on your back|lie down|lay down|\blie\b(?! (down )?(face ?down|on your (stomach|chest|front|side|left|right)))/, 'supine'],
  [/push-?up position|plank position/, 'plank'],
  [/all fours|hands and knees/, 'allfours'],
  [/\bkneel/, 'kneel'],
  [/on your (left |right )?side\b/, 'side'],
  [/\b(stand|standing)\b(?! up on)/, 'stand'],
];
// Read wrongly by the rules above (or named misleadingly): what the instructions really say.
const WANT_ID: Record<string, Posture | null> = {
  Downward_Facing_Balance: 'plank', 'Exercise_Ball_Pull-In': null, // over a ball, hands on the floor
  Lying_High_Bench_Barbell_Curl: 'prone', Straight_Raises_on_Incline_Bench: 'lean', // face down on the bench
  Wind_Sprints: 'hang', // hanging knee sprints, despite the name
  Spider_Crawl: 'allfours', Glute_Ham_Raise: 'kneel', 'Quadriceps-SMR': 'plank', // face down, but on the knee pad / on the forearms
  Shoulder_Circles: 'stand', // "or in your lap if you're seated"
  Low_Cable_Triceps_Extension: 'supine', // lies on the bench of the seated row machine
  'Lower_Back-SMR': 'supine', London_Bridges: 'supine', Barbell_Ab_Rollout: 'bent', Middle_Back_Shrug: 'lean', Standing_Concentration_Curl: 'bent', 'Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench': 'stand', 'wg_crab-walk': 'seat', 'wg_squat-thrust': 'allfours', Weighted_Ball_Hyperextension: 'prone',
  Hamstring_Stretch: 'supine', Chain_Handle_Extension: 'supine', 'One-Arm_Incline_Lateral_Raise': 'side', 'Lying_One-Arm_Lateral_Raise': 'prone', 'Anti-Gravity_Press': 'lean', Reverse_Flyes: 'lean', Reverse_Flyes_With_External_Rotation: 'lean',
};
export function wantPosture(e: Ex): Posture | null {
  if (e.id in WANT_ID) return WANT_ID[e.id];
  const n = e.name.toLowerCase();
  for (const [re, p, not] of WANT_NAME) if (re.test(n) && !(not && not.test(n))) return p;
  const s = (e.steps ?? []).slice(0, 2).join(' ').toLowerCase();
  let best: Posture | null = null, at = 1e9;
  for (const [re, p] of WANT_STEP) { const m = re.exec(s); if (m && m.index < at) { at = m.index; best = p; } }
  return best;
}
// Which shown postures honestly stand for a wanted one (an incline bench is "seated, reclined"; a hinge is standing).
export const POSTURE_OK: Record<Posture, Posture[]> = {
  stand: ['stand', 'bent'], bent: ['bent', 'lean', 'stand'], seat: ['seat', 'recline', 'lean'], recline: ['recline', 'supine'], lean: ['lean', 'prone'],
  kneel: ['kneel', 'allfours'], allfours: ['allfours', 'kneel', 'plank'], plank: ['plank', 'allfours', 'side'], supine: ['supine', 'recline'],
  prone: ['prone', 'lean'], side: ['side', 'supine'], hang: ['hang'], inverted: ['inverted'],
};
export function postureMismatch(e: Ex): string | null {
  const w = wantPosture(e);
  if (!w) return null;
  const { pose } = poseFor(e), a = postureOf(pose, 0), b = postureOf(pose, 1);
  return POSTURE_OK[w].includes(a) || POSTURE_OK[w].includes(b) ? null : `${e.id}: wants ${w}, shows ${a}>${b}`;
}
