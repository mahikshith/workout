# Round 14: fluid UI (motion, glass, depth)

Owner's ask: calm, premium, tactile. Not confetti. The feel comes from one springy motion system, depth (glass on
floating layers, soft shadows on cards) and touch that answers at once.

Two new modules. Neither imports `ui.tsx` or `kit.tsx`, so anything may import them.

- `src/motion.tsx`: springs, durations, and the animated building blocks.
- `src/glass.tsx`: glass surfaces, floating bars, the ambient background, shadows.

## 1. API (stable: code against this)

### src/glass.tsx

```tsx
import { Glass, GlassBar, TabBarSurface, Ambient, shadow, GLASS } from '../src/glass';
```

| Export | Props | What it is |
| --- | --- | --- |
| `Glass` | `children?`, `style?`, `radius?: number` (default `r.lg`), `intensity?: number` 1-100 (default 40), `tint?: 'surface' \| 'accent' \| string` (a hex colour washes the glass with it; default `'surface'`), `border?: boolean` (default true), `highlight?: boolean` (default true), `level?: 0 \| 1 \| 2 \| 3` shadow (default 2), `blur?: boolean` (default: `GLASS.blur`), `pointerEvents?` | A floating translucent surface. The outer view takes `style` (position, size, margin) and the shadow; the inner view clips to `radius` and lays out `children` with `contentStyle?`. |
| `GlassBar` | `edge: 'top' \| 'bottom'`, `children`, `style?` (inner row style), `inset?: boolean` (default true: adds the safe-area inset on its edge as padding), `floating?: boolean` (default false; true = a pill 12 px from the sides and edge, all corners round), `absolute?: boolean` (default true) | A bar pinned to the top or bottom edge that content scrolls under. Docked: full width, hairline on the inner edge, corners rounded on the inner edge only when `edge='bottom'`. |
| `TabBarSurface` | `children`, `height?: number` (default 64, the app's `TAB_BAR_HEIGHT`), `style?` (the row inside: defaults to `flexDirection:'row'`, `alignItems:'flex-start'`, `paddingTop: 6`), `floating?: boolean` | Ready tab bar background: absolute at the bottom, full width, glass, top corners rounded 22, bottom padding `max(inset.bottom, 8)`. Total height is `height + max(inset.bottom, 8)`, the same as the old bar, so the mini bar maths (`TAB_BAR_HEIGHT`, `CENTRE_RISE`) does not change. `overflow` is visible, so a raised centre button may stick out above it. |
| `Ambient` | `colors?: [string, string?, string?]` (default accent, training teal, sleep indigo), `strength?: number` (default 1), `style?` | Static soft colour glows behind a screen (absolute fill, `pointerEvents="none"`). `Screen` in ui.tsx already draws one; add it by hand only on screens with their own root view, as the first child. |
| `shadow(level)` | `0 \| 1 \| 2 \| 3` | Style object for soft depth: 1 = cards, 2 = floating bars, 3 = sheets and menus. Use it inline or in a StyleSheet. |
| `GLASS` | `{ blur: boolean }` | `blur` is true on web and iOS, false on Android (see section 5). One switch for a device trial. |
| `TAB_SURFACE_RADIUS` | `22` | Top corner radius of `TabBarSurface`. |

Tab bar usage (lead):

```tsx
function Bar({ state, navigation }: BottomTabBarProps) {
  return (
    <TabBarSurface>            {/* absolute, glass, safe-area padded; children are laid out in a row */}
      {item(0)}{item(1)}<Centre />{item(2)}{item(3)}
    </TabBarSurface>
  );
}
```

Notes for the tab bar:
- The surface is absolute, so scenes run to the bottom of the screen and scroll under it. `Screen` already pads the
  bottom by `inset + 120`; a screen with its own list must pad `TAB_BAR_HEIGHT + inset.bottom + 16` itself.
- The centre circle used a 4 px ring in `c.bar` to cut it out of the old bar. On glass, drop that ring (or use
  `c.glassLine`) and give the circle `shadow(2)`.
- For the selected-tab pill use `<Animated.View>` with `spring.snappy`, or the `Pop` helper below.

### src/motion.tsx

```tsx
import { spring, dur, ease, Enter, PressableScale, Swap, Collapsible, ProgressBar, Skeleton, Tick, Pulse, Pop,
  AnimatedNumber, useStill, usePressStyle, useScrollY } from '../src/motion';
```

| Export | Props / shape | What it does |
| --- | --- | --- |
| `spring` | `{ snappy, gentle, bouncy, press, sheet }` | Spring configs for `withSpring` (table in section 3). |
| `dur` | `{ fast: 120, base: 200, slow: 320, fill: 700, count: 600 }` | Durations in ms for the few timed animations. |
| `ease` | `{ out, inOut, move, fill, pop }` | Easings. `move` = cubic-bezier(.32,.72,0,1), `fill` = (.23,1,.32,1), `pop` = (.34,1.56,.64,1). |
| `useStill()` | `boolean` | Reduced motion is on. Every component below already honours it. |
| `Enter` | `i?: number` (stagger index, 50 ms each, capped at 8), `from?: 'bottom' \| 'top' \| 'left' \| 'right' \| 'none'` (default bottom), `distance?: number` (default 14), `delay?: number`, `style?`, `children` | Rise and fade in with a gentle spring when first mounted. `Rise` in ui.tsx is now this. |
| `PressableScale` | `onPress?`, `onLongPress?`, `disabled?`, `scale?: number` (default 0.97), `dim?: number` (opacity while pressed, default 0.9), `haptic?: 'light' \| 'medium' \| 'none'`, `style?`, `hitSlop?`, accessibility props, `children` | The press: springs down, dims a little, springs back with a hint of overshoot. `Tap` in ui.tsx is built on the same hook, so prefer `Tap`. |
| `usePressStyle(scale?, dim?)` | `{ style, onPressIn, onPressOut }` | The same press feedback for a custom `Animated` pressable. |
| `Swap` | `k: string \| number` (the state's key), `children`, `style?`, `morph?: boolean` (default true: height springs to the new content) | Cross-fades from the old child to the new one when `k` changes. |
| `Collapsible` | `open: boolean`, `children`, `style?`, `lazy?: boolean` (default true: children mount on first open) | Height springs open and closed with a fade. `Fold` in ui.tsx uses it. |
| `ProgressBar` | `progress: number` 0-1, `color?`, `track?`, `height?: number` (default 6), `style?` | A bar that springs to its value. |
| `Skeleton` | `width?`, `height?: number` (default 16), `radius?: number`, `style?` | Placeholder block with a slow shimmer (1.2 s). Never a spinner. |
| `Tick` | `on: boolean`, `size?: number` (default 22), `color?`, `stroke?: number` | A check mark that draws itself when `on` turns true (and un-draws when false). |
| `Pulse` | `value: number`, `children`, `style?`, `scale?: number` (default 1.18) | Pulses its child once whenever `value` goes up (streak flame, a ring that just filled). Not on first mount. |
| `Pop` | `on: boolean`, `children`, `style?` | Springs its child in (scale 0.6 to 1, fade) while `on`, out when not. For badges and selected marks. |
| `AnimatedNumber` | `value: number`, `decimals?`, `prefix?`, `suffix?`, `style?` | Counts up to the value; a later change pops 1.12 to 1. `CountUp` in kit.tsx is the same component. |
| `useScrollY()` | `{ y: SharedValue<number>, onScroll }` | Scroll position on the UI thread for `Animated.ScrollView` (headers that fade in a hairline or title). |
| `haptic(kind?)` | `'light' \| 'medium' \| 'success' \| 'warning'` | Moved here from ui.tsx (still exported from ui.tsx). |

### Changed primitives (same names, same props, extra optional props only)

| Where | What changed | New optional props |
| --- | --- | --- |
| `ui.tsx` `Tap` | spring press with a slight dim | `onLongPress?`, `dim?` |
| `ui.tsx` `Card`, `st.card`, `st.tile`, `st.listRow` | soft shadow (`shadow(1)`), radius from tokens | |
| `ui.tsx` `Button` | press spring; loading and success states | `loading?: boolean`, `success?: boolean` |
| `ui.tsx` `Chip` | selected state cross-fades and pops | |
| `ui.tsx` `Ring` | springs to its value, pulses once when it reaches 100 % | |
| `ui.tsx` `Fold` | height springs open and closed | |
| `ui.tsx` `Rise` | is `Enter` | |
| `ui.tsx` `Screen` | draws `Ambient` behind the content | `ambient?: boolean` (default true) |
| `ui.tsx` `Tile` | progress bar springs | |
| `sheet.tsx` `Sheet` | spring with velocity, rubber band, backdrop follows the drag (blur where safe) | |
| `kit.tsx` `Header` | optional glass header | `glass?: boolean` |
| `kit.tsx` `MiniBar` | glass, springs in and out | |
| `kit.tsx` `Segmented` | pill moves on a spring | |
| `kit.tsx` `CountUp` | is `AnimatedNumber` | |
| `hint.tsx` | not touched | |

(Sections 2 to 6, tokens, rules, motion table, Android notes and the device checklist, follow below once built.)
