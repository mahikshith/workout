import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { Image, type ImageProps } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { artFrames, frames, MEDIA, origin, type Exercise } from './data/exercises';
import { poseFor } from './data/poses';
import { Figure } from './figure';
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
  h2: { fontFamily: f.bold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: f.semi, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: f.regular, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: f.medium, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: f.semi, fontSize: 13, lineHeight: 17, letterSpacing: 1.2, textTransform: 'uppercase' },
  num: { fontFamily: f.display, fontSize: 28, lineHeight: 34 },
};
export function T({ v = 'body', color, style, ...p }: TextProps & { v?: V; color?: string }) {
  // Small print is grey; tags and labels are a lighter grey so they stay readable on dark cards.
  const def = v === 'small' ? c.muted : v === 'label' ? '#B4B4BA' : c.text;
  return <Text {...p} style={[tv[v], { color: color ?? def }, style]} />;
}

export function Screen({ children, scroll = true, pad = true }: { children: ReactNode; scroll?: boolean; pad?: boolean }) {
  const ins = useSafeAreaInsets();
  const style = { paddingTop: ins.top + 12, paddingHorizontal: pad ? 12 : 0, paddingBottom: ins.bottom + 120 };
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
const KINDS: { k: MediaPref; label: string }[] = [{ k: 'animated', label: 'Animated' }, { k: 'drawing', label: 'Drawing' }, { k: 'photo', label: 'Photo' }, { k: 'video', label: 'Video' }];
export const mediaKinds = (ex: Exercise) =>
  KINDS.filter(({ k }) => (k === 'animated' ? !ex.noImages : k === 'drawing' ? !!ex.art : k === 'photo' ? !(ex.noPhoto || ex.noImages) : !!VIDEOS[ex.id]));
const CREDIT = { drawing: 'Drawing: workout-guide by Bryl Lim, CC BY-SA 4.0, based on Everkinetic', photo: 'Photo: free-exercise-db, public domain' };
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const NAME: Record<MediaPref, string> = { animated: 'Animation', drawing: 'Drawing', photo: 'Photo', video: 'Video' };

// Animated figure, drawing (workout-guide), photo (free-exercise-db) or video (wger), with a switch in the corner.
// The pick is remembered for every exercise. If a picture or video can't load, the pane quietly falls back to the
// next kind (usually the animated figure, which needs no network) and says so; a failure never blanks the pane.
export function Demo({ ex, height = 240, style, credit }: { ex: Exercise; height?: number; style?: StyleProp<ViewStyle>; credit?: boolean }) {
  const pref = useStore((s) => s.mediaPref);
  const setPref = useStore((s) => s.setMediaPref);
  const [w, setW] = useState(0);
  const [failed, setFailed] = useState<MediaPref[]>([]);
  const [prev, setPrev] = useState<MediaPref | null>(null); // stays under the new pick while it fades in
  useEffect(() => setFailed([]), [ex.id]);
  useEffect(() => { if (!prev) return; const t = setTimeout(() => setPrev(null), 250); return () => clearTimeout(t); }, [prev]);
  if (ex.noImages) return <Breath ex={ex} height={height} style={style} />;
  const kinds = mediaKinds(ex).filter((m) => !failed.includes(m.k));
  const kind = kinds.find((m) => m.k === pref)?.k ?? kinds[0]?.k;
  const missed = pref !== kind && failed.includes(pref) ? pref : null;
  const shown = prev && prev !== kind && kinds.some((m) => m.k === prev) ? [prev, kind] : [kind];
  const fail = (k: MediaPref) => setFailed((f) => (f.includes(k) ? f : [...f, k]));
  const { pose, matched } = poseFor(ex);
  return (
    <View style={style}>
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
        style={{ height, borderRadius: r.lg, backgroundColor: c.card2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {!kind ? <Ionicons name="barbell-outline" size={height * 0.3} color={c.muted} /> : shown.map((k) => (
          <Animated.View key={ex.id + k} entering={k === kind && shown.length > 1 ? FadeIn.duration(200).easing(EASE) : undefined} style={StyleSheet.absoluteFill}>
            {k === 'animated' ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }]}>
                {w > 0 && <Figure pose={pose} primary={ex.primary} secondary={ex.secondary} height={height} width={w} />}
              </View>
            ) : k === 'video' ? <Clip id={ex.id} onFail={() => fail('video')} />
              : <Loop uris={k === 'drawing' ? artFrames(ex.art!) : frames(ex.id)} solid={k === 'photo'} onFail={() => fail(k)} />}
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
        {missed && kind && (
          <View style={md.note}><T v="small" color={c.text}>{`${NAME[missed]} didn’t load, so here’s the ${NAME[kind].toLowerCase()}.`}</T></View>
        )}
      </View>
      {credit && kind && (
        <T v="small" color={c.dim} style={{ marginTop: 8, textAlign: 'center' }}>
          {kind === 'animated'
            ? matched ? 'The figure shows the movement pattern. Follow the steps below for the exact form.' : 'Dots mark the moving joints, the arc is the joint angle at the key point, and the dashed line is what to keep straight.'
            : kind === 'video' ? `Video: ${VIDEOS[ex.id].author}, wger.de, CC BY-SA 4.0` : CREDIT[kind]}
        </T>
      )}
    </View>
  );
}

// An image from our mirror; if the mirror fails it retries the original host once, then reports the error.
function Pic({ uri, onLoad, onError, ...p }: { uri: string; onLoad?: () => void; onError?: () => void } & Omit<ImageProps, 'source' | 'onLoad' | 'onError'>) {
  const [src, setSrc] = useState(uri);
  useEffect(() => setSrc(uri), [uri]);
  return <Image {...p} source={src} onLoad={onLoad} onError={() => { const o = origin(src); if (o) setSrc(o); else onError?.(); }} />;
}

// Poses played 1→2→3→2→1 (photos 1→2→1): each held 700 ms, 450 ms crossfades. Only frames that actually loaded
// take part, so a missing frame can never cover the others; if none load, the pane falls back.
function Loop({ uris, solid, onFail }: { uris: string[]; solid: boolean; onFail: () => void }) {
  const [st, setSt] = useState<('ok' | 'bad' | undefined)[]>([]);
  const mark = (i: number, v: 'ok' | 'bad') => setSt((s) => { if (s[i]) return s; const n = [...s]; n[i] = v; return n; });
  useEffect(() => {
    setSt([]);
    const t = setTimeout(() => setSt((s) => uris.map((_, i) => s[i] ?? 'bad')), 12000); // slow network: give up on stragglers
    return () => clearTimeout(t);
  }, [uris[0]]);
  const good = uris.map((_, i) => i).filter((i) => st[i] === 'ok');
  const settled = uris.every((_, i) => st[i]);
  useEffect(() => { if (settled && !good.length) onFail(); }, [settled, good.length]);
  const p = useSharedValue(0);
  const n = settled ? good.length : 0;
  useEffect(() => {
    cancelAnimation(p); p.value = 0;
    if (n < 2) return;
    const fade = (v: number) => withTiming(v, { duration: 450, easing: Easing.inOut(Easing.quad) });
    const hold = (v: number) => withTiming(v, { duration: 700 });
    const steps = (n > 2 ? [1, 2, 1, 0] : [1, 0]).flatMap((v) => [fade(v), hold(v)]).slice(0, -1);
    p.value = withRepeat(withSequence(hold(0), ...steps), -1);
    return () => cancelAnimation(p);
  }, [n, uris[0]]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: solid ? c.media : c.card2, alignItems: 'center', justifyContent: 'center' }]}>
      {!good.length && <ActivityIndicator color={c.muted} />}
      {uris.map((uri, i) => <Frame key={uri} uri={uri} slot={good.indexOf(i)} p={p} solid={solid} onLoad={() => mark(i, 'ok')} onError={() => mark(i, 'bad')} />)}
    </View>
  );
}

