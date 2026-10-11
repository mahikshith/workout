import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { frames, type Exercise } from './data/exercises';
import { c, f, r } from './theme';

export const haptic = (kind: 'light' | 'medium' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
};

const APress = Animated.createAnimatedComponent(Pressable);

// Every tappable surface springs down a little and ticks a haptic.
export function Tap({ onPress, style, children, disabled, scale = 0.96, feedback = 'light' }: {
  onPress?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; disabled?: boolean; scale?: number; feedback?: 'light' | 'medium' | 'none';
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APress
      disabled={disabled}
      onPressIn={() => (s.value = withSpring(scale, { damping: 15, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 12, stiffness: 300 }))}
      onPress={() => { if (feedback !== 'none') haptic(feedback); onPress?.(); }}
      style={[a, style, disabled && { opacity: 0.4 }]}
      accessibilityRole="button"
    >
      {children}
    </APress>
  );
}

type V = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'num';
const tv: Record<V, object> = {
  display: { fontFamily: f.display, fontSize: 44, lineHeight: 50, letterSpacing: 0.5, textTransform: 'uppercase' },
  h1: { fontFamily: f.display, fontSize: 32, lineHeight: 38, letterSpacing: 0.4, textTransform: 'uppercase' },
  h2: { fontFamily: f.bold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: f.semi, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: f.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: f.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: f.semi, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
  num: { fontFamily: f.display, fontSize: 28, lineHeight: 34 },
};
export function T({ v = 'body', color, style, ...p }: TextProps & { v?: V; color?: string }) {
  const def = v === 'small' || v === 'label' ? c.muted : c.text;
  return <Text {...p} style={[tv[v], { color: color ?? def }, style]} />;
}

export function Screen({ children, scroll = true, pad = true }: { children: ReactNode; scroll?: boolean; pad?: boolean }) {
  const ins = useSafeAreaInsets();
  const style = { paddingTop: ins.top + 12, paddingHorizontal: pad ? 20 : 0, paddingBottom: ins.bottom + 120 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={style} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export const Rise = ({ i = 0, children, style }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <Animated.View entering={FadeInDown.delay(i * 60).springify().damping(18)} style={style}>{children}</Animated.View>
);

export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[st.card, style]}>{children}</View>
);

export function Button({ title, onPress, kind = 'primary', icon, style, disabled }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? '#2A1210' : c.card2;
  const fg = kind === 'primary' ? c.accentInk : kind === 'danger' ? c.danger : c.text;
  return (
    <Tap onPress={onPress} disabled={disabled} feedback="medium" style={[st.btn, { backgroundColor: bg }, style]}>
      {icon && <Ionicons name={icon} size={20} color={fg} />}
      <Text style={{ fontFamily: f.bold, fontSize: 16, color: fg }}>{title}</Text>
    </Tap>
  );
}

export function Chip({ label, icon, on, onPress, color = c.accent }: {
  label: string; icon?: keyof typeof Ionicons.glyphMap; on?: boolean; onPress?: () => void; color?: string;
}) {
  const fg = on ? c.accentInk : c.text;
  return (
    <Tap onPress={onPress} style={[st.chip, on && { backgroundColor: color, borderColor: color }]}>
      {icon && <Ionicons name={icon} size={16} color={fg} />}
      <Text style={{ fontFamily: f.semi, fontSize: 14, color: fg }}>{label}</Text>
    </Tap>
  );
}

const ACircle = Animated.createAnimatedComponent(Circle);
export function Ring({ size = 120, stroke = 10, progress, color = c.accent, track = c.card2, children }: {
  size?: number; stroke?: number; progress: number; color?: string; track?: string; children?: ReactNode;
}) {
  const rad = (size - stroke) / 2;
  const len = 2 * Math.PI * rad;
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(Math.min(1, Math.max(0, progress)), { duration: 700, easing: Easing.out(Easing.cubic) }); }, [progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2} cy={size / 2} r={rad} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={len} animatedProps={props} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// The dataset ships a start and an end frame; crossfading them on a loop reads as a demo animation.
export function Demo({ ex, height = 240, style }: { ex: Exercise; height?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0, { duration: 700 }), withTiming(1, { duration: 500 }), withTiming(1, { duration: 700 }), withTiming(0, { duration: 500 })), -1);
  }, []);
  const top = useAnimatedStyle(() => ({ opacity: o.value }));
  if (ex.noImages) return <Breath ex={ex} height={height} style={style} />;
  const [a, b] = frames(ex.id);
  return (
    <View style={[{ height, borderRadius: r.lg, backgroundColor: c.media, overflow: 'hidden' }, style]}>
      <Image source={a} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" transition={200} />
      <Animated.View style={[StyleSheet.absoluteFill, top]}>
        <Image source={b} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" />
      </Animated.View>
    </View>
  );
}

