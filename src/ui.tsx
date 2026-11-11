import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { Image, type ImageProps } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type AccessibilityRole, type AccessibilityState, type StyleProp, type TextProps, type ViewProps, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, useAnimatedProps, useReducedMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useScrollToTop } from '@react-navigation/native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { frames, MEDIA, origin, type Exercise } from './data/exercises';
import { poseFor } from './data/poses';
import { Figure } from './figure';
import { G as ArtG, Path as ArtPath } from 'react-native-svg';
import { ART, type Art } from './data/art';
import videos from './data/videos.json';
import { useStore, type MediaPref } from './store';
import { useLook } from './look';
import { c, dom, f, r, tint } from './theme';
import { Ambient, shadow } from './glass';
import { Collapsible, Enter, haptic, ProgressBar, spring, Tick, usePressStyle } from './motion';

export { haptic }; // lives in motion.tsx now

const APress = Animated.createAnimatedComponent(Pressable);

// Every tappable surface gives under the finger: down fast, a slight dim, back on a spring (motion.tsx usePressStyle),
// and ticks a haptic. No scale with reduced motion. Accessibility props pass through; the role defaults to button.
export function Tap({ onPress, onLongPress, style, children, disabled, scale = 0.97, dim = 0.9, feedback = 'light', accessibilityRole = 'button', accessibilityLabel, accessibilityHint, accessibilityState, hitSlop }: {
  hitSlop?: number; // extends the touch area past a small visual (steppers in tight rows) to reach 44 px
  onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; disabled?: boolean; scale?: number; dim?: number; feedback?: 'light' | 'medium' | 'none';
  accessibilityRole?: AccessibilityRole; accessibilityLabel?: string; accessibilityHint?: string; accessibilityState?: AccessibilityState;
}) {
  // A caller's own opacity (rows that fade themselves) stays the resting opacity; disabled rests at 40 %.
  const own = style ? StyleSheet.flatten(style)?.opacity : undefined;
  const press = usePressStyle(scale, dim, (typeof own === 'number' ? own : 1) * (disabled ? 0.4 : 1));
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

type V = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'num';
const tv: Record<V, object> = {
  // The whole type scale. Screens pick a variant; they never set their own font or size.
  // Round 13: no more all-caps condensed display face. Titles are sentence case in Outfit, like Fitbit and WHOOP.
  // Headings SemiBold; Bold is kept for numbers (research: Fitbit/WHOOP keep heavy weights for metrics only).
  display: { fontFamily: f.semi, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h1: { fontFamily: f.semi, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h2: { fontFamily: f.semi, fontSize: 19, lineHeight: 25 },
  h3: { fontFamily: f.semi, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: f.regular, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: f.medium, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: f.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
  num: { fontFamily: f.bold, fontSize: 28, lineHeight: 34 },
};
export function T({ v = 'body', color, style, ...p }: TextProps & { v?: V; color?: string }) {
  // Small print is grey; tags and labels are a lighter grey so they stay readable on dark cards.
  const def = v === 'small' ? c.muted : v === 'label' ? c.label : c.text;
  return <Text {...p} style={[tv[v], { color: color ?? def }, style]} />;
}

// --- Workout mini bar placement (the bar itself is MiniBar in kit.tsx, rendered once in app/_layout.tsx).
export const TAB_BAR_HEIGHT = 64;
export const MINI_BAR_HEIGHT = 56;
export const MINI_GAP = 8;
// How far the tab bar's centre Start circle rises above the bar. On tabs the mini bar sits this much higher, so the
// circle never runs under it.
export const CENTRE_RISE = 16;
const NO_MINI_BAR = ['session', 'summary', 'onboarding'];
export function useMiniBarPlace() {
  const seg = useSegments() as string[];
  const running = useStore((s) => !!s.active && s.active.running !== false); // a ready (not started) workout has no bar
  return { visible: running && !NO_MINI_BAR.includes(seg[0] ?? ''), tabs: !seg.length || seg[0] === '(tabs)' };
}
// Extra bottom padding a scrolling screen adds on top of its usual padding, so its last item ends 8 px above the
// mini bar. 0 when no workout is running or the bar is hidden. Fixed bottom bars on pushed screens add it too.
export function useMiniBarSpace() {
  const { visible, tabs } = useMiniBarPlace();
  return visible ? MINI_BAR_HEIGHT + MINI_GAP * 2 + (tabs ? CENTRE_RISE : 0) : 0;
}

// For screens with their own ScrollView or FlatList: pass the returned ref to it, and tapping the current tab scrolls
// it to the top (react-navigation's useScrollToTop).
// Usage: `const ref = useScrollTopRef<FlatList<Row>>();` then `<FlatList ref={ref} ... />`.
export function useScrollTopRef<V = ScrollView>() {
  const ref = useRef<V>(null);
  useScrollToTop(ref as unknown as Parameters<typeof useScrollToTop>[0]);
  return ref;
}

// `top` overrides the top padding (screens with their own pinned header pass 0). `bottom` adds room for a fixed
// bottom bar. Tapping the current tab scrolls a Screen to the top. Bottom padding always includes the mini bar.
// `ambient` draws the soft colour glows of glass.tsx behind the content; they stay put while it scrolls. On by default
// for full-height screens; a Screen under a header (`top` given) leaves it to the page root, which draws one
// `<Ambient />` behind header and content together (no seam).
export function Screen({ children, scroll = true, pad = true, onScroll, top, bottom = 0, ambient = top === undefined, tone }: {
  children: ReactNode; scroll?: boolean; pad?: boolean; onScroll?: (y: number) => void; top?: number; bottom?: number; ambient?: boolean; tone?: [string, string?, string?]; // tone: this screen's own glow colours
}) {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const ref = useScrollTopRef<ScrollView>();
  const style = { paddingTop: top ?? ins.top + 12, paddingHorizontal: pad ? 12 : 0, paddingBottom: ins.bottom + 120 + mini + bottom };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: ambient ? c.bg : undefined }, style]}>{ambient && <Ambient colors={tone} strength={tone ? 1.25 : 1} />}{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: ambient ? c.bg : undefined }}>
      {ambient && <Ambient colors={tone} strength={tone ? 1.25 : 1} />}
      <ScrollView ref={ref} style={{ flex: 1 }} contentContainerStyle={style} showsVerticalScrollIndicator={false}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined} scrollEventThrottle={onScroll ? 100 : undefined}>
        {children}
      </ScrollView>
    </View>
  );
}

