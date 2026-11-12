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
| `Glass` | `children?`, `style?`, `radius?: number` (default `r.lg`), `intensity?: number` 1-100 (default 40), `tint?: 'surface' \| 'accent' \| string` (a hex colour washes the glass with it; default `'surface'`), `border?: boolean` (default true), `highlight?: boolean` (default true), `level?: 0 \| 1 \| 2 \| 3` shadow (default 2), `blur?: boolean` (default: `GLASS.blur`), `pointerEvents?` | A floating translucent surface. `style` positions it and lays out the children (flex direction, padding). Children are not clipped, so a raised button may stand proud of it. |
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
| `ui.tsx` `Screen` | draws `Ambient` behind the content | `ambient?: boolean` (default: on when `top` is not given; a Screen under a header leaves it to the page root) |
| `ui.tsx` `Tile` | progress bar springs | |
| `sheet.tsx` `Sheet` | spring with velocity, rubber band, backdrop follows the drag (blur where safe) | |
| `kit.tsx` `Header` | clear background; optional floating glass header | `glass?: boolean`. With it, pad the content by `useHeaderSpace()` (= top inset + `HEADER_HEIGHT` 58), both exported from kit.tsx |
| `ui.tsx` `Row` | passes other View props through (`accessible`, `accessibilityLabel`...) | |
| `kit.tsx` `MiniBar` | glass, springs in and out | |
| `kit.tsx` `Segmented` | pill moves on a spring | |
| `kit.tsx` `CountUp` | is `AnimatedNumber` | |
| `hint.tsx` | not touched | |

## 2. Tokens (src/theme.ts)

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `c.glassFill` | `rgba(24,24,28,0.94)` | `rgba(255,255,255,0.94)` | Glass with no blur behind it (Android). Nearly opaque on purpose. |
| `c.glassThin` | `rgba(24,24,28,0.72)` | `rgba(255,255,255,0.72)` | Glass over a real blur (web, iOS). |
| `c.glassLine` | `rgba(255,255,255,0.11)` | `rgba(20,24,32,0.09)` | Hairline round glass. |
| `c.glassHi` | `rgba(255,255,255,0.09)` | `rgba(255,255,255,0.80)` | Top of the 28 px highlight gradient (fades to clear). |
| `c.shade` | `rgba(0,0,0,0.55)` | `rgba(24,32,52,0.16)` | Shadow colour, for one-off shadows. |
| `SHADOWS.light/dark[0..3]` | | | Box-shadow strings; use through `shadow(level)`. |
| `r.lg` | 20 (was 16) | | Cards, tiles, the mini bar. |
| `r.xl` | 26 (was 20) | | Sheets, hero cards. |

Glass washes: `tint="accent"` or any domain colour (`dom.heart`...) lays `tint(colour)` over the fill and colours the
hairline, in every accent and both schemes, because it reads `c.accent` / `dom.*` at render time.

Contrast: text on glass is `c.text` (or `c.accent` for one short status line). On `glassFill` both schemes give more
than 12:1 for `c.text`; the light accents (deep by design) stay above 4.5:1. Over a real blur the fill is 72 %, so the
worst case (white card or bright photo under dark glass, dark figure under light glass) still keeps `c.text` above
4.5:1. Do not put `c.muted` or `c.dim` text on glass.

## 3. When to use what

- **Glass is for floating layers only**: tab bar, workout mini bar, pinned bottom action bars, a header the page
  scrolls under, a sheet's backdrop. At most three glass surfaces on screen (typically header + bottom bar + mini bar).
- **Content cards stay solid** (`Card`, `st.card`, `Tile`, `DoorCard`): text always sits on a known colour. They lift
  with `shadow(1)` and keep a hairline, because on near-black a shadow cannot be seen.
- **No glass and no `shadow()` inside long lists** (`st.listRow` has neither).
- **Sheets are solid** with a dimmed (and, where safe, blurred) backdrop: they hold forms.
- **Ambient**: one per screen, behind everything, never animated. Tabs get it from `Screen`. A pushed screen with a
  header puts `<Ambient />` first in its root view.
- **Pinned bottom bar** on a pushed screen:
  `<GlassBar edge="bottom" inset={false} style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: ins.bottom + 12 + mini }}>`.
- **Glass header**: `<Header title="You" glass />` and `paddingTop: useHeaderSpace() + 8` on the scroll content.
- Motion: pick a preset from `spring`; never write stiffness/damping in a screen. Only the things in the table below
  move. Nothing loops except `Skeleton` and the exercise demos.

## 4. Motion table (replaces the table in docs/REDESIGN.md section 3 where they differ)

