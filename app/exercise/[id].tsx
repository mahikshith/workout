import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { bestBefore } from '../../src/calc';
import { alternatives, byId, title } from '../../src/data/exercises';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Card, Demo, Rise, Row, Screen, T, Tap, Thumb } from '../../src/ui';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = byId[id];
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const active = useStore((s) => s.active);
  const startSingle = useStore((s) => s.startSingle);
  if (!ex) return null;
  const best = bestBefore(sessions, ex.id);
  const gym = alternatives(ex, 'gym', [], 3);
  const home = alternatives(ex, 'home', profile?.gear ?? [], 3);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        <T v="label">{title(ex.category)}</T>
        <View style={{ width: 40 }} />
      </Row>
      <Rise><Demo ex={ex} height={300} style={{ marginTop: 16 }} /></Rise>
      <Rise i={1}>
        <T v="h1" style={{ marginTop: 18 }}>{ex.name}</T>
        <Row style={{ flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          {[...ex.primary.map((m) => ({ m, p: true })), ...ex.secondary.map((m) => ({ m, p: false }))].map(({ m, p }) => (
            <View key={m} style={[s.tag, p && { backgroundColor: c.accent }]}>
              <T v="small" color={p ? c.accentInk : c.text}>{title(m)}</T>
            </View>
          ))}
        </Row>
        <Row style={{ marginTop: 14 }} gap={18}>
          <Meta icon="barbell-outline" text={title(ex.equipment)} />
          <Meta icon="speedometer-outline" text={title(ex.level)} />
          {ex.mechanic && <Meta icon="git-merge-outline" text={title(ex.mechanic)} />}
        </Row>
        {best.e1rm > 0 && <T v="small" color={c.accent} style={{ marginTop: 10 }}>Your best: {Math.round(best.e1rm)} kg estimated 1RM</T>}
      </Rise>

      <Rise i={2}>
        <T v="label" style={{ marginTop: 26, marginBottom: 10 }}>How to do it</T>
        <Card style={{ gap: 14 }}>
          {ex.steps.map((step, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <View style={s.num}><T v="small" color={c.accentInk}>{i + 1}</T></View>
              <T v="body" style={{ flex: 1 }}>{step}</T>
            </Row>
          ))}
        </Card>
      </Rise>

      {[{ label: 'No machine? Gym alternatives', list: gym }, { label: 'At home instead', list: home }].map(({ label, list }, k) =>
        list.length ? (
          <Rise key={label} i={3 + k}>
            <T v="label" style={{ marginTop: 26, marginBottom: 10 }}>{label}</T>
            <View style={{ gap: 8 }}>
              {list.map((a) => (
                <Tap key={a.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: a.id } })} style={s.alt} scale={0.98}>
                  <Thumb ex={a} size={52} />
                  <View style={{ flex: 1 }}>
                    <T v="h3">{a.name}</T>
                    <T v="small">{title(a.equipment)}</T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.muted} />
                </Tap>
              ))}
            </View>
          </Rise>
        ) : null,
      )}

      {!active && (
        <Button title="Train this now" icon="play" style={{ marginTop: 28 }}
          onPress={() => { startSingle(ex.id, profile?.place === 'home' ? 'home' : 'gym'); router.push('/session'); }} />
      )}
      <T v="small" color={c.dim} style={{ marginTop: 20, textAlign: 'center' }}>Images: free-exercise-db (public domain)</T>
    </Screen>
  );
}

const Meta = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => (
  <Row gap={6}><Ionicons name={icon} size={16} color={c.muted} /><T v="small">{text}</T></Row>
);

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: c.card2, justifyContent: 'center' },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
});
