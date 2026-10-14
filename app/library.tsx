import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Dimensions, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MuscleMap, RED } from '../src/body';
import { available, byId, exercises, title, type Exercise, type Place } from '../src/data/exercises';
import { dose, doseText, focusOf, GROUPS, groupFor, inGroup, office, restText, type Group } from '../src/data/muscles';
import { fit, recommend, type Fit, type Planned } from '../src/data/pairing';
import { gate } from '../src/engine';
import { doneNote, doneRecently } from '../src/calc';
import { useStore } from '../src/store';
import { c, equip, f, r } from '../src/theme';
import { Avatar, Banner, Card, Chip, ListRow, Row, Section, T, Tap, Thumb } from '../src/ui';

const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
const BLOCK = Math.floor((Math.min(Dimensions.get('window').width, 600) - 24 - 12) / 2); // two columns: 12 px gutters, one 12 px gap
const LINE = '#26262C'; // a quiet 1 px edge so blocks and rows read as separate without standing out
// The muscle grid reads top to bottom like a body: upper body, core, lower body, then everything else.
const REGIONS: { label: string; ids: string[] }[] = [
  { label: 'Upper body', ids: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'] },
  { label: 'Core and neck', ids: ['abs', 'neck'] },
  { label: 'Lower body', ids: ['glutes', 'quads', 'hamstrings', 'calves', 'hips'] },
  { label: 'More', ids: ['mobility', 'cardio', 'pelvic', 'desk'] },
];
type Icon = keyof typeof Ionicons.glyphMap;
// Which half of the body shows each muscle block best; the rest use the front. Blocks without muscles get an icon.
const SIDE: Record<string, 'front' | 'back'> = { back: 'back', triceps: 'back', glutes: 'back', hamstrings: 'back', calves: 'back' };
const ICON: Record<string, Icon> = { mobility: 'body', cardio: 'heart', pelvic: 'flower', desk: 'eye' };
const NONE: string[] = [];
const FIT_COLOR: Record<Fit['level'], string> = { great: c.ok, ok: c.muted, later: c.warm };
type Note = { id: string; kind: 'later' | 'locked'; text: string };
type Where = 'gym' | 'home' | 'office';
const WHERE: { k: Where; label: string; icon: Icon }[] = [
  { k: 'gym', label: 'Gym', icon: 'barbell' }, { k: 'home', label: 'Home', icon: 'home' }, { k: 'office', label: 'Office', icon: 'briefcase' },
];
const ALL = 'All';

// Also mounted as the Exercises tab (tab = true). Muscle blocks -> the muscle's focus areas -> exercises by level.
// ?equip=none (Today's "No equipment needed") shows bodyweight moves only; ?muscle=chest opens that block.
export default function Library({ tab }: { tab?: boolean }) {
  const ins = useSafeAreaInsets();
  const { pick, muscle, equip: eq } = useLocalSearchParams<{ pick?: string; muscle?: string; equip?: string }>();
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const done = sessions.length;
  const recent = useMemo(() => doneRecently(sessions), [sessions]);
  const addItem = useStore((s) => s.addItem);
  const startSingle = useStore((s) => s.startSingle);
  const active = useStore((s) => s.active);
  const place: Place = active?.place ?? (profile.place === 'home' ? 'home' : 'gym');
  const [q, setQ] = useState('');
  const [where, setWhere] = useState<Where>(pick ? place : profile.place === 'home' ? 'home' : 'gym');
  const [note, setNote] = useState<Note | null>(null); // pick mode: a locked move explained, or a poor fit waiting for a second tap
  const [bare, setBare] = useState(eq === 'none');
  const [gid, setGid] = useState<string | null>(muscle ? groupFor(muscle) : null);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => { if (eq === 'none') { setBare(true); setGid(null); setFocus(null); } }, [eq]);
  useEffect(() => { if (muscle) { setGid(groupFor(muscle)); setFocus(null); } }, [muscle]);

  const g = GROUPS.find((x) => x.id === gid);
  const fo = g && !g.focus.length ? ALL : focus; // a group without focus areas goes straight to its list
  const up = () => { setNote(null); if (g && focus && g.focus.length) setFocus(null); else if (g) setGid(null); else router.back(); };
  const openGroup = useCallback((id: string) => { setGid(id); setFocus(null); }, []);
  useEffect(() => {
    if (!g) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { up(); return true; });
    return () => sub.remove();
  }, [g, focus]);

  const pool = useMemo(() => exercises.filter((e) =>
    (where === 'gym' || (where === 'home' ? available(e, 'home', profile.gear) : office(e))) && (!bare || available(e, 'home', [])),
  ).sort((a, b) => Number(!!b.art) - Number(!!a.art)), [where, bare, profile]); // animated demos first
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((x) => [x.id, pool.filter((e) => inGroup(x, e)).length])), [pool]);
  // What the active workout already holds, for the fit tags and suggestions in pick mode.
  const planned = useMemo<Planned[]>(() => (active?.items ?? []).flatMap((it) => (byId[it.exId] ? [{ ex: byId[it.exId], sets: it.sets.length }] : [])), [active]);
  const picks = useMemo(() => (pick ? recommend(planned, place, profile.gear, profile, done) : []), [pick, planned, place, profile, done]);
  const inG = useMemo(() => (g ? pool.filter((e) => inGroup(g, e)) : pool), [pool, g]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = words.length || fo
    ? inG.filter((e) => (!fo || fo === ALL || focusOf(e, g?.id)?.label === fo) &&
        words.every((w) => e.name.toLowerCase().includes(w) || e.equipment.includes(w)))
    : [];
  const sections = LEVELS.map((l) => ({ title: title(l), data: list.filter((e) => e.level === l) })).filter((x) => x.data.length);
  const starters = g ? inG.filter((e) => e.level === 'beginner' && !gate(e, profile, done).locked).slice(0, 3) : [];

  const details = (e: Exercise) => router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
  const add = (e: Exercise) => {
    if (active) addItem(e.id);
    else startSingle(e.id, place); // no workout running (e.g. opened from a link): start one with this move
    setNote(null);
    if (router.canGoBack()) router.back();
    else router.replace('/session');
  };
  // Pick mode adds and goes back. A locked move is explained here first (a second tap opens its page); a move that
  // fits badly ("Better on another day") asks once before it is added.
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
  const pad = { paddingHorizontal: 12, paddingBottom: ins.bottom + (tab ? 110 : 40) };
  const heading = g ? (fo && fo !== ALL ? `${g.label}: ${fo}` : g.label) : pick ? 'Add exercise' : 'Exercises';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8 }}>
      <Row style={{ paddingHorizontal: 12 }}>
        {(g || !tab) && <Tap onPress={up} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>}
        <T v={tab && !g ? 'display' : g ? 'h2' : 'h1'} style={{ flex: 1 }} numberOfLines={1}>{heading}</T>
        <T v="small">{words.length || fo ? list.length : inG.length}</T>
        {tab && <Avatar />}
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
      {pick && note && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <Banner icon={note.kind === 'locked' ? 'lock-closed' : 'alert-circle'} color={c.warm} title={note.text}
            action={note.kind === 'locked' ? 'Details' : 'Add anyway'}
            onPress={() => { const e = byId[note.id]; if (note.kind === 'locked') details(e); else add(e); }} />
        </View>
      )}

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
            <ExRow e={item} focus={focusOf(item, g?.id)?.label} locked={gate(item, profile, done).locked} match={pick ? fit(item, planned) : undefined}
              onPress={() => open(item)} at={recent.get(item.id)} />
          )}
          ListEmptyComponent={<T v="small" style={{ marginTop: 12 }}>Nothing here for this place yet. Try Gym.</T>}
        />
      ) : !g ? (
        <ScrollView contentContainerStyle={pad} showsVerticalScrollIndicator={false}>
          {picks.length > 0 && (
            <Section title="Suggested" style={{ marginTop: 0, marginBottom: 20 }}>
              <View style={{ gap: 8 }}>
                {picks.map((x) => (
                  <ListRow key={x.ex.id} thumb={<Thumb ex={x.ex} size={44} />} title={x.ex.name} sub={x.reason} onPress={() => open(x.ex)} style={s.edge}
                    right={<Ionicons name="add-circle" size={26} color={c.accent} />} />
                ))}
              </View>
            </Section>
          )}
          {REGIONS.map((reg) => (
            <View key={reg.label}>
              <T v="h3" style={{ marginTop: 6, marginBottom: 12 }}>{reg.label}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {GROUPS.filter((x) => reg.ids.includes(x.id)).map((x) => <Block key={x.id} g={x} n={counts[x.id] ?? 0} onOpen={openGroup} />)}
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

// A muscle block: that group's muscles in red on one half of the body (still, so a grid of them stays cheap),
// or an icon for groups with nothing on the map; the name and move count centred below.
const Block = memo(function Block({ g, n, onOpen }: { g: Group; n: number; onOpen: (id: string) => void }) {
  return (
    <Tap disabled={!n} onPress={() => onOpen(g.id)} style={s.block}>
      {g.muscles ? <MuscleMap primary={g.muscles} secondary={NONE} size={68} side={SIDE[g.id] ?? 'front'} still />
        : <View style={s.circle}><Ionicons name={ICON[g.id] ?? 'fitness'} size={30} color={RED} /></View>}
      <T v="h3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 8, textAlign: 'center' }}>{g.label}</T>
      <T v="small" style={{ textAlign: 'center' }}>{n} moves</T>
    </Tap>
  );
});

// In pick mode (`match` set) the row shows how well the move fits the workout instead of its focus area.
function ExRow({ e, focus, locked, match, onPress, at }: { e: Exercise; focus?: string; locked: boolean; match?: Fit; onPress: () => void; at?: number }) {
  const q = equip(e.equipment);
  const pick = !!match;
  return (
    <Tap onPress={onPress} style={[s.row, at !== undefined && { borderWidth: 1, borderColor: c.ok + '55' }]} scale={0.98}>
      <Thumb ex={e} size={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <T v="h3" numberOfLines={1}>{e.name}</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <View style={s.tag}><T v="small" color={c.text}>{title(e.level)}</T></View>
          <View style={[s.tag, { backgroundColor: q.color + '22' }]}><T v="small" color={q.color}>{q.label}</T></View>
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
}

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 12, marginTop: 14, height: 50, borderRadius: 25, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: c.line },
  input: { flex: 1, color: c.text, fontFamily: f.medium, fontSize: 15, height: 50 },
  block: { width: BLOCK, height: 152, padding: 12, borderRadius: r.lg, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: LINE },
  circle: { width: 68, height: 68, borderRadius: 34, backgroundColor: RED + '22', alignItems: 'center', justifyContent: 'center' },
  edge: { borderWidth: 1, borderColor: LINE, borderRadius: r.lg },
  focus: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: LINE },
  start: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: LINE },
  tag: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: c.card2, justifyContent: 'center' },
});