// The profile button that sits at the top right of every tab.
export function Avatar() {
  const name = useStore((s) => s.profile.name);
  return (
    <Tap onPress={() => router.push('/you')} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent }}>
      {name ? <T v="h3" color={c.accentInk}>{name[0].toUpperCase()}</T> : <Ionicons name="person" size={18} color={c.accentInk} />}
    </Tap>
  );
}

// A tab's big title with the profile button beside it.
export const TabTitle = ({ title }: { title: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <T v="display" numberOfLines={1} style={{ flex: 1 }}>{title}</T>
    <Avatar />
  </View>
);

export const Rise = ({ i = 0, children, style }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <Enter i={i} style={style}>{children}</Enter>
);

export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[st.card, style]}>{children}</View>
);

// --- Layout primitives. Every screen is built from these, so spacing and hierarchy stay the same everywhere:
// a Section has a short title (2-3 words, no sentence under it) and an optional action on the right; its content
// sits 12 below; sections are 32 apart. Supporting text is one short line at most.
type Icon = keyof typeof Ionicons.glyphMap;

export function Section({ title, action, onAction, first, children, style }: {
  title: string; action?: string; onAction?: () => void; first?: boolean; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginTop: first ? 20 : 32 }, style]}>
      {/* The action sits right beside the title as a small pill, so the eye never has to jump to the far edge. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <T v="h2" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</T>
        {action && (
          <Tap onPress={onAction} scale={0.95} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 28, paddingLeft: 10, paddingRight: 6, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
            <T v="small" color={c.accent} numberOfLines={1}>{action}</T>
            {onAction && <Ionicons name="chevron-forward" size={14} color={c.accent} />}
          </Tap>
        )}
      </View>
      {children}
    </View>
  );
}

// Tappable when it has an onPress, a plain view otherwise (never greyed out like a disabled button).
const Press = ({ onPress, style, children }: { onPress?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode }) =>
  onPress ? <Tap onPress={onPress} scale={0.98} style={style}>{children}</Tap> : <View style={style}>{children}</View>;

// An icon on a tinted rounded square: the visual anchor at the start of every row and tile.
export const IconBox = ({ icon, color = c.accent, size = 40, solid }: { icon: Icon; color?: string; size?: number; solid?: boolean }) => (
  <View style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center', backgroundColor: solid ? color : color + '22' }}>
    <Ionicons name={icon} size={size * 0.5} color={solid ? c.accentInk : color} />
  </View>
);

// A stat tile: icon, one big number, a 1-2 word label. No sentences.
export function Tile({ icon, color = c.accent, value, unit, label, onPress, progress, style }: {
  icon: Icon; color?: string; value: string | number; unit?: string; label: string; onPress?: () => void; progress?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press onPress={onPress} style={[st.tile, style]}>
      <IconBox icon={icon} color={color} size={32} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: f.bold, fontSize: 24, color: c.text, marginTop: 12 }}>
        {value}{unit ? <Text style={{ fontFamily: f.medium, fontSize: 13, color: c.muted }}> {unit}</Text> : null}
      </Text>
      <T v="small" numberOfLines={1}>{label}</T>
      {progress === undefined ? <View style={{ height: 4, marginTop: 10 }} /> : <ProgressBar progress={progress} color={color} height={4} style={{ marginTop: 10 }} />}
    </Press>
  );
}

// A one-line row: icon, title, optional short subtitle, chevron or custom right side.
export function ListRow({ icon, color, thumb, title, sub, right, onPress, style }: {
  icon?: Icon; color?: string; thumb?: ReactNode; title: string; sub?: string; right?: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press onPress={onPress} style={[st.listRow, style]}>
      {thumb ?? (icon ? <IconBox icon={icon} color={color} /> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3" numberOfLines={2}>{title}</T>
        {sub ? <T v="small" numberOfLines={2}>{sub}</T> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.dim} /> : null)}
    </Press>
  );
}

// A slim notice: icon + one line + optional action. For setup prompts, permissions, health context.
export function Banner({ icon, color = c.accent, title, action, onPress }: { icon: Icon; color?: string; title: string; action?: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} style={[st.banner, { borderColor: color + '55' }]}>
      <Ionicons name={icon} size={18} color={color} />
      <T v="body" color={c.text} numberOfLines={2} style={{ flex: 1 }}>{title}</T>
      {action ? <T v="small" color={color}>{action}</T> : onPress ? <Ionicons name="chevron-forward" size={16} color={c.dim} /> : null}
    </Press>
  );
}

// Show more on demand: a heading line that opens its content. For instructions, explanations, long lists.
export function Fold({ title, icon, children, open: start = false }: { title: string; icon?: Icon; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(start);
  const still = useReducedMotion();
  const turn = useSharedValue(start ? 1 : 0);
  useEffect(() => { turn.value = still ? (open ? 1 : 0) : withSpring(open ? 1 : 0, spring.snappy); }, [open, still]);
  const chev = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <View style={st.card}>
      <Tap onPress={() => setOpen(!open)} scale={0.99} feedback="none" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {icon && <IconBox icon={icon} size={36} />}
        <T v="h3" style={{ flex: 1 }}>{title}</T>
        <Animated.View style={chev}><Ionicons name="chevron-down" size={18} color={c.muted} /></Animated.View>
      </Tap>
      {/* The height springs open and closed (motion.tsx Collapsible); the content mounts on first open. */}
      <Collapsible open={open} style={{ paddingTop: 14, gap: 12 }}>{children}</Collapsible>
    </View>
  );
}

