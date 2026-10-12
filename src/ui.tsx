import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { artFrames, frames, type Exercise } from './data/exercises';
import videos from './data/videos.json';
import { useStore, type MediaPref } from './store';
import { c, f, r } from './theme';

export const haptic = (kind: 'light' | 'medium' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
};

const APress = Animated.createAnimatedComponent(Pressable);

// Every tappable surface springs down a little and ticks a haptic.
export function Tap({ onPress, style, children, disabled, scale = 0.97, feedback = 'light' }: {
  onPress?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; disabled?: boolean; scale?: number; feedback?: 'light' | 'medium' | 'none';
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APress
      disabled={disabled}
      onPressIn={() => (s.value = withTiming(scale, { duration: 120, easing: Easing.out(Easing.quad) }))}
      onPressOut={() => (s.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.32, 0.72, 0, 1) }))}
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
  // The whole type scale. Screens pick a variant; they never set their own font or size.
  display: { fontFamily: f.display, fontSize: 40, lineHeight: 46, letterSpacing: 0.5, textTransform: 'uppercase' },
  h1: { fontFamily: f.display, fontSize: 30, lineHeight: 36, letterSpacing: 0.4, textTransform: 'uppercase' },
  h2: { fontFamily: f.bold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: f.semi, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: f.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: f.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: f.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
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
  <Animated.View entering={FadeInDown.delay(i * 50).duration(380)} style={style}>{children}</Animated.View>
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

const VIDEOS: Record<string, { url: string; author: string }> = videos;
const KINDS: { k: MediaPref; label: string }[] = [{ k: 'drawing', label: 'Drawing' }, { k: 'photo', label: 'Photo' }, { k: 'video', label: 'Video' }];
export const mediaKinds = (ex: Exercise) =>
  KINDS.filter(({ k }) => (k === 'drawing' ? !!ex.art : k === 'photo' ? !(ex.noPhoto || ex.noImages) : !!VIDEOS[ex.id]));
const CREDIT = { drawing: 'Drawing: workout-guide by Bryl Lim, CC BY-SA 4.0, based on Everkinetic', photo: 'Photo: free-exercise-db, public domain' };
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

// Drawing (workout-guide), photo (free-exercise-db) or video (wger), whichever exist, with a switch in the corner.
// The pick is remembered for every exercise. Steps-only exercises get a glyph and never hit the photo CDN.
export function Demo({ ex, height = 240, style, credit }: { ex: Exercise; height?: number; style?: StyleProp<ViewStyle>; credit?: boolean }) {
  const pref = useStore((s) => s.mediaPref);
  const setPref = useStore((s) => s.setMediaPref);
  const [prev, setPrev] = useState<MediaPref | null>(null); // stays under the new pick while it fades in
  useEffect(() => { if (!prev) return; const t = setTimeout(() => setPrev(null), 250); return () => clearTimeout(t); }, [prev]);
  if (ex.noImages) return <Breath ex={ex} height={height} style={style} />;
  const kinds = mediaKinds(ex);
  const kind = kinds.find((m) => m.k === pref)?.k ?? kinds[0]?.k;
  const shown = prev && prev !== kind && kinds.some((m) => m.k === prev) ? [prev, kind] : [kind];
  return (
    <View style={style}>
      <View style={{ height, borderRadius: r.lg, backgroundColor: c.card2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {!kind ? <Ionicons name="barbell-outline" size={height * 0.3} color={c.muted} /> : shown.map((k) => (
          <Animated.View key={ex.id + k} entering={k === kind && shown.length > 1 ? FadeIn.duration(200).easing(EASE) : undefined} style={StyleSheet.absoluteFill}>
            {k === 'video' ? <Clip uri={VIDEOS[ex.id].url} /> : <Loop uris={k === 'drawing' ? artFrames(ex.art!) : frames(ex.id)} solid={k === 'photo'} />}
          </Animated.View>
        ))}
        {kinds.length > 1 && (
          <View style={md.switch}>
            {kinds.map(({ k, label }) => (
              <Pressable key={k} hitSlop={10} accessibilityRole="button" accessibilityState={{ selected: k === kind }}
                onPress={() => { if (!kind || k === kind) return; haptic(); setPrev(kind); setPref(k); }}
                style={[md.opt, k === kind && { backgroundColor: c.accent }]}>
                <T v="label" color={k === kind ? c.accentInk : c.text}>{label}</T>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {credit && kind && (
        <T v="small" color={c.dim} style={{ marginTop: 8, textAlign: 'center' }}>
          {kind === 'video' ? `Video: ${VIDEOS[ex.id].author}, wger.de, CC BY-SA 4.0` : CREDIT[kind]}
        </T>
      )}
    </View>
  );
}

// Poses played 1→2→3→2→1 (photos 1→2→1): each held 700 ms, 450 ms crossfades. Starts once every frame is cached.
function Loop({ uris, solid }: { uris: string[]; solid: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    let live = true;
    const fade = (v: number) => withTiming(v, { duration: 450, easing: Easing.inOut(Easing.quad) });
    const hold = (v: number) => withTiming(v, { duration: 700 });
    const steps = (uris.length > 2 ? [1, 2, 1, 0] : [1, 0]).flatMap((v) => [fade(v), hold(v)]).slice(0, -1);
    Image.prefetch(uris, 'memory-disk').finally(() => { if (live) p.value = withRepeat(withSequence(hold(0), ...steps), -1); });
    return () => { live = false; cancelAnimation(p); };
  }, [uris[0]]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: solid ? c.media : c.card2 }]}>
      {uris.map((uri, i) => <Frame key={uri} uri={uri} i={i} p={p} solid={solid} />)}
    </View>
  );
}

// Every frame sits on an opaque background and fades in over the last one, so mid-blend the white outlines mix
// evenly instead of stacking up and looking thicker (what trading opacity on transparent line art did).
function Frame({ uri, i, p, solid }: { uri: string; i: number; p: SharedValue<number>; solid: boolean }) {
  const a = useAnimatedStyle(() => ({ opacity: i === 0 ? 1 : Math.min(1, Math.max(0, p.value - i + 1)) }));
  const inset = solid ? 0 : 12;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: solid ? c.media : c.card2 }, a]}>
      <Image source={uri} style={{ position: 'absolute', top: inset, bottom: inset, left: inset, right: inset }} contentFit="contain" cachePolicy="memory-disk" />
    </Animated.View>
  );
}

