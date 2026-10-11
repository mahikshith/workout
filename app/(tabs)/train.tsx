import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ranked } from '../../src/coach';
import { title } from '../../src/data/exercises';
import { planById } from '../../src/data/plans';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { Chip, Rise, Row, Screen, T, Tap } from '../../src/ui';

const BODY = [
  { m: 'chest', e: '🫁' }, { m: 'shoulders', e: '🤷' }, { m: 'lats', e: '🦅' }, { m: 'biceps', e: '💪' },
  { m: 'triceps', e: '🔱' }, { m: 'abdominals', e: '🧱' }, { m: 'glutes', e: '🍑' }, { m: 'quadriceps', e: '🦵' },
  { m: 'hamstrings', e: '🏃' }, { m: 'calves', e: '🦶' }, { m: 'lower back', e: '🧘' }, { m: 'pelvic floor', e: '🌸' },
];

export default function Train() {
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const [where, setWhere] = useState<'all' | 'gym' | 'home'>('all');
  if (!profile) return null;
  const current = planById[planId];
  const list = ranked(profile).filter((p) => p.id !== planId && (where === 'all' || p.place === where || p.place === 'any'));

  return (
    <Screen>
      <Rise><T v="display">Train</T></Rise>

      {current && (
        <Rise i={1}>
          <Tap onPress={() => router.push({ pathname: '/plan/[id]', params: { id: current.id } })} style={s.current} scale={0.98}>
            <LinearGradient colors={[current.color, current.color + 'AA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <T v="label" color={c.accentInk}>Your plan</T>
            <T v="h1" color={c.accentInk} style={{ marginTop: 4 }}>{current.name}</T>
            <T v="body" color="#1A1A1A">{current.tagline}</T>
            <Row style={{ marginTop: 14 }} gap={8}>
              {current.days.map((d) => (
                <View key={d.name} style={s.dayPill}><T v="small" color={c.text}>{d.name}</T></View>
              ))}
            </Row>
          </Tap>
        </Rise>
      )}

      <Rise i={2}>
        <Tap onPress={() => router.push('/library')} style={s.lib} scale={0.98}>
          <View style={s.libIcon}><Ionicons name="search" size={22} color={c.accentInk} /></View>
          <View style={{ flex: 1 }}>
            <T v="h3">Exercise library</T>
            <T v="small">878 exercises with demos and alternatives</T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Tap>
      </Rise>

      <Rise i={3}>
        <T v="label" style={{ marginTop: 26, marginBottom: 12 }}>Browse by muscle</T>
        <View style={s.grid}>
          {BODY.map((b) => (
            <Tap key={b.m} onPress={() => router.push({ pathname: '/library', params: { muscle: b.m } })} style={s.muscle}>
              <T style={{ fontSize: 24 }}>{b.e}</T>
              <T v="small" color={c.text} numberOfLines={1}>{title(b.m)}</T>
            </Tap>
          ))}
        </View>
      </Rise>

      <Rise i={4}>
        <Row style={{ marginTop: 26, marginBottom: 12, justifyContent: 'space-between' }}>
          <T v="label">More plans</T>
          <Row gap={6}>
            {(['all', 'gym', 'home'] as const).map((w) => <Chip key={w} label={title(w)} on={where === w} onPress={() => setWhere(w)} />)}
          </Row>
        </Row>
        <View style={{ gap: 12 }}>
          {list.map((p) => (
            <Tap key={p.id} onPress={() => router.push({ pathname: '/plan/[id]', params: { id: p.id } })} style={s.plan} scale={0.98}>
              <View style={[s.bar, { backgroundColor: p.color }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3">{p.name}</T>
                <T v="small" numberOfLines={1}>{p.tagline}</T>
                <Row gap={6} style={{ marginTop: 6 }}>
                  <T v="label" color={p.color}>{p.place === 'any' ? 'Anywhere' : title(p.place)}</T>
                  <T v="label">· {p.days.length} day{p.days.length > 1 ? 's' : ''} · {p.level}</T>
                </Row>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Tap>
          ))}
        </View>
      </Rise>
    </Screen>
  );
}

const s = StyleSheet.create({
  current: { marginTop: 18, borderRadius: r.xl, padding: 22, overflow: 'hidden' },
  dayPill: { backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center' },
  lib: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  libIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  muscle: { width: '31%', flexGrow: 1, height: 84, borderRadius: r.md, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  bar: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
});
