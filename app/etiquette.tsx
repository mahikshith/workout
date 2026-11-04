import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASE, Header } from '../src/kit';
import { c, r } from '../src/theme';
import { IconBox, T, Tap } from '../src/ui';

// Plain gym manners: what regulars expect, so a first visit feels less awkward.
const RULES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'hourglass', title: 'Be patient for equipment', body: 'If someone is using what you need, ask how many sets they have left, or work on something else and come back.' },
  { icon: 'people', title: 'Share between sets', body: 'Offer to "work in" on a machine or bench: you alternate sets while they rest. Most people say yes.' },
  { icon: 'phone-portrait', title: "Don't camp on a machine", body: 'Scroll your phone between sets somewhere else, not sitting on a machine others are waiting for.' },
  { icon: 'repeat', title: 'Put weights back', body: 'Re-rack plates and dumbbells where you found them. Nobody likes stripping your bar.' },
  { icon: 'water', title: 'Wipe down after use', body: 'Wipe benches, seats and handles with the spray and towel provided, especially where you sweated.' },
  { icon: 'resize', title: 'Respect personal space', body: 'Leave room around people lifting, and never walk right in front of the mirror someone is using to check their form.' },
  { icon: 'chatbubbles', title: 'Ask before helping', body: 'Offer a spot or a tip only if someone looks stuck or asks. "Want a spot?" is always welcome.' },
  { icon: 'volume-low', title: 'Keep the noise down', body: 'A grunt on a heavy rep is fine. Dropping weights, shouting and loud phone calls are not.' },
  { icon: 'camera', title: 'Film only yourself', body: "Make sure strangers aren't in your videos or photos without asking them first." },
  { icon: 'shirt', title: 'Come clean and ready', body: 'Fresh clothes, deodorant, closed shoes and a small towel. Your future gym friends thank you.' },
  { icon: 'heart', title: 'Be kind to beginners', body: 'Everyone was new once. A smile or a nod makes someone come back tomorrow.' },
];

// One grouped list of short titles; tap a rule to read the one-line why.
export default function Etiquette() {
  const ins = useSafeAreaInsets();
  const still = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Gym etiquette" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: ins.bottom + 40, gap: 12 }} showsVerticalScrollIndicator={false}>
        <T v="small">The unwritten rules regulars follow</T>
        <Animated.View entering={still ? undefined : FadeInDown.duration(380).easing(EASE)} style={s.group}>
          {RULES.map((x, i) => {
            const on = open === x.title;
            return (
              <Animated.View key={x.title} layout={still ? undefined : LinearTransition.duration(260).easing(EASE)} style={i > 0 && s.rule}>
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
              </Animated.View>
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
