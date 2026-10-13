import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '../src/calc';
import { foodsFor, type Food } from '../src/data/foods';
import { GROUPS, groupFor, perServing, recipeById, recipesFor, totals, type Recipe } from '../src/data/recipes';
import { swapFor } from '../src/data/swaps';
import { useStore, type MealSlot } from '../src/store';
import { c, f, r } from '../src/theme';
import { Banner, Button, Card, IconBox, ListRow, Row, Section, Stepper, T, Tap, Tile } from '../src/ui';

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const fade = () => FadeIn.duration(280).easing(EASE);
type Icon = keyof typeof Ionicons.glyphMap;
const NAMES: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const SLOT_ICON: Record<MealSlot, Icon> = { breakfast: 'sunny', lunch: 'restaurant', snack: 'cafe', dinner: 'moon' };
const ICON = { vegan: 'leaf', veg: 'nutrition', egg: 'egg', fish: 'fish', meat: 'flame' } as const;
const TABS = ['Recipes', 'Foods', 'Custom'] as const;
const EMPTY = { name: '', kcal: '', protein: '' };
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const plural = (n: number) => `${fmt(n)} serving${n === 1 ? '' : 's'}`;
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
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
  const whole = open && totals(open);
  const todays = meals.filter((m) => m.day === dayKey());
  const logged = (x: Recipe) => todays.find((m) => m.name === x.name || m.name.startsWith(x.name + ' ('));
  const already = open ? logged(open) : undefined;
  const logRecipe = () => {
    if (!open || !per || already) return;
    addMeal({ name: serv === 1 ? open.name : `${open.name} (${plural(serv)})`, kcal: Math.round(per.kcal * serv), protein: Math.round(per.protein * serv), slot });
    if (recipe) router.back(); else setOpen(null);
  };

  const recRow = (x: Recipe) => {
    const p = perServing(x);
    return (
      <ListRow key={x.id} icon={ICON[x.kind]} color={c.pink} title={x.name} onPress={() => show(x)}
        sub={gentle ? `${x.minutes} min` : `${x.minutes} min · ${p.kcal} kcal · ${p.protein} g protein`}
        right={logged(x) ? <Ionicons name="checkmark-circle" size={22} color={c.ok} /> : undefined} />
    );
  };
  const foodRow = (fd: Food) => {
    const on = items.some((m) => m.name === fd.name);
    return (
      <ListRow key={fd.name} icon={fd.icon} color={c.pink} title={fd.name} onPress={() => toggle(fd)}
        sub={gentle ? undefined : `${fd.serving} · ${fd.kcal} kcal · ${fd.protein} g protein`}
        right={<Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={on ? c.ok : c.dim} />} />
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: ins.top + 12, paddingHorizontal: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Tap onPress={back} style={s.round}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
          <T v="label" numberOfLines={1} style={{ flexShrink: 1 }}>{open ? 'Recipe' : `Add to ${meal}`}</T>
          <View style={{ width: 44 }} />
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + 24 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* What this meal holds so far. */}
        <Card style={{ marginTop: 12 }}>
          <Row>
            <IconBox icon={SLOT_ICON[slot]} color={items.length ? c.ok : c.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="h3" numberOfLines={1}>{NAMES[slot]} today</T>
              <T v="small" numberOfLines={1}>{items.length ? items.map((m) => m.name).join(', ') : 'Nothing yet'}</T>
            </View>
            {!gentle && (
              <View style={{ alignItems: 'flex-end' }}>
                <T v="h3" color={c.warm} numberOfLines={1}>{kcal}<T v="small"> kcal</T></T>
                <T v="small" color={c.pink} numberOfLines={1}>{protein} g protein</T>
              </View>
            )}
          </Row>
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
          <View style={s.search}>
            <Ionicons name="search" size={18} color={c.dim} />
            <TextInput value={q} onChangeText={setQ} placeholder={tab === 'Recipes' ? 'Search recipes' : 'Search foods'} maxLength={40}
              placeholderTextColor={c.dim} style={s.searchInput} />
          </View>
        )}
        {open && per && whole ? (
          <Animated.View key={open.id} entering={fade()}>
            <T v="h1" style={{ marginTop: 24 }}>{open.name}</T>
            <Row gap={16} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Meta icon="time-outline" text={`${open.minutes} min`} />
              <Meta icon="people-outline" text={`Serves ${fmt(open.serves)}`} />
              <Meta icon="restaurant-outline" text={cap(open.slots.join(', '))} />
            </Row>
            {!gentle && <T v="small" style={{ marginTop: 12 }}>{open.why}</T>}
            {open.group === 'Pregnancy-friendly' && (
              <View style={{ marginTop: 16 }}>
                <Banner icon="heart" color={c.pink} title="Pregnancy-safe: cooked through and pasteurised. Ask your doctor about your needs." />
              </View>
            )}
            {!gentle && (
              <Row style={{ marginTop: 16 }}>
                <Tile icon="flame" color={c.warm} value={per.kcal} unit="kcal" label="Per serving" />
                <Tile icon="nutrition" color={c.pink} value={per.protein} unit="g" label="Protein per serving" />
              </Row>
            )}

            <Section title="Ingredients">
              <Card style={{ paddingVertical: 4 }}>
                {open.ing.map(([n, amount, k, p], i) => {
                  const swap = swapFor(n);
                  return (
                    <View key={n} style={[s.ing, i > 0 && s.sep]}>
                      <Row style={{ alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <T v="body">{n}</T>
                          {(!gentle || !weighed(amount)) && <T v="small" numberOfLines={1}>{amount}</T>}
                        </View>
                        {!gentle && (
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Pill color={c.warm} text={`${k} kcal`} />
                            <Pill color={c.pink} text={`${p} g protein`} />
                          </View>
                        )}
                      </Row>
                      {swap && (
                        <Row gap={6} style={{ marginTop: 6, alignItems: 'flex-start' }}>
                          <Ionicons name="swap-horizontal" size={14} color={c.blue} style={{ marginTop: 2 }} />
                          <T v="small" color={c.blue} style={{ flex: 1 }}>{swap}</T>
                        </Row>
                      )}
                    </View>
                  );
                })}
                <Row style={[s.ing, s.sep]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3" numberOfLines={1}>Whole recipe</T>
                    <T v="small" numberOfLines={1}>Makes {plural(open.serves)}</T>
                  </View>
                  {!gentle && <T v="small" color={c.text} numberOfLines={1}>{whole.kcal} kcal · {whole.protein} g</T>}
                </Row>
              </Card>
            </Section>

            <Section title="Steps">
              <Card style={{ gap: 16 }}>
                {open.steps.map((x, n) => (
                  <Row key={n} style={{ alignItems: 'flex-start' }}>
                    <View style={[s.num, { backgroundColor: c.accent + '22' }]}><T v="small" color={c.accent}>{n + 1}</T></View>
                    <T v="body" style={{ flex: 1 }}>{x}</T>
                  </Row>
                ))}
              </Card>
            </Section>

            <Section title="More detail">
              <Row>
                <Button title="Search recipe" icon="search" kind="ghost" style={s.half}
                  onPress={() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(open.name + ' recipe')}`)} />
                <Button title="Watch video" icon="logo-youtube" kind="ghost" style={s.half}
                  onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent('how to make ' + open.name)}`)} />
              </Row>
              <T v="small" style={{ marginTop: 8 }}>A fuller walkthrough, found online.</T>
            </Section>
          </Animated.View>
        ) : tab === 'Recipes' ? (
          <Animated.View key="recipes" entering={fade()}>
            {!recs.length && <T v="small" style={{ marginTop: 16 }}>No recipe with that name. Try Foods or Custom.</T>}
            {gentle ? (
              <View style={s.list}>{groups.flatMap((g) => recs.filter((x) => x.group === g)).map(recRow)}</View>
            ) : (
              groups.filter((g) => recs.some((x) => x.group === g)).map((g, i) => (
                <Section key={g} title={g === mine ? `${g} · for you` : g} first={i === 0}>
                  <View style={{ gap: 8 }}>{recs.filter((x) => x.group === g).map(recRow)}</View>
                </Section>
              ))
            )}
          </Animated.View>
        ) : tab === 'Foods' ? (
          <Animated.View key="foods" entering={fade()}>
            <T v="small" numberOfLines={1} style={{ marginTop: 16 }}>{foods.length ? 'Tap to add, tap again to remove.' : 'No match. Add it under Custom.'}</T>
            <View style={s.list}>{foods.map(foodRow)}</View>
          </Animated.View>
        ) : (
          <Animated.View key="custom" entering={fade()}>
            <T v="small" numberOfLines={1} style={{ marginTop: 16 }}>Anything not in the lists.</T>
            <TextInput value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="What did you eat?" maxLength={40}
              placeholderTextColor={c.dim} style={[s.input, { marginTop: 8 }]} />
            {!gentle && (
              <Row gap={8} style={{ marginTop: 8 }}>
                <TextInput value={form.kcal} onChangeText={(v) => setForm({ ...form, kcal: v.replace(/\D/g, '') })} placeholder="Calories" keyboardType="number-pad" maxLength={4} placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
                <TextInput value={form.protein} onChangeText={(v) => setForm({ ...form, protein: v.replace(/\D/g, '') })} placeholder="Protein g" keyboardType="number-pad" maxLength={3} placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
              </Row>
            )}
            <Button title={`Add to ${meal}`} icon="add" disabled={!form.name.trim() || (!gentle && !form.kcal)} onPress={addCustom} style={{ marginTop: 16 }} />
          </Animated.View>
        )}
      </ScrollView>

      {open && per && (
        <Animated.View entering={fade()} style={[s.foot, { paddingBottom: ins.bottom + 12 }]}>
          <T v="small" numberOfLines={1} style={{ marginBottom: 8 }}>
            {gentle ? `You eat ${plural(serv)}` : `${plural(serv)}: ${Math.round(per.kcal * serv)} kcal · ${Math.round(per.protein * serv)} g protein`}
          </T>
          {already ? (
            <Row>
              <Row gap={6} style={{ flex: 1 }}><Ionicons name="checkmark-circle" size={20} color={c.ok} /><T v="small" color={c.text} style={{ flex: 1 }}>{`Logged today${already.slot ? ` at ${NAMES[already.slot].toLowerCase()}` : ''}`}</T></Row>
              <Button title="Remove" icon="trash-outline" kind="ghost" onPress={() => removeMeal(already.id)} style={{ height: 48, paddingHorizontal: 16 }} />
            </Row>
          ) : (
            <Row>
              <Stepper value={serv} onChange={setServ} step={0.5} min={0.5} />
              <Button title={`Add to ${meal}`} icon="add" onPress={logRecipe} style={{ flex: 1, height: 52, paddingHorizontal: 12 }} />
            </Row>
          )}
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const Meta = ({ icon, text }: { icon: Icon; text: string }) => (
  <Row gap={6}><Ionicons name={icon} size={16} color={c.muted} /><T v="small" color={c.text}>{text}</T></Row>
);

const Pill = ({ color, text }: { color: string; text: string }) => (
  <View style={[s.pill, { backgroundColor: color + '22' }]}><T v="small" color={color} numberOfLines={1}>{text}</T></View>
);

const s = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', gap: 4, marginTop: 12, padding: 4, borderRadius: 22, backgroundColor: c.card2 },
  segItem: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, height: 48, borderRadius: r.md, backgroundColor: c.card2, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: 48, padding: 0, color: c.text, fontFamily: f.medium, fontSize: 15 },
  input: { height: 48, borderRadius: r.md, backgroundColor: c.card2, paddingHorizontal: 14, color: c.text, fontFamily: f.medium, fontSize: 15 },
  list: { gap: 8, marginTop: 12 },
  ing: { paddingVertical: 12 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  half: { flex: 1, height: 48, paddingHorizontal: 10 },
  foot: { paddingHorizontal: 12, paddingTop: 12, backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
});
