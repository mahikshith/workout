import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASE, Header, useMiniBarSpace } from '../src/kit';
import { c, r } from '../src/theme';
import { IconBox, T, Tap } from '../src/ui';

// Plain gym manners: what regulars expect, so a first visit feels less awkward.
const RULES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'hourglass', title: 'Be patient for equipment', body: 'Ask how many sets are left, or train something else and come back.' },
  { icon: 'people', title: 'Share between sets', body: 'Ask to "work in": you swap sets while they rest. Most say yes.' },
  { icon: 'phone-portrait', title: "Don't camp on a machine", body: 'Scroll your phone away from a machine others are waiting for.' },
  { icon: 'repeat', title: 'Put weights back', body: 'Re-rack plates and dumbbells where you found them.' },
  { icon: 'water', title: 'Wipe down after use', body: 'Spray and wipe benches, seats and handles, especially where you sweated.' },
  { icon: 'resize', title: 'Respect personal space', body: "Leave room around lifters, and don't block the mirror someone is using." },
  { icon: 'chatbubbles', title: 'Ask before helping', body: 'Help only if someone looks stuck or asks. "Want a spot?" is always welcome.' },
  { icon: 'volume-low', title: 'Keep the noise down', body: 'A grunt on a heavy rep is fine. Dropping weights, shouting and loud calls are not.' },
  { icon: 'camera', title: 'Film only yourself', body: "Keep strangers out of your photos and videos unless they agree." },
  { icon: 'shirt', title: 'Come clean and ready', body: 'Fresh clothes, deodorant, closed shoes and a small towel.' },
  { icon: 'heart', title: 'Be kind to beginners', body: 'Everyone was new once. A smile or nod goes a long way.' },
];

// One grouped list of short titles; tap a rule to read the one-line why. Round 15: no line under the header.
export default function Etiquette() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const still = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Gym etiquette" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: ins.bottom + 40 + mini, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={still ? undefined : FadeInDown.duration(380).easing(EASE)} style={s.group}>
          {RULES.map((x, i) => {
            const on = open === x.title;
            return (
              <View key={x.title} style={i > 0 && s.rule}>
                <Tap onPress={() => setOpen(on ? null : x.title)} scale={0.99} style={s.row}>
                  <IconBox icon={x.icon} size={32} />
                  <T v="body" style={{ flex: 1 }}>{x.title}</T>
                  <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={16} color={c.dim} />
                </Tap>
                {on && (
                  <Animated.View entering={still ? undefined : FadeIn.duration(200)} style={s.body}>
                    <T v="small">{x.body}</T>
                  </Animated.View>
                )}
              </View>
            );
          })}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  group: { borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 },
  rule: { borderTopWidth: 1, borderTopColor: c.card2 },
  body: { paddingLeft: 58, paddingRight: 14, paddingBottom: 14, marginTop: -4 },
});
