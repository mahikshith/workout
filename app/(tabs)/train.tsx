import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { doneThisWeek, postpartumWeek, pregnancyWeek } from '../../src/calc';
import { ranked } from '../../src/coach';
import { CATEGORIES, perWeek, planById, plans, type Category, type Plan } from '../../src/data/plans';
import { useStore, type Profile } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Chip, IconBox, ListRow, Rise, Row, Screen, Section, T, Tap, TabTitle } from '../../src/ui';

type Icon = keyof typeof Ionicons.glyphMap;
type Where = 'gym' | 'home' | 'office';
const WHERE: { k: Where; label: string; icon: 'barbell' | 'home' | 'briefcase' }[] = [
  { k: 'gym', label: 'Gym', icon: 'barbell' }, { k: 'home', label: 'Home', icon: 'home' }, { k: 'office', label: 'Office', icon: 'briefcase' },
];

// One icon per category, on every plan card and row.
const ICON: Record<Category, Icon> = {
  Muscle: 'barbell', Strength: 'trophy', 'One muscle': 'locate', 'Fat loss': 'flame', Cardio: 'pulse', Functional: 'fitness', Home: 'home', Women: 'female', Recovery: 'leaf',
};

// Office shows recovery and desk-friendly plans only; gym and home hide desk-only plans.
const fits = (p: Plan, w: Where) =>
  w === 'office' ? p.category === 'Recovery' : !p.tags.includes('office') && (p.place === w || p.place === 'any');

// A 2-4 word tag on why a plan suits this person.
function because(p: Profile, plan: Plan) {
  if (plan.id === 'pregnancy-safe') return 'Safe in pregnancy';
  if (plan.id === 'after-birth') return 'Gentle after birth';
  if (plan.category === 'Recovery' && (pregnancyWeek(p) !== null || postpartumWeek(p) !== null)) return 'Gentle and safe';
  if (plan.category === 'One muscle') return 'Add-on to your plan';
  const days = perWeek(plan) === p.daysPerWeek;
  if (plan.tags.includes(p.goal)) return days ? 'Your goal, your days' : 'Fits your goal';
  if (plan.level === 'beginner' && p.level === 'beginner') return 'Beginner friendly';
  return days ? 'Fits your week' : 'A change of pace';
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const meta = (p: Plan) => `${perWeek(p)} days · ${cap(p.level)}`;
const open = (id: string) => router.push({ pathname: '/plan/[id]', params: { id } });

export default function Train() {
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const sessions = useStore((s) => s.sessions);
  const [where, setWhere] = useState<Where>(profile?.place === 'home' ? 'home' : 'gym');
  if (!profile) return null;
  const cur: Plan | undefined = planById[planId];
  const n = cur ? perWeek(cur) : 0;
  const wk = [...doneThisWeek(sessions)].filter((k) => k.startsWith(planId + ':')).length;
  const best = ranked(profile).filter((p) => p.id !== planId).slice(0, 3); // the current plan has its own card above
  const shown = plans.filter((p) => fits(p, where) && (p.category !== 'Women' || profile.gender !== 'male'));

  return (
    <Screen>
      <Rise><TabTitle title="Plans" /></Rise>

      {/* Hero: the plan you are on, this week's progress, one way in. */}
      {cur && (
        <Rise i={1}>
          <View style={[s.hero, { borderColor: c.accent + '55' }]}>
            <Row gap={8}>
              <Ionicons name="checkmark-circle" size={16} color={c.accent} />
              <T v="label" color={c.accent}>Current plan</T>
            </Row>
            <T v="h1" numberOfLines={2} style={{ marginTop: 12 }}>{cur.name}</T>
            <Row gap={16} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Meta icon="calendar-outline" text={`${n} days/week`} />
              <Meta icon="flag-outline" text={`${cur.weeks} weeks`} />
            </Row>
            <Row gap={12} style={{ marginTop: 16 }}>
              <Row gap={4} style={{ flex: 1 }}>
                {Array.from({ length: n }, (_, i) => <View key={i} style={[s.pip, { backgroundColor: i < wk ? c.accent : c.card2 }]} />)}
              </Row>
              <T v="small" color={wk >= n ? c.ok : c.text}>{wk >= n ? 'Week done' : `${wk}/${n} this week`}</T>
            </Row>
            <Button title="Open plan" icon="arrow-forward" style={{ marginTop: 16 }} onPress={() => open(cur.id)} />
          </View>
        </Rise>
      )}

      {best.length > 0 && (
        <Rise i={2}>
          <Section title="Best for you">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 12 }} style={{ marginHorizontal: -12, paddingLeft: 12 }}>
              {best.map((p) => (
                <Tap key={p.id} onPress={() => open(p.id)} style={s.pick} scale={0.97}>
                  <IconBox icon={ICON[p.category]} />
                  <T v="h3" numberOfLines={2} style={{ flexGrow: 1 }}>{p.name}</T>
                  <View style={{ gap: 4 }}>
                    <T v="small" numberOfLines={1}>{meta(p)}</T>
                    <T v="small" color={c.accent} numberOfLines={1}>{because(profile, p)}</T>
                  </View>
                </Tap>
              ))}
            </ScrollView>
          </Section>
        </Rise>
      )}

      <Rise i={3}>
        <Section title="All plans">
          <Row gap={8}>
            {WHERE.map((w) => <Chip key={w.k} label={w.label} icon={w.icon} on={where === w.k} onPress={() => setWhere(w.k)} />)}
          </Row>
          {CATEGORIES.map((cat) => {
            const list = shown.filter((p) => p.category === cat);
            if (!list.length) return null;
            return (
              <Section key={cat} title={cat} style={{ marginTop: 24 }}>
                <View style={{ gap: 8 }}>
                  {list.map((p) => {
                    const on = p.id === planId;
                    return (
                      <ListRow key={p.id} icon={ICON[cat]} title={p.name} sub={meta(p)} onPress={() => open(p.id)}
                        right={on ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : undefined}
                        style={on ? { borderColor: c.accent, borderWidth: 1 } : undefined} />
                    );
                  })}
                </View>
              </Section>
            );
          })}
        </Section>
      </Rise>

      <Rise i={4} style={{ marginTop: 32 }}>
        <ListRow icon="search" title="Exercise library" sub="Demos and alternatives" onPress={() => router.push('/library')} />
      </Rise>
    </Screen>
  );
}

const Meta = ({ icon, text }: { icon: Icon; text: string }) => (
  <Row gap={8}><Ionicons name={icon} size={16} color={c.muted} /><T v="small" color={c.text}>{text}</T></Row>
);

const s = StyleSheet.create({
  hero: { marginTop: 20, padding: 20, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1 },
  pip: { flex: 1, height: 8, borderRadius: 4 },
  pick: { width: 168, gap: 12, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
});