| Element | Animation | Spring / timing |
| --- | --- | --- |
| Press (`Tap`, `Button`, chips, rows) | scale to 0.97 (buttons 0.96, chips 0.94) and dim to 90 %, back with a hair of overshoot | down 90 ms ease-out; up `spring.press` (520 / 24 / mass 0.8) |
| Content arriving (`Enter`, `Rise`) | rise 14 px and fade | `spring.gentle` (170 / 22), 50 ms stagger, capped at 8 |
| Push a place | slides in from the right, the screen under shifts back (`ios_from_right`) | native, about 200 to 300 ms |
| Open a detail (exercise, plan, challenge, chart) | rises 8 % and fades in (`fade_from_bottom`) | native, 350 ms decelerate |
| Workout | slides up from the bottom (`slide_from_bottom`) | native |
| Setup, Summary | fade | native |
| Tab switch | cross-fade + 4 px rise (lead's tab layout) | 200 ms ease-out |
| Sheet open | rides up, about 1.5 % overshoot (the sheet runs 40 px below the edge, so no gap shows) | `spring.sheet` (260 / 26) |
| Sheet drag | follows the finger; pulled up it rubber-bands (18 %); backdrop dim and blur follow | UI thread |
| Sheet close | flick (over 900 px/s) or past 30 % / 160 px; carries the finger's speed | spring 320 / 32, clamped |
| Mini bar | springs up in, fades down out | `spring.sheet` in, 200 ms out |
| Segmented pill, chip fill, Fold chevron | slide / cross-fade / turn | `spring.snappy` (420 / 32) |
| Fold, `Collapsible`, `Swap` | height springs, content fades | `spring.gentle`, clamped |
| Ring, `ProgressBar`, Tile bar | spring to the value, no overshoot at the ends | `spring.gentle` |
| Ring reaches 100 % (after being open) | one pulse 1 to 1.06 to 1 | 160 ms then `spring.bouncy` (260 / 17) |
| Numbers (`AnimatedNumber`, `CountUp`) | count up; a later change pops 1.12 to 1 | 600 ms ease-out; `spring.bouncy` |
| `Tick` | the check draws itself | 260 ms, cubic-bezier(.23,1,.32,1) |
| `Pulse` (streak flame) | once when the value goes up: 1 to 1.18 to 1 | 140 ms then `spring.bouncy` |
| `Skeleton` | opacity 1 to 0.45 and back | 1.2 s loop |
| Button `loading` / `success` | icon swaps for spinner / drawn tick; width never changes | |

Reduced motion: every item above jumps to its end state (press keeps the dim, loses the scale).
Only `transform` and `opacity` move, except `Collapsible`/`Swap`/`Fold` (height, one view, short) and SVG dash offsets.

Micro-delight that exists now: tick draw (`Tick`, `Button success`), ring pulse on close, number pop, chip settle,
press spring, haptics as before. No sound, no confetti added. For the lead: wrap the streak flame in
`<Pulse value={streak}>` and use `<Tick on />` where a set or a log row turns done.

## 5. Android notes

- **Blur is off on Android** (`GLASS.blur = false`). expo-blur 15 (SDK 54) only blurs on Android with
  `experimentalBlurMethod="dimezisBlurView"` (Dimezis BlurView 2.0.6): it redraws the screen's view tree into a
  software bitmap on every frame, is documented as experimental with performance and graphical issues, and cannot
  draw hardware bitmaps (expo-image). So Android glass is a 94 % fill + highlight + hairline + soft shadow over the
  ambient glows. To trial real blur on a device: set `GLASS.blur = true` at the top of `app/_layout.tsx`, keep it to
  the tab bar and mini bar, and watch scrolling on Home and the exercise page.
- **Shadows**: opaque cards use native `elevation: 3` with a soft `shadowColor` (light mode only; cheap). Glass and
  sheets use `boxShadow` (RN 0.81, Android 9+), because an elevation shadow shows through a translucent view.
  A theme switched in place on a release build keeps the card shadows of the scheme the app started in until restart.
- **Ambient** is one static SVG (three radial gradients), drawn once per screen; no blur filter, no animation.
- **Height animations** (`Collapsible`, `Swap`) relayout one subtree per frame; fine for a card, do not wrap a whole
  list in them.
- **Transitions** are native fragment animations (react-native-screens 4.16): `ios_from_right` and
  `fade_from_bottom` exist on Android; `animationDuration`, `animationMatchesGesture`, `gestureDirection` are iOS
  only. The navigator theme and every `contentStyle` carry `c.bg`, so no white frame between screens.
- **Predictive back**: left off (`android.predictiveBackGestureEnabled: false` in app.json). The native stack does
  not animate screens with the gesture in this version; turning it on only adds the system back-to-home preview and
  touches Summary's and onboarding's `BackHandler`. Worth a separate device trial, not part of this round.

## 6. Check on a real phone

1. Tab bar and mini bar on Android: is the 94 % glass convincing over the ambient? Does `boxShadow` draw outside the
   shape only (no dark tint showing through the bar)?
2. Scroll Home, Library and the exercise page with the mini bar up: frame rate (cards now have elevation in light mode).
3. `ios_from_right` and `fade_from_bottom`: speed and feel; exercise to exercise hops; back from a detail page.
4. Sheet: drag from the grabber, flick down, pull up (rubber band), keyboard open inside a sheet (the sheet now runs
   40 px below the edge: check nothing is hidden behind the keyboard or nav bar), 3-button navigation.
5. Glass header on You and the exercise page: status bar icons readable in both themes; content does not ghost through.
6. Press feel on a list row while scrolling (the dim must not flash when a scroll starts).
7. Fold open/close with long text; Remove animations on (everything should jump, nothing should break).
8. Light mode card shadows at radius 20 on a low-end phone; dark mode edges (hairline only).
9. Every accent (lime, gold, ember, glacier, rose) on the mini bar: status text contrast on the washed glass.

## 7. Applied in this round

- Everywhere (through the primitives): press spring, card radius and shadow, chip, ring, fold, tile bar, sheet,
  mini bar, segmented control, count-up, ambient behind every `Screen` without a header, stack transitions.
- `app/you.tsx`: ambient, glass header.
- `app/exercise/[id].tsx`: ambient, glass header, glass action bar.
- `app/challenge/[id].tsx`: ambient, glass Join bar.
- `app/plan/[id].tsx`, `app/reminders.tsx`, `app/supplements.tsx`, `app/recovery.tsx`: ambient.
- Not touched: tabs, onboarding, summary, history, tracker, watch, library, session, profile, food.
