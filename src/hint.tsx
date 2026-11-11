// One-time hints ("teach once, then get out of the way", docs/round13/PLAN.md principle 4).
//
// A hint shows while the store's `hints[id]` count is below `max`. Each mount that shows it counts one showing
// (seeHint), so by default a hint appears on at most two visits. Tapping the close button retires it for good.
// The decision is made once per mount, so counting the showing never makes the hint vanish while it is on screen.
//
//   <Hint id="session-swipe" text="Swipe left on a set to delete it." />
//   const { show, dismiss } = useHint('today-log', 1);
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useStore } from './store';
import { c, r } from './theme';
import { T, Tap } from './ui';

export function useHint(id: string, max = 2) {
  // Read once at mount: show for this whole visit if it had been shown fewer than `max` times before it.
  const [show, setShow] = useState(() => (useStore.getState().hints?.[id] ?? 0) < max);
  const counted = useRef(false);
  useEffect(() => {
    if (show && !counted.current) {
      counted.current = true;
      useStore.getState().seeHint(id);
    }
  }, [id, show]);
  const dismiss = () => {
    setShow(false);
    // Retire it: set the count to max so it never shows again (additive write through the existing hints map).
    useStore.setState((s) => ({ hints: { ...s.hints, [id]: Math.max(max, s.hints?.[id] ?? 0) } }));
  };
  return { show, dismiss };
}

export function Hint({ id, text, max = 2, style, icon = 'bulb-outline' }: {
  id: string; text: string; max?: number; style?: StyleProp<ViewStyle>; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { show, dismiss } = useHint(id, max);
  if (!show) return null;
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}
      accessibilityRole="text" accessibilityLabel={`Tip: ${text}`}
      style={[{
        flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingVertical: 4, borderRadius: r.md,
        backgroundColor: c.accent + '1A', borderWidth: 1, borderColor: c.accent + '55',
      }, style]}>
      <Ionicons name={icon} size={18} color={c.accent} />
      <T v="small" color={c.text} style={{ flex: 1, paddingVertical: 8 }}>{text}</T>
      <Tap onPress={dismiss} feedback="none" accessibilityLabel="Got it, hide this tip"
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={18} color={c.muted} />
      </Tap>
    </Animated.View>
  );
}
