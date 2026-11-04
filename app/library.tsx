import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MuscleMap, RED } from '../src/body';
import { doneNote, doneRecently } from '../src/calc';
import { available, byId, exercises, title, type Exercise, type Place } from '../src/data/exercises';
import { focusOf, GROUPS, groupFor, inGroup, office, type Group } from '../src/data/muscles';
import { fit, recommend, type Fit, type Planned } from '../src/data/pairing';
import { gate } from '../src/engine';
import { EASE, Empty, Header } from '../src/kit';
import { useStore } from '../src/store';
import { c, equip, EQUIP, f, r } from '../src/theme';
import { Banner, Chip, ListRow, Row, T, Tap, Thumb } from '../src/ui';

// The muscle page, pushed from Train (?muscle=chest). Without a muscle it lists every exercise, with a muscle filter.
// ?pick=1 is the running workout's "Add exercise": a tap adds the move and goes back. ?equip=none shows bodyweight only.

type Icon = keyof typeof Ionicons.glyphMap;
const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
const LV: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 };
const LINE = '#26262C'; // a quiet 1 px edge so blocks and rows read as separate without standing out
const NONE: string[] = [];
const ALL = 'All';
const FIT_COLOR: Record<Fit['level'], string> = { great: c.ok, ok: c.muted, later: c.warm };
type Note = { id: string; kind: 'later' | 'locked'; text: string };
type Where = 'gym' | 'home' | 'office';
const WHERE: { k: Where; label: string; icon: Icon }[] = [
  { k: 'gym', label: 'Gym', icon: 'barbell' }, { k: 'home', label: 'Home', icon: 'home' }, { k: 'office', label: 'Office', icon: 'briefcase' },
];

// The muscle grid reads top to bottom like a body: upper body, core, lower body, then everything else.
const ORDER = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'neck', 'glutes', 'quads', 'hamstrings', 'calves', 'hips', 'mobility', 'cardio', 'pelvic', 'desk'];
const SORTED = [...GROUPS].sort((a, b) => (ORDER.indexOf(a.id) + 99) % 99 - (ORDER.indexOf(b.id) + 99) % 99);
// Which half of the body shows each muscle block best; the rest use the front. Blocks without muscles get an icon.
const SIDE: Record<string, 'front' | 'back'> = { back: 'back', triceps: 'back', glutes: 'back', hamstrings: 'back', calves: 'back' };
const ICON: Record<string, Icon> = { mobility: 'body', cardio: 'heart', pelvic: 'flower', desk: 'eye' };

// Exercises a place supports: home uses the person's gear, office only desk-friendly moves. Animated demos first.
export function poolFor(where: Where, gear: string[], bare = false) {
  return exercises.filter((e) =>
    (where === 'gym' || (where === 'home' ? available(e, 'home', gear) : office(e))) && (!bare || available(e, 'home', [])),
  ).sort((a, b) => LV[a.level] - LV[b.level] || Number(!!b.art) - Number(!!a.art));
}

// Content entering: a short rise, staggered, on the shared curve (reduced motion is honoured by Reanimated).
export const Enter = ({ i = 0, children, style }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <Animated.View entering={FadeInDown.delay(Math.min(i, 6) * 60).duration(380).easing(EASE)} style={style}>{children}</Animated.View>
);

// Back to the running workout without ever stacking a second one: pop to it when it is below us, else open it.
export function useOpenSession() {
  const nav = useNavigation();
  return () => {
    const st = nav.getState();
    const routes = st?.routes ?? [];
    const i = st?.index ?? routes.length - 1;
    if (routes[i - 1]?.name === 'session') router.back();
    else if (routes.some((x) => x.name === 'session')) router.dismissTo('/session');
    else router.navigate('/session');
  };
}

// The muscle blocks, shared with Train. Still maps (no animation hooks) and memoised tiles keep the page scrolling smooth.
export function MuscleGrid({ where, onOpen }: { where: Where; onOpen: (id: string) => void }) {
  const gear = useStore((s) => s.profile.gear);
  const counts = useMemo(() => {
    const pool = poolFor(where, gear);
    return Object.fromEntries(GROUPS.map((x) => [x.id, pool.filter((e) => inGroup(x, e)).length]));
  }, [where, gear]);
  return (
    <View style={s.grid}>
      {SORTED.map((x) => <Block key={x.id} g={x} n={counts[x.id] ?? 0} onOpen={onOpen} />)}
    </View>
  );
}

const Block = memo(function Block({ g, n, onOpen }: { g: Group; n: number; onOpen: (id: string) => void }) {
  return (
    <Tap disabled={!n} onPress={() => onOpen(g.id)} style={s.block} scale={0.96}>
      {g.muscles ? <MuscleMap primary={g.muscles} secondary={NONE} size={56} side={SIDE[g.id] ?? 'front'} still />
        : <View style={s.circle}><Ionicons name={ICON[g.id] ?? 'fitness'} size={24} color={RED} /></View>}
      <T v="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 6, textAlign: 'center', fontSize: 15 }}>{g.label}</T>
      <T v="small" style={{ textAlign: 'center', fontSize: 12 }}>{n} moves</T>
    </Tap>
  );
});