// Every shown frame sits on an opaque background and fades in over the last one, so mid-blend the outlines mix
// evenly instead of stacking up and looking thicker. Frames still loading (slot -1) stay invisible.
function Frame({ uri, slot, p, solid, onLoad, onError }: { uri: string; slot: number; p: SharedValue<number>; solid: boolean; onLoad: () => void; onError: () => void }) {
  const a = useAnimatedStyle(() => ({ opacity: slot < 0 ? 0 : slot === 0 ? 1 : Math.min(1, Math.max(0, p.value - slot + 1)) }));
  const inset = solid ? 0 : 12;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: solid ? c.media : c.card2 }, a]} pointerEvents="none">
      <Pic uri={uri} onLoad={onLoad} onError={onError} style={{ position: 'absolute', top: inset, bottom: inset, left: inset, right: inset }} contentFit="contain" contentPosition="center" cachePolicy="memory-disk" />
    </Animated.View>
  );
}

// wger videos, transcoded to small muted H.264 by .github/workflows/media.yml and mirrored to our Pages site;
// falls back to the release download, then to the next media kind.
function Clip({ id, onFail }: { id: string; onFail: () => void }) {
  const [i, setI] = useState(0);
  const uris = [`${MEDIA}video/${id}.mp4`, VIDEOS[id].url];
  return <ClipView key={i} uri={uris[i]} onError={() => (i === 0 ? setI(1) : onFail())} />;
}
function ClipView({ uri, onError }: { uri: string; onError: () => void }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (pl) => { pl.loop = true; pl.muted = true; pl.play(); });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => { if (status === 'error') onError(); if (status === 'readyToPlay') player.play(); }, [status]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} surfaceType="textureView" />
      {status !== 'readyToPlay' && <ActivityIndicator color={c.muted} />}
    </View>
  );
}

const md = StyleSheet.create({
  switch: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 2, padding: 3, borderRadius: 16, backgroundColor: 'rgba(10,10,11,0.72)' },
  opt: { height: 26, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  note: { position: 'absolute', left: 10, bottom: 10, right: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(10,10,11,0.72)' },
});

// List thumbnails: first drawing or photo frame; an icon if neither loads, so a bad network never leaves holes.
export function Thumb({ ex, size = 56 }: { ex: Exercise; size?: number }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [ex.id]);
  if (ex.noImages)
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: '#251B33', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pulse" size={size * 0.45} color="#BF8CFF" />
      </View>
    );
  if (bad || (!ex.art && ex.noPhoto))
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="barbell-outline" size={size * 0.45} color={c.muted} />
      </View>
    );
  return ex.art
    ? <Pic uri={artFrames(ex.art)[0]} onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.card2 }} contentFit="contain" cachePolicy="disk" transition={150} />
    : <Pic uri={frames(ex.id)[0]} onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.media }} contentFit="cover" cachePolicy="disk" transition={150} />;
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
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  btn: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  chip: { paddingHorizontal: 16, height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  step: { width: 30, height: 34, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  stepBig: { width: 56, height: 56, borderRadius: 28 },
});
