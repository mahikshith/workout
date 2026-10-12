import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '../src/calc';
import { foodsFor, type Food } from '../src/data/foods';
import { GROUPS, groupFor, perServing, recipeById, recipesFor, totals, type Recipe } from '../src/data/recipes';
import { useStore, type MealSlot } from '../src/store';
import { c, f } from '../src/theme';
import { Button, Card, Row, Stepper, T, Tap } from '../src/ui';

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const fade = () => FadeIn.duration(280).easing(EASE);
const NAMES: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const ICON = { vegan: 'leaf', veg: 'nutrition', egg: 'egg', fish: 'fish', meat: 'flame' } as const;
const TABS = ['Recipes', 'Foods', 'Custom'] as const;
const EMPTY = { name: '', kcal: '', protein: '' };
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const plural = (n: number) => `${fmt(n)} serving${n === 1 ? '' : 's'}`;
const weighed = (amount: string) => /\d\s?(g|ml)\b/.test(amount); // gentle mode hides gram and ml amounts

// Full-screen add-food page for one meal: recipes, single foods, or your own entry. ?recipe= opens a recipe straight away.
export default function AddFood() {
  const { slot: raw, recipe } = useLocalSearchParams<{ slot?: string; recipe?: string }>();
  const slot: MealSlot = raw && raw in NAMES ? (raw as MealSlot) : 'snack';
  const meal = NAMES[slot].toLowerCase();
  const ins = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const { addMeal, removeMeal } = useStore.getState();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Recipes');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Recipe | null>(() => (recipe && recipeById[recipe]) || null);
  const [serv, setServ] = useState(1);
  const [form, setForm] = useState(EMPTY);
  // Android back closes the recipe first, unless the recipe was opened straight from the Fuel plan.
  useEffect(() => {
    if (!open || recipe) return;
    const h = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(null); return true; });
    return () => h.remove();
  }, [open]);

  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));
  const items = meals.filter((m) => m.day === dayKey() && (m.slot ?? 'snack') === slot);
  const kcal = items.reduce((a, m) => a + m.kcal, 0), protein = items.reduce((a, m) => a + m.protein, 0);
  const needle = q.trim().toLowerCase();
  const recs = recipesFor(profile).filter((x) => x.name.toLowerCase().includes(needle));
  const foods = foodsFor(profile.diet).filter((x) => x.name.toLowerCase().includes(needle));
  const mine = groupFor(profile, gentle);
  const groups = [mine, ...GROUPS.filter((g) => g !== mine && !(g === 'Pregnancy-friendly' && profile.gender === 'male'))];
  const back = () => (open && !recipe ? setOpen(null) : router.back());
  const show = (x: Recipe) => { setServ(1); setOpen(x); };
  const toggle = (fd: Food) => {
    const hit = items.filter((m) => m.name === fd.name).pop();
    if (hit) removeMeal(hit.id); else addMeal({ name: fd.name, kcal: fd.kcal, protein: fd.protein, slot });
  };
  const addCustom = () => {
    addMeal({ name: form.name.trim(), kcal: gentle ? 0 : +form.kcal, protein: gentle ? 0 : +form.protein || 0, slot });
    setForm(EMPTY);
  };
  const per = open && perServing(open);
  const logRecipe = () => {
    if (!open || !per) return;
    addMeal({ name: serv === 1 ? open.name : `${open.name} (${plural(serv)})`, kcal: Math.round(per.kcal * serv), protein: Math.round(per.protein * serv), slot });
    if (recipe) router.back(); else setOpen(null);
  };

  const recRow = (x: Recipe) => {
    const p = perServing(x);
    return (
      <Tap key={x.id} onPress={() => show(x)} scale={0.98} style={s.row}>
        <View style={s.icon}><Ionicons name={ICON[x.kind]} size={16} color={c.warm} /></View>
        <View style={{ flex: 1 }}>
          <T v="body" numberOfLines={1}>{x.name}</T>
          <T v="small" numberOfLines={1}>{gentle ? `${x.minutes} min` : `${x.minutes} min · ${p.kcal} kcal · ${p.protein} g protein`}</T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.dim} />
      </Tap>
    );
  };
  const foodRow = (fd: Food) => {
    const on = items.some((m) => m.name === fd.name);
    return (
      <Tap key={fd.name} onPress={() => toggle(fd)} scale={0.98} style={s.row}>
        <View style={s.icon}><Ionicons name={fd.icon} size={16} color={c.warm} /></View>
        <View style={{ flex: 1 }}>
          <T v="body" numberOfLines={1}>{fd.name}</T>
          {!gentle && <T v="small" numberOfLines={1}>{fd.kcal} kcal · {fd.protein} g protein · {fd.serving}</T>}
        </View>
        <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={on ? c.accent : c.dim} />
      </Tap>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: ins.top + 12, paddingHorizontal: 20 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Tap onPress={back} style={s.round}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
          <T v="label" numberOfLines={1} style={{ flexShrink: 1 }}>{open ? 'Recipe' : `Add to ${meal}`}</T>
          <View style={{ width: 40 }} />
        </Row>

        <Card style={{ marginTop: 14, padding: 14 }}>
          <T v="small" numberOfLines={1}>{NAMES[slot]} so far today</T>
          {gentle ? (
            <T v="h3" numberOfLines={1} style={{ marginTop: 4 }}>{items.length ? `${items.length} logged` : 'Nothing yet'}</T>
          ) : (
            <Row gap={16} style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <T v="h2" color={c.warm} numberOfLines={1}>{kcal} <T v="small">kcal</T></T>
              <T v="h2" color={c.pink} numberOfLines={1}>{protein} g <T v="small">protein</T></T>
            </Row>
          )}
          {items.length > 0 && <T v="small" numberOfLines={2} style={{ marginTop: 4 }}>{items.map((m) => m.name).join(', ')}</T>}
        </Card>

        {!open && (
          <View style={s.seg}>
            {TABS.map((x) => (
              <Tap key={x} onPress={() => setTab(x)} scale={0.97} style={[s.segItem, tab === x && { backgroundColor: c.accent }]}>
                <T v="h3" numberOfLines={1} color={tab === x ? c.accentInk : c.muted}>{x}</T>
              </Tap>
            ))}
          </View>
        )}
        {!open && tab !== 'Custom' && (
          <TextInput value={q} onChangeText={setQ} placeholder={tab === 'Recipes' ? 'Search recipes' : 'Search foods'} maxLength={40}
            placeholderTextColor={c.dim} style={[s.input, { marginTop: 12 }]} />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: ins.bottom + 24 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {open && per ? (
          <Animated.View key={open.id} entering={fade()}>
            <T v="h2" style={{ marginTop: 8 }}>{open.name}</T>
            <T v="small" style={{ marginTop: 4 }}>
              Makes {plural(open.serves)} · {open.minutes} min · Good for {open.slots.map((x) => NAMES[x].toLowerCase()).join(', ')}
            </T>
            {!gentle && <T v="body" style={{ marginTop: 10 }}>{open.why}</T>}
            {open.group === 'Pregnancy-friendly' && (
              <T v="small" color={c.text} style={{ marginTop: 10 }}>Made with pregnancy-safe foods: everything cooked through and pasteurised. Check with your doctor about your needs.</T>
            )}
            {!gentle && (
              <Card style={{ marginTop: 14, padding: 14 }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <T v="label" numberOfLines={1}>Per serving</T>
                    <T v="h2" color={c.warm} numberOfLines={1}>{per.kcal} kcal</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="label" numberOfLines={1}>Protein</T>
                    <T v="h2" color={c.pink} numberOfLines={1}>{per.protein} g</T>
                  </View>
                </Row>
              </Card>
            )}

            <T v="h3" style={{ marginTop: 20 }}>Ingredients · makes {plural(open.serves)}</T>
            {open.ing.map(([n, amount, k, p]) => (
              <View key={n} style={s.ing}>
                <View style={{ flex: 1 }}>
                  <T v="body" numberOfLines={2}>{n}</T>
                  {(!gentle || !weighed(amount)) && <T v="small" numberOfLines={1}>{amount}</T>}
                </View>
                {!gentle && (
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[s.pill, { backgroundColor: c.warm + '22' }]}><T v="small" color={c.warm} numberOfLines={1}>{k} kcal</T></View>
                    <View style={[s.pill, { backgroundColor: c.pink + '22' }]}><T v="small" color={c.pink} numberOfLines={1}>{p} g protein</T></View>
                  </View>
                )}
              </View>
            ))}
            {!gentle && (
              <View style={[s.ing, { flexWrap: 'wrap' }]}>
                <T v="h3" style={{ flex: 1, minWidth: 110 }}>Whole recipe</T>
                <T v="small" color={c.text} numberOfLines={1}>{totals(open).kcal} kcal · {totals(open).protein} g protein</T>
              </View>
            )}

            <T v="h3" style={{ marginTop: 20 }}>Steps</T>
            {open.steps.map((x, n) => (
              <Row key={n} gap={12} style={{ alignItems: 'flex-start', marginTop: 12 }}>
                <View style={[s.num, { backgroundColor: c.accent }]}><T v="small" color={c.accentInk}>{n + 1}</T></View>
                <T v="body" style={{ flex: 1 }}>{x}</T>
              </Row>
            ))}
          </Animated.View>
        ) : tab === 'Recipes' ? (
          <Animated.View key="recipes" entering={fade()}>
            {!recs.length && <T v="small" style={{ marginTop: 12 }}>No recipe with that name. Try Foods or Custom.</T>}
            {gentle
              ? groups.flatMap((g) => recs.filter((x) => x.group === g)).map(recRow)
              : groups.map((g) => {
                const list = recs.filter((x) => x.group === g);
                return list.length > 0 && (
                  <View key={g} style={{ marginTop: 14 }}>
                    <T v="label" numberOfLines={1}>{g}{g === mine ? ' · for you' : ''}</T>
                    {list.map(recRow)}
                  </View>
                );
              })}
          </Animated.View>
        ) : tab === 'Foods' ? (
          <Animated.View key="foods" entering={fade()}>
            <T v="small" numberOfLines={2} style={{ marginTop: 8 }}>{foods.length ? 'Fits your diet. Tap to add, tap again to remove.' : 'No match. Add it under Custom.'}</T>
            {foods.map(foodRow)}
          </Animated.View>
        ) : (
          <Animated.View key="custom" entering={fade()}>
            <T v="small" numberOfLines={2} style={{ marginTop: 8 }}>Anything that is not in the lists.</T>
            <TextInput value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="What did you eat?" maxLength={40}
              placeholderTextColor={c.dim} style={[s.input, { marginTop: 10 }]} />
            {!gentle && (
              <Row gap={8} style={{ marginTop: 8 }}>
                <TextInput value={form.kcal} onChangeText={(v) => setForm({ ...form, kcal: v.replace(/\D/g, '') })} placeholder="Calories" keyboardType="number-pad" maxLength={4} placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
                <TextInput value={form.protein} onChangeText={(v) => setForm({ ...form, protein: v.replace(/\D/g, '') })} placeholder="Protein g" keyboardType="number-pad" maxLength={3} placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
              </Row>
            )}
            <Button title={`Add to ${meal}`} icon="add" disabled={!form.name.trim() || (!gentle && !form.kcal)} onPress={addCustom} style={{ marginTop: 14 }} />
          </Animated.View>
        )}
      </ScrollView>

      {open && per && (
        <Animated.View entering={fade()} style={[s.foot, { paddingBottom: ins.bottom + 12 }]}>
          <T v="small" numberOfLines={1} style={{ marginBottom: 8 }}>
            {gentle ? `You eat ${plural(serv)}` : `${plural(serv)}: ${Math.round(per.kcal * serv)} kcal · ${Math.round(per.protein * serv)} g protein`}
          </T>
          <Row>
            <Stepper value={serv} onChange={setServ} step={0.5} min={0.5} />
            <Button title={`Add to ${meal}`} icon="add" onPress={logRecipe} style={{ flex: 1, height: 52, paddingHorizontal: 12 }} />
          </Row>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  seg: { flexDirection: 'row', gap: 4, marginTop: 12, padding: 4, borderRadius: 22, backgroundColor: c.card2 },
  segItem: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  input: { height: 48, borderRadius: 14, backgroundColor: c.card2, paddingHorizontal: 14, color: c.text, fontFamily: f.medium, fontSize: 15 },
  ing: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  foot: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
});
