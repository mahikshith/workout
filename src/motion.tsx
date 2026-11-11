// The one motion system (docs/round14/fluid.md). Springs for anything the hand moves or that changes state; a few
// timed curves for fills and fades. Everything runs on the UI thread (Reanimated) and stands still when the phone's
// "Remove animations" / reduce-motion setting is on. This module imports neither ui.tsx nor kit.tsx.
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform, Pressable, StyleSheet, View, type AccessibilityRole, type AccessibilityState, type DimensionValue, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeOut, interpolate, runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle,
  useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useLook } from './look';
import { c, f } from './theme';

// --- Presets. Pick one by what moves, never invent numbers in a screen.
export const spring = {
  snappy: { stiffness: 420, damping: 32, mass: 1 }, // selection pills, toggles, small things that move a short way
  gentle: { stiffness: 170, damping: 22, mass: 1 }, // content arriving, height changes, rings and bars
  bouncy: { stiffness: 260, damping: 17, mass: 1 }, // the few moments of delight: a tick, a pulse, a badge (about 12 % overshoot)
  press: { stiffness: 520, damping: 24, mass: 0.8 }, // release after a press
  sheet: { stiffness: 260, damping: 26, mass: 1 }, // sheets and docked bars (a whisper of overshoot)
} as const;
export const dur = { fast: 120, base: 200, slow: 320, fill: 700, count: 600 } as const;
export const ease = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.quad),
  move: Easing.bezier(0.32, 0.72, 0, 1), // pushes, sheets closing
  fill: Easing.bezier(0.23, 1, 0.32, 1), // rings and bars (timed variant)
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const useStill = () => useReducedMotion();

export const haptic = (kind: 'light' | 'medium' | 'success' | 'warning' = 'light') => {
  if (Platform.OS === 'web' || !useLook.getState().haptics) return; // You › Haptics can switch them off
  if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
};

// --- Press. Down fast (90 ms), back on a spring that overshoots a hair, with a slight dim: the surface feels like it
// gives under the finger. `base` is the resting opacity (a disabled control rests at 0.4).
export function usePressStyle(scale = 0.97, dim = 0.9, base = 1) {
  const p = useSharedValue(0);
  const still = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    opacity: base * interpolate(p.value, [0, 1], [1, dim], 'clamp'),
    transform: [{ scale: still ? 1 : 1 + (scale - 1) * p.value }],
  }));
  return {
    style,
    onPressIn: () => { p.value = withTiming(1, { duration: 90, easing: ease.out }); },
    onPressOut: () => { p.value = still ? withTiming(0, { duration: 120 }) : withSpring(0, spring.press); },
  };
}

const APress = Animated.createAnimatedComponent(Pressable);
export type PressProps = {
  onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; children?: ReactNode; disabled?: boolean;
  scale?: number; dim?: number; haptic?: 'light' | 'medium' | 'none'; hitSlop?: number;
  accessibilityRole?: AccessibilityRole; accessibilityLabel?: string; accessibilityHint?: string; accessibilityState?: AccessibilityState;
};
export function PressableScale({
  onPress, onLongPress, style, children, disabled, scale = 0.97, dim = 0.9, haptic: feedback = 'light', hitSlop,
  accessibilityRole = 'button', accessibilityLabel, accessibilityHint, accessibilityState,
}: PressProps) {
  // The caller's own opacity (some rows fade themselves) is kept as the resting opacity.
  const own = style ? StyleSheet.flatten(style)?.opacity : undefined;
  const base = (typeof own === 'number' ? own : 1) * (disabled ? 0.4 : 1);
  const press = usePressStyle(scale, dim, base);
  return (
    <APress
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => { if (feedback !== 'none') haptic(feedback); onPress?.(); }}
      onLongPress={onLongPress ? () => { haptic('medium'); onLongPress(); } : undefined}
      style={[style, press.style]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={disabled ? { ...accessibilityState, disabled: true } : accessibilityState}
    >
      {children}
    </APress>
  );
}