// `loading` swaps the icon for a spinner and ignores taps; `success` draws a tick in its place (set it for a moment
// after a save, then clear it). The label stays, so the button never changes width.
export function Button({ title, onPress, kind = 'primary', icon, style, disabled, loading, success }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>; disabled?: boolean;
  loading?: boolean; success?: boolean;
}) {
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? c.dangerBg : c.card2;
  const fg = kind === 'primary' ? c.accentInk : kind === 'danger' ? c.danger : c.text;
  const busy = loading || success;
  return (
    <Tap onPress={busy ? undefined : onPress} disabled={disabled} feedback={busy ? 'none' : 'medium'} scale={0.96}
      accessibilityLabel={title} accessibilityState={{ busy: !!loading }}
      style={[st.btn, { backgroundColor: bg }, kind === 'primary' && !disabled && shadow(1), style]}>
      {success ? <Tick on size={20} color={fg} />
        : loading ? <ActivityIndicator size="small" color={fg} />
        : icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: f.bold, fontSize: 16, color: fg, flexShrink: 1 }}>{title}</Text>
    </Tap>
  );
}

export function Chip({ label, icon, on, onPress, color = c.accent }: {
  label: string; icon?: keyof typeof Ionicons.glyphMap; on?: boolean; onPress?: () => void; color?: string;
}) {
  const fg = on ? c.accentInk : c.text;
  // The selected fill fades in over the chip (no colour jump), and the chip settles with a small spring.
  const still = useReducedMotion();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = still ? (on ? 1 : 0) : withSpring(on ? 1 : 0, spring.snappy); }, [on, still]);
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, p.value)) }));
  return (
    <Tap onPress={onPress} scale={0.94} style={st.chip} accessibilityState={onPress ? { selected: !!on } : undefined}>
      <Animated.View pointerEvents="none" style={[st.chipOn, { backgroundColor: color }, fill]} />
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
  const pulse = useSharedValue(1);
  const was = useRef<number | null>(null); // the last value shown; null before the first one (no pulse on load)
  const still = useReducedMotion();
  useEffect(() => {
    const to = Math.min(1, Math.max(0, progress || 0));
    // Springs to its value (no overshoot past the ends). Closing the ring after it was open pulses it once.
    p.value = still ? to : withSpring(to, { ...spring.gentle, overshootClamping: to >= 1 || to <= 0 });
    if (!still && to >= 1 && was.current !== null && was.current < 1) pulse.value = withDelay(260, withSequence(withTiming(1.06, { duration: 160 }), withSpring(1, spring.bouncy)));
    was.current = to;
  }, [progress, still]);
  const beat = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  // At zero the round cap would still paint a dot, so the arc hides until there is something to show.
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value), strokeOpacity: p.value > 0.002 ? 1 : 0 }));
  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, beat]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2} cy={size / 2} r={rad} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={len} animatedProps={props} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </Animated.View>
  );
}

