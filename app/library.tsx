import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Dimensions, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { available, exercises, title, type Exercise } from '../src/data/exercises';
import { dose, doseText, focusOf, GROUPS, groupFor, inGroup, office, restText } from '../src/data/muscles';
import { gate } from '../src/engine';
import { useStore } from '../src/store';
import { c, equip, f, r } from '../src/theme';
import { Card, Chip, Row, T, Tap, Thumb } from '../src/ui';

const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
const BLOCK = Math.floor((Math.min(Dimensions.get('window').width, 600) - 24 - 20) / 3); // 12 px gutters, two 10 px gaps
// The muscle grid reads top to bottom like a body: upper body, core, lower body, then everything else.
const REGIONS: { label: string; ids: string[] }[] = [
  { label: 'Upper body', ids: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'neck'] },
  { label: 'Core', ids: ['abs'] },
  { label: 'Lower body', ids: ['glutes', 'quads', 'hamstrings', 'calves', 'hips'] },
  { label: 'More', ids: ['mobility', 'cardio', 'pelvic', 'desk'] },
];
type Where = 'gym' | 'home' | 'office';
const WHERE: { k: Where; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { k: 'gym', label: 'Gym', icon: 'barbell' }, { k: 'home', label: 'Home', icon: 'home' }, { k: 'office', label: 'Office', icon: 'briefcase' },
];
const ALL = 'All';

