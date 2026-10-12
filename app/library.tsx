import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Dimensions, FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { available, exercises, MUSCLES, title } from '../src/data/exercises';
import { gate } from '../src/engine';
import { useStore } from '../src/store';
import { c, f, r } from '../src/theme';
import { Chip, Row, T, Tap, Thumb } from '../src/ui';

const LEVEL = { beginner: 0, intermediate: 1, expert: 2 };
const TILE = Math.floor((Math.min(Dimensions.get('window').width, 600) - 50) / 2);

// Also mounted as the Exercises tab (tab = true): grid layout, no back button.
export default function Library({ tab }: { tab?: boolean }) {
  const ins = useSafeAreaInsets();
  const { pick, muscle: m0 } = useLocalSearchParams<{ pick?: string; muscle?: string }>();
  const profile = useStore((s) => s.profile);
  const done = useStore((s) => s.sessions.length);
  const addItem = useStore((s) => s.addItem);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(m0 ?? null);
  const [homeOnly, setHomeOnly] = useState(false);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return exercises.filter((e) =>
      (!muscle || e.primary.includes(muscle)) &&
      (!homeOnly || available(e, 'home', profile?.gear ?? [])) &&
      words.every((w) => e.name.toLowerCase().includes(w) || e.equipment.includes(w)),
    ).sort((a, b) => Number(!!b.art) - Number(!!a.art) || LEVEL[a.level] - LEVEL[b.level]); // animated demos first, easiest first
  }, [q, muscle, homeOnly, profile]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8 }}>
      <Row style={{ paddingHorizontal: 20 }}>
        {!tab && <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>}
        <T v={tab ? 'display' : 'h1'} style={{ flex: 1 }}>{pick ? 'Add exercise' : 'Exercises'}</T>
        <T v="small">{list.length}</T>
      </Row>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search squat, dumbbell, plank…" placeholderTextColor={c.dim} style={s.input} />
        {!!q && <Tap onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={c.muted} /></Tap>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 12 }}>
        <Chip label="Home-friendly" icon="home" on={homeOnly} onPress={() => setHomeOnly(!homeOnly)} color={c.blue} />
        {MUSCLES.map((m) => <Chip key={m} label={title(m)} on={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />)}
      </ScrollView>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        initialNumToRender={14}
        windowSize={7}
        key={tab ? 'grid' : 'list'}
        numColumns={tab ? 2 : 1}
        columnWrapperStyle={tab ? { gap: 10 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: ins.bottom + (tab ? 110 : 40), gap: tab ? 10 : 8 }}
        renderItem={({ item: e }) => tab ? (
          <Tap onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })} style={s.tile} scale={0.97}>
            <Thumb ex={e} size={TILE} />
            {gate(e, profile, done).locked && (
              <View style={s.lock}><Ionicons name="lock-closed" size={12} color={c.text} /></View>
            )}
            <View style={{ padding: 10, gap: 2 }}>
              <T v="h3" numberOfLines={2}>{e.name}</T>
              <T v="small" numberOfLines={1}>{title(e.primary[0])} · {title(e.equipment)}</T>
            </View>
          </Tap>
        ) : (
          <Tap
            onPress={() => {
              if (pick && !gate(e, profile, done).locked) { addItem(e.id); router.back(); } else router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
            }}
            style={s.row} scale={0.98}
          >
            <Thumb ex={e} size={56} />
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>{e.name}</T>
              <T v="small">{title(e.primary[0])} · {title(e.equipment)}</T>
            </View>
            <Ionicons name={pick ? 'add-circle' : 'chevron-forward'} size={pick ? 26 : 18} color={pick ? c.accent : c.muted} />
          </Tap>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 20, marginTop: 14, height: 50, borderRadius: 25, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: c.line },
  input: { flex: 1, color: c.text, fontFamily: f.medium, fontSize: 15, height: 50 },
  lock: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(10,10,11,0.75)', alignItems: 'center', justifyContent: 'center' },
  tile: { width: TILE, borderRadius: r.md, backgroundColor: c.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
});
