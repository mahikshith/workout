import { Ionicons } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, useMiniBarSpace } from '../src/kit';
import { SAFETY_POINTS } from '../src/safety';
import { c } from '../src/theme';
import { Fold, Row, T } from '../src/ui';

// Safety and disclaimer: reached from You, setup's plan step, challenges and supplements.
// Round 15: every point is kept, as short bullets under a fold; the two that matter most in the moment start open.
export default function Safety() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Safety and disclaimer" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: ins.bottom + 40 + mini, gap: 12 }} showsVerticalScrollIndicator={false}>
        {SAFETY_POINTS.map((x) => (
          <Fold key={x.title} title={x.title} icon={x.icon} open={x.open}>
            {x.points.map((t) => (
              <Row key={t} gap={8} style={{ alignItems: 'flex-start' }}>
                <T v="small" color={c.muted}>•</T>
                <T v="small" style={{ flex: 1 }}>{t}</T>
              </Row>
            ))}
          </Fold>
        ))}
        <Row gap={8} style={{ paddingHorizontal: 4 }} accessibilityRole="text">
          <Ionicons name="call-outline" size={16} color={c.danger} />
          <T v="small" color={c.text} style={{ flex: 1 }}>Emergency? Call your local emergency number.</T>
        </Row>
      </ScrollView>
    </View>
  );
}