const VIDEOS: Record<string, { url: string; author: string }> = videos;
const KINDS: { k: MediaPref; label: string }[] = [{ k: 'animated', label: 'Animated' }, { k: 'drawing', label: 'Drawing' }, { k: 'photo', label: 'Photo' }, { k: 'video', label: 'Video' }];
// A borrowed animation of a different movement is never offered; those exercises show their photo or drawing.
export const mediaKinds = (ex: Exercise) =>
  KINDS.filter(({ k }) => (k === 'animated' ? !ex.noImages && !poseFor(ex).pose.weak : k === 'drawing' ? !!ex.art && ex.art in ART : k === 'photo' ? !(ex.noPhoto || ex.noImages) : !!VIDEOS[ex.id]));
const CREDIT = { drawing: 'Drawing: workout-guide by Bryl Lim, CC BY-SA 4.0, based on Everkinetic', photo: 'Photo: free-exercise-db, public domain' };
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const NAME: Record<MediaPref, string> = { animated: 'Animation', drawing: 'Drawing', photo: 'Photo', video: 'Video' };

// Pictures and videos that failed (usually no internet) wait here. One shared check asks the media host every 5 s, and
// when the app comes back to the front, whether it answers; any answer means we are online, and every waiting picture
// reloads in place, so nobody has to leave the page and come back.
const waiters = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
const ping = () => fetch(`${MEDIA}?t=${Date.now()}`, { method: 'HEAD' }).then(() => { const ws = [...waiters]; waiters.clear(); stop(); ws.forEach((w) => w()); }, () => {});
AppState.addEventListener('change', (st) => { if (st === 'active' && waiters.size) ping(); });
function useBackOnline(waiting: boolean, retry: () => void) {
  useEffect(() => {
    if (!waiting) return;
    waiters.add(retry);
    timer ??= setInterval(ping, 5000);
    return () => { waiters.delete(retry); if (!waiters.size) stop(); };
  }, [waiting]);
}

