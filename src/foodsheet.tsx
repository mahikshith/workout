// The one place food is added: Fuel's Add button, Today's food ring and the workout summary all open this sheet.
// `FoodPicker` is the sheet's body; app/food.tsx reuses it as a full page for old links.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { fits, foods, type Food } from './data/foods';
import { GROUPS, groupFor, perServing, recipesFor, type Recipe } from './data/recipes';
import { EASE, Segmented } from './kit';
import { Sheet } from './sheet';
import { useStore, type MealSlot } from './store';
import { c, f, r } from './theme';
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

const TABS: { k: FoodTab; label: string }[] = [{ k: 'recipes', label: 'Recipes' }, { k: 'foods', label: 'Foods' }, { k: 'custom', label: 'Custom' }];
const KIND_ICON = { vegan: 'leaf', veg: 'nutrition', egg: 'egg', fish: 'fish', meat: 'flame' } as const;
const EMPTY = { name: '', kcal: '', protein: '' };

type RowItem = { key: string; icon: Icon; title: string; sub?: string; log: () => void; recipe?: string; divider?: string };

// Slot picker, tabs, search and a virtualised list. Tapping + logs to the chosen meal with a light haptic and a short
// "Added" note. Tapping a recipe's name hands its id to onRecipe (the caller opens the recipe page).
export function FoodPicker({ slot: slot0, tab: tab0 = 'recipes', query: q0 = '', onRecipe, listHeight }: {
  slot?: MealSlot; tab?: FoodTab; query?: string; onRecipe: (id: string, slot: MealSlot) => void; listHeight?: number;
}) {
  const profile = useStore((s) => s.profile);
  const addMeal = useStore((s) => s.addMeal);
  const still = useReducedMotion();
  const [slot, setSlot] = useState<MealSlot>(slot0 ?? slotNow());
  const [tab, setTab] = useState<FoodTab>(tab0);
  const [q, setQ] = useState(q0);
  const [form, setForm] = useState(EMPTY);
  const [added, setAdded] = useState<{ key: string; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const gentle = isGentle(profile);
  const meal = slotName(slot).toLowerCase();
  const needle = q.trim().toLowerCase();

  const log = (key: string, name: string, kcal: number, protein: number) => {
    addMeal({ name, kcal: gentle ? 0 : kcal, protein: gentle ? 0 : protein, slot });
    haptic('light');
    setAdded((a) => ({ key, n: (a?.n ?? 0) + 1 }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(null), 1400);
  };

  // Recipes for your diet, the group that fits you first.
  const mine = groupFor(profile, gentle);
  const order = [mine, ...GROUPS.filter((g) => g !== mine)];
  const recipeRows: RowItem[] = recipesFor(profile)
    .filter((x) => x.name.toLowerCase().includes(needle))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .map((x: Recipe) => {
      const p = perServing(x);
      return {
        key: 'r:' + x.id, icon: KIND_ICON[x.kind], title: x.name, recipe: x.id,
        sub: gentle ? `${x.minutes} min` : `${x.minutes} min · ${p.kcal} kcal · ${p.protein} g protein`,
        log: () => log('r:' + x.id, x.name, p.kcal, p.protein),
      };
    });
  const foodRow = (x: Food): RowItem => ({
    key: 'f:' + x.name, icon: x.icon, title: x.name,
    sub: gentle ? undefined : `${x.serving} · ${x.kcal} kcal · ${x.protein} g protein`,
    log: () => log('f:' + x.name, x.name, x.kcal, x.protein),
  });
  const matching = foods.filter((x) => x.name.toLowerCase().includes(needle));
  // Foods for your diet first. A search also shows matches outside it, under a small divider, instead of "No match".
  const outside = needle ? matching.filter((x) => !fits(profile.diet, x.kind)) : [];
  const foodRows: RowItem[] = [
    ...matching.filter((x) => fits(profile.diet, x.kind)).map(foodRow),
    ...(outside.length ? [{ key: 'divider', icon: 'remove' as Icon, title: '', log: () => {}, divider: 'Not in your diet' }, ...outside.map(foodRow)] : []),
  ];
  const rows = tab === 'recipes' ? recipeRows : foodRows;

  const addCustom = () => {
    log('custom', form.name.trim(), +form.kcal || 0, +form.protein || 0);
    setForm(EMPTY);
  };

  const renderRow = ({ item, index }: { item: RowItem; index: number }) => {
    if (item.divider) {
      return (
        <View style={s.divider}>
          <View style={s.rule} />
          <T v="label" color={c.dim}>{item.divider}</T>
          <View style={s.rule} />
        </View>
      );
    }
    const done = added?.key === item.key;
    return (
      <Animated.View entering={!still && index < 6 ? FadeInDown.delay(index * 50).duration(320).easing(EASE) : undefined} style={s.row}>
        <Tap onPress={item.recipe ? () => onRecipe(item.recipe!, slot) : item.log} feedback="none" scale={0.98} style={s.rowMain}>
          <IconBox icon={item.icon} color={c.pink} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3" numberOfLines={1} style={{ fontSize: 16 }}>{item.title}</T>
            {item.sub ? <T v="small" numberOfLines={1}>{item.sub}</T> : null}
          </View>
          {item.recipe ? <Ionicons name="chevron-forward" size={16} color={c.dim} /> : null}
        </Tap>
        <Tap onPress={item.log} feedback="none" scale={0.85} style={s.plus}>
          <Ionicons name={done ? 'checkmark-circle' : 'add-circle'} size={30} color={done ? c.ok : c.accent} />
        </Tap>
      </Animated.View>
    );
  };

  const body = listHeight ? { height: listHeight } : { flex: 1 };
  return (
    <View style={listHeight ? undefined : { flex: 1 }}>
      {/* Which meal this goes to. Defaults to the meal that fits the time of day. */}
      <Row gap={6}>
        {SLOTS.map((x) => {
          const on = x.id === slot;
          return (
            <Tap key={x.id} onPress={() => setSlot(x.id)} scale={0.95} style={[s.slot, on && { backgroundColor: c.accent + '22', borderColor: c.accent }]}>
              <T v="small" numberOfLines={1} color={on ? c.accent : c.muted}>{x.name}</T>
            </Tap>
          );
        })}
      </Row>
      <Segmented options={TABS} value={tab} onChange={setTab} style={{ marginTop: 12 }} />
      {tab !== 'custom' && (
        <View style={s.search}>
          <Ionicons name="search" size={18} color={c.dim} />
          <TextInput value={q} onChangeText={setQ} placeholder={tab === 'recipes' ? 'Search recipes' : 'Search foods'} maxLength={40}
            placeholderTextColor={c.dim} style={s.searchInput} autoCorrect={false} />
          {q ? <Tap onPress={() => setQ('')} feedback="none" style={s.clear}><Ionicons name="close-circle" size={18} color={c.dim} /></Tap> : null}
        </View>
      )}

      <View style={[body, { marginTop: 12 }]}>
        {tab === 'custom' ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: 8 }}>
            <TextInput value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="What did you eat?" maxLength={40}
              placeholderTextColor={c.dim} style={s.input} />
            {!gentle && (
              <Row gap={8}>
                <TextInput value={form.kcal} onChangeText={(v) => setForm({ ...form, kcal: v.replace(/\D/g, '') })} placeholder="Calories" keyboardType="number-pad"
                  maxLength={4} placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
                <TextInput value={form.protein} onChangeText={(v) => setForm({ ...form, protein: v.replace(/\D/g, '') })} placeholder="Protein g" keyboardType="number-pad"
                  maxLength={3} placeholderTextColor={c.dim} style={[s.input, { flex: 1 }]} />
              </Row>
            )}
            <Button title={`Add to ${meal}`} icon="add" disabled={!form.name.trim() || (!gentle && !form.kcal)} onPress={addCustom} style={{ marginTop: 8 }} />
          </Animated.View>
        ) : (
          <FlatList
            key={tab}
            data={rows}
            keyExtractor={(x) => x.key}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            windowSize={7}
            contentContainerStyle={{ gap: 8, paddingBottom: 56 }}
            ListEmptyComponent={<T v="small" style={{ marginTop: 8 }}>{tab === 'recipes' ? 'No recipe with that name. Try Foods or Custom.' : 'No match. Add it under Custom.'}</T>}
          />
        )}
        {added && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} pointerEvents="none" style={s.toast}>
            <Ionicons name="checkmark-circle" size={18} color={c.ok} />
            <T v="small" color={c.text}>{added.n > 1 ? `Added ${added.n} to ${meal}` : `Added to ${meal}`}</T>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export function FoodSheet({ open, onClose, slot, tab, query }: {
  open: boolean; onClose: () => void; slot?: MealSlot; tab?: FoodTab; query?: string;
}) {
  const { height } = useWindowDimensions();
  const [round, setRound] = useState(0); // a fresh picker each time the sheet opens
  useEffect(() => { if (open) setRound((n) => n + 1); }, [open]);
  // Close first, then open the recipe page once the sheet is on its way down (never a sheet over a pushed screen).
  const openRecipe = (id: string, at: MealSlot) => {
    onClose();
    setTimeout(() => router.push({ pathname: '/food', params: { recipe: id, slot: at } }), 180);
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <T v="h2" style={{ marginBottom: 12 }}>Add food</T>
      <FoodPicker key={round} slot={slot} tab={tab} query={query} onRecipe={openRecipe} listHeight={Math.max(260, Math.min(480, height * 0.5))} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  slot: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1, borderColor: c.card2, paddingHorizontal: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, height: 44, borderRadius: r.md, backgroundColor: c.card2, paddingLeft: 14 },
  searchInput: { flex: 1, height: 44, padding: 0, color: c.text, fontFamily: f.medium, fontSize: 15 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { height: 48, borderRadius: r.md, backgroundColor: c.card2, paddingHorizontal: 14, color: c.text, fontFamily: f.medium, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: r.md, backgroundColor: c.card2, paddingLeft: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingHorizontal: 4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.line },
  plus: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: '#2A2A30', borderWidth: 1, borderColor: c.line,
  },
});
