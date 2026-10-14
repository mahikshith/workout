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
const APath = Animated.createAnimatedComponent(Path);
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

// Front and back side by side. Every region has a light outline; main muscles are red with a soft wide stroke behind
// them as a glow; helpers are a still, lighter red. The main muscles pulse twice when the map appears, then hold still:
// a constant pulse on these detailed paths made scrolling the exercise page stutter on Android.
// All main muscles share one glow path and one fill path, so the pulse animates two paths, not dozens.
// `side` shows only the front or back figure (small icons); `still` skips the opening pulse (grids of many maps).
export function MuscleMap({ primary, secondary, size = 200, side, still: quiet }: { primary: string[]; secondary: string[]; size?: number; side?: 'front' | 'back'; still?: boolean }) {
  const p = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    p.value = still || quiet ? 1 : withRepeat(withTiming(1, { duration: 1200, easing: EASE }), 5, true);
    return () => cancelAnimation(p);
  }, [still, quiet]);
  const parts = BODY.map(([region, d]) => {
    const ms = MAP[region] ?? [];
    return { region, d, kind: ms.some((m) => primary.includes(m)) ? 2 : ms.some((m) => secondary.includes(m)) ? 1 : 0 };
  }).filter((x) => x.region !== 'rhomboids' || x.kind); // drawn over the traps only when it is working
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
  const a = useAnimatedProps(() => ({ strokeOpacity: 0.1 + 0.3 * p.value }));
  return <APath d={d} fill="none" stroke={RED} strokeWidth={26} strokeLinejoin="round" animatedProps={a} />;
}

function Main({ d, p }: { d: string; p: SharedValue<number> }) {
  const a = useAnimatedProps(() => ({ fillOpacity: 0.75 + 0.25 * p.value }));
  return <APath d={d} fill={RED} stroke="#FFB4AE" strokeOpacity={0.9} strokeWidth={5} strokeLinejoin="round" animatedProps={a} />;
}