export default function Library() {
  const { pick, muscle, equip: eq } = useLocalSearchParams<{ pick?: string; muscle?: string; equip?: string }>();
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const active = useStore((s) => s.active);
  const addItem = useStore((s) => s.addItem);
  const startSingle = useStore((s) => s.startSingle);
  const done = sessions.length;
  const recent = useMemo(() => doneRecently(sessions), [sessions]);
  const place: Place = active?.place ?? (profile.place === 'home' ? 'home' : 'gym');
  const fixed = muscle ? (GROUPS.some((x) => x.id === muscle) ? muscle : groupFor(muscle)) : null;

  const [q, setQ] = useState('');
  const [where, setWhere] = useState<Where>(pick ? place : profile.place === 'office' ? 'office' : profile.place === 'home' ? 'home' : 'gym');
  const [bare, setBare] = useState(eq === 'none');
  const [gid, setGid] = useState<string | null>(fixed);
  const [focus, setFocus] = useState(ALL);
  const [lvl, setLvl] = useState<string>(ALL);
  const [kit, setKit] = useState<string>(ALL);
  const [note, setNote] = useState<Note | null>(null); // pick mode: a locked move explained, or a poor fit waiting for a second tap
  useEffect(() => { setFocus(ALL); setKit(ALL); }, [gid]);
  useEffect(() => { if (eq === 'none') setBare(true); }, [eq]);

  const g = GROUPS.find((x) => x.id === gid);
  const pool = useMemo(() => poolFor(where, profile.gear, bare), [where, profile.gear, bare]);
  const whole = useMemo(() => (g ? pool.filter((e) => inGroup(g, e)) : pool), [pool, g]);
  const kits = useMemo(() => [...new Set(whole.map((e) => equip(e.equipment).label))], [whole]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = useMemo(() => whole.filter((e) =>
    (lvl === ALL || e.level === lvl) && (kit === ALL || equip(e.equipment).label === kit) &&
    (focus === ALL || focusOf(e, g?.id)?.label === focus) &&
    words.every((w) => e.name.toLowerCase().includes(w) || e.equipment.includes(w) || e.primary.some((m) => m.includes(w)))),
  [whole, lvl, kit, focus, q, g]);
  // What the running workout already holds, for the fit tags and suggestions in pick mode.
  const planned = useMemo<Planned[]>(() => (active?.items ?? []).flatMap((it) => (byId[it.exId] ? [{ ex: byId[it.exId], sets: it.sets.length }] : [])), [active]);
  const picks = useMemo(() => (pick ? recommend(planned, place, profile.gear, profile, done) : []), [pick, planned, place, profile, done]);

  const details = (e: Exercise) => router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
  const add = (e: Exercise) => {
    if (active) addItem(e.id);
    else startSingle(e.id, place); // no workout running (opened from a link): start one with this move
    setNote(null);
    if (router.canGoBack()) router.back();
    else router.replace('/session');
  };
  // Pick mode adds and goes back. A locked move is explained first (a second tap opens its page); a move that fits
  // badly ("Better on another day") asks once before it is added.
  const open = (e: Exercise) => {
    if (!pick) return details(e);
    const again = note?.id === e.id;
    const lock = gate(e, profile, done);
    if (lock.locked) {
      if (again) return details(e);
      const left = lock.sessionsLeft ?? 0;
      return setNote({ id: e.id, kind: 'locked', text: lock.safety ? lock.reason ?? 'Paused for your safety.' : `${e.name} unlocks after ${left} more session${left === 1 ? '' : 's'}.` });
    }
    const m = fit(e, planned);
    if (m.level === 'later' && !again) return setNote({ id: e.id, kind: 'later', text: `${e.name} · ${m.reason}` });
    add(e);
  };

  const heading = pick ? 'Add exercise' : g ? g.label : 'Exercises';
  const filtered = lvl !== ALL || kit !== ALL || focus !== ALL || bare;

  const head = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      {g && !words.length && <Enter><T color={c.muted}>{g.does}</T></Enter>}
      <Enter i={1}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.bleed}>
          {WHERE.map((w) => <Chip key={w.k} label={w.label} icon={w.icon} on={where === w.k} onPress={() => setWhere(w.k)} />)}
          {bare && <Chip label="No equipment" icon="close" on color={c.ok} onPress={() => setBare(false)} />}
        </ScrollView>
      </Enter>
      {g && g.focus.length > 0 && (
        <Enter i={2}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.bleed}>
            {[ALL, ...g.focus.map((x) => x.label)].map((x) => <Chip key={x} label={x === ALL ? 'All areas' : x} on={focus === x} onPress={() => setFocus(x)} />)}
          </ScrollView>
        </Enter>
      )}
      {picks.length > 0 && !words.length && !gid && (
        <Enter i={3} style={{ gap: 8 }}>
          <T v="h3">Suggested</T>
          {picks.map((x) => (
            <ListRow key={x.ex.id} thumb={<Thumb ex={x.ex} size={44} />} title={x.ex.name} sub={x.reason} onPress={() => open(x.ex)} style={s.edge}
              right={<Ionicons name="add-circle" size={26} color={c.accent} />} />
          ))}
        </Enter>
      )}
      <T v="small">{list.length} {list.length === 1 ? 'move' : 'moves'}</T>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={heading} />
      {/* Pinned: search, then level and equipment filters (and the muscle filter when no muscle was given). */}
      <View style={s.search}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={g ? `Search ${g.label.toLowerCase()} moves` : 'Search squat, dumbbell, plank'}
          placeholderTextColor={c.dim} style={s.input} returnKeyType="search" />
        {!!q && <Tap onPress={() => setQ('')} feedback="none"><Ionicons name="close-circle" size={18} color={c.muted} /></Tap>}
      </View>
      <View style={{ gap: 8, paddingTop: 12, paddingBottom: 8 }}>
        {!fixed && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <Chip label="All muscles" on={!gid} onPress={() => setGid(null)} />
            {SORTED.map((x) => <Chip key={x.id} label={x.label} on={gid === x.id} onPress={() => setGid(x.id)} />)}
          </ScrollView>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[ALL, ...LEVELS].map((l) => <Chip key={l} label={l === ALL ? 'All levels' : title(l)} on={lvl === l} onPress={() => setLvl(l)} />)}
        </ScrollView>
        {kits.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {[ALL, ...kits].map((k) => {
              const col = k === ALL ? c.accent : Object.values(EQUIP).find((x) => x.label === k)?.color;
              return <Chip key={k} label={k === ALL ? 'All equipment' : k} on={kit === k} color={col} onPress={() => setKit(k)} />;
            })}
          </ScrollView>
        )}
      </View>
      {pick && note && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <Banner icon={note.kind === 'locked' ? 'lock-closed' : 'alert-circle'} color={c.warm} title={note.text}
            action={note.kind === 'locked' ? 'Details' : 'Add anyway'}
            onPress={() => { const e = byId[note.id]; if (note.kind === 'locked') details(e); else add(e); }} />
        </View>
      )}
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={s.list}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={head}
        ListEmptyComponent={
          <Empty icon="search" title={filtered ? 'Nothing matches these filters' : words.length ? 'No moves match that search' : 'Nothing here for this place yet'}
            action={filtered ? 'Clear filters' : undefined} onPress={() => { setLvl(ALL); setKit(ALL); setFocus(ALL); setBare(false); }} />
        }
        renderItem={({ item }) => (
          <ExRow e={item} focus={focusOf(item, g?.id)?.label} locked={gate(item, profile, done).locked} match={pick ? fit(item, planned) : undefined}
            onPress={() => open(item)} at={recent.get(item.id)} />
        )}
      />
    </View>
  );
}