// Animated figure, drawing (workout-guide), photo (free-exercise-db) or video (wger), with a switch in the corner.
// The pick is remembered for every exercise. If a picture or video can't load, the pane quietly falls back to the
// next kind (usually the animated figure, which needs no network) and says so; a failure never blanks the pane.
// `paused` stops the animated figure (the screen passes it when the pane is scrolled out of view).
export function Demo({ ex, height = 240, style, credit, paused }: { ex: Exercise; height?: number; style?: StyleProp<ViewStyle>; credit?: boolean; paused?: boolean }) {
  const pref = useStore((s) => s.mediaPref);
  const setPref = useStore((s) => s.setMediaPref);
  const [w, setW] = useState(0);
  const [failed, setFailed] = useState<MediaPref[]>([]);
  const [prev, setPrev] = useState<MediaPref | null>(null); // stays under the new pick while it fades in
  const [online, setOnline] = useState(false); // "Needs internet" hint, shown for a moment on photo, drawing or video
  const [tries, setTries] = useState(0); // bumps to reload pictures once the internet is back
  useEffect(() => setFailed([]), [ex.id]);
  useBackOnline(failed.length > 0, () => { setFailed([]); setTries((t) => t + 1); });
  useEffect(() => { if (!prev) return; const t = setTimeout(() => setPrev(null), 250); return () => clearTimeout(t); }, [prev]);
  useEffect(() => {
    if (pref === 'animated' || pref === 'drawing') return; // both are inside the app
    setOnline(true);
    const t = setTimeout(() => setOnline(false), 3500);
    return () => clearTimeout(t);
  }, [pref, ex.id]);
  if (ex.noImages) return <Breath ex={ex} height={height} style={style} />;
  const all = mediaKinds(ex);
  const kinds = all.filter((m) => !failed.includes(m.k));
  const kind = kinds.find((m) => m.k === pref)?.k ?? kinds[0]?.k;
  const missed = pref !== kind && failed.includes(pref) ? pref : null;
  const shown = prev && prev !== kind && kinds.some((m) => m.k === prev) ? [prev, kind] : [kind];
  const fail = (k: MediaPref) => setFailed((f) => (f.includes(k) ? f : [...f, k]));
  const { pose, matched } = poseFor(ex);
  return (
    <View style={style}>
      {/* The media switch sits above the pane, so its labels never cover the animation or photo. */}
      {/* Every kind stays in the switch, even one that failed offline; tapping it tries again. */}
      {all.length > 1 && (
        <View style={md.switch}>
          {all.map(({ k, label }) => (
            <Pressable key={k} hitSlop={6} accessibilityRole="button" accessibilityState={{ selected: k === kind }}
              onPress={() => {
                if (k === kind) return;
                haptic();
                if (failed.includes(k)) { setFailed((f) => f.filter((x) => x !== k)); setTries((t) => t + 1); }
                else if (kind) setPrev(kind);
                setPref(k);
              }}
              style={[md.opt, k === kind && { backgroundColor: c.accent }]}>
              {k !== 'animated' && k !== 'drawing' && <Ionicons name={failed.includes(k) ? 'cloud-offline-outline' : 'cloud-outline'} size={12} color={k === kind ? c.accentInk : c.muted} />}
              <T v="small" color={k === kind ? c.accentInk : failed.includes(k) ? c.muted : c.text}>{label}</T>
            </Pressable>
          ))}
        </View>
      )}
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
        style={{ height, borderRadius: r.lg, backgroundColor: c.card2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line }}>
        {!kind ? (
          <View style={{ alignItems: 'center', gap: 8, padding: 24 }}>
            <Ionicons name="cloud-offline-outline" size={40} color={c.muted} />
            <T v="small" style={{ textAlign: 'center' }}>No internet. The photo loads here by itself once you are back online.</T>
          </View>
        ) : shown.map((k) => (
          <Animated.View key={ex.id + k + tries} entering={k === kind && shown.length > 1 ? FadeIn.duration(200).easing(EASE) : undefined} style={StyleSheet.absoluteFill}>
            {k === 'animated' ? (
              // The figure is drawn at exactly the pane's measured size, top-left anchored; the SVG viewBox centres the
              // body inside it, so nothing depends on flex centring (which shifted it right on some Android phones).
              <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card2 }]}>
                {w > 0 && (
                  <View style={{ position: 'absolute', left: 0, top: 8, width: w, height: height - 16 }}>
                    <Figure pose={pose} primary={ex.primary} secondary={ex.secondary} height={height - 16} width={w} paused={paused} />
                  </View>
                )}
              </View>
            ) : k === 'video' ? <Clip id={ex.id} onFail={() => fail('video')} />
              : k === 'drawing' ? <Drawing slug={ex.art!} />
              : <Loop uris={frames(ex.id)} solid onFail={() => fail(k)} />}
          </Animated.View>
        ))}
        {online && kind && kind !== 'animated' && kind !== 'drawing' && (
          <Animated.View entering={FadeIn.duration(200)} style={md.hint}>
            <Ionicons name="cloud-outline" size={14} color={c.text} />
            <T v="small" color={c.text}>Needs internet once · then saved on your phone</T>
          </Animated.View>
        )}
        {missed && kind && (
          <View style={md.note}><T v="small" color={c.text}>{`${NAME[missed]} didn’t load, so here’s the ${NAME[kind].toLowerCase()}. It switches back by itself once you’re online.`}</T></View>
        )}
      </View>
      {credit && kind && (
        <T v="small" color={c.dim} style={{ marginTop: 8, textAlign: 'center' }}>
          {kind === 'animated'
            ? `${matched ? 'Movement pattern · ' : ''}Blue: keep straight · Arc: joint angle · Grey: balance`
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

// Line drawings (workout-guide, CC BY-SA 4.0) are inside the app: src/data/art, built by scripts/art.mjs. Each frame is
// one filled outline traced from a bitmap, so it has no stroke width to set. It is filled in the text colour (white on
// the dark theme, near-black on the light one) and stroked in the pane colour by the frame's knock-out width `k`, which
// trims heavy outlines down so every drawing has the same line weight. Small thumbnails skip the trim and get a hairline
// of the text colour instead, so the lines stay readable at 40 px.
function ArtSvg({ art, i, size, small }: { art: Art; i: number; size: number | `${number}%`; small?: boolean }) {
  const [x, y, side] = art.b;
  const px = typeof size === 'number' ? size : 216;
  const k = art.k[i]; // > 0: trim a heavy outline with the pane colour; < 0: thicken a faint one with the line colour
  const edge = small ? { stroke: c.text, strokeWidth: Math.max(0, (0.9 * side) / px - 3) } : { stroke: k < 0 ? c.text : c.card2, strokeWidth: Math.abs(k) };
  return (
    // viewBox origin 0,0 and a translate, as in figure.tsx (react-native-svg misplaces a non-zero origin on phones)
    <Svg width={size} height={size} viewBox={`0 0 ${side} ${side}`} preserveAspectRatio="xMidYMid meet">
      <ArtG transform={`translate(${-x} ${-y})`}>
        <ArtPath d={art.d[i]} fill={c.text} fillRule="evenodd" strokeLinejoin="round" {...edge} />
      </ArtG>
    </Svg>
  );
}
// The poses played 1→2→3→2→1 like the photos: each held 700 ms, 450 ms crossfades, every frame on its own opaque
// pane so the outlines never stack up mid-blend.
function Drawing({ slug }: { slug: string }) {
  const art = ART[slug]();
  const p = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(p); p.value = 0;
    const fade = (v: number) => withTiming(v, { duration: 450, easing: Easing.inOut(Easing.quad) });
    const hold = (v: number) => withTiming(v, { duration: 700 });
    const n = art.d.length; // usually 3; a frame the source got wrong is left out by scripts/art.mjs
    if (n < 2) return;
    p.value = withRepeat(withSequence(hold(0), ...(n > 2 ? [1, 2, 1, 0] : [1, 0]).flatMap((v) => [fade(v), hold(v)]).slice(0, -1)), -1);
    return () => cancelAnimation(p);
  }, [slug]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card2 }]}>
      {art.d.map((_, i) => <ArtFrame key={i} art={art} i={i} p={p} />)}
    </View>
  );
}
function ArtFrame({ art, i, p }: { art: Art; i: number; p: SharedValue<number> }) {
  const a = useAnimatedStyle(() => ({ opacity: i === 0 ? 1 : Math.min(1, Math.max(0, p.value - i + 1)) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.card2, padding: 12 }, a]} pointerEvents="none">
      <ArtSvg art={art} i={i} size="100%" />
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
  switch: { flexDirection: 'row', gap: 4, padding: 4, marginBottom: 10, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  opt: { flex: 1, height: 34, borderRadius: 10, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(10,10,11,0.75)' },
  note: { position: 'absolute', left: 10, bottom: 10, right: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(10,10,11,0.72)' },
});

// List thumbnails: first drawing or photo frame; an icon if neither loads, so a bad network never leaves holes.
export function Thumb({ ex, size = 56 }: { ex: Exercise; size?: number }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [ex.id]);
  useBackOnline(bad, () => setBad(false));
  if (ex.noImages)
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: tint(dom.sleep), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pulse" size={size * 0.45} color={dom.sleep} />
      </View>
    );
  if ((bad && !(ex.art && ex.art in ART)) || (!(ex.art && ex.art in ART) && ex.noPhoto))
    return (
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="barbell-outline" size={size * 0.45} color={c.muted} />
      </View>
    );
  return ex.art && ex.art in ART
    ? <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' }}><ArtSvg art={ART[ex.art]()} i={0} size={size - 6} small /></View>
    : <Pic uri={frames(ex.id)[0]} onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.media }} contentFit="cover" cachePolicy="disk" transition={150} />;
}