// Also mounted as the Exercises tab (tab = true). Muscle blocks -> the muscle's focus areas -> exercises by level.
// ?equip=none (Today's "No equipment needed") shows bodyweight moves only; ?muscle=chest opens that block.
export default function Library({ tab }: { tab?: boolean }) {
  const ins = useSafeAreaInsets();
  const { pick, muscle, equip: eq } = useLocalSearchParams<{ pick?: string; muscle?: string; equip?: string }>();
  const profile = useStore((s) => s.profile);
  const done = useStore((s) => s.sessions.length);
  const addItem = useStore((s) => s.addItem);
  const [q, setQ] = useState('');
  const [where, setWhere] = useState<Where>(profile.place === 'home' ? 'home' : 'gym');
  const [bare, setBare] = useState(eq === 'none');
  const [gid, setGid] = useState<string | null>(muscle ? groupFor(muscle) : null);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => { if (eq === 'none') { setBare(true); setGid(null); setFocus(null); } }, [eq]);

  const g = GROUPS.find((x) => x.id === gid);
  const fo = g && !g.focus.length ? ALL : focus; // a group without focus areas goes straight to its list
  const up = () => (g && focus && g.focus.length ? setFocus(null) : g ? setGid(null) : router.back());
  useEffect(() => {
    if (!g) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { up(); return true; });
    return () => sub.remove();
  }, [g, focus]);

  const pool = useMemo(() => exercises.filter((e) =>
    (where === 'gym' || (where === 'home' ? available(e, 'home', profile.gear) : office(e))) && (!bare || available(e, 'home', [])),
  ).sort((a, b) => Number(!!b.art) - Number(!!a.art)), [where, bare, profile]); // animated demos first
  const counts = useMemo(() => GROUPS.map((x) => pool.filter((e) => inGroup(x, e)).length), [pool]);
  const inG = useMemo(() => (g ? pool.filter((e) => inGroup(g, e)) : pool), [pool, g]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = words.length || fo
    ? inG.filter((e) => (!fo || fo === ALL || focusOf(e, g?.id)?.label === fo) &&
        words.every((w) => e.name.toLowerCase().includes(w) || e.equipment.includes(w)))
    : [];
  const sections = LEVELS.map((l) => ({ title: title(l), data: list.filter((e) => e.level === l) })).filter((x) => x.data.length);
  const starters = g ? inG.filter((e) => e.level === 'beginner' && !gate(e, profile, done).locked).slice(0, 3) : [];

  const open = (e: Exercise) => {
    if (pick && !gate(e, profile, done).locked) { addItem(e.id); router.back(); }
    else router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
  };
  const pad = { paddingHorizontal: 12, paddingBottom: ins.bottom + (tab ? 110 : 40) };
  const heading = g ? (fo && fo !== ALL ? `${g.label}: ${fo}` : g.label) : pick ? 'Add exercise' : 'Exercises';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8 }}>
      <Row style={{ paddingHorizontal: 12 }}>
        {(g || !tab) && <Tap onPress={up} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>}
        <T v={tab && !g ? 'display' : g ? 'h2' : 'h1'} style={{ flex: 1 }} numberOfLines={1}>{heading}</T>
        <T v="small">{words.length || fo ? list.length : inG.length}</T>
      </Row>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search squat, dumbbell, plank…" placeholderTextColor={c.dim} style={s.input} />
        {!!q && <Tap onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={c.muted} /></Tap>}
      </View>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 12, flexWrap: 'wrap' }} gap={8}>
        {WHERE.map((w) => <Chip key={w.k} label={w.label} icon={w.icon} on={where === w.k} onPress={() => setWhere(w.k)} />)}
        {bare && <Chip label="No equipment" icon="close" on color={c.ok} onPress={() => setBare(false)} />}
      </Row>

      {words.length || fo ? (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.id}
          initialNumToRender={12}
          windowSize={7}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[pad, { gap: 8 }]}
          renderSectionHeader={({ section }) => <T v="h3" style={{ marginTop: 10 }}>{section.title}</T>}
          renderItem={({ item }) => (
            <ExRow e={item} focus={focusOf(item, g?.id)?.label} locked={gate(item, profile, done).locked} pick={!!pick} onPress={() => open(item)} />
          )}
          ListEmptyComponent={<T v="small" style={{ marginTop: 12 }}>Nothing here for this place yet. Try Gym.</T>}
        />
      ) : !g ? (
        <ScrollView contentContainerStyle={pad} showsVerticalScrollIndicator={false}>
          {REGIONS.map((reg) => (
            <View key={reg.label}>
              <T v="h3" style={{ marginTop: 6, marginBottom: 10 }}>{reg.label}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {GROUPS.map((x, i) => reg.ids.includes(x.id) && (
                  <Tap key={x.id} disabled={!counts[i]} onPress={() => { setGid(x.id); setFocus(null); }} style={s.block}>
                    <T v="h3" numberOfLines={2}>{x.label}</T>
                    <T v="small" color={c.accent}>{counts[i]} moves</T>
                  </Tap>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[pad, { gap: 10 }]} showsVerticalScrollIndicator={false}>
          <T color={c.muted}>{g.does}</T>
          {starters.length > 0 && (
            <Card style={{ gap: 12, padding: 14 }}>
              <T v="label" color={c.accent}>Start here</T>
              {starters.map((e) => {
                const d = dose(e);
                return (
                  <Tap key={e.id} onPress={() => open(e)} scale={0.98} style={s.start}>
                    <Thumb ex={e} size={44} />
                    <View style={{ flex: 1 }}>
                      <T v="h3" numberOfLines={1}>{e.name}</T>
                      <T v="small">{doseText(d)} · rest {restText(d)}</T>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.muted} />
                  </Tap>
                );
              })}
            </Card>
          )}
          <T v="h3" style={{ marginTop: 8 }}>Focus areas</T>
          {[{ label: ALL, about: `Every ${g.label.toLowerCase()} move, easiest first.` }, ...g.focus].map((x) => {
            const n = x.label === ALL ? inG.length : inG.filter((e) => focusOf(e, g.id)?.label === x.label).length;
            return (
              <Tap key={x.label} disabled={!n} onPress={() => setFocus(x.label)} scale={0.98} style={s.focus}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="h3">{x.label}</T>
                  <T v="small">{x.about}</T>
                </View>
                <T v="h3" color={c.accent}>{n}</T>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </Tap>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function ExRow({ e, focus, locked, pick, onPress }: { e: Exercise; focus?: string; locked: boolean; pick: boolean; onPress: () => void }) {
  const q = equip(e.equipment);
  return (
    <Tap onPress={onPress} style={s.row} scale={0.98}>
      <Thumb ex={e} size={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <T v="h3" numberOfLines={1}>{e.name}</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <View style={s.tag}><T v="small" color={c.text}>{title(e.level)}</T></View>
          <View style={[s.tag, { backgroundColor: q.color + '22' }]}><T v="small" color={q.color}>{q.label}</T></View>
          {focus && <T v="small" numberOfLines={1}>{focus}</T>}
        </Row>
      </View>
      {locked ? <Ionicons name="lock-closed" size={16} color={c.muted} />
        : <Ionicons name={pick ? 'add-circle' : 'chevron-forward'} size={pick ? 26 : 18} color={pick ? c.accent : c.muted} />}
    </Tap>
  );
}

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 12, marginTop: 14, height: 50, borderRadius: 25, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: c.line },
  input: { flex: 1, color: c.text, fontFamily: f.medium, fontSize: 15, height: 50 },
  block: { width: BLOCK, minHeight: 88, padding: 12, borderRadius: r.md, backgroundColor: c.card, justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  focus: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  start: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
  tag: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: c.card2, justifyContent: 'center' },
});
