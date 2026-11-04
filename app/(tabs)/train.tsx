import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { postpartumWeek, pregnancyWeek } from '../../src/calc';
import { ranked } from '../../src/coach';
import { exercises, title, type Exercise } from '../../src/data/exercises';
import { perWeek, planById, plans, type Category, type Plan } from '../../src/data/plans';
import { Segmented, useToday } from '../../src/kit';
import { useStore, type Profile } from '../../src/store';
import { c, equip, f, r } from '../../src/theme';
import { Avatar, ListRow, Row, Section, T, Tap, Thumb } from '../../src/ui';
import { Enter, MuscleGrid } from '../library';

// Train: your plan, the whole exercise library (search + muscle grid) and every other plan, in one place.
// Depth: Train -> plan / muscle page / exercise -> exercise (alternatives replace, never stack).

type Icon = keyof typeof Ionicons.glyphMap;
type Where = 'gym' | 'home' | 'office';
const WHERE: { k: Where; label: string }[] = [{ k: 'gym', label: 'Gym' }, { k: 'home', label: 'Home' }, { k: 'office', label: 'Office' }];

// One icon per category, on every plan row.
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
const openPlan = (id: string) => router.push({ pathname: '/plan/[id]', params: { id } });
const openEx = (id: string) => router.push({ pathname: '/exercise/[id]', params: { id } });
const openMuscle = (id: string) => router.push({ pathname: '/library', params: { muscle: id } });

