import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { postpartumWeek, pregnancyWeek } from '../../src/calc';
import { ranked } from '../../src/coach';
import { exercises, title, type Exercise } from '../../src/data/exercises';
import { perWeek, planById, plans, type Category, type Plan } from '../../src/data/plans';
import { DoorCard, openWorkout, Segmented, useMiniBarSpace, useToday } from '../../src/kit';
import { asDay } from '../../src/data/quick';
import { quickPicks, type QuickPick } from '../../src/restday';
import { useStore, type Profile } from '../../src/store';
import { c, dom, equip, f, r } from '../../src/theme';
import { Avatar, haptic, IconBox, ListRow, Row, Section, T, Tap, Thumb } from '../../src/ui';
import { Enter, MuscleGrid, plural } from '../library';

// Workouts (the centre tab, round 14): today's workout, short sessions and the whole exercise library (search +
// muscle grid). Plans and challenges live on the Plans tab; search here still finds plans.
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

// Every exercise some plan uses: search lists these familiar moves first.
const IN_PLANS = new Set(plans.flatMap((p) => p.days.flatMap((d) => d.slots.map((sl) => sl.id))));

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const meta = (p: Plan) => `${plural(perWeek(p), 'day')} · ${cap(p.level)}`;
const openPlan = (id: string) => router.push({ pathname: '/plan/[id]', params: { id } });
const openEx = (id: string) => router.push({ pathname: '/exercise/[id]', params: { id } });
const openMuscle = (id: string) => router.push({ pathname: '/library', params: { muscle: id } });

