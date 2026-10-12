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

const [, , W, H] = VIEWBOX.split(' ').map(Number);
const APath = Animated.createAnimatedComponent(Path);
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

// Front and back side by side. Every region has a light outline; main muscles are red and breathe slowly
// (1.6 s in, 1.6 s out) with a soft wide stroke behind them as a glow; helpers are a still, lighter red.
export function MuscleMap({ primary, secondary, size = 200 }: { primary: string[]; secondary: string[]; size?: number }) {
  const p = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    p.value = still ? 1 : withRepeat(withTiming(1, { duration: 1600, easing: EASE }), -1, true);
    return () => cancelAnimation(p);
  }, [still]);
  const parts = BODY.map(([region, d]) => {
    const ms = MAP[region] ?? [];
    return { region, d, kind: ms.some((m) => primary.includes(m)) ? 2 : ms.some((m) => secondary.includes(m)) ? 1 : 0 };
  }).filter((x) => x.region !== 'rhomboids' || x.kind); // drawn over the traps only when it is working
  const main = parts.filter((x) => x.kind === 2);
  return (
    <Svg width={(size * W) / H} height={size} viewBox={VIEWBOX}>
      {parts.filter((x) => x.kind < 2).map((x, i) => (
        <Path key={i} d={x.d} fill={x.kind ? SOFT : c.card2} fillOpacity={x.kind ? 0.55 : 1}
          stroke={x.kind ? SOFT : c.muted} strokeOpacity={x.kind ? 0.9 : 0.6} strokeWidth={5} strokeLinejoin="round" />
      ))}
      {main.map((x, i) => <Glow key={'g' + i} d={x.d} p={p} />)}
      {main.map((x, i) => <Main key={'m' + i} d={x.d} p={p} />)}
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
