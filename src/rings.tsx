import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { c } from './theme';

const ACircle = Animated.createAnimatedComponent(Circle);

// Concentric progress rings, outermost first, with the children centred inside.
export function Rings({ size, stroke, rings, children }: { size: number; stroke: number; rings: { progress: number; color: string }[]; children?: ReactNode }) {
  const gap = Math.round(stroke / 3);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {rings.map((g, i) => <Arc key={i} size={size} stroke={stroke} rad={(size - stroke) / 2 - i * (stroke + gap)} {...g} />)}
      </Svg>
      {children}
    </View>
  );
}

function Arc({ size, stroke, rad, progress, color }: { size: number; stroke: number; rad: number; progress: number; color: string }) {
  const m = size / 2;
  const len = 2 * Math.PI * rad;
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(Math.min(1, Math.max(0, progress || 0)), { duration: 700, easing: Easing.out(Easing.cubic) }); }, [progress]);
  // At zero the round cap would still paint a dot, so the arc hides until there is something to show.
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value), strokeOpacity: p.value > 0.002 ? 1 : 0 }));
  return (
    <>
      <Circle cx={m} cy={m} r={rad} stroke={c.card2} strokeWidth={stroke} fill="none" />
      <ACircle
        cx={m} cy={m} r={rad} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={len} animatedProps={props} transform={`rotate(-90 ${m} ${m})`}
      />
    </>
  );
}
