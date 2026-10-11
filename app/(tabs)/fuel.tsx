import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { dayKey, targets } from '../../src/calc';
import { foodsFor } from '../../src/data/foods';
import { useStore } from '../../src/store';
import { c, f, r } from '../../src/theme';
import { Button, Card, Ring, Rise, Row, Screen, T, Tap } from '../../src/ui';

export default function Fuel() {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water[dayKey()] ?? 0);
  const { addMeal, removeMeal, addWater } = useStore.getState();
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '' });
  if (!profile) return null;

  const t = targets(profile);
  const today = meals.filter((m) => m.day === dayKey());
  const kcal = today.reduce((a, m) => a + m.kcal, 0);
  const protein = today.reduce((a, m) => a + m.protein, 0);
  const left = t.kcal - kcal;

  return (
    <Screen>
      <Rise><T v="display">Fuel</T></Rise>
      <Rise i={1}><T v="small">{profile.diet} · {profile.goal} · BMI {t.bmi.toFixed(1)}</T></Rise>

      <Rise i={2}>
        <Card style={{ marginTop: 18, alignItems: 'center' }}>
          <Ring size={190} stroke={16} progress={kcal / t.kcal} color={left < 0 ? c.danger : c.warm}>
            <T style={{ fontFamily: f.display, fontSize: 44 }}>{Math.abs(left)}</T>
            <T v="label">{left >= 0 ? 'kcal left' : 'kcal over'}</T>
          </Ring>
          <Row style={{ marginTop: 18, alignSelf: 'stretch' }}>
            <Macro label="Eaten" value={`${kcal}`} unit="kcal" />
            <Macro label="Target" value={`${t.kcal}`} unit="kcal" />
            <Macro label="Protein" value={`${protein}/${t.protein}`} unit="g" color={c.pink} />
          </Row>
          <View style={s.bar}><View style={{ width: `${Math.min(100, (protein / t.protein) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: c.pink }} /></View>
        </Card>
      </Rise>

      <Rise i={3}>
        <Card style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <T v="label">Water</T>
              <T v="h2" style={{ marginTop: 4 }}>{water} / {t.water} glasses</T>
            </View>
            <Row gap={8}>
              <Tap onPress={() => addWater(-1)} style={s.round}><Ionicons name="remove" size={20} color={c.text} /></Tap>
              <Tap onPress={() => addWater(1)} style={[s.round, { backgroundColor: c.blue }]}><Ionicons name="water" size={20} color={c.accentInk} /></Tap>
            </Row>
          </Row>
          <Row style={{ marginTop: 14, flexWrap: 'wrap' }} gap={6}>
            {Array.from({ length: t.water }, (_, i) => (
              <View key={i} style={[s.glass, i < water && { backgroundColor: c.blue, borderColor: c.blue }]} />
            ))}
          </Row>
        </Card>
      </Rise>

      <Rise i={4}>
        <T v="label" style={{ marginTop: 26, marginBottom: 10 }}>Quick add · fits your diet</T>
        <View style={s.grid}>
          {foodsFor(profile.diet).map((fd) => (
            <Tap key={fd.name} onPress={() => addMeal({ name: fd.name, kcal: fd.kcal, protein: fd.protein })} style={s.food} scale={0.95}>
              <T style={{ fontSize: 26 }}>{fd.emoji}</T>
              <T v="small" color={c.text} numberOfLines={1}>{fd.name}</T>
              <T v="label">{fd.kcal} kcal · {fd.protein}g</T>
            </Tap>
          ))}
        </View>
      </Rise>

      <Rise i={5}>
        <Card style={{ marginTop: 14, gap: 10 }}>
          <T v="label">Log something else</T>
          <TextInput value={custom.name} onChangeText={(name) => setCustom({ ...custom, name })} placeholder="What did you eat?" placeholderTextColor={c.dim} style={s.input} />
          <Row gap={10}>
            <TextInput value={custom.kcal} onChangeText={(kcal) => setCustom({ ...custom, kcal: kcal.replace(/\D/g, '') })} placeholder="kcal" keyboardType="number-pad" placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
            <TextInput value={custom.protein} onChangeText={(protein) => setCustom({ ...custom, protein: protein.replace(/\D/g, '') })} placeholder="protein g" keyboardType="number-pad" placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
          </Row>
          <Button title="Add" icon="add" kind="ghost" disabled={!custom.name || !custom.kcal}
            onPress={() => { addMeal({ name: custom.name, kcal: +custom.kcal, protein: +custom.protein || 0 }); setCustom({ name: '', kcal: '', protein: '' }); }} />
        </Card>
      </Rise>

      <Rise i={6}>
        <T v="label" style={{ marginTop: 26, marginBottom: 10 }}>Today’s log</T>
        {today.length === 0 && <T v="body" color={c.muted}>Nothing logged yet. Tap a food above.</T>}
        {today.map((m) => (
          <Animated.View key={m.id} entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={s.meal}>
            <View style={{ flex: 1 }}>
              <T v="h3">{m.name}</T>
              <T v="small">{m.kcal} kcal · {m.protein} g protein</T>
            </View>
            <Tap onPress={() => removeMeal(m.id)} style={s.round}><Ionicons name="trash-outline" size={18} color={c.muted} /></Tap>
          </Animated.View>
        ))}
      </Rise>
    </Screen>
  );
}

const Macro = ({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <T style={{ fontFamily: f.display, fontSize: 20, color: color ?? c.text }}>{value}<T v="small"> {unit}</T></T>
    <T v="label">{label}</T>
  </View>
);

const s = StyleSheet.create({
  bar: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: c.card2, marginTop: 14 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  glass: { width: 22, height: 30, borderRadius: 6, borderWidth: 1.5, borderColor: c.dim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  food: { width: '31%', flexGrow: 1, padding: 12, borderRadius: r.md, backgroundColor: c.card, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  input: { height: 48, borderRadius: 14, backgroundColor: c.card2, paddingHorizontal: 14, color: c.text, fontFamily: f.medium, fontSize: 15 },
  meal: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: r.md, backgroundColor: c.card, marginBottom: 8 },
});
