import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { c, r } from '../src/theme';
import { Rise, Row, Screen, T, Tap } from '../src/ui';

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

export default function Etiquette() {
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tap onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        <T v="h2">Gym etiquette</T>
        <View style={{ width: 40 }} />
      </Row>
      <T v="body" color={c.muted} style={{ marginTop: 16 }}>The unwritten rules regulars follow. A few minutes here makes your first visits feel easy.</T>
      <View style={{ gap: 10, marginTop: 16 }}>
        {RULES.map((x, i) => (
          <Rise key={x.title} i={Math.min(i, 6)}>
            <Row style={s.card}>
              <View style={[s.badge, { backgroundColor: c.accent + '22' }]}><Ionicons name={x.icon} size={18} color={c.accent} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3">{x.title}</T>
                <T v="body" color={c.muted}>{x.body}</T>
              </View>
            </Row>
          </Rise>
        ))}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  card: { alignItems: 'flex-start', padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  badge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