export function Thumb({ ex, size = 56 }: { ex: Exercise; size?: number }) {
  if (ex.noImages)
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: '#251B33', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pulse" size={size * 0.45} color="#BF8CFF" />
      </View>
    );
  return <Image source={frames(ex.id)[0]} style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.media }} contentFit="cover" cachePolicy="disk" transition={150} />;
}

// Pelvic-floor drills: a circle that grows while you squeeze and shrinks while you release.
export function Breath({ ex, height, style }: { ex: Exercise; height: number; style?: StyleProp<ViewStyle> }) {
  const { hold, rest } = ex.timed ?? { hold: 4, rest: 4 };
  const s = useSharedValue(0.55);
  useEffect(() => {
    s.value = withRepeat(withSequence(
      withTiming(1, { duration: hold * 1000, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.55, { duration: rest * 1000, easing: Easing.inOut(Easing.sin) }),
    ), -1);
  }, [hold, rest]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 0.35 + (s.value - 0.55) }));
  const inner = useAnimatedStyle(() => ({ transform: [{ scale: s.value * 0.7 }] }));
  return (
    <View style={[{ height, borderRadius: r.lg, backgroundColor: '#140F1C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Animated.View style={[{ position: 'absolute', width: height * 0.8, height: height * 0.8, borderRadius: height, backgroundColor: '#BF8CFF' }, a]} />
      <Animated.View style={[{ position: 'absolute', width: height * 0.8, height: height * 0.8, borderRadius: height, backgroundColor: '#E2CCFF' }, inner]} />
      <T v="label" color="#251B33" style={{ position: 'absolute', bottom: 16 }}>{`squeeze ${hold}s · release ${rest}s`}</T>
    </View>
  );
}

export function Stat({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: f.display, fontSize: 26, color: color ?? c.text }}>
        {value}
        {unit ? <Text style={{ fontFamily: f.semi, fontSize: 13, color: c.muted }}> {unit}</Text> : null}
      </Text>
      <T v="label" style={{ marginTop: 2 }}>{label}</T>
    </View>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, suffix, big }: {
  value: number; onChange: (n: number) => void; step?: number; min?: number; suffix?: string; big?: boolean;
}) {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 16 : 6 }}>
      <Tap onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))} style={[st.step, big && st.stepBig]}>
        <Ionicons name="remove" size={big ? 26 : 18} color={c.text} />
      </Tap>
      <Text style={{ fontFamily: big ? f.display : f.bold, fontSize: big ? 48 : 17, color: c.text, minWidth: big ? 120 : 44, textAlign: 'center' }}>
        {fmt(value)}{suffix ? <Text style={{ fontSize: big ? 18 : 12, color: c.muted }}>{suffix}</Text> : null}
      </Text>
      <Tap onPress={() => onChange(+(value + step).toFixed(2))} style={[st.step, big && st.stepBig]}>
        <Ionicons name="add" size={big ? 26 : 18} color={c.text} />
      </Tap>
    </View>
  );
}

export const Row = ({ children, style, gap = 12 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const st = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  btn: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  chip: { paddingHorizontal: 16, height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  step: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  stepBig: { width: 56, height: 56, borderRadius: 28 },
});
