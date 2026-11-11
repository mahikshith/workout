import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { explain, ranked } from '../../src/coach';
import { CATEGORIES, perWeek, planById, plans, type Plan } from '../../src/data/plans';
import { Segmented, useMiniBarSpace, useScrollTopRef, useToday } from '../../src/kit';
import { because, openPlan, PLAN_COLOR, PLAN_ICON, PlanCard, planFits, planMeta, type Where } from '../../src/plansui';
import { Ambient } from '../../src/glass';
import { useStore } from '../../src/store';
import { c, dom, r, tint } from '../../src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, IconBox, ListRow, Row, Section, T, Tap } from '../../src/ui';
import { ChallengeCard } from '../../src/challenges/Card';
import { ChallengesBody } from '../challenges';
import { Enter } from '../library';

// Plans (round 14): what you are doing now (your plan, your challenge), then every plan and every challenge.
// Two segments on one tab: Plans | Challenges. ?tab=challenges opens the second one.

type Seg = 'plans' | 'challenges';
const SEGS: { k: Seg; label: string }[] = [{ k: 'plans', label: 'Plans' }, { k: 'challenges', label: 'Challenges' }];
const WHERE: { k: Where; label: string }[] = [{ k: 'gym', label: 'Gym' }, { k: 'home', label: 'Home' }, { k: 'office', label: 'Office' }];

export default function Plans() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [seg, setSeg] = useState<Seg>(params.tab === 'challenges' ? 'challenges' : 'plans');
  useEffect(() => { if (params.tab === 'challenges' || params.tab === 'plans') setSeg(params.tab); }, [params.tab]);
  const scroll = useScrollTopRef<ScrollView>();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient colors={[dom.sleep, dom.streak, dom.train]} strength={1.25} />
      <View style={{ paddingTop: ins.top + 12, paddingHorizontal: 12, gap: 14, paddingBottom: 12 }}>
        <Row gap={10}>
          <T v="display" numberOfLines={1} style={{ flex: 1 }}>Plans</T>
          <Avatar />
        </Row>
        <Segmented options={SEGS} value={seg} onChange={(k) => { setSeg(k); router.setParams({ tab: k }); }} />
      </View>
      <ScrollView ref={scroll} key={seg} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: ins.bottom + 120 + mini }}>
        {seg === 'plans' ? <PlansList /> : <ChallengesBody />}
      </ScrollView>
    </View>
  );
}

function PlansList() {
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const sessions = useStore((s) => s.sessions);
  const today = useToday();
  const home: Where = profile.place === 'office' ? 'office' : profile.place === 'home' ? 'home' : 'gym';
  const [where, setWhere] = useState<Where>(home);
  useEffect(() => setWhere(home), [home]);

  const cur: Plan | undefined = planById[planId];
  const n = cur ? perWeek(cur) : 0;
  const mine = useMemo(() => sessions.filter((x) => x.planId === planId && x.dayIndex !== undefined), [sessions, planId]);
  const wk = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return new Set(mine.filter((x) => x.startedAt >= d.getTime()).map((x) => x.dayIndex)).size;
  }, [mine]);
  const weekNo = cur ? Math.min(cur.weeks, Math.floor(mine.length / Math.max(1, n)) + 1) : 1;
  const curBase = cur?.base ?? planId;

  // Best fit first (the engine's ranking); the top three sit in their own row with a reason each.
  const order = useMemo(() => ranked(profile), [profile]);
  const best = order.filter((p) => p.id !== curBase).slice(0, 4);
  const bestIds = new Set(best.map((p) => p.id));
  const rank = useMemo(() => new Map(order.map((p, i) => [p.id, i])), [order]);
  const groups = CATEGORIES.map((cat) => ({
    cat,
    list: plans.filter((p) => p.category === cat && planFits(p, where) && (cat !== 'Women' || profile.gender !== 'male'))
      .sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999)),
  })).filter((g) => g.list.length > 0);

  return (
    <View>
      {/* What you are doing now: your plan (week, next day, Start) and your challenge. */}
      <Enter>
        <T v="label" style={{ marginBottom: 8 }}>Doing now</T>
        <View style={{ gap: 8 }}>
          {cur && (
            <Tap onPress={() => openPlan(cur.id)} style={[s.plan, { borderColor: tint(PLAN_COLOR[cur.category], 1.6) }]} scale={0.98}>
              <LinearGradient colors={[tint(PLAN_COLOR[cur.category], 1.5), tint(c.accent, 0.4), c.card]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill} pointerEvents="none" />
              <Row gap={12}>
                <IconBox icon={PLAN_ICON[cur.category]} color={PLAN_COLOR[cur.category]} size={44} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <T v="h2" numberOfLines={2} style={{ fontSize: 18, lineHeight: 22 }}>{cur.name}</T>
                  <T v="small" numberOfLines={1}>{`Week ${weekNo} of ${cur.weeks} · next: ${today.day.name}`}</T>
                </View>
                <Tap onPress={today.start} style={[s.start, { backgroundColor: c.accent }]} scale={0.94} feedback="none">
                  <Ionicons name="play" size={16} color={c.accentInk} />
                  <T v="h3" color={c.accentInk} style={{ fontSize: 16 }}>{today.active ? 'Resume' : 'Start'}</T>
                </Tap>
              </Row>
              <Row gap={6}>
                {Array.from({ length: n }, (_, i) => <View key={i} style={[s.pip, { backgroundColor: i < wk ? c.accent : c.line }]} />)}
              </Row>
              <T v="small" numberOfLines={1}>{`${wk} of ${n} done this week`}</T>
            </Tap>
          )}
          <ChallengeCard />
        </View>
      </Enter>

      {best.length > 0 && (
        <Enter i={1}>
          <Section title="Recommended for you" style={{ marginTop: 28 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 12 }}>
              {best.map((p) => <PlanCard key={p.id} plan={p} why={explain(profile, p.id).find((x) => !/days/.test(x)) ?? because(profile, p)} />)}
            </ScrollView>
          </Section>
        </Enter>
      )}

      <Enter i={2}>
        <Section title="All plans" style={{ marginTop: 28 }}>
          <Segmented options={WHERE} value={where} onChange={setWhere} />
        </Section>
        {groups.map(({ cat, list }) => (
          <View key={cat} style={{ marginTop: 20, gap: 8 }}>
            <Row gap={8}>
              <View style={[s.dot, { backgroundColor: PLAN_COLOR[cat] }]} />
              <T v="h3" style={{ flex: 1 }}>{cat}</T>
              <T v="small">{list.length}</T>
            </Row>
            {list.map((p) => (
              <ListRow key={p.id} icon={PLAN_ICON[p.category]} color={PLAN_COLOR[p.category]} title={p.name}
                sub={p.id === curBase ? `${planMeta(p)} · Your plan` : bestIds.has(p.id) ? `${planMeta(p)} · ${because(profile, p)}` : planMeta(p)}
                onPress={() => openPlan(p.id)} />
            ))}
          </View>
        ))}
        {!groups.length && <T v="small" style={{ marginTop: 12 }}>No plans for this place.</T>}
      </Enter>
    </View>
  );
}

const s = StyleSheet.create({
  plan: { overflow: 'hidden', gap: 10, padding: 16, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1, borderColor: tint(c.accent, 1.6) },
  start: { height: 44, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pip: { flex: 1, height: 6, borderRadius: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
