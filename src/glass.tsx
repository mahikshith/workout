// Glass and depth (docs/round14/fluid.md). Glass is for layers that float over content: the tab bar, the workout
// mini bar, pinned action bars, headers that content scrolls under, sheets' backdrops. Content cards stay solid, so
// text is always on a known colour. This module imports neither ui.tsx nor kit.tsx.
//
// Real blur: web and iOS. Android draws the same surface nearly opaque with the highlight and hairline, because
// expo-blur's Android blur (SDK 54: `experimentalBlurMethod="dimezisBlurView"`) redraws the whole screen into a
// bitmap on every frame and cannot draw hardware bitmaps (expo-image pictures). Set `GLASS.blur = true` before the
// app renders to try it on a device.
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useId, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { c, dom, r, SHADOWS, tint as wash } from './theme';

export const GLASS = { blur: Platform.OS !== 'android' };
export const TAB_SURFACE_RADIUS = 22;

// Soft depth. 1 cards, 2 floating bars, 3 sheets and bottom bars (cast upwards). Opaque cards on Android use the
// native elevation shadow (cheap, drawn by the render thread); translucent layers must not (an elevation shadow
// shows through glass), so they use boxShadow, which is drawn outside the shape only.
export function shadow(level: 0 | 1 | 2 | 3): ViewStyle {
  if (!level) return {};
  if (Platform.OS === 'android' && level === 1) return c.scheme === 'light' ? { elevation: 3, shadowColor: 'rgba(24,32,52,0.45)' } : {};
  return { boxShadow: SHADOWS[c.scheme][level] } as ViewStyle;
}

const hex = (s: string) => /^#[0-9a-f]{6}/i.test(s);

type GlassProps = {
  children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; intensity?: number; tint?: 'surface' | 'accent' | (string & {});
  border?: boolean; highlight?: boolean; level?: 0 | 1 | 2 | 3; blur?: boolean; pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  shape?: ViewStyle; // per-corner radii for bars (overrides `radius`)
};

// A floating translucent surface. `style` positions it and lays out the children; the children are not clipped, so
// a raised button may stand proud of the surface.
export function Glass({ children, style, radius = r.lg, intensity = 40, tint = 'surface', border = true, highlight = true, level = 2, blur = GLASS.blur, pointerEvents, shape }: GlassProps) {
  const round = shape ?? { borderRadius: radius };
  const colour = tint === 'accent' ? c.accent : tint !== 'surface' && hex(tint) ? tint : null;
  return (
    <View style={[round, shadow(level), style]} pointerEvents={pointerEvents}>
      <View style={[StyleSheet.absoluteFill, round, { overflow: 'hidden' }]} pointerEvents="none">
        {blur && (Platform.OS === 'web'
          ? <View style={[StyleSheet.absoluteFill, { backdropFilter: `blur(${Math.round(intensity * 0.5)}px) saturate(160%)` } as ViewStyle]} />
          : <BlurView intensity={intensity} tint={c.scheme === 'dark' ? 'dark' : 'light'} experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFill} />)}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? c.glassThin : c.glassFill }]} />
        {colour && <View style={[StyleSheet.absoluteFill, { backgroundColor: wash(colour, blur ? 1.1 : 0.8) }]} />}
        {highlight && <LinearGradient colors={[c.glassHi, 'transparent']} style={g.hi} />}
      </View>
      {border && <View style={[StyleSheet.absoluteFill, round, { borderWidth: StyleSheet.hairlineWidth, borderColor: colour ? colour + '66' : c.glassLine }]} pointerEvents="none" />}
      {children}
    </View>
  );
}

