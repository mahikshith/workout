import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, r } from './theme';

// Sheets are for actions (docs/REDESIGN.md): they spring up over a dimmed page and close by dragging down, tapping
// outside or Back. Only one is ever open. The grab handle shows they can be dragged.
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ins = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const [h, setH] = useState(600);
  const p = useSharedValue(0); // 0 closed, 1 open
  const drag = useSharedValue(0); // px dragged down
  useEffect(() => {
    if (open) {
      setMounted(true);
      drag.value = 0;
      p.value = withSpring(1, { damping: 20, stiffness: 220, overshootClamping: true });
    } else p.value = withTiming(0, { duration: 240, easing: EASE }, (done) => { if (done) runOnJS(setMounted)(false); });
  }, [open]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-20, 20])
    .onUpdate((e) => { drag.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (drag.value > Math.min(160, h * 0.3) || e.velocityY > 900) runOnJS(onClose)();
      else drag.value = withSpring(0, { damping: 20, stiffness: 260 });
    });

  const scrim = useAnimatedStyle(() => ({ opacity: p.value * Math.max(0.2, 1 - drag.value / Math.max(1, h)) }));
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * (h + 40) + drag.value }] }));

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, s.scrim, scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={[s.sheet, { paddingBottom: ins.bottom + 20 }, body]}>
            <View style={s.handle} />
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%', backgroundColor: c.card, paddingHorizontal: 20, paddingTop: 10,
    borderTopLeftRadius: r.xl + 4, borderTopRightRadius: r.xl + 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#3A3A40', marginBottom: 14 },
});