export default function Train() {
  const ins = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const sessions = useStore((s) => s.sessions);
  const today = useToday();
  const [q, setQ] = useState('');
  const [where, setWhere] = useState<Where>(profile.place === 'office' ? 'office' : profile.place === 'home' ? 'home' : 'gym');

  const cur: Plan | undefined = planById[planId];
  const n = cur ? perWeek(cur) : 0;
  // This week's training days done for the plan, and which week of the plan you are in (sessions done / days a week).
  const mine = useMemo(() => sessions.filter((x) => x.planId === planId && x.dayIndex !== undefined), [sessions, planId]);
  const wk = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return new Set(mine.filter((x) => x.startedAt >= d.getTime()).map((x) => x.dayIndex)).size;
  }, [mine]);
  const weekNo = cur ? Math.min(cur.weeks, Math.floor(mine.length / Math.max(1, n)) + 1) : 1;

  // Other plans: best fit first (the coach's ranking), then the rest; the current plan has its own card.
  const rank = useMemo(() => new Map(ranked(profile).map((p, i) => [p.id, i])), [profile]);
  const others = useMemo(() => plans
    .filter((p) => p.id !== planId && fits(p, where) && (p.category !== 'Women' || profile.gender !== 'male'))
    .sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999)), [planId, where, profile.gender, rank]);

  // Search: plans and exercises together; results replace everything below the field while typing.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const planHits = useMemo(() => (words.length ? plans.filter((p) => {
    const hay = `${p.name} ${p.category} ${p.tags.join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, 4) : []), [q]);
  const exHits = useMemo(() => {
    if (!words.length) return [];
    const hits = exercises.filter((e) => words.every((w) => e.name.toLowerCase().includes(w) || e.equipment.includes(w) || e.primary.some((m) => m.includes(w))));
    const head = words[0];
    return hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(head)) - Number(a.name.toLowerCase().startsWith(head)));
  }, [q]);
  const searching = words.length > 0;
  const placeLabel = profile.place === 'both' ? 'Gym and home' : cap(profile.place);
  const bottom = ins.bottom + 150; // clears the tab bar and the workout mini bar

  const header = (
    <View style={{ paddingTop: ins.top + 12, paddingHorizontal: 12, gap: 14, paddingBottom: 12, backgroundColor: c.bg }}>
      <Row gap={10}>
        <T v="display" numberOfLines={1} style={{ flex: 1 }}>Train</T>
        <Tap onPress={() => router.push('/you')} style={s.place} scale={0.95}>
          <Ionicons name={profile.place === 'office' ? 'briefcase-outline' : profile.place === 'home' ? 'home-outline' : 'barbell-outline'} size={14} color={c.muted} />
          <T v="small" color={c.text}>{placeLabel}</T>
        </Tap>
        <Avatar />
      </Row>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${exercises.length} exercises and plans`} placeholderTextColor={c.dim}
          style={s.input} returnKeyType="search" autoCorrect={false} />
        {!!q && <Tap onPress={() => setQ('')} feedback="none"><Ionicons name="close-circle" size={18} color={c.muted} /></Tap>}
      </View>
    </View>
  );

  if (searching) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <FlatList
          key="search"
          data={exHits}
          keyExtractor={(e) => e.id}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: bottom }}
          ItemSeparatorComponent={Gap}
          ListHeaderComponent={
            <View style={{ gap: 8, paddingBottom: 12 }}>
              {planHits.length > 0 && <T v="label">Plans</T>}
              {planHits.map((p) => <ListRow key={p.id} icon={ICON[p.category]} title={p.name} sub={meta(p)} onPress={() => openPlan(p.id)} />)}
              {exHits.length > 0 && <T v="label" style={{ marginTop: planHits.length ? 12 : 0 }}>{`Exercises · ${exHits.length}`}</T>}
            </View>
          }
          ListEmptyComponent={planHits.length ? null : <T v="small" style={{ marginTop: 8 }}>Nothing matches. Try a muscle or a piece of kit.</T>}
          renderItem={({ item }) => <Hit e={item} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <FlatList
        key="browse"
        data={others}
        keyExtractor={(p) => p.id}
        initialNumToRender={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: bottom }}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View>
            {/* Your plan: name, this week's pips, next day, one Start (Resume while a workout runs). */}
            {cur && (
              <Enter>
                <Tap onPress={() => openPlan(cur.id)} style={s.plan} scale={0.98}>
                  <T v="label">Your plan</T>
                  <Row gap={12}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="h2" numberOfLines={1} style={{ fontSize: 19 }}>{cur.name}</T>
                      <T v="small" numberOfLines={1}>{`Week ${weekNo} · next: ${today.day.name}`}</T>
                    </View>
                    <Tap onPress={today.start} style={[s.start, { backgroundColor: c.accent }]} scale={0.94} feedback="none">
                      <Ionicons name="play" size={16} color={c.accentInk} />
                      <T v="h3" color={c.accentInk} style={{ fontSize: 16 }}>{today.active ? 'Resume' : 'Start'}</T>
                    </Tap>
                  </Row>
                  <Row gap={6}>
                    {Array.from({ length: n }, (_, i) => <View key={i} style={[s.pip, { backgroundColor: i < wk ? c.accent : c.line }]} />)}
                  </Row>
                </Tap>
              </Enter>
            )}

            <Enter i={1}>
              <Section title="Muscles" action="All exercises" onAction={() => router.push('/library')} style={{ marginTop: 28 }}>
                <MuscleGrid where={where} onOpen={openMuscle} />
              </Section>
            </Enter>

            <Enter i={2}>
              <Section title="Other plans" style={{ marginTop: 28 }}>
                <Segmented options={WHERE} value={where} onChange={setWhere} style={{ marginBottom: 12 }} />
              </Section>
            </Enter>
          </View>
        }
        renderItem={({ item: p, index }) => (
          <ListRow icon={ICON[p.category]} title={p.name} sub={index < 3 ? `${meta(p)} · ${because(profile, p)}` : meta(p)} onPress={() => openPlan(p.id)} />
        )}
        ListEmptyComponent={<T v="small">No other plans for this place.</T>}
      />
    </View>
  );
}

const Gap = () => <View style={{ height: 8 }} />;

function Hit({ e }: { e: Exercise }) {
  const q = equip(e.equipment);
  return (
    <ListRow thumb={<Thumb ex={e} size={44} />} title={e.name} sub={`${q.label} · ${title(e.level)}`} onPress={() => openEx(e.id)} />
  );
}

const s = StyleSheet.create({
  place: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.card2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  search: { height: 48, borderRadius: 14, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line },
  input: { flex: 1, color: c.text, fontFamily: f.medium, fontSize: 16, height: 48 },
  plan: { gap: 12, padding: 16, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  start: { height: 44, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pip: { flex: 1, height: 6, borderRadius: 3 },
});
