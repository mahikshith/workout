// Plan pieces shared by Home ("Plans for you") and the Plans tab: icons, the short "why" tag, the wide card.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { postpartumWeek, pregnancyWeek } from './calc';
import { perWeek, type Category, type Plan } from './data/plans';
import type { Profile } from './store';
import { c, dom, r, tint } from './theme';
import { IconBox, Row, T, Tap } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;
export type Where = 'gym' | 'home' | 'office';

export const PLAN_ICON: Record<Category, Icon> = {
  Muscle: 'barbell', Strength: 'trophy', 'One muscle': 'locate', 'Fat loss': 'flame', Cardio: 'pulse', Functional: 'fitness', Home: 'home', Women: 'female', Recovery: 'leaf',
};
// One colour per kind of plan, from the domain colours every other screen uses.
export const PLAN_COLOR: Record<Category, string> = {
  Muscle: dom.train, Strength: dom.streak, 'One muscle': dom.protein, 'Fat loss': dom.kcal, Cardio: dom.heart, Functional: dom.steps, Home: dom.water, Women: c.pink, Recovery: dom.sleep,
};

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const planMeta = (p: Plan) => `${plural(perWeek(p), 'day')} a week · ${cap(p.level)}`;
export const openPlan = (id: string) => router.push({ pathname: '/plan/[id]', params: { id } });

// Office shows recovery and desk-friendly plans only; gym and home hide desk-only plans.
export const planFits = (p: Plan, w: Where) =>
  w === 'office' ? p.category === 'Recovery' : !p.tags.includes('office') && (p.place === w || p.place === 'any');

// A 2-4 word tag on why a plan suits this person.
export function because(p: Profile, plan: Plan) {
  if (plan.id === 'pregnancy-safe') return 'Safe in pregnancy';
  if (plan.id === 'after-birth') return 'Gentle after birth';
  if (plan.category === 'Recovery' && (pregnancyWeek(p) !== null || postpartumWeek(p) !== null)) return 'Gentle and safe';
  if (plan.category === 'One muscle') return 'Add-on to your plan';
  const days = perWeek(plan) === p.daysPerWeek;
  if (plan.tags.includes(p.goal)) return days ? 'Your goal, your days' : 'Fits your goal';
  if (plan.level === 'beginner' && p.level === 'beginner') return 'Beginner friendly';
  return days ? 'Fits your week' : 'A change of pace';
}

// The wide card in a sideways row: icon, name, days and level, one reason. `tag` marks the one you are on.
export function PlanCard({ plan, why, tag, width = 220 }: { plan: Plan; why?: string; tag?: string; width?: number }) {
  const col = PLAN_COLOR[plan.category];
  return (
    <Tap onPress={() => openPlan(plan.id)} style={[s.card, { width, borderColor: tint(col, 1.4) }]} scale={0.97} accessibilityLabel={`${plan.name}, ${planMeta(plan)}`}>
      {/* A soft wash of the plan's own colour, so a row of plans reads as different kinds at a glance. */}
      <LinearGradient colors={[tint(col, 1.3), c.card]} locations={[0, 0.75]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Row gap={8}>
        <IconBox icon={PLAN_ICON[plan.category]} color={col} size={40} />
        <View style={{ flex: 1 }} />
        {tag ? <View style={[s.tag, { backgroundColor: tint(c.accent, 1.3) }]}><T v="small" color={c.accent} style={{ fontSize: 12, lineHeight: 15 }}>{tag}</T></View> : null}
      </Row>
      <T v="h3" numberOfLines={2} style={{ minHeight: 44 }}>{plan.name}</T>
      <T v="small" numberOfLines={1}>{planMeta(plan)}</T>
      {why ? (
        <Row gap={4} style={{ marginTop: 2 }}>
          <Ionicons name="checkmark-circle" size={14} color={col} />
          <T v="small" color={c.soft} numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>{why}</T>
        </Row>
      ) : null}
    </Tap>
  );
}

const s = StyleSheet.create({
  card: { overflow: 'hidden', gap: 6, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  tag: { height: 22, paddingHorizontal: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
