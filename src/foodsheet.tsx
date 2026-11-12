// The one place food is logged: Fuel's Log food button and meal rows, Today's food ring and the workout summary all
// open this sheet. `FoodPicker` is the sheet's body; app/food.tsx reuses it as a full page for old links.
//
// Logging a common food is two taps from Fuel (Log food, then its +); tapping the food itself picks the servings
// (½, 1, 1½, 2 ...) first. Anything not in the list can be logged by typing it: "2 roti, dal and rice" gets a calorie
// and protein estimate from the foods we know, and a name alone is enough (calories are optional). The sheet can log to
// yesterday for something forgotten. MealSheet edits or removes one logged food.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { dayKey } from './calc';
import { fits, foods, type Food } from './data/foods';
import { GROUPS, groupFor, perServing, recipesFor, type Recipe } from './data/recipes';
import { EASE, Segmented } from './kit';
import { Sheet } from './sheet';
import { Meta, type MetaItem } from './tip';
import { useStore, type Meal, type MealSlot } from './store';
import { c, dom, f, r, tint } from './theme';
import { Button, haptic, IconBox, Row, T, Tap } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;
export type FoodTab = 'recipes' | 'foods' | 'custom';
export const SLOTS: { id: MealSlot; name: string; icon: Icon }[] = [
  { id: 'breakfast', name: 'Breakfast', icon: 'sunny' },
  { id: 'lunch', name: 'Lunch', icon: 'restaurant' },
  { id: 'snack', name: 'Snack', icon: 'cafe' },
  { id: 'dinner', name: 'Dinner', icon: 'moon' },
];
export const slotName = (id: MealSlot) => SLOTS.find((x) => x.id === id)!.name;
// The meal that fits the time of day.
export const slotNow = (h = new Date().getHours()): MealSlot => (h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner');
export const isGentle = (p: { gentle?: boolean; concerns?: string[] }) => !!(p.gentle || p.concerns?.includes('food'));

// Everyday single items the main food list (data/foods.ts, built around protein) doesn't have, so a normal meal can be
// found or estimated. Honest per-serving approximations.
const STAPLES: Food[] = [
  { name: 'Rice', serving: '1 cup cooked', kcal: 205, protein: 4, kind: 'vegan', icon: 'restaurant' },
  { name: 'Dal', serving: '1 bowl', kcal: 180, protein: 9, kind: 'vegan', icon: 'restaurant' },
  { name: 'Chapati / phulka', serving: '1 piece', kcal: 100, protein: 3, kind: 'vegan', icon: 'disc' },
  { name: 'Paratha', serving: '1 piece', kcal: 260, protein: 5, kind: 'veg', icon: 'disc' },
  { name: 'Sabzi / vegetable curry', serving: '1 bowl', kcal: 150, protein: 4, kind: 'vegan', icon: 'leaf' },
  { name: 'Sambar', serving: '1 bowl', kcal: 130, protein: 6, kind: 'vegan', icon: 'cafe' },
  { name: 'Idli', serving: '1 piece', kcal: 60, protein: 2, kind: 'vegan', icon: 'disc' },
  { name: 'Dosa', serving: '1 plain', kcal: 170, protein: 4, kind: 'vegan', icon: 'disc' },
  { name: 'Masala dosa', serving: '1 piece', kcal: 390, protein: 8, kind: 'veg', icon: 'disc' },
  { name: 'Poha', serving: '1 plate', kcal: 270, protein: 6, kind: 'vegan', icon: 'restaurant' },
  { name: 'Upma', serving: '1 plate', kcal: 250, protein: 6, kind: 'veg', icon: 'restaurant' },
  { name: 'Khichdi', serving: '1 bowl', kcal: 320, protein: 12, kind: 'veg', icon: 'restaurant' },
  { name: 'Curd rice', serving: '1 bowl', kcal: 300, protein: 8, kind: 'veg', icon: 'restaurant' },
  { name: 'Veg biryani', serving: '1 plate', kcal: 450, protein: 10, kind: 'veg', icon: 'restaurant' },
  { name: 'Chicken biryani', serving: '1 plate', kcal: 600, protein: 28, kind: 'meat', icon: 'restaurant' },
  { name: 'Egg', serving: '1 egg', kcal: 78, protein: 6, kind: 'egg', icon: 'egg' },
  { name: 'Bread', serving: '1 slice', kcal: 80, protein: 3, kind: 'vegan', icon: 'fast-food' },
  { name: 'Sandwich', serving: '1 sandwich', kcal: 300, protein: 12, kind: 'veg', icon: 'fast-food' },
  { name: 'Pasta', serving: '1 plate', kcal: 400, protein: 14, kind: 'veg', icon: 'restaurant' },
  { name: 'Noodles', serving: '1 plate', kcal: 380, protein: 10, kind: 'veg', icon: 'restaurant' },
  { name: 'Pizza', serving: '1 slice', kcal: 285, protein: 12, kind: 'veg', icon: 'pizza' },
  { name: 'Burger', serving: '1 burger', kcal: 450, protein: 20, kind: 'veg', icon: 'fast-food' },
  { name: 'Samosa', serving: '1 piece', kcal: 260, protein: 4, kind: 'vegan', icon: 'triangle' },
  { name: 'Biscuits', serving: '2 pieces', kcal: 90, protein: 1, kind: 'veg', icon: 'disc' },
  { name: 'Chocolate', serving: '30 g', kcal: 160, protein: 2, kind: 'veg', icon: 'cube' },
  { name: 'Orange', serving: '1 medium', kcal: 60, protein: 1, kind: 'vegan', icon: 'nutrition' },
  { name: 'Mango', serving: '1 medium', kcal: 150, protein: 1, kind: 'vegan', icon: 'nutrition' },
  { name: 'Tea with milk', serving: '1 cup', kcal: 70, protein: 2, kind: 'veg', icon: 'cafe' },
  { name: 'Coffee with milk', serving: '1 cup', kcal: 60, protein: 2, kind: 'veg', icon: 'cafe' },
  { name: 'Fruit juice', serving: '1 glass', kcal: 110, protein: 1, kind: 'vegan', icon: 'beaker' },
  { name: 'Soft drink', serving: '330 ml', kcal: 140, protein: 0, kind: 'vegan', icon: 'beaker' },
  { name: 'Beer', serving: '330 ml', kcal: 150, protein: 1, kind: 'vegan', icon: 'beer' },
];
const ALL: Food[] = [...foods, ...STAPLES.filter((s) => !foods.some((x) => x.name.toLowerCase() === s.name.toLowerCase()))];

// --- "Describe what you ate": split the text into items, read a leading amount, and match each item to a known food.
const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5, some: 1 };
const aliases = (fd: Food) => fd.name.toLowerCase().split(/\s*(?:\/|\+|,|\()\s*/).map((x) => x.replace(/\)$/, '').trim()).filter((x) => x.length > 1);
const singular = (w: string) => (w.length > 3 ? w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : w); // eggs, rotis, idlis
function bestFood(part: string): Food | null {
  let best: Food | null = null, score = 0;
  const p = singular(part);
  for (const fd of ALL) {
    const as = aliases(fd);
    const combo = /\+/.test(fd.name); // "Paneer bhurji + roti" is a plate, not a roti
    for (const a of as) {
      const s = a === part || a === p ? (combo ? 3 : 5) : part.includes(a) && a.length >= 3 ? 2 + a.length / 100 : a.includes(p) && p.length >= 3 ? 1 + p.length / 100 - (combo ? 0.5 : 0) : 0;
      if (s > score) { score = s; best = fd; }
    }
  }
  return best;
}
export type Estimate = { kcal: number; protein: number; from: string[] };
export function estimate(text: string): Estimate | null {
  const parts = text.toLowerCase().split(/,|\+|&|\n|\band\b|\bwith\b/).map((x) => x.trim()).filter(Boolean);
  let kcal = 0, protein = 0;
  const from: string[] = [];
  for (const raw of parts) {
    const m = raw.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|half|some)\s+(.*)$/);
    const qty = m ? (WORDS[m[1]] ?? (parseFloat(m[1]) || 1)) : 1;
    const name = (m ? m[2] : raw).replace(/\b(plate|plates|bowl|bowls|cup|cups|glass|glasses|piece|pieces|slice|slices|of)\b/g, '').trim();
    if (!name) continue;
    const fd = bestFood(name);
    if (!fd) continue;
    // Foods served as "2 pieces" or "2 eggs" count per piece when the person gave a number.
    const per = m && /^\s*(\d+)\s+(pieces|eggs|slices)/.exec(fd.serving);
    const n = per ? qty / Number(per[1]) : qty;
    kcal += fd.kcal * n; protein += fd.protein * n;
    from.push(qty !== 1 ? `${fd.name} ×${qty}` : fd.name);
  }
  return from.length ? { kcal: Math.round(kcal / 5) * 5, protein: Math.round(protein), from } : null;
}