const Gap = () => <View style={{ height: 8 }} />;

// In pick mode (`match` set) the row shows how well the move fits the workout instead of its focus area.
const ExRow = memo(function ExRow({ e, focus, locked, match, onPress, at }: { e: Exercise; focus?: string; locked: boolean; match?: Fit; onPress: () => void; at?: number }) {
  const q = equip(e.equipment);
  const pick = !!match;
  return (
    <Tap onPress={onPress} style={[s.row, at !== undefined && { borderColor: c.ok + '55' }]} scale={0.98}>
      <Thumb ex={e} size={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <T v="h3" numberOfLines={1}>{e.name}</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <View style={[s.tag, { backgroundColor: q.color + '22' }]}><T v="small" color={q.color}>{q.label}</T></View>
          <View style={s.tag}><T v="small" color={c.text}>{title(e.level)}</T></View>
          {match ? (
            <View style={[s.tag, { backgroundColor: FIT_COLOR[match.level] + '22' }]}><T v="small" color={FIT_COLOR[match.level]}>{match.reason}</T></View>
          ) : focus ? <T v="small" numberOfLines={1}>{focus}</T> : null}
        </Row>
        {at !== undefined && <Row gap={4}><Ionicons name="checkmark-circle" size={14} color={c.ok} /><T v="small" color={c.ok} numberOfLines={1}>{doneNote(at).text}</T></Row>}
      </View>
      {locked ? <Ionicons name="lock-closed" size={16} color={c.muted} />
        : <Ionicons name={pick ? 'add-circle' : 'chevron-forward'} size={pick ? 26 : 18} color={pick ? c.accent : c.muted} />}
    </Tap>
  );
});

const s = StyleSheet.create({
  search: { marginHorizontal: 12, height: 48, borderRadius: 14, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line },
  input: { flex: 1, color: c.text, fontFamily: f.medium, fontSize: 16, height: 48 },
  chips: { paddingHorizontal: 12, gap: 8 },
  bleed: { marginHorizontal: -12 },
  list: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 120 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  block: { width: '31.5%', height: 118, padding: 8, borderRadius: r.lg, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: LINE },
  circle: { width: 56, height: 56, borderRadius: 28, backgroundColor: RED + '22', alignItems: 'center', justifyContent: 'center' },
  edge: { borderWidth: 1, borderColor: LINE, borderRadius: r.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: LINE },
  tag: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: c.card2, justifyContent: 'center' },
});