export default function Train() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const sessions = useStore((s) => s.sessions);
  const today = useToday();
  const [q, setQ] = useState('');
  // Tapping the Train tab again scrolls back to the top (only one of the two lists is mounted at a time).
  const browseRef = useRef<ScrollView>(null);
  const searchRef = useRef<FlatList<Exercise>>(null);
  useScrollToTop(browseRef);
  useScrollToTop(searchRef);
  const home: Where = profile.place === 'office' ? 'office' : profile.place === 'home' ? 'home' : 'gym';
  const [where, setWhere] = useState<Where>(home);
  useEffect(() => setWhere(home), [home]); // follow the place set in your profile

  // Short sessions that suit this person's day; a tap opens one ready, exactly like Start.
  const picks = useMemo(() => quickPicks(profile, sessions), [profile, sessions]);
  const startQuick = (q: QuickPick) => {
    haptic('medium');
    if (!useStore.getState().active) useStore.getState().start(asDay(q.q), q.place);
    openWorkout();
  };

  // Search: plans and exercises together; results replace everything below the field while typing.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const planHits = useMemo(() => (words.length ? plans.filter((p) => {
    const hay = `${p.name} ${p.category} ${p.tags.join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, 4) : []), [q]);
  const exHits = useMemo(() => {
    if (!words.length) return [];
    const hits = exercises.filter((e) => words.every((w) => e.name.toLowerCase().includes(w) || e.equipment.includes(w) || e.primary.some((m) => m.includes(w))));
    // Moves the plans use (the everyday ones) first, then names that start with the first word.
    const head = words[0];
    const rank = (e: Exercise) => (IN_PLANS.has(e.id) ? 2 : 0) + (e.name.toLowerCase().startsWith(head) ? 1 : 0);
    return hits.sort((a, b) => rank(b) - rank(a));
  }, [q]);
  const searching = words.length > 0;
  const placeLabel = profile.place === 'both' ? 'Gym and home' : cap(profile.place);
  const bottom = ins.bottom + 120 + mini; // clears the tab bar, plus the workout mini bar while it shows

  const header = (
    <View style={{ paddingTop: ins.top + 12, paddingHorizontal: 12, gap: 14, paddingBottom: 12, backgroundColor: c.bg }}>
      <Row gap={10}>
        <T v="display" numberOfLines={1} style={{ flex: 1 }}>Workouts</T>
        <Tap onPress={() => router.push('/you')} style={s.place} scale={0.95}>
          <Ionicons name={profile.place === 'office' ? 'briefcase-outline' : profile.place === 'home' ? 'home-outline' : 'barbell-outline'} size={14} color={c.muted} />
          <T v="small" color={c.text}>{placeLabel}</T>
        </Tap>
        <Avatar />
      </Row>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${exercises.length.toLocaleString('en-US')} exercises and plans`} placeholderTextColor={c.dim}
          style={s.input} returnKeyType="search" autoCorrect={false} />
        {!!q && <Tap onPress={() => setQ('')} feedback="none" style={s.clear} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={c.muted} /></Tap>}
      </View>
    </View>
  );

  if (searching) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <FlatList
          ref={searchRef}
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
          ListEmptyComponent={planHits.length ? null : (
            <View style={{ gap: 4, marginTop: 8 }}>
              <T v="small">Nothing matches. Try a muscle or a piece of kit.</T>
              <Tap onPress={() => { setQ(''); router.push('/library'); }} style={s.browse} scale={0.97}>
                <T v="h3" color={c.accent}>Browse all exercises</T>
                <Ionicons name="chevron-forward" size={16} color={c.accent} />
              </Tap>
            </View>
          )}
          renderItem={({ item }) => <Hit e={item} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <ScrollView ref={browseRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: bottom }}>
        {/* Today's workout in one row: the same pick as Home, one Start (Resume while a workout runs). */}
        <Enter>
          <View style={s.plan}>
            <Row gap={12}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T v="label">{today.active ? 'In progress' : 'Today'}</T>
                <T v="h2" numberOfLines={1} style={{ fontSize: 19 }}>{today.active ? today.active.title : today.day.name}</T>
                <T v="small" numberOfLines={1}>{today.active ? plural(today.active.items.length, 'exercise') : `${plural(today.day.slots.length, 'exercise')} · ${today.minutes} min`}</T>
              </View>
              <Tap onPress={today.start} style={[s.start, { backgroundColor: c.accent }]} scale={0.94} feedback="none">
                <Ionicons name="play" size={16} color={c.accentInk} />
                <T v="h3" color={c.accentInk} style={{ fontSize: 16 }}>{today.active ? 'Resume' : 'Start'}</T>
              </Tap>
            </Row>
          </View>
        </Enter>

        {/* Short sessions: 2 to 15 minutes, picked for this person's day. */}
        {picks.length > 0 && (
          <Enter i={1}>
            <Section title="Short on time" style={{ marginTop: 24 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 12 }}>
                {picks.map((q) => (
                  <Tap key={q.id} onPress={() => startQuick(q)} style={s.quick} scale={0.97} accessibilityLabel={`Start ${q.name}`}>
                    <IconBox icon={q.icon} color={c.accent} size={36} />
                    <T v="h3" numberOfLines={1} style={{ fontSize: 15 }}>{q.name}</T>
                    <T v="small" numberOfLines={1} style={{ fontSize: 12 }}>{q.sub}</T>
                  </Tap>
                ))}
              </ScrollView>
            </Section>
          </Enter>
        )}

        <Enter i={2}>
          <Section title="By muscle" action="All exercises" onAction={() => router.push('/library')} style={{ marginTop: 24 }}>
            <Segmented options={WHERE} value={where} onChange={setWhere} style={{ marginBottom: 12 }} />
            <MuscleGrid where={where} onOpen={openMuscle} />
          </Section>
        </Enter>

        <Enter i={3} style={{ marginTop: 24, gap: 8 }}>
          <DoorCard icon="list" title="All exercises" meta={`${exercises.length.toLocaleString('en-US')} moves with demos`} onPress={() => router.push('/library')} compact />
          <DoorCard icon="map" color={dom.streak} title="Plans and challenges" meta="Your plan, every plan, 27 challenges" onPress={() => router.navigate('/plans')} compact />
        </Enter>
      </ScrollView>
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
  clear: { width: 44, height: 44, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  browse: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  place: { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.card2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  search: { height: 48, borderRadius: 14, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line },
  input: { flex: 1, color: c.text, fontFamily: f.medium, fontSize: 16, height: 48, outlineWidth: 0 },
  plan: { gap: 12, padding: 16, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  start: { height: 44, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quick: { width: 150, gap: 6, padding: 12, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
});