const TABS: { k: FoodTab; label: string }[] = [{ k: 'foods', label: 'Foods' }, { k: 'recipes', label: 'Recipes' }, { k: 'custom', label: 'Your own' }];
const KIND_ICON = { vegan: 'leaf', veg: 'nutrition', egg: 'egg', fish: 'fish', meat: 'flame' } as const;
const EMPTY = { name: '', kcal: '', protein: '', carbs: '', fat: '' };
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const digits = (v: string) => v.replace(/\D/g, '');
const opt = (v: string) => (v ? +v : undefined);

export const findFood = (name: string) => ALL.find((x) => x.name.toLowerCase() === name.toLowerCase());
// ½, 1, 1½, 2 ... servings.
export const servings = (n: number) => { const w = Math.floor(n), half = n - w >= 0.5 ? '½' : ''; return w ? `${w}${half}` : half || '0'; };
const servWord = (n: number) => `${servings(n)} serving${n === 1 ? '' : 's'}`;
const SERVINGS = [0.5, 1, 1.5, 2, 3];
// kcal and protein as icon + number (flame, and the protein leaf in its pink), for list rows.
const kp = (kcal: number, protein: number, about = ''): MetaItem[] => [
  { icon: 'flame', text: `${about}${kcal} kcal`, color: dom.kcal },
  { icon: 'nutrition', text: `${about}${protein} g`, color: dom.protein },
];

