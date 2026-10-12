import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, r } from './theme';

// iOS-style sheet: eased slide up with a fading scrim, and the same motion in reverse on close.
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ins = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const p = useSharedValue(0);
  useEffect(() => {
    if (open) { setMounted(true); p.value = withTiming(1, { duration: 380, easing: EASE }); }
    else p.value = withTiming(0, { duration: 260, easing: EASE }, (done) => { if (done) runOnJS(setMounted)(false); });
  }, [open]);
  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * 520 }] }));
  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: ins.bottom + 20 }, body]}>{children}</Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, padding: 22,
    borderTopLeftRadius: r.xl, borderTopRightRadius: r.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line,
  },
});
