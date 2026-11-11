import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, useMiniBarSpace } from '../src/kit';
import { SAFETY_POINTS } from '../src/safety';
import { c, r } from '../src/theme';
import { IconBox, T } from '../src/ui';

// Safety and disclaimer: reached from You, setup's plan step, challenges and supplements.
export default function Safety() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Safety and disclaimer" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: ins.bottom + 40 + mini, gap: 12 }} showsVerticalScrollIndicator={false}>
        <T v="body" color={c.soft}>Gym Buddy suggests workouts, challenges and food targets to help you stay consistent. How you use them is up to you.</T>
        <View style={s.group}>
          {SAFETY_POINTS.map((x, i) => (
            <View key={x.title} style={[s.row, i > 0 && s.line]}>
              <IconBox icon={x.icon} size={32} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">{x.title}</T>
                <T v="small">{x.body}</T>
              </View>
            </View>
          ))}
        </View>
        <T v="small" color={c.muted}>In an emergency, call your local emergency number.</T>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  group: { borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
});