// Days: logging something forgotten files it under that day, at the same clock time.
const DAY_MS = 86400000;
export const yesterday = () => dayKey(Date.now() - DAY_MS);
export const dayLabel = (d: string) => {
  if (d === dayKey()) return 'Today';
  if (d === yesterday()) return 'Yesterday';
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const atFor = (d: string) => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(); x.setFullYear(y, m - 1, dd); return x.getTime(); };
export const timeOf = (at?: number) => { if (!at) return ''; const d = new Date(at); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

type Pick = { name: string; serving: string; kcal: number; protein: number; icon: Icon };
type RowItem = { key: string; icon: Icon; title: string; sub?: string; meta?: MetaItem[]; said?: string; log: () => void; open?: () => void; kind?: 'own' | 'recipe' | 'food'; divider?: string; name?: string };

// Which meal this goes to. Defaults to the meal that fits the time of day.
export function SlotPicker({ value, onChange }: { value: MealSlot; onChange: (s: MealSlot) => void }) {
  return (
    <Row gap={6}>
      {SLOTS.map((x) => {
        const on = x.id === value;
        return (
          <Tap key={x.id} onPress={() => onChange(x.id)} scale={0.95} style={[s.slot, on && { backgroundColor: c.accent, borderColor: c.accent }]}
            accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={x.name}>
            <T v="small" numberOfLines={1} color={on ? c.accentInk : c.muted}>{x.name}</T>
          </Tap>
        );
      })}
    </Row>
  );
}

// Slot picker, search, tabs and a virtualised list. Tapping a food opens its serving picker (½, 1, 1½, 2 ...); its +
// logs one serving straight away with a light haptic and a short "Added" note with Undo. Tapping a recipe's name hands
// its id to onRecipe (the caller opens it). `food` opens straight on that food's servings; onDone then runs after logging.
export function FoodPicker({ slot: slot0, tab: tab0 = 'foods', query: q0 = '', food, day, onRecipe, onDone, listHeight }: {
  slot?: MealSlot; tab?: FoodTab; query?: string; food?: string; day?: string; onRecipe: (id: string, slot: MealSlot) => void; onDone?: () => void; listHeight?: number;
}) {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const addMeal = useStore((s) => s.addMeal);
  const removeMeal = useStore((s) => s.removeMeal);
  const still = useReducedMotion();
  const [slot, setSlot] = useState<MealSlot>(slot0 ?? slotNow());
  const [tab, setTab] = useState<FoodTab>(tab0);
  const [q, setQ] = useState(q0);
  const [form, setForm] = useState(EMPTY);
  const [pick, setPick] = useState<Pick | null>(() => (food && findFood(food)) || null);
  const [added, setAdded] = useState<{ key: string; n: number; ids: string[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const gentle = isGentle(profile);
  const when = day ?? dayKey();
  const past = when !== dayKey();
  const meal = slotName(slot).toLowerCase();
  const where = past ? `${dayLabel(when).toLowerCase()}'s ${meal}` : meal; // "yesterday's lunch"
  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;

  const log = (key: string, name: string, kcal: number, protein: number, extra?: { carbs?: number; fat?: number }) => {
    addMeal({
      name, kcal: gentle ? 0 : Math.round(kcal), protein: gentle ? 0 : Math.round(protein), slot,
      ...(gentle || !extra ? {} : extra), ...(past ? { day: when, at: atFor(when) } : {}),
    });
    const id = useStore.getState().meals.at(-1)?.id;
    haptic('light');
    if (onDone) { onDone(); return; }
    setAdded((a) => ({ key, n: (a?.n ?? 0) + 1, ids: [...(a?.ids ?? []), ...(id ? [id] : [])] }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(null), 2600);
  };
  // Undo takes back the last one logged (tap again for the one before).
  const undo = () => {
    if (!added) return;
    const id = added.ids.at(-1);
    if (id) removeMeal(id);
    const ids = added.ids.slice(0, -1);
    setAdded(ids.length ? { key: '', n: ids.length, ids } : null);
    haptic('light');
  };

  // Recent: what you logged before, newest first, one tap to log again.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Meal[] = [];
    for (let i = meals.length - 1; i >= 0 && out.length < 8; i--) {
      const m = meals[i];
      const k = m.name.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(m); }
    }
    return out;
  }, [meals]);

  // Recipes for your diet, the group that fits you first.
  const mine = groupFor(profile, gentle);
  const order = [mine, ...GROUPS.filter((g) => g !== mine)];
  const recipeRow = (x: Recipe): RowItem => {
    const p = perServing(x);
    return {
      key: 'r:' + x.id, kind: 'recipe', icon: KIND_ICON[x.kind], title: x.name, open: () => onRecipe(x.id, slot),
      meta: [{ icon: 'time-outline', text: `${x.minutes} min` }, ...(gentle ? [] : kp(p.kcal, p.protein))],
      said: gentle ? `${x.minutes} minutes` : `${x.minutes} minutes, ${p.kcal} kcal, ${p.protein} grams protein`,
      log: () => log('r:' + x.id, x.name, p.kcal, p.protein),
    };
  };
  const recipes = recipesFor(profile).filter((x) => x.name.toLowerCase().includes(needle)).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  const foodRow = (x: Food): RowItem => ({
    key: 'f:' + x.name, kind: 'food', icon: x.icon, title: x.name, open: () => setPick(x),
    sub: gentle ? undefined : x.serving, meta: gentle ? undefined : kp(x.kcal, x.protein),
    said: gentle ? undefined : `${x.serving}, ${x.kcal} kcal, ${x.protein} grams protein`,
    log: () => log('f:' + x.name, x.name, x.kcal, x.protein),
  });
  const matching = ALL.filter((x) => x.name.toLowerCase().includes(needle));
  const mineFoods = matching.filter((x) => fits(profile.diet, x.kind));
  const outside = searching ? matching.filter((x) => !fits(profile.diet, x.kind)) : [];
  const divider = (title: string): RowItem => ({ key: 'd:' + title, icon: 'remove', title: '', log: () => {}, divider: title });

  // What you typed, as a meal of your own, with an estimate when we recognise what's in it.
  const est = searching ? estimate(q) : null;
  const ownRow: RowItem | null = searching ? {
    key: 'own', kind: 'own', icon: 'create', title: `Log "${q.trim()}"`, name: `"${q.trim()}"`,
    sub: gentle || !est ? 'Your own meal' : undefined, meta: !gentle && est ? kp(est.kcal, est.protein, '~') : undefined,
    said: gentle ? 'as your own meal' : est ? `about ${est.kcal} kcal, ${est.protein} grams protein` : 'as your own meal, calories optional',
    log: () => log('own', cap(q.trim()), est?.kcal ?? 0, est?.protein ?? 0),
    open: () => { setForm({ ...EMPTY, name: cap(q.trim()) }); setQ(''); setTab('custom'); },
  } : null;

  const rows: RowItem[] = searching
    ? [
      ...(ownRow ? [ownRow] : []),
      ...mineFoods.map(foodRow),
      ...(recipes.length ? [divider('Recipes'), ...recipes.map(recipeRow)] : []),
      ...(outside.length ? [divider('Not in your diet'), ...outside.map(foodRow)] : []),
    ]
    : tab === 'recipes' ? recipes.map(recipeRow) : mineFoods.map(foodRow);

  const formEst = form.name.trim() ? estimate(form.name) : null;
  const addCustom = () => {
    const kcal = form.kcal ? +form.kcal : formEst?.kcal ?? 0;
    const protein = form.protein ? +form.protein : form.kcal ? 0 : formEst?.protein ?? 0;
    log('custom', cap(form.name.trim()), kcal, protein, { carbs: opt(form.carbs), fat: opt(form.fat) });
    setForm(EMPTY);
  };

  const renderRow = ({ item, index }: { item: RowItem; index: number }) => {
    if (item.divider) {
      return (
        <View style={s.divider}>
          <View style={s.rule} />
          <T v="label" color={c.muted}>{item.divider}</T>
          <View style={s.rule} />
        </View>
      );
    }
    const done = added?.key === item.key;
    const own = item.kind === 'own';
    const tone = own ? c.accent : item.kind === 'recipe' ? dom.protein : dom.kcal;
    return (
      <Animated.View entering={!still && index < 6 ? FadeInDown.delay(index * 50).duration(320).easing(EASE) : undefined}
        style={[s.row, own && { backgroundColor: tint(c.accent, 0.8), borderColor: tint(c.accent, 2.5) }]}>
        <Tap onPress={item.open ?? item.log} feedback="none" scale={0.98} style={s.rowMain}
          accessibilityLabel={`${own ? `Edit ${item.name} before logging` : item.kind === 'recipe' ? `${item.title}, open recipe` : `${item.title}, choose servings`}${item.said ? `. ${item.said}` : ''}`}>
          <IconBox icon={item.icon} color={tone} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3" numberOfLines={1} style={{ fontSize: 16 }}>{item.title}</T>
            {item.sub || item.meta ? (
              <Row gap={12}>
                {item.sub ? <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>{item.sub}</T> : null}
                {item.meta ? <Meta items={item.meta} style={{ flexWrap: 'nowrap' }} /> : null}
              </Row>
            ) : null}
          </View>
        </Tap>
        <Tap onPress={item.log} feedback="none" scale={0.85} style={s.plus} accessibilityLabel={`Log ${item.name ?? item.title} to ${where}`}>
          <Ionicons name={done ? 'checkmark-circle' : 'add-circle'} size={32} color={done ? c.ok : c.accent} />
        </Tap>
      </Animated.View>
    );
  };

  const body = listHeight ? { height: listHeight } : { flex: 1 };
  return (
    <View style={listHeight ? undefined : { flex: 1 }}>
      <SlotPicker value={slot} onChange={setSlot} />
      {!pick && tab !== 'custom' && (
        <View style={s.search}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search or type a meal" maxLength={60} accessibilityLabel="Search foods"
            placeholderTextColor={c.muted} style={s.searchInput} autoCorrect={false} returnKeyType="done"
            onSubmitEditing={() => { if (ownRow && !mineFoods.length && !recipes.length) ownRow.log(); }} />
          {q ? <Tap onPress={() => setQ('')} feedback="none" style={s.clear} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={c.muted} /></Tap> : null}
        </View>
      )}
      {!pick && !searching && <Segmented options={TABS} value={tab} onChange={setTab} style={{ marginTop: 12 }} />}

      <View style={[body, { marginTop: 12 }]}>
        {pick ? (
          <Servings key={pick.name} pick={pick} gentle={gentle} where={where} onBack={() => setPick(null)}
            onLog={(n, extra) => { setPick(null); log('f:' + pick.name, n === 1 ? pick.name : `${pick.name} (${servWord(n)})`, pick.kcal * n, pick.protein * n, extra); }} />
        ) : tab === 'custom' && !searching ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeIn.duration(200)} style={{ gap: 8 }}>
              <TextInput value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="e.g. 2 roti, dal and rice" maxLength={60}
                placeholderTextColor={c.muted} style={s.input} autoFocus={false} accessibilityLabel="What did you eat? A name is enough" />
              {!gentle && formEst && (
                <Row gap={8} style={s.estimate}>
                  <Ionicons name="sparkles" size={16} color={dom.kcal} />
                  <T v="small" color={c.text} style={{ flex: 1 }} numberOfLines={2}>
                    ~{formEst.kcal} kcal · {formEst.protein} g protein · {formEst.from.join(', ')}
                  </T>
                </Row>
              )}
              {!gentle && (
                <>
                  <Row gap={8}>
                    <TextInput value={form.kcal} onChangeText={(v) => setForm({ ...form, kcal: digits(v) })} keyboardType="number-pad"
                      placeholder={formEst ? `${formEst.kcal} kcal` : 'kcal'} maxLength={4} placeholderTextColor={c.muted} style={[s.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="kcal, optional" />
                    <TextInput value={form.protein} onChangeText={(v) => setForm({ ...form, protein: digits(v) })} keyboardType="number-pad"
                      placeholder={formEst ? `${formEst.protein} g protein` : 'Protein g'} maxLength={3} placeholderTextColor={c.muted} style={[s.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Protein in grams, optional" />
                  </Row>
                  <Row gap={8}>
                    <TextInput value={form.carbs} onChangeText={(v) => setForm({ ...form, carbs: digits(v) })} keyboardType="number-pad"
                      placeholder="Carbs g" maxLength={3} placeholderTextColor={c.muted} style={[s.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Carbs in grams, optional" />
                    <TextInput value={form.fat} onChangeText={(v) => setForm({ ...form, fat: digits(v) })} keyboardType="number-pad"
                      placeholder="Fat g" maxLength={3} placeholderTextColor={c.muted} style={[s.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Fat in grams, optional" />
                  </Row>
                </>
              )}
              <Button title={`Log to ${where}`} icon="add" disabled={!form.name.trim()} onPress={addCustom} style={{ marginTop: 8 }} />
            </Animated.View>
          </ScrollView>
        ) : (
          <FlatList
            key={searching ? 'search' : tab}
            data={rows}
            keyExtractor={(x) => x.key}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            windowSize={7}
            contentContainerStyle={{ gap: 8, paddingBottom: 64 }}
            ListHeaderComponent={!searching && tab === 'foods' && recent.length ? (
              <View style={{ gap: 8, marginBottom: 4 }}>
                <T v="label">Log again</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
                  {recent.map((m) => (
                    <Tap key={m.id} onPress={() => log('again:' + m.name, m.name, m.kcal, m.protein, { carbs: m.carbs, fat: m.fat })} scale={0.95} style={s.again}
                      accessibilityLabel={`Log ${m.name} again to ${where}`}>
                      <Ionicons name={added?.key === 'again:' + m.name ? 'checkmark' : 'refresh'} size={14} color={c.accent} />
                      <T v="small" color={c.text} numberOfLines={1} style={{ maxWidth: 180 }}>{m.name}</T>
                    </Tap>
                  ))}
                </ScrollView>
                <T v="label" style={{ marginTop: 8 }}>{profile.diet === 'non-veg' ? 'Foods' : 'Foods for your diet'}</T>
              </View>
            ) : null}
            ListEmptyComponent={<T v="small" style={{ marginTop: 8 }}>{tab === 'recipes' ? 'No recipes yet' : 'Nothing here yet'}</T>}
          />
        )}
        {added && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} style={s.toast}>
            <Ionicons name="checkmark-circle" size={18} color={c.ok} />
            <T v="small" color={c.text}>{added.n > 1 ? `Added ${added.n} to ${where}` : `Added to ${where}`}</T>
            <Tap onPress={undo} feedback="none" style={s.undo} accessibilityLabel="Undo"><T v="small" color={c.accent} style={{ fontFamily: f.semi }}>Undo</T></Tap>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// One food, how much of it: ½ to 10 servings, the kcal and protein scaled, optional carbs and fat, then log.
function Servings({ pick, gentle, where, onBack, onLog }: {
  pick: Pick; gentle: boolean; where: string; onBack: () => void; onLog: (n: number, extra?: { carbs?: number; fat?: number }) => void;
}) {
  const [n, setN] = useState(1);
  const [more, setMore] = useState(false);
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const set = (v: number) => setN(Math.min(10, Math.max(0.5, v)));
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>
      <Animated.View entering={FadeIn.duration(180)} style={{ gap: 14 }}>
        <Row gap={10}>
          <Tap onPress={onBack} style={s.back} scale={0.9} accessibilityLabel="Back to the list"><Ionicons name="chevron-back" size={20} color={c.text} /></Tap>
          <IconBox icon={pick.icon} color={dom.kcal} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3" numberOfLines={1}>{pick.name}</T>
            <T v="small" numberOfLines={1}>{gentle ? 'How much?' : `1 serving = ${pick.serving}`}</T>
          </View>
        </Row>
        <View style={s.panel}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Tap onPress={() => set(n - 0.5)} disabled={n <= 0.5} style={s.step} scale={0.9} accessibilityLabel="Half a serving less"><Ionicons name="remove" size={22} color={c.text} /></Tap>
            <View style={{ alignItems: 'center' }}>
              <T v="display">{servings(n)}</T>
              <T v="small">{n === 1 ? 'serving' : 'servings'}</T>
            </View>
            <Tap onPress={() => set(n + 0.5)} disabled={n >= 10} style={s.step} scale={0.9} accessibilityLabel="Half a serving more"><Ionicons name="add" size={22} color={c.text} /></Tap>
          </Row>
          <Row gap={6}>
            {SERVINGS.map((v) => {
              const on = v === n;
              return (
                <Tap key={v} onPress={() => setN(v)} scale={0.94} style={[s.slot, { height: 40 }, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                  accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={servWord(v)}>
                  <T v="small" color={on ? c.accentInk : c.text}>{servings(v)}</T>
                </Tap>
              );
            })}
          </Row>
        </View>
        {!gentle && (
          <Row gap={8}>
            <Amount color={dom.kcal} value={Math.round(pick.kcal * n)} unit="kcal" />
            <Amount color={dom.protein} value={Math.round(pick.protein * n)} unit="g protein" />
          </Row>
        )}
        {!gentle && (more ? (
          <Row gap={8}>
            <TextInput value={carbs} onChangeText={(v) => setCarbs(digits(v))} keyboardType="number-pad" placeholder="Carbs g" maxLength={3}
              placeholderTextColor={c.muted} style={[s.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Carbs in grams, optional" />
            <TextInput value={fat} onChangeText={(v) => setFat(digits(v))} keyboardType="number-pad" placeholder="Fat g" maxLength={3}
              placeholderTextColor={c.muted} style={[s.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Fat in grams, optional" />
          </Row>
        ) : (
          <Tap onPress={() => setMore(true)} style={s.more} scale={0.98} accessibilityLabel="Add carbs and fat, optional">
            <Ionicons name="add" size={16} color={c.accent} />
            <T v="small" color={c.accent}>Carbs and fat</T>
          </Tap>
        ))}
        <Button title={`Log to ${where}`} icon="add" onPress={() => onLog(n, { carbs: opt(carbs), fat: opt(fat) })} />
      </Animated.View>
    </ScrollView>
  );
}

const Amount = ({ color, value, unit }: { color: string; value: number; unit: string }) => (
  <View style={[s.amount, { backgroundColor: tint(color, 0.8) }]}>
    <T v="num" color={c.text}>{value}</T>
    <T v="small" color={color}>{unit}</T>
  </View>
);

// Today or an earlier day. `from` is the earlier day offered (yesterday unless the caller is showing an older day).
function DayPick({ value, from, onChange }: { value: string; from: string; onChange: (d: string) => void }) {
  return (
    <Row gap={0} style={s.days}>
      {[from, dayKey()].map((d) => {
        const on = d === value;
        return (
          <Tap key={d} onPress={() => onChange(d)} scale={0.95} style={[s.day, on && { backgroundColor: c.accent }]}
            accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Log to ${dayLabel(d).toLowerCase()}`}>
            <T v="small" color={on ? c.accentInk : c.muted} numberOfLines={1}>{dayLabel(d)}</T>
          </Tap>
        );
      })}
    </Row>
  );
}

export function FoodSheet({ open, onClose, slot, tab, query, day, food }: {
  open: boolean; onClose: () => void; slot?: MealSlot; tab?: FoodTab; query?: string; day?: string; food?: string;
}) {
  const { height } = useWindowDimensions();
  const [round, setRound] = useState(0); // a fresh picker each time the sheet opens
  const [d, setD] = useState(day ?? dayKey());
  useEffect(() => { if (open) { setRound((n) => n + 1); setD(day ?? dayKey()); } }, [open]);
  // Close first, then open the recipe page once the sheet is on its way down (never a sheet over a pushed screen).
  const openRecipe = (id: string, at: MealSlot) => {
    onClose();
    setTimeout(() => router.push({ pathname: '/food', params: { recipe: id, slot: at } }), 180);
  };
  const from = day && day !== dayKey() ? day : yesterday();
  return (
    <Sheet open={open} onClose={onClose}>
      <Row style={{ marginBottom: 12 }}>
        <T v="h2" style={{ flex: 1 }} numberOfLines={1}>Log food</T>
        <DayPick value={d} from={from} onChange={setD} />
      </Row>
      <FoodPicker key={round} slot={slot} tab={tab} query={query} food={food} day={d} onRecipe={openRecipe} onDone={food ? onClose : undefined}
        listHeight={Math.max(300, Math.min(480, height * 0.52))} />
    </Sheet>
  );
}

// Edit or remove one logged food: name, meal, and (outside gentle mode) kcal, protein, carbs and fat.
export function MealSheet({ meal, onClose }: { meal: Meal | null; onClose: () => void }) {
  const profile = useStore((s) => s.profile);
  const removeMeal = useStore((s) => s.removeMeal);
  const last = useRef<Meal | null>(meal);
  if (meal) last.current = meal; // keeps the content while the sheet slides away
  const m = meal ?? last.current;
  const [form, setForm] = useState(EMPTY);
  const [slot, setSlot] = useState<MealSlot>('snack');
  useEffect(() => {
    if (!meal) return;
    const str = (n?: number) => (n ? String(n) : '');
    setForm({ name: meal.name, kcal: str(meal.kcal), protein: str(meal.protein), carbs: str(meal.carbs), fat: str(meal.fat) });
    setSlot(meal.slot ?? 'snack');
  }, [meal?.id]);
  const gentle = isGentle(profile);
  const save = () => {
    if (!m) return;
    const patch: Partial<Meal> = { name: form.name.trim() || m.name, slot };
    if (!gentle) Object.assign(patch, { kcal: +form.kcal || 0, protein: +form.protein || 0, carbs: opt(form.carbs), fat: opt(form.fat) });
    useStore.setState((st) => ({ meals: st.meals.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) }));
    haptic('success');
    onClose();
  };
  const field = (k: 'kcal' | 'protein' | 'carbs' | 'fat', label: string, max: number) => (
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <T v="label">{label}</T>
      <TextInput value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: digits(v) })} keyboardType="number-pad" maxLength={max}
        placeholder="—" placeholderTextColor={c.muted} style={s.input} accessibilityLabel={label} />
    </View>
  );
  return (
    <Sheet open={!!meal} onClose={onClose}>
      {m && (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 2 }}>
            <T v="h2">Edit food</T>
            <T v="small">{`Logged ${dayLabel(m.day).toLowerCase()}${m.at ? ` at ${timeOf(m.at)}` : ''}`}</T>
          </View>
          <TextInput value={form.name} onChangeText={(name) => setForm({ ...form, name })} maxLength={60} placeholder="Name"
            placeholderTextColor={c.muted} style={s.input} accessibilityLabel="Name" />
          <SlotPicker value={slot} onChange={setSlot} />
          {!gentle && (
            <>
              <Row gap={8}>{field('kcal', 'kcal', 4)}{field('protein', 'Protein g', 3)}</Row>
              <Row gap={8}>{field('carbs', 'Carbs g', 3)}{field('fat', 'Fat g', 3)}</Row>
            </>
          )}
          <Row gap={10} style={{ marginTop: 4 }}>
            <Button title="Remove" kind="danger" icon="trash-outline" style={{ flex: 1, paddingHorizontal: 12 }}
              onPress={() => { removeMeal(m.id); haptic('light'); onClose(); }} />
            <Button title="Save" style={{ flex: 1, paddingHorizontal: 12 }} onPress={save} />
          </Row>
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  slot: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1, borderColor: c.card2, paddingHorizontal: 4 },
  days: { height: 44, borderRadius: 22, backgroundColor: c.card2, padding: 3 },
  day: { height: 38, borderRadius: 19, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, height: 48, borderRadius: r.md, backgroundColor: c.card2, paddingLeft: 14 },
  searchInput: { flex: 1, height: 48, padding: 0, color: c.text, fontFamily: f.medium, fontSize: 15, outlineWidth: 0 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { height: 48, borderRadius: r.md, backgroundColor: c.card2, paddingHorizontal: 14, color: c.text, fontFamily: f.medium, fontSize: 15 },
  estimate: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: r.md, backgroundColor: c.card2 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: r.md, backgroundColor: c.card2, paddingLeft: 10, borderWidth: 1, borderColor: 'transparent' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingHorizontal: 4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.line },
  plus: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  again: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  panel: { gap: 12, padding: 12, borderRadius: r.lg, backgroundColor: c.card2 },
  step: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  amount: { flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 10, borderRadius: r.md },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44 },
  toast: {
    position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 14, height: 44, borderRadius: 22, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  undo: { height: 44, paddingHorizontal: 14, justifyContent: 'center' },
});
