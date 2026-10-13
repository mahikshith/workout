import { useEffect, useId, useMemo, type ReactNode } from 'react';
import Animated, {
  useAnimatedProps, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { RED, SOFT } from './body';
import {
  angle, arm, at, base, cap, circ, cycleSeconds, FRONT_M, L, leg, n2, NECK, phase, R, SIDE_M, solve, spindle, torso,
  type Angles, type Key, type MuscleSpec, type Pose, type Pts, type Seg,
} from './data/poses';
import { c, f } from './theme';

// A code-drawn figure: every joint angle is interpolated on the UI thread, so the movement between the two
// key poses is continuous. Limbs are tapered capsules (light outline, soft vertical shading, far side darker),
// working muscles are red spindles whose glow follows the effort of the rep, and the form guide (alignment line,
// joint angle) fades in at the key position.

const APath = Animated.createAnimatedComponent(Path);
const AG = Animated.createAnimatedComponent(G);
type P2 = [number, number];
type Frame = { o: Pts; g: number; p: number; breath: number; shadow: [number, number, number] };
type FV = { readonly value: Frame };
// Joints whose angle changes are dotted; the arc shows the angle between these two neighbours.
const JOINTS: [keyof Angles, string][] = [['hip', 'hp'], ['knee', 'kn'], ['ankle', 'an'], ['shoulder', 'sh'], ['elbow', 'el']];
const NB: Record<string, [Key, Key]> = { kn0: ['hp0', 'an0'], hp0: ['kn0', 'neck'], el0: ['sh0', 'wr0'], sh0: ['hp0', 'el0'], an0: ['kn0', 'toe0'] };

const BODY = { near: ['url(#__N)', '#9A9AA2'], far: ['url(#__F)', '#5A5A62'] } as const;
const GEAR = { fill: '#36363D', stroke: '#8E8E93' };
const BAND = '#64D2FF';
const AXIS = '#64D2FF'; // alignment lines are blue, so they never read as the (accent) angle

export function Figure({ pose, primary, secondary, height, width, paused }: {
  pose: Pose; primary: string[]; secondary: string[]; height: number; width?: number; paused?: boolean;
}) {
  const still = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const front = pose.view === 'front';
  const acc = c.accent;

  const b = useMemo(() => base(pose), [pose]);
  // The clock: about 30 updates a second (smooth for a slow rep, half the drawing work of 60) and none at all
  // while paused (scrolled out of view) or with reduced motion.
  const t = useSharedValue(0);
  const dur = useSharedValue(cycleSeconds(pose) * 1000);
  const last = useSharedValue(-1e9);
  useEffect(() => {
    dur.value = cycleSeconds(pose) * 1000;
    t.value = still ? (pose.pace === 'cycle' ? 0.25 : pose.pace === 'hold' ? 0.44 : 0.38) : 0; // held at the top
  }, [pose, still]);
  const clock = useFrameCallback((fi) => {
    'worklet';
    if (fi.timeSinceFirstFrame - last.value < 32) return;
    last.value = fi.timeSinceFirstFrame;
    t.value = (fi.timeSinceFirstFrame % dur.value) / dur.value;
  }, false);
  useEffect(() => { clock.setActive(!still && !paused); return () => clock.setActive(false); }, [still, paused]);

  const fr = useDerivedValue<Frame>(() => {
    const tt = t.value;
    const [p, g] = phase(pose, tt);
    const lag = phase(pose, (tt + 0.96) % 1)[0];
    const breath = pose.pace === 'cycle' ? 0 : Math.sin(2 * Math.PI * tt * (pose.pace === 'hold' ? 2 : 1));
    const nod = Math.max(-6, Math.min(6, (lag - p) * (pose.end.spine - pose.start.spine))); // the head trails the torso
    const o = solve(pose, b, p, breath, nod);
    // soft shadow under whatever is nearest the floor; it shrinks and fades as the body leaves the ground
    let low = -1e9;
    for (const k in o) { const r = R[k as Key]; if (r !== undefined) low = Math.max(low, o[k as Key][1] + r); }
    let sw = 0, sx = 0, x0 = 1e9, x1 = -1e9;
    for (const k in o) {
      const r = R[k as Key];
      if (r === undefined) continue;
      const w = Math.max(0, 1 - (low - o[k as Key][1] - r) / 10);
      if (w > 0) { sw += w; sx += w * o[k as Key][0]; x0 = Math.min(x0, o[k as Key][0]); x1 = Math.max(x1, o[k as Key][0]); }
    }
    const up = Math.max(0, -low);
    return { o, g, p, breath, shadow: [sx / sw, ((x1 - x0) / 2 + 10) * (1 - Math.min(0.5, up / 50)), 0.6 * Math.max(0.25, 1 - up / 25)] };
  });

  const box = useMemo(() => viewBox(pose, b), [pose, b]);
  const muscles = useMemo(() => {
    const out: { seg: string; m: MuscleSpec; kind: 1 | 2 }[] = [];
    const add = (name: string, kind: 1 | 2) => {
      for (const m of (front && FRONT_M[name]) || SIDE_M[name] || []) out.push({ seg: m[0], m: front && !FRONT_M[name] && m[0] === 'torso' ? [m[0], m[1], m[2], 0, m[4] * 1.3] : m, kind });
    };
    secondary.filter((x) => !primary.includes(x)).forEach((x) => add(x, 1));
    primary.forEach((x) => add(x, 2));
    return out;
  }, [primary, secondary, front]);

  const moving = useMemo(() => {
    const keys: { k: Key; d: number }[] = [];
    for (const [j, key] of JOINTS)
      for (const s of front ? [0, 1] : [0]) {
        const d = Math.abs((pose.end[j] as [number, number])[s] - (pose.start[j] as [number, number])[s]);
        if (d > 8) keys.push({ k: `${key}${s}` as Key, d });
      }
    const main = pose.guide?.joint ?? [...keys].filter((x) => x.k.endsWith('0')).sort((x, y) => y.d - x.d)[0]?.k;
    const ks = keys.map((x) => x.k);
    if (main && !ks.includes(main)) ks.push(main);
    return { keys: ks, main };
  }, [pose, front]);

  // The angle of the main working joint (the pose's guide joint, else the joint that moves most, else the hip for
  // holds) is labelled once, at the key position.
  const label = useMemo(() => {
    const j = (pose.guide?.joint ?? (moving.main && moving.main in NB ? moving.main : 'hp0')) as Key;
    const key = pose.guide?.at ?? 1;
    const o = solve(pose, b, key);
    const [na, nb] = NB[j];
    const a1 = angle(o[j], o[na]), a2 = angle(o[j], o[nb]);
    const d = ((a2 - a1 + 540) % 360) - 180;
    return { j, key, pos: at(o[j], a1 + d / 2, 18), deg: Math.round(Math.abs(d)) };
  }, [pose, b, moving.main]);

  // Body layers, back to front. Each limb stays its own path (so outlines overlap correctly), but every muscle of a
  // layer shares one path per kind, which keeps the number of animated paths low.
  const layers = useMemo(() => {
    const L = (segs: Seg[], far: boolean) => ({ segs, far, ms: muscles.filter((m) => segs.some((s) => s.part === m.seg)) });
    return front
      ? { back: L([...leg(0), ...leg(1), torso(true), NECK], false), arms: L([...arm(0), ...arm(1)], false), far: null }
      : { far: L([...leg(1), ...arm(1)], true), back: L([torso(false), ...leg(0), NECK], false), arms: L(arm(0), false) };
  }, [front, muscles]);

  const tone = (s: 0 | 1) => (front || s === 0 ? BODY.near : BODY.far);
  const segs = (list: Seg[]) => list.map((s) => <SegPath key={s.id} fr={fr} s={s} fill={tone(s.side)[0].replace('__', uid)} stroke={tone(s.side)[1]} />);
  const layer = (l: { segs: Seg[]; far: boolean; ms: typeof muscles } | null) => l && (
    <>
      {segs(l.segs)}
      {l.ms.length > 0 && <Muscles fr={fr} segs={l.segs} ms={l.ms} dim={l.far ? 0.55 : 1} front={front} />}
    </>
  );
  const hand = (n: 0 | 1) => <Dot key={'hand' + n} fr={fr} k={`wr${n}` as Key} r={3} fill={tone(n)[0].replace('__', uid)} stroke={tone(n)[1]} />;
  const gear = (n: 0 | 1) => (n === 1 && pose.one ? null : <Gear key={'gear' + n} fr={fr} pose={pose} b={b} n={n} />);
  const flat = pose.ground !== 'hang' && pose.ground !== 'mat';
  const axis = pose.guide?.axis ?? (['pelvis', 'neck'] as [Key, Key]);

  return (
    <Svg width={width ?? '100%'} height={height} viewBox={box.join(' ')} preserveAspectRatio="xMidYMid meet">
      <Defs>
        <LinearGradient id={uid + 'N'} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#404047" />
          <Stop offset="1" stopColor="#2A2A30" />
        </LinearGradient>
        <LinearGradient id={uid + 'F'} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2B2B31" />
          <Stop offset="1" stopColor="#1F1F24" />
        </LinearGradient>
        <RadialGradient id={uid + 'S'} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#000" stopOpacity={1} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {flat && <Line x1={box[0] - 400} x2={box[0] + box[2] + 400} y1={0.4} y2={0.4} stroke={c.line} strokeWidth={0.9} />}
      <G>
        {flat && <Shadow fr={fr} fill={`url(#${uid}S)`} />}
        {flat && <Balance fr={fr} top={box[1]} />}
        <Scenery pose={pose} b={b} top={box[1]} />
        {front ? (
          <>
            {layer(layers.back)}
            <Dot fr={fr} k="head" r={L.head} fill={tone(0)[0].replace('__', uid)} stroke={tone(0)[1]} />
            <Axis fr={fr} ab={axis} color={AXIS} />
            {gear(0)}{gear(1)}
            {layer(layers.arms)}{hand(0)}{hand(1)}
          </>
        ) : (
          <>
            {layer(layers.far)}{hand(1)}
            {gear(1)}
            {layer(layers.back)}
            <Dot fr={fr} k="head" r={L.head} fill={tone(0)[0].replace('__', uid)} stroke={tone(0)[1]} />
            <Axis fr={fr} ab={axis} color={AXIS} />
            {gear(0)}
            {layer(layers.arms)}{hand(0)}
          </>
        )}
        <Joints fr={fr} keys={moving.keys} main={moving.main} color={acc} />
        <Arc fr={fr} j={label.j} at={label.key} color={acc}>
          <SvgText x={label.pos[0]} y={label.pos[1] + 2.4} fontSize={7} fontFamily={f.semi} fill={acc} textAnchor="middle">{`${label.deg}°`}</SvgText>
        </Arc>
      </G>
    </Svg>
  );
}

function SegPath({ fr, s, fill, stroke }: { fr: FV; s: Seg; fill: string; stroke: string }) {
  const ap = useAnimatedProps(() => {
    const { o, breath } = fr.value;
    return { d: cap(o[s.a], o[s.b], s.ra, s.rb + (s.part === 'torso' ? 0.35 * breath : 0), s.curved ? o.ctl : undefined) };
  });
  return <APath animatedProps={ap} fill={fill} stroke={stroke} strokeWidth={0.8} strokeOpacity={0.9} />;
}

// Every working muscle of one body layer: helpers in soft red, main muscles in red with a glow that follows the effort.
function Muscles({ fr, segs, ms, dim, front }: { fr: FV; segs: Seg[]; ms: { seg: string; m: MuscleSpec; kind: 1 | 2 }[]; dim: number; front: boolean }) {
  const pairs = ms.flatMap((m) => segs.filter((s) => s.part === m.seg).map((s) => ({ s, m: m.m, kind: m.kind })));
  const one = pairs.filter((x) => x.kind === 1), two = pairs.filter((x) => x.kind === 2);
  const width = two.length ? Math.max(...two.map((x) => x.m[4])) * 0.9 : 0;
  const soft = useAnimatedProps(() => {
    const { o, g } = fr.value;
    let d = '';
    for (const x of one) d += spindle(o, x.s, x.m, front);
    return { d, fillOpacity: dim * (0.3 + 0.25 * g) };
  });
  const glow = useAnimatedProps(() => {
    const { o, g } = fr.value;
    let d = '';
    for (const x of two) d += spindle(o, x.s, x.m, front);
    return { d, strokeOpacity: dim * 0.45 * g * g };
  });
  const main = useAnimatedProps(() => {
    const { o, g } = fr.value;
    let d = '';
    for (const x of two) d += spindle(o, x.s, x.m, front);
    return { d, fillOpacity: dim * (0.45 + 0.55 * g) };
  });
  return (
    <>
      {one.length > 0 && <APath animatedProps={soft} fill={SOFT} />}
      {two.length > 0 && <APath animatedProps={glow} fill="none" stroke={RED} strokeWidth={width} strokeLinejoin="round" />}
      {two.length > 0 && <APath animatedProps={main} fill={RED} />}
    </>
  );
}

function Dot({ fr, k, r, fill, stroke }: { fr: FV; k: Key; r: number; fill: string; stroke: string }) {
  const ap = useAnimatedProps(() => ({ d: circ(fr.value.o[k], r) }));
  return <APath animatedProps={ap} fill={fill} stroke={stroke} strokeWidth={0.8} strokeOpacity={0.9} />;
}

// Moving joints as small dots (one path) and a ring on the main one.
function Joints({ fr, keys, main, color }: { fr: FV; keys: Key[]; main?: Key; color: string }) {
  const dots = useAnimatedProps(() => {
    let d = '';
    for (const k of keys) d += circ(fr.value.o[k], k === main ? 1.6 : 1.2);
    return { d };
  });
  const ring = useAnimatedProps(() => ({ d: main ? circ(fr.value.o[main], 4.4) : '', strokeOpacity: 0.5 + 0.4 * fr.value.g }));
  return (
    <>
      {main && <APath animatedProps={ring} fill="none" stroke={color} strokeWidth={0.9} />}
      <APath animatedProps={dots} fill={color} fillOpacity={0.85} />
    </>
  );
}

// A faint dashed line through two points, running a little past both.
function Axis({ fr, ab, color }: { fr: FV; ab: [Key, Key]; color: string }) {
  const ap = useAnimatedProps(() => {
    const a = fr.value.o[ab[0]], b = fr.value.o[ab[1]], t = angle(a, b);
    return { d: `M${n2(at(a, t, -12))}L${n2(at(b, t, 12))}` };
  });
  return <APath animatedProps={ap} stroke={color} strokeOpacity={0.75} strokeWidth={0.9} strokeDasharray="2.5 2.5" strokeLinecap="round" />;
}

// The angle wedge at a joint; it (and its label) fades in as the rep reaches the key position.
function Arc({ fr, j, at: key, color, children }: { fr: FV; j: Key; at: number; color: string; children: ReactNode }) {
  const wrap = useAnimatedProps(() => {
    const u = Math.min(1, Math.max(0, (0.22 - Math.abs(fr.value.p - key)) / 0.16));
    return { opacity: u * u * (3 - 2 * u) };
  });
  const wedge = useAnimatedProps(() => {
    const o = fr.value.o, [na, nb] = NB[j];
    const a1 = angle(o[j], o[na]), a2 = angle(o[j], o[nb]);
    const d = ((a2 - a1 + 540) % 360) - 180;
    return { d: `M${n2(o[j])}L${n2(at(o[j], a1, 9))}A9,9 0 0 ${d > 0 ? 1 : 0} ${n2(at(o[j], a2, 9))}Z` };
  });
  return (
    <AG animatedProps={wrap}>
      <APath animatedProps={wedge} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={0.8} />
      {children}
    </AG>
  );
}

// Balance line: a vertical through the body's centre of mass (head, trunk and limbs weighted roughly by mass)
// with a dot at the centre itself. Over the feet means balanced; the floor line is the horizontal axis.
function Balance({ fr, top }: { fr: FV; top: number }) {
  const W: [Key, number][] = [['head', 0.08], ['neck', 0.2], ['pelvis', 0.32], ['kn0', 0.1], ['kn1', 0.1], ['el0', 0.05], ['el1', 0.05], ['an0', 0.05], ['an1', 0.05]];
  const line = useAnimatedProps(() => {
    const o = fr.value.o;
    let x = 0;
    for (const [k, w] of W) x += o[k][0] * w;
    return { d: `M${x.toFixed(1)},0L${x.toFixed(1)},${(top + 4).toFixed(1)}` };
  });
  const dot = useAnimatedProps(() => {
    const o = fr.value.o;
    let x = 0, y = 0;
    for (const [k, w] of W) { x += o[k][0] * w; y += o[k][1] * w; }
    return { d: circ([x, y], 1.6) };
  });
  return (
    <>
      <APath animatedProps={line} stroke="#8E8E93" strokeOpacity={0.35} strokeWidth={0.6} strokeDasharray="1.5 2.5" />
      <APath animatedProps={dot} fill="#8E8E93" fillOpacity={0.8} />
    </>
  );
}

function Shadow({ fr, fill }: { fr: FV; fill: string }) {
  const ap = useAnimatedProps(() => {
    const [x, rx, op] = fr.value.shadow;
    return { d: `M${n2([x - rx, 0.5])}a${rx},3.2 0 1 0 ${2 * rx},0a${rx},3.2 0 1 0 ${-2 * rx},0Z`, fillOpacity: op };
  });
  return <APath animatedProps={ap} fill={fill} />;
}

// Dumbbell, barbell or kettlebell in hand n, or the band/cable it pulls.
function Gear({ fr, pose, b, n }: { fr: FV; pose: Pose; b: Pts; n: 0 | 1 }) {
  const front = pose.view === 'front';
  const anchor = anchorOf(pose, b, n);
  const ap = useAnimatedProps(() => {
    const o = fr.value.o, w = o[`wr${n}` as Key];
    if (pose.prop === 'dumbbell') return { d: circ(w, 5) };
    if (pose.prop === 'kettlebell') return { d: circ(at(w, angle(o[`el${n}` as Key], w), 5.5), 5.5) };
    if (pose.prop === 'barbell') {
      if (!front) return { d: circ(w, 9) };
      if (n === 1) return { d: '' };
      const t = angle(o.wr1, o.wr0), e0 = at(o.wr0, t, 12), e1 = at(o.wr1, t, -12);
      return { d: cap(e0, e1, 1.1, 1.1) + cap(at(e0, t + 90, 7), at(e0, t - 90, 7), 2.6, 2.6) + cap(at(e1, t + 90, 7), at(e1, t - 90, 7), 2.6, 2.6) };
    }
    if (pose.prop === 'band') {
      if (anchor) return { d: `M${n2(w)}L${n2(anchor)}` };
      return { d: n === 0 && front ? `M${n2(o.wr0)}L${n2(o.wr1)}` : '' };
    }
    return { d: '' };
  });
  if (!pose.prop || pose.prop === 'none' || pose.prop === 'bar') return null;
  if (pose.prop === 'band') return <APath animatedProps={ap} fill="none" stroke={BAND} strokeOpacity={0.85} strokeWidth={1.1} strokeLinecap="round" />;
  return <APath animatedProps={ap} fill={GEAR.fill} stroke={GEAR.stroke} strokeWidth={0.8} />;
}

const anchorOf = (pose: Pose, b: Pts, n: 0 | 1): P2 | null => {
  if (!pose.line || (n === 1 && pose.view !== 'front')) return null;
  const w = b[`wr${n}` as Key];
  return [w[0] + (n === 1 ? -pose.line[0] : pose.line[0]), w[1] + pose.line[1]];
};

// Fixed things, placed from the start pose: bench, box, wall, bar, treadmill, sloped ground.
function Scenery({ pose, b, top }: { pose: Pose; b: Pts; top: number }) {
  const els: ReactNode[] = [];
  const kit = { fill: '#232328', stroke: '#3C3C43', strokeWidth: 0.8 };
  const x = b.pelvis[0], tilt = pose.incline ? `rotate(${-pose.incline} ${x} 0)` : undefined;
  if (pose.machine === 'treadmill') {
    // deck and belt (tilted for incline walks), front upright and the handrail the hands sit near
    els.push(
      <G key="tread" transform={tilt}>
        <Rect x={x - 36} y={0.6} width={72} height={4} rx={2} {...kit} />
        <Line x1={x - 34} x2={x + 34} y1={0.6} y2={0.6} stroke="#55555C" strokeWidth={1} />
        <Path d={circ([x - 34, 2.6], 2) + circ([x + 34, 2.6], 2)} fill="#3C3C43" />
        <Line x1={x + 34} x2={x + 38} y1={0} y2={-58} stroke="#3C3C43" strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={x + 38} x2={x + 22} y1={-58} y2={-56} stroke="#3C3C43" strokeWidth={2} strokeLinecap="round" />
        <Rect x={x + 32} y={-66} width={12} height={8} rx={2} {...kit} />
      </G>,
    );
  } else if (pose.incline) {
    els.push(<Line key="slope" transform={tilt} x1={x - 60} x2={x + 60} y1={0.4} y2={0.4} stroke="#55555C" strokeWidth={1.2} />);
  }
  if (pose.ground === 'bench') {
    const P = b.pelvis, y = P[1] + (R.pelvis ?? 7) + 2.6, t = pose.start.spine;
    els.push(<Line key="leg" x1={P[0]} x2={P[0]} y1={y} y2={0} stroke="#3C3C43" strokeWidth={2.4} />);
    els.push(<Path key="seat" d={cap([P[0] - (pose.view === 'front' ? 15 : 12), y], [P[0] + (pose.view === 'front' ? 15 : 12), y], 2.6, 2.6)} {...kit} />);
    if (pose.view === 'side' && Math.abs(t) >= 25) {
      const down = (d: number) => -Math.cos((d * Math.PI) / 180);
      const nrm = Math.abs(down(t + 90)) < 0.3 ? t - 90 : down(t + 90) > down(t - 90) ? t + 90 : t - 90;
      const e = at(at(P, t, L.torso - 2), nrm, 10);
      if (e[1] < -3) els.push(<Line key="leg2" x1={e[0]} x2={e[0]} y1={e[1]} y2={0} stroke="#3C3C43" strokeWidth={2.4} />);
      els.push(<Path key="pad" d={cap(at(P, nrm, 10), e, 2.6, 2.6)} {...kit} />);
    }
  }
  if (pose.box) {
    const p = b[pose.box], y = p[1] + (R[pose.box] ?? 3);
    if (y < -1) els.push(<Rect key="box" x={p[0] - 11} y={y} width={22} height={-y} rx={2} {...kit} />);
  }
  if (pose.wall) {
    const x = pose.wall === 'front' ? b.wr0[0] + 3.6 : Math.min(b.pelvis[0], b.neck[0]) - 9.5;
    els.push(<Line key="wall" x1={x} x2={x} y1={0} y2={top} stroke={c.line} strokeWidth={2} />);
  }
  if (pose.prop === 'bar') {
    if (pose.view === 'front') els.push(<Line key="bar" x1={b.wr0[0] - 14} x2={b.wr1[0] + 14} y1={b.wr0[1]} y2={b.wr0[1]} stroke={c.muted} strokeWidth={2.2} strokeLinecap="round" />);
    else els.push(<Path key="bar" d={circ(b.wr0, 2.4)} fill={c.muted} />);
  }
  return <>{els}</>;
}

// Frame the whole movement, plus whatever is drawn around it.
function viewBox(pose: Pose, b: Pts): [number, number, number, number] {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const grow = (p: P2, r: number) => { x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); y0 = Math.min(y0, p[1] - r); y1 = Math.max(y1, p[1] + r); };
  const gear = pose.prop === 'barbell' ? 9.5 : pose.prop === 'dumbbell' || pose.prop === 'kettlebell' ? 11 : 3.3;
  let mid = 0; // the body's own centre, averaged over the rep, so the figure sits in the middle of the pane
  for (let i = 0; i <= 16; i++) {
    const o = solve(pose, b, i / 16);
    let lo = 1e9, hi = -1e9;
    for (const k of Object.keys(o) as Key[]) {
      grow(o[k], k.startsWith('wr') ? gear : (R[k] ?? 4));
      if (!k.startsWith('wr') && !k.startsWith('el')) { lo = Math.min(lo, o[k][0]); hi = Math.max(hi, o[k][0]); }
    }
    mid += (lo + hi) / 2 / 17;
  }
  for (const n of [0, 1] as const) { const a = anchorOf(pose, b, n); if (a) grow(a, 2); }
  if (pose.ground !== 'hang' && pose.ground !== 'mat') grow([b.pelvis[0], 0], 2);
  if (pose.machine === 'treadmill') { grow([b.pelvis[0] - 38, 6], 0); grow([b.pelvis[0] + 46, -68], 0); }
  const pad = 9, w = Math.max(2 * Math.max(mid - x0, x1 - mid) + 2 * pad, 80), h = Math.max(y1 - y0 + 2 * pad, 80);
  return [mid - w / 2, (y0 + y1) / 2 - h / 2, w, h].map((v) => Math.round(v * 10) / 10) as [number, number, number, number];
}