// Drills without a figure (pelvic floor, breathing, eyes, desk): a breathing circle in the app's accent with the reps
// counting down in the middle. Nothing runs until the user taps play; pause freezes the circle and the countdown
// together (one clock, so there are never two timers drifting apart); after the last rep it stops on "Set done"
// with a button to go again.
export function Breath({ ex, height, style, reps = 10 }: { ex: Exercise; height: number; style?: StyleProp<ViewStyle>; reps?: number }) {
  const { hold, rest } = ex.timed ?? { hold: 4, rest: 4 };
  const s = useSharedValue(0.6);
  const [run, setRun] = useState(false);
  const [k, setK] = useState(0); // reps finished
  const [ph, setPh] = useState<'in' | 'out'>('in');
  const [left, setLeft] = useState(hold); // seconds left in this phase
  const end = useRef(0); // when this phase ends, while running
  const animate = (p: 'in' | 'out', ms: number) => { s.value = withTiming(p === 'in' ? 1 : 0.6, { duration: ms, easing: Easing.inOut(Easing.sin) }); };
  const reset = () => { setRun(false); cancelAnimation(s); s.value = withTiming(0.6, { duration: 300 }); setK(0); setPh('in'); setLeft(hold); };
  useEffect(() => { reset(); return () => cancelAnimation(s); }, [ex.id, hold, rest]);
  const done = k >= reps;
  const play = () => {
    if (done) { setK(0); setPh('in'); setLeft(hold); end.current = Date.now() + hold * 1000; animate('in', hold * 1000); }
    else { end.current = Date.now() + left * 1000; animate(ph, left * 1000); }
    setRun(true); haptic('medium');
  };
  const pause = () => { setRun(false); cancelAnimation(s); setLeft(Math.max(0.2, (end.current - Date.now()) / 1000)); haptic('medium'); };
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => {
      const rem = (end.current - Date.now()) / 1000;
      if (rem > 0) { setLeft(rem); return; }
      if (ph === 'in') { setPh('out'); setLeft(rest); end.current = Date.now() + rest * 1000; animate('out', rest * 1000); haptic(); return; }
      const n = k + 1;
      setK(n); setPh('in'); setLeft(hold);
      if (n >= reps) { setRun(false); haptic('success'); return; }
      end.current = Date.now() + hold * 1000; animate('in', hold * 1000); haptic();
    }, 200);
    return () => clearInterval(t);
  }, [run, ph, k]);
  const outer = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ scale: 0.55 + (s.value - 0.6) * 0.8 }] }));
  const pelvic = ex.category === 'pelvic floor', breathing = ex.category === 'breathing';
  const word = ph === 'in' ? (pelvic ? 'Squeeze' : breathing ? 'Breathe in' : 'Hold') : pelvic ? 'Release' : breathing ? 'Breathe out' : 'Rest';
  const D = Math.min(height * 0.62, 220);
  return (
    <View style={[{ height, borderRadius: r.lg, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Animated.View style={[{ position: 'absolute', width: D, height: D, borderRadius: D, backgroundColor: c.accent + '18' }, outer]} />
      <Animated.View style={[{ position: 'absolute', width: D, height: D, borderRadius: D, backgroundColor: c.accent + '30' }, inner]} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: f.display, fontSize: 48, lineHeight: 54, color: c.text }}>{done ? '✓' : reps - k}</Text>
        <T v="small" color={c.text}>{done ? 'Set done' : run ? `${word} · ${Math.ceil(left)}s` : k ? 'Paused' : `${reps} reps`}</T>
      </View>
      <T v="small" style={{ position: 'absolute', top: 12, left: 14 }}>{`${pelvic ? 'Squeeze' : breathing ? 'In' : 'Hold'} ${hold}s · ${pelvic ? 'release' : breathing ? 'out' : 'rest'} ${rest}s`}</T>
      <View style={{ position: 'absolute', left: 14, bottom: 18, flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: reps }, (_, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i < k ? c.accent : c.line }} />)}
      </View>
      <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 }}>
        {(k > 0 || run) && !done && (
          <Tap onPress={reset} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="refresh" size={18} color={c.text} />
          </Tap>
        )}
        <Tap onPress={run ? pause : play} feedback="none" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={run ? 'pause' : done ? 'refresh' : 'play'} size={20} color={c.accentInk} />
        </Tap>
      </View>
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
  // Tap the number to type it; +/- still nudge. A typed value is kept only if it is a real number at or above min.
  const [txt, setTxt] = useState<string | null>(null);
  const commit = () => {
    const n = parseFloat((txt ?? '').replace(',', '.'));
    if (Number.isFinite(n)) onChange(Math.max(min, +n.toFixed(2)));
    setTxt(null);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 16 : 2 }}>
      <Tap onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))} style={[st.step, big && st.stepBig]} hitSlop={big ? 0 : 6} accessibilityLabel="Less">
        <Ionicons name="remove" size={big ? 26 : 18} color={c.text} />
      </Tap>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', minWidth: big ? 120 : 34 }}>
        <TextInput value={txt ?? fmt(value)} onFocus={() => setTxt(fmt(value))} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit}
          keyboardType="decimal-pad" selectTextOnFocus maxLength={6} returnKeyType="done"
          style={{ fontFamily: big ? f.display : f.bold, fontSize: big ? 48 : 17, color: c.text, textAlign: 'center', padding: 0, width: big ? 120 : 52,
            borderBottomWidth: txt !== null ? 1.5 : 0, borderBottomColor: c.accent }} />
        {suffix ? <Text style={{ fontFamily: f.semi, fontSize: big ? 18 : 12, color: c.muted }}>{suffix}</Text> : null}
      </View>
      <Tap onPress={() => onChange(+(value + step).toFixed(2))} style={[st.step, big && st.stepBig]} hitSlop={big ? 0 : 6} accessibilityLabel="More">
        <Ionicons name="add" size={big ? 26 : 18} color={c.text} />
      </Tap>
    </View>
  );
}

export const Row = ({ children, style, gap = 12, ...p }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number } & Omit<ViewProps, 'style' | 'children'>) => (
  <View {...p} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const st = StyleSheet.create({
  // Cards are solid (text always sits on a known colour) and lift off the page with a soft shadow; the hairline stays
  // because on near-black a shadow cannot be seen. Rows in long lists carry no shadow (cheap to scroll).
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, ...shadow(1) },
  tile: { flex: 1, minWidth: 0, backgroundColor: c.card, borderRadius: r.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, ...shadow(1) },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1 },
  btn: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  chip: { paddingHorizontal: 16, height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  chipOn: { position: 'absolute', left: -1, right: -1, top: -1, bottom: -1, borderRadius: 20 },
  step: { width: 30, height: 34, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  stepBig: { width: 56, height: 56, borderRadius: 28 },
});
