import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { postpartumWeek, pregnancyWeek } from '../../src/calc';
import { ranked } from '../../src/coach';
import { CATEGORIES, perWeek, plans, type Plan } from '../../src/data/plans';
import { useStore, type Profile } from '../../src/store';
import { c, r } from '../../src/theme';
import { Chip, Rise, Row, Screen, T, Tap } from '../../src/ui';

type Where = 'gym' | 'home' | 'office';
const WHERE: { k: Where; label: string; icon: 'barbell' | 'home' | 'briefcase' }[] = [
  { k: 'gym', label: 'Gym', icon: 'barbell' }, { k: 'home', label: 'Home', icon: 'home' }, { k: 'office', label: 'Office', icon: 'briefcase' },
];

// Office shows recovery and desk-friendly plans only; gym and home hide desk-only plans.
const fits = (p: Plan, w: Where) =>
  w === 'office' ? p.category === 'Recovery' : !p.tags.includes('office') && (p.place === w || p.place === 'any');

// One plain line on why a plan suits this person.
function because(p: Profile, plan: Plan) {
  if (plan.id === 'pregnancy-safe') return 'Safe moves for your pregnancy, checked against your week.';
  if (plan.id === 'after-birth') return 'Gentle steps back after birth, at your pace.';
  if (plan.category === 'Recovery' && (pregnancyWeek(p) !== null || postpartumWeek(p) !== null)) return 'Gentle and safe for you right now.';
  const n = perWeek(plan);
  const goal = plan.tags.includes(p.goal) ? `Built to help you ${p.goal}` : 'A good change of pace';
  const days = n === p.daysPerWeek ? `your ${n} days a week` : `${n} days a week`;
  return `${goal}, ${days}${plan.level === 'beginner' && p.level === 'beginner' ? ', beginner friendly' : ''}.`;
}

const open = (id: string) => router.push({ pathname: '/plan/[id]', params: { id } });

export default function Train() {
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const [where, setWhere] = useState<Where>(profile?.place === 'home' ? 'home' : 'gym');
  if (!profile) return null;
  const best = ranked(profile).slice(0, 3);
  const shown = plans.filter((p) => fits(p, where) && (p.category !== 'Women' || profile.gender !== 'male'));
  const meta = (p: Plan) => `${perWeek(p)} days/week · ${p.level}`;

  return (
    <Screen>
      <Rise><T v="display">Plans</T></Rise>

      <Rise i={1}>
        <T v="label" style={{ marginTop: 18, marginBottom: 12 }}>Best for you</T>
        <View style={s.grid}>
          {best.map((p, i) => (
            <Tap key={p.id} onPress={() => open(p.id)} style={[s.block, i === 0 && s.feature, i === 0 && { borderColor: c.accent }]} scale={0.98}>
              <T v="label" color={c.accent}>{p.id === planId ? 'Current plan' : i === 0 ? 'Top pick' : p.category}</T>
              <T v={i === 0 ? 'h2' : 'h3'} numberOfLines={2}>{p.name}</T>
              <T v="small" numberOfLines={i === 0 ? 2 : 3} style={{ flexGrow: 1 }}>{because(profile, p)}</T>
              <T v="label" color={c.text}>{meta(p)}</T>
            </Tap>
          ))}
        </View>
      </Rise>

      <Rise i={2}>
        <Row style={{ marginTop: 28, justifyContent: 'space-between' }}>
          <T v="label">All plans</T>
          <T v="small" color={c.dim}>{shown.length} plans</T>
        </Row>
        <Row gap={8} style={{ marginTop: 12 }}>
          {WHERE.map((w) => <Chip key={w.k} label={w.label} icon={w.icon} on={where === w.k} onPress={() => setWhere(w.k)} />)}
        </Row>
        {CATEGORIES.map((cat) => {
          const list = shown.filter((p) => p.category === cat);
          if (!list.length) return null;
          return (
            <View key={cat} style={{ marginTop: 22 }}>
              <T v="h3" style={{ marginBottom: 10 }}>{cat}</T>
              <View style={s.grid}>
                {list.map((p) => (
                  <Tap key={p.id} onPress={() => open(p.id)} style={s.block} scale={0.98}>
                    <T v="h3" numberOfLines={2} style={{ flexGrow: 1 }}>{p.name}</T>
                    <T v="small">{perWeek(p)} days/week</T>
                    <T v="label" color={p.id === planId ? c.accent : c.muted}>{p.id === planId ? 'Current' : p.level}</T>
                  </Tap>
                ))}
              </View>
            </View>
          );
        })}
      </Rise>

      <Rise i={3}>
        <Tap onPress={() => router.push('/library')} style={s.lib} scale={0.98}>
          <View style={[s.libIcon, { backgroundColor: c.accent }]}><Ionicons name="search" size={22} color={c.accentInk} /></View>
          <View style={{ flex: 1 }}>
            <T v="h3">Exercise library</T>
            <T v="small">Every exercise with demos and alternatives</T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Tap>
      </Rise>
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  block: { width: '48%', minHeight: 120, gap: 6, padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  feature: { width: '100%', minHeight: 0, padding: 18, borderRadius: r.lg, borderWidth: 1 },
  lib: { marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  libIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