// A bar pinned to the top or bottom edge; content scrolls under it. Docked (default): full width, a hairline on the
// inner edge, and on the bottom edge rounded top corners. Floating: a pill 12 px in from the sides.
export function GlassBar({ edge, children, style, inset = true, floating = false, absolute = true, radius = TAB_SURFACE_RADIUS }: {
  edge: 'top' | 'bottom'; children?: ReactNode; style?: StyleProp<ViewStyle>; inset?: boolean; floating?: boolean; absolute?: boolean; radius?: number;
}) {
  const ins = useSafeAreaInsets();
  const top = edge === 'top';
  const pad = !inset ? 0 : top ? ins.top : floating ? 0 : Math.max(ins.bottom, 8);
  const place: ViewStyle = absolute
    ? { position: 'absolute', left: floating ? 12 : 0, right: floating ? 12 : 0, ...(top ? { top: floating ? ins.top + 8 : 0 } : { bottom: floating ? Math.max(ins.bottom, 8) + 4 : 0 }) }
    : {};
  const shape: ViewStyle = floating ? { borderRadius: radius }
    : top ? { borderRadius: 0 } : { borderTopLeftRadius: radius, borderTopRightRadius: radius };
  return (
    <Glass shape={shape} border={floating} level={top && !floating ? 0 : floating ? 2 : 3} highlight={!top || floating}
      style={[place, top ? { paddingTop: floating ? 0 : pad } : { paddingBottom: pad }, style]}>
      {/* Docked bars get one hairline on the edge that meets the content, not a full outline. */}
      {!floating && <View pointerEvents="none" style={[top ? g.lineBottom : g.lineTop, shape, { borderColor: c.glassLine }]} />}
      {children}
    </Glass>
  );
}

// The tab bar's background: absolute at the bottom, glass, safe-area padded. Its total height is
// `height + max(inset.bottom, 8)`, the same as the old solid bar.
export function TabBarSurface({ children, height = 64, style, floating = false }: { children?: ReactNode; height?: number; style?: StyleProp<ViewStyle>; floating?: boolean }) {
  const ins = useSafeAreaInsets();
  const bottom = floating ? 0 : Math.max(ins.bottom, 8);
  return (
    <GlassBar edge="bottom" floating={floating} style={[{ height: height + bottom, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6 }, style]}>
      {children}
    </GlassBar>
  );
}

// Soft colour glows behind a screen, so glass has something to tint and the page is not one flat grey. Static: three
// radial gradients drawn once (no blur filter, no animation), fixed while content scrolls over them.
export function Ambient({ colors, strength = 1, style }: { colors?: [string, string?, string?]; strength?: number; style?: StyleProp<ViewStyle> }) {
  const { width, height } = useWindowDimensions();
  const [a, b, d] = colors ?? [c.accent, dom.train, dom.sleep];
  const k = (c.scheme === 'light' ? 0.17 : 0.2) * strength;
  const H = Math.min(height, 900);
  const id = 'amb' + useId().replace(/[^a-z0-9]/gi, ''); // several screens are mounted at once: gradient ids must not clash on the web
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, overflow: 'hidden' }, style]}>
      <Svg width={width} height={H}>
        <Defs>
          <RadialGradient id={id + 'a'} cx={width * 0.1} cy={-10} r={width * 0.95} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={a} stopOpacity={k} /><Stop offset="0.55" stopColor={a} stopOpacity={k * 0.28} /><Stop offset="1" stopColor={a} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={id + 'b'} cx={width * 1.05} cy={H * 0.3} r={width * 0.8} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={b ?? a} stopOpacity={k * 0.7} /><Stop offset="0.6" stopColor={b ?? a} stopOpacity={k * 0.18} /><Stop offset="1" stopColor={b ?? a} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={id + 'c'} cx={width * 0.05} cy={H * 0.86} r={width * 0.85} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={d ?? a} stopOpacity={k * 0.6} /><Stop offset="0.6" stopColor={d ?? a} stopOpacity={k * 0.15} /><Stop offset="1" stopColor={d ?? a} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={H} fill={`url(#${id}a)`} />
        <Rect x={0} y={0} width={width} height={H} fill={`url(#${id}b)`} />
        <Rect x={0} y={0} width={width} height={H} fill={`url(#${id}c)`} />
      </Svg>
    </View>
  );
}

const g = StyleSheet.create({
  hi: { position: 'absolute', left: 0, right: 0, top: 0, height: 28 },
  lineTop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  lineBottom: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderBottomWidth: StyleSheet.hairlineWidth },
});