// --- Enter: content rises and fades in on a gentle spring when it first mounts. `i` staggers siblings by 50 ms
// (capped, so the tenth card of a long page never waits half a second).
export function Enter({ i = 0, from = 'bottom', distance = 14, delay = 0, style, children }: {
  i?: number; from?: 'bottom' | 'top' | 'left' | 'right' | 'none'; distance?: number; delay?: number; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  const still = useReducedMotion();
  const p = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) { p.value = 1; return; }
    p.value = withDelay(delay + Math.min(i, 8) * 50, withSpring(1, spring.gentle));
  }, []);
  const a = useAnimatedStyle(() => {
    const d = (1 - p.value) * distance;
    return {
      opacity: Math.min(1, Math.max(0, p.value * 1.6)),
      transform: [from === 'left' ? { translateX: -d } : from === 'right' ? { translateX: d } : { translateY: from === 'top' ? -d : from === 'none' ? 0 : d }],
    };
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

// --- Swap: cross-fade between states (`k` names the state); the box springs to the new content's height.
export function Swap({ k, children, style, morph = true }: { k: string | number; children: ReactNode; style?: StyleProp<ViewStyle>; morph?: boolean }) {
  const still = useReducedMotion();
  const h = useSharedValue(-1); // -1: not measured yet, the box sizes itself
  const box = useAnimatedStyle(() => (h.value < 0 ? {} : { height: h.value }));
  const onLayout = (height: number) => {
    if (!morph) return;
    h.value = h.value < 0 || still ? height : withSpring(height, spring.gentle);
  };
  return (
    <Animated.View style={[morph && { overflow: 'hidden' }, style, box]}>
      <Animated.View key={k} entering={still ? undefined : FadeIn.duration(dur.base)} exiting={still ? undefined : FadeOut.duration(dur.fast)}
        onLayout={(e) => onLayout(e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

// --- Collapsible: height springs open and closed, content fades. The content is measured in place, so it can change
// size while open. `lazy` mounts the children on first open (long instructions cost nothing until asked for).
export function Collapsible({ open, children, style, lazy = true }: { open: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; lazy?: boolean }) {
  const still = useReducedMotion();
  const [seen, setSeen] = useState(open || !lazy);
  const h = useSharedValue(0);
  const p = useSharedValue(open ? 1 : 0);
  const ready = useSharedValue(0); // measured at least once: until then an open box sizes itself (no jump on mount)
  useEffect(() => {
    if (open && !seen) setSeen(true);
    p.value = still ? (open ? 1 : 0) : withSpring(open ? 1 : 0, { ...spring.gentle, overshootClamping: true });
  }, [open, still]);
  const box = useAnimatedStyle(() => (ready.value ? { height: h.value * p.value, opacity: Math.min(1, p.value * 1.4) } : { height: p.value ? undefined : 0, opacity: p.value }));
  return (
    <Animated.View style={[{ overflow: 'hidden' }, box]} pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
      {seen && (
        <View style={style} onLayout={(e) => { h.value = e.nativeEvent.layout.height; ready.value = 1; }}>
          {children}
        </View>
      )}
    </Animated.View>
  );
}

// --- A progress bar that springs to its value.
export function ProgressBar({ progress, color = c.accent, track = c.card2, height = 6, style }: {
  progress: number; color?: string; track?: string; height?: number; style?: StyleProp<ViewStyle>;
}) {
  const still = useReducedMotion();
  const w = useSharedValue(0);
  const p = useSharedValue(0);
  const to = Math.min(1, Math.max(0, progress || 0));
  useEffect(() => { p.value = still ? to : withSpring(to, { ...spring.gentle, overshootClamping: to >= 1 || to <= 0 }); }, [to, still]);
  const fill = useAnimatedStyle(() => ({ opacity: w.value ? 1 : 0, transform: [{ translateX: -w.value * (1 - Math.min(1, Math.max(0, p.value))) }] }));
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }, style]}
      onLayout={(e) => { w.value = e.nativeEvent.layout.width; }}
      accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(to * 100) }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fill]} />
    </View>
  );
}

// --- Skeleton: a placeholder that breathes while data loads (watch sync, pictures). Never a spinner.
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (still) return;
    o.value = withRepeat(withSequence(withTiming(0.45, { duration: 600, easing: ease.inOut }), withTiming(1, { duration: 600, easing: ease.inOut })), -1);
    return () => cancelAnimation(o);
  }, [still]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: c.card2 }, style, a]} />;
}

// --- Tick: a check mark that draws itself when something is logged.
const APath = Animated.createAnimatedComponent(Path);
const TICK_LEN = 21;
export function Tick({ on, size = 22, color = c.accentInk, stroke = 2.6 }: { on: boolean; size?: number; color?: string; stroke?: number }) {
  const still = useReducedMotion();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = still ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: on ? 260 : dur.fast, easing: ease.fill }); }, [on, still]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: TICK_LEN * (1 - p.value), strokeOpacity: p.value > 0.02 ? 1 : 0 }));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <APath d="M5 12.6l4.6 4.6L19 7.6" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none"
        strokeDasharray={TICK_LEN} animatedProps={props} />
    </Svg>
  );
}

// --- Pulse: its child swells once whenever `value` goes up (a streak that grew, a ring that just closed).
export function Pulse({ value, children, style, scale = 1.18 }: { value: number; children: ReactNode; style?: StyleProp<ViewStyle>; scale?: number }) {
  const still = useReducedMotion();
  const s = useSharedValue(1);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current && !still) s.value = withSequence(withTiming(scale, { duration: 140, easing: ease.out }), withSpring(1, spring.bouncy));
    prev.current = value;
  }, [value]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

// --- Pop: springs its child in while `on`, out when not (selected marks, small badges).
export function Pop({ on, children, style }: { on: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = still ? (on ? 1 : 0) : on ? withSpring(1, spring.bouncy) : withTiming(0, { duration: dur.fast }); }, [on, still]);
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, p.value * 1.5)), transform: [{ scale: 0.6 + 0.4 * p.value }] }));
  return <Animated.View style={[style, a]} pointerEvents={on ? 'auto' : 'none'}>{children}</Animated.View>;
}

// --- A number that counts up to its value and pops gently when it changes later.
export function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '', style }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; style?: StyleProp<TextStyle>;
}) {
  const still = useReducedMotion();
  const v = useSharedValue(still ? value : 0);
  const scale = useSharedValue(1);
  const [shown, setShown] = useState(still ? value : 0);
  const first = useRef(true);
  useEffect(() => {
    if (still) { setShown(value); return; }
    v.value = withTiming(value, { duration: dur.count, easing: ease.out });
    if (!first.current) scale.value = withSequence(withTiming(1.12, { duration: dur.fast }), withSpring(1, spring.bouncy));
    first.current = false;
  }, [value, still]);
  // Only steps that change the printed text reach React (a count to 12 renders 12 times, not 36).
  const k = Math.pow(10, decimals);
  useAnimatedReaction(() => Math.round(v.value * k) / k, (n, old) => { if (n !== old) runOnJS(setShown)(n); });
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const txt = `${prefix}${shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  return <Animated.Text style={[{ fontFamily: f.display, fontSize: 28, color: c.text }, style, pop]}>{txt}</Animated.Text>;
}

// --- Scroll position on the UI thread: `<Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>`.
export function useScrollY() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  return { y, onScroll };
}
