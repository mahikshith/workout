import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { bestStreak, dayKey, doneSets, streak, volume } from '../src/calc';
import { byId } from '../src/data/exercises';
import { useStore } from '../src/store';
import { c, f, r } from '../src/theme';
import { Card, IconBox, ListRow, Rise, Row, Screen, Section, T, Tap, Thumb, Tile } from '../src/ui';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function History() {
  const sessions = useStore((s) => s.sessions);
  const deleteSession = useStore((s) => s.deleteSession);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [day, setDay] = useState(dayKey());
  const [confirm, setConfirm] = useState<string | null>(null);

  const byDay: Record<string, typeof sessions> = {};
  for (const s of sessions) (byDay[dayKey(s.startedAt)] ??= []).push(s);
  const lead = (month.getDay() + 6) % 7; // Monday-first grid
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const picked = byDay[day] ?? [];
  const inMonth = sessions.filter((s) => new Date(s.startedAt).getMonth() === month.getMonth() && new Date(s.startedAt).getFullYear() === month.getFullYear()).length;
  const dayTitle = new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tap onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        <T v="h2">History</T>
        <View style={{ width: 44 }} />
      </Row>

      {/* Hero: the streak. */}
      <Rise>
        <Card style={{ marginTop: 20, gap: 8 }}>
          <Row gap={16}>
            <IconBox icon="flame" color={c.warm} size={56} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: f.display, fontSize: 56, lineHeight: 62, color: c.text }}>{streak(sessions)}</T>
              <T v="small">Session streak</T>
            </View>
          </Row>
          <T v="small" color={c.dim}>Rest days are fine · 3 days off ends it</T>
        </Card>
      </Rise>

      <Rise i={1}>
        <Row gap={12} style={{ marginTop: 12 }}>
          <Tile icon="trophy" color={c.warm} value={bestStreak(sessions)} label="Best streak" />
          <Tile icon="calendar" value={inMonth} label="This month" />
          <Tile icon="barbell" value={sessions.length} label="All time" />
        </Row>
      </Rise>

      <Rise i={2}>
        <Section title="Calendar">
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Tap onPress={() => shift(-1)} style={s.nav}><Ionicons name="chevron-back" size={18} color={c.text} /></Tap>
              <T v="h3">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</T>
              <Tap onPress={() => shift(1)} style={s.nav}><Ionicons name="chevron-forward" size={18} color={c.text} /></Tap>
            </Row>
            <View style={s.grid}>
              {DOW.map((d, i) => <T key={`h${i}`} v="label" style={s.cellHead}>{d}</T>)}
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={s.cell} />;
                const k = dayKey(d), did = !!byDay[k], on = k === day, today = k === dayKey();
                return (
                  <Tap key={k} onPress={() => setDay(k)} style={s.cell} scale={0.9} feedback="none">
                    <View style={[s.dayDot, did && { backgroundColor: c.accent }, on && { borderColor: c.text, borderWidth: 1.5 }, today && !did && { backgroundColor: c.card2 }]}>
                      <T v="small" color={did ? c.accentInk : d.getTime() > Date.now() ? c.dim : c.text}>{d.getDate()}</T>
                    </View>
                  </Tap>
                );
              })}
            </View>
          </Card>
        </Section>
      </Rise>

      <Section title={dayTitle}>
        {picked.length === 0 && <ListRow icon="bed-outline" color={c.muted} title="Rest day" sub="No workout logged" />}
        <View style={{ gap: 12 }}>
          {picked.map((ss) => (
            <Animated.View key={ss.id} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(250)}>
              <Card style={{ gap: 12 }}>
                <Row gap={12}>
                  <IconBox icon={ss.place === 'home' ? 'home' : 'barbell'} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3" numberOfLines={1}>{ss.title}</T>
                    <T v="small" numberOfLines={1}>{doneSets(ss)} sets · {Math.round(volume(ss))} kg · {Math.max(1, Math.round(((ss.endedAt ?? ss.startedAt) - ss.startedAt) / 60000))} min</T>
                  </View>
                  <Tap onPress={() => (confirm === ss.id ? deleteSession(ss.id) : setConfirm(ss.id))} style={[s.nav, confirm === ss.id && { backgroundColor: '#2A1210' }]}>
                    <Ionicons name="trash-outline" size={18} color={confirm === ss.id ? c.danger : c.muted} />
                  </Tap>
                </Row>
                {confirm === ss.id && <T v="small" color={c.danger}>Tap the bin again to delete</T>}
                {ss.items.map((it) => (
                  <Row key={it.exId} gap={12}>
                    <Thumb ex={byId[it.exId]} size={36} />
                    <T v="body" style={{ flex: 1 }} numberOfLines={1}>{byId[it.exId]?.name}</T>
                    <T v="small">{it.sets.map((x) => (x.weight ? `${x.weight}×${x.reps}` : x.reps)).join('  ')}</T>
                  </Row>
                ))}
              </Card>
            </Animated.View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const s = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  nav: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  cellHead: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 34, height: 34, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center' },
});