// wger videos, transcoded to small muted H.264 by .github/workflows/media.yml. TextureView so it can fade and round its corners.
function Clip({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (pl) => { pl.loop = true; pl.muted = true; pl.play(); });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} surfaceType="textureView" />
      {status === 'loading' && <ActivityIndicator color={c.muted} />}
      {status === 'error' && <T v="small">Video not available right now</T>}
    </View>
  );
}

const md = StyleSheet.create({
  switch: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 2, padding: 3, borderRadius: 16, backgroundColor: 'rgba(10,10,11,0.72)' },
  opt: { height: 26, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

export function Thumb({ ex, size = 56 }: { ex: Exercise; size?: number }) {
  if (ex.noImages)
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: '#251B33', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pulse" size={size * 0.45} color="#BF8CFF" />
      </View>
    );
  if (ex.art)
    return <Image source={artFrames(ex.art)[0]} style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.card2 }} contentFit="contain" cachePolicy="disk" transition={150} />;
  if (ex.noPhoto)
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="barbell-outline" size={size * 0.45} color={c.muted} />
      </View>
    );
  return <Image source={frames(ex.id)[0]} style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.media }} contentFit="cover" cachePolicy="disk" transition={150} />;
}

// Drills without pictures (pelvic floor, breathing, eyes, desk): a circle that grows for the hold and shrinks for the rest.
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
      <T v="label" color="#251B33" style={{ position: 'absolute', bottom: 16 }}>{`${ex.category === 'pelvic floor' ? 'squeeze' : ex.category === 'breathing' ? 'breathe in' : 'hold'} ${hold}s · ${ex.category === 'pelvic floor' ? 'release' : ex.category === 'breathing' ? 'breathe out' : 'rest'} ${rest}s`}</T>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 16 : 2 }}>
      <Tap onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))} style={[st.step, big && st.stepBig]}>
        <Ionicons name="remove" size={big ? 26 : 18} color={c.text} />
      </Tap>
      <Text style={{ fontFamily: big ? f.display : f.bold, fontSize: big ? 48 : 17, color: c.text, minWidth: big ? 120 : 34, textAlign: 'center' }}>
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
  step: { width: 30, height: 34, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  stepBig: { width: 56, height: 56, borderRadius: 28 },
});
