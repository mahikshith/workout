import { useEffect } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { BODY, VIEWBOX } from './data/bodyPaths';
import { c } from './theme';

export const RED = '#FF453A';
export const SOFT = '#FF8A80'; // helper muscles

// MuscleMap region -> our muscle names. Abductors have no region of their own; they sit in the upper glutes.
const MAP: Record<string, string[]> = {
  chest: ['chest'], deltoids: ['shoulders'], triceps: ['triceps'], biceps: ['biceps'], forearm: ['forearms'],
  upperBack: ['lats'], rotatorCuff: ['lats', 'middle back'], rhomboids: ['middle back'], lowerBack: ['lower back'],
  trapezius: ['traps'], abs: ['abdominals'], obliques: ['abdominals'], quadriceps: ['quadriceps'], hamstring: ['hamstrings'],
  gluteal: ['glutes', 'abductors'], calves: ['calves'], adductors: ['adductors'], neck: ['neck'],
};
export const mapped = (m: string) => Object.values(MAP).some((ms) => ms.includes(m));

const [X, Y, W, H] = VIEWBOX.split(' ').map(Number);
// Each region's path holds outlines from both figures; for a one-sided map keep only the outlines on that side, so a
// grid of small maps draws half the shapes. Subpaths all start with an absolute M, so its x says which figure it is in.
const HALF: Record<'front' | 'back', [string, string][]> = { front: [], back: [] };
const half = (side: 'front' | 'back') => {
  if (!HALF[side].length)
    HALF[side] = BODY.map(([region, d]) => [region, d.split(/(?=M)/).filter((p) => (parseFloat(p.slice(1)) < X + W / 2) === (side === 'front')).join('')] as [string, string])
      .filter(([, d]) => d);
  return HALF[side];
};
const APath = Animated.createAnimatedComponent(Path);
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

// Front and back side by side. Every region has a light outline; main muscles are red with a soft wide stroke behind
// them as a glow; helpers are a still, lighter red. The main muscles blink (0.9 s in, 0.9 s out) for as long as the map
// is on screen; small grid maps pass `still`.
// All main muscles share one glow path and one fill path, so the pulse animates two paths, not dozens.
// `side` shows only the front or back figure (small icons); `still` skips the opening pulse (grids of many maps).
export function MuscleMap(props: { primary: string[]; secondary: string[]; size?: number; side?: 'front' | 'back'; still?: boolean }) {
  const { still, ...rest } = props;
  return still ? <StillMap {...rest} /> : <LiveMap {...rest} />;
}

const kinds = (primary: string[], secondary: string[], side?: 'front' | 'back') =>
  (side ? half(side) : BODY).map(([region, d]) => {
    const ms = MAP[region] ?? [];
    return { region, d, kind: ms.some((m) => primary.includes(m)) ? 2 : ms.some((m) => secondary.includes(m)) ? 1 : 0 };
  }).filter((x) => x.region !== 'rhomboids' || x.kind); // drawn over the traps only when it is working

// Grids of small maps: plain paths, no animation hooks at all, so scrolling past them costs nothing extra.
function StillMap({ primary, secondary, size = 200, side }: { primary: string[]; secondary: string[]; size?: number; side?: 'front' | 'back' }) {
  const parts = kinds(primary, secondary, side);
  return (
    <Svg width={(size * (side ? W / 2 : W)) / H} height={size}
      viewBox={side ? `${side === 'front' ? X : X + W / 2} ${Y} ${W / 2} ${H}` : VIEWBOX}>
      {parts.map((x, i) => (
        <Path key={i} d={x.d} fill={x.kind === 2 ? RED : x.kind ? SOFT : c.card2} fillOpacity={x.kind === 1 ? 0.55 : 1}
          stroke={x.kind === 2 ? '#FFB4AE' : x.kind ? SOFT : c.muted} strokeOpacity={x.kind ? 0.9 : 0.6} strokeWidth={5} strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

function LiveMap({ primary, secondary, size = 200, side }: { primary: string[]; secondary: string[]; size?: number; side?: 'front' | 'back' }) {
  const p = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    p.value = still ? 1 : withRepeat(withTiming(1, { duration: 900, easing: EASE }), -1, true);
    return () => cancelAnimation(p);
  }, [still]);
  const parts = kinds(primary, secondary, side);
  const main = parts.filter((x) => x.kind === 2);
  return (
    <Svg width={(size * (side ? W / 2 : W)) / H} height={size}
      viewBox={side ? `${side === 'front' ? X : X + W / 2} ${Y} ${W / 2} ${H}` : VIEWBOX}>
      {parts.filter((x) => x.kind < 2).map((x, i) => (
        <Path key={i} d={x.d} fill={x.kind ? SOFT : c.card2} fillOpacity={x.kind ? 0.55 : 1}
          stroke={x.kind ? SOFT : c.muted} strokeOpacity={x.kind ? 0.9 : 0.6} strokeWidth={5} strokeLinejoin="round" />
      ))}
      {main.length > 0 && <Glow d={main.map((x) => x.d).join(' ')} p={p} />}
      {main.length > 0 && <Main d={main.map((x) => x.d).join(' ')} p={p} />}
    </Svg>
  );
}

function Glow({ d, p }: { d: string; p: SharedValue<number> }) {
  const a = useAnimatedProps(() => ({ strokeOpacity: 0.05 + 0.5 * p.value }));
  return <APath d={d} fill="none" stroke={RED} strokeWidth={26} strokeLinejoin="round" animatedProps={a} />;
}

function Main({ d, p }: { d: string; p: SharedValue<number> }) {
  const a = useAnimatedProps(() => ({ fillOpacity: 0.35 + 0.65 * p.value }));
  return <APath d={d} fill={RED} stroke="#FFB4AE" strokeOpacity={0.9} strokeWidth={5} strokeLinejoin="round" animatedProps={a} />;
}
