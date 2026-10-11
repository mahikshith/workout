import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { available, exercises, MUSCLES, title } from '../src/data/exercises';
import { useStore } from '../src/store';
import { c, f, r } from '../src/theme';
import { Chip, Row, T, Tap, Thumb } from '../src/ui';

export default function Library() {
  const ins = useSafeAreaInsets();
  const { pick, muscle: m0 } = useLocalSearchParams<{ pick?: string; muscle?: string }>();
  const profile = useStore((s) => s.profile);
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
    );
  }, [q, muscle, homeOnly, profile]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8 }}>
      <Row style={{ paddingHorizontal: 20 }}>
        <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        <T v="h1" style={{ flex: 1 }}>{pick ? 'Add exercise' : 'Exercises'}</T>
        <T v="small">{list.length}</T>
      </Row>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search squat, dumbbell, plank…" placeholderTextColor={c.dim} style={s.input} />
        {!!q && <Tap onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={c.muted} /></Tap>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 12 }}>
        <Chip label="🏠 Home-friendly" on={homeOnly} onPress={() => setHomeOnly(!homeOnly)} color={c.blue} />
        {MUSCLES.map((m) => <Chip key={m} label={title(m)} on={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />)}
      </ScrollView>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        initialNumToRender={14}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: ins.bottom + 40, gap: 8 }}
        renderItem={({ item: e }) => (
          <Tap
            onPress={() => {
              if (pick) { addItem(e.id); router.back(); } else router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
});
