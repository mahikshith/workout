import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, r } from './theme';

// Sheets are for actions (docs/REDESIGN.md): they spring up over a dimmed page and close by dragging down, tapping
// outside or Back. Only one is ever open. The grab handle shows they can be dragged.
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ins = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const h = useSharedValue(600); // measured sheet height
  const measured = useSharedValue(0); // 0 until the first layout of this opening: the sheet stays invisible and off-screen
  const p = useSharedValue(0); // 0 closed, 1 open
  const drag = useSharedValue(0); // px dragged down
  const still = useReducedMotion();
  const rise = () => {
    p.value = still ? withTiming(1, { duration: 1 }) : withSpring(1, { damping: 20, stiffness: 220, overshootClamping: true });
  };
  useEffect(() => {
    if (open) {
      setMounted(true);
      drag.value = 0;
      if (measured.value) rise(); // reopened while still mounted: the height is known
    } else p.value = withTiming(0, { duration: still ? 1 : 240, easing: EASE }, (done) => {
      if (done) { measured.value = 0; runOnJS(setMounted)(false); }
    });
  }, [open]);
  const onLayout = (height: number) => {
    h.value = height;
    if (!measured.value) { measured.value = 1; if (open) rise(); }
  };

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-20, 20])
    .onUpdate((e) => { drag.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (drag.value > Math.min(160, h.value * 0.3) || e.velocityY > 900) runOnJS(onClose)();
      else drag.value = withSpring(0, { damping: 20, stiffness: 260 });
    });

  const scrim = useAnimatedStyle(() => ({ opacity: p.value * Math.max(0.2, 1 - drag.value / Math.max(1, h.value)) }));
  const body = useAnimatedStyle(() => ({ opacity: measured.value, transform: [{ translateY: (1 - p.value) * (h.value + 40) + drag.value }] }));

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, s.scrim, scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        {/* Drag starts on the grab strip only, so lists inside the sheet keep scrolling normally. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav} pointerEvents="box-none">
          <Animated.View onLayout={(e) => onLayout(e.nativeEvent.layout.height)} style={[s.sheet, { paddingBottom: ins.bottom + 20 }, body]}>
            <GestureDetector gesture={pan}>
              <View style={s.grab} accessibilityLabel="Drag down to close"><View style={s.handle} /></View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { backgroundColor: c.scrim },
  kav: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%', backgroundColor: c.card, paddingHorizontal: 20, paddingTop: 0,
    borderTopLeftRadius: r.xl + 4, borderTopRightRadius: r.xl + 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line,
  },
  grab: { height: 30, marginHorizontal: -20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.handle },
});
