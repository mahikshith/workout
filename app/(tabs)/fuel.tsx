import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { dayKey, postpartumWeek, pregnancyWeek, targets } from '../../src/calc';
import { BLOATING, SUPPLEMENTS, foodsFor, proteinPicks, type Food } from '../../src/data/foods';
import { mealPlan, perServing, suggest } from '../../src/data/recipes';
import { Rings } from '../../src/rings';
import { useStore, type MealSlot } from '../../src/store';
import { c, f, r } from '../../src/theme';
import { Card, Chip, Fold, IconBox, Rise, Row, Screen, Section, T, Tap, TabTitle } from '../../src/ui';

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const fade = () => FadeIn.duration(280).easing(EASE);
type Icon = keyof typeof Ionicons.glyphMap;
const SLOTS: { id: MealSlot; name: string; icon: Icon }[] = [
  { id: 'breakfast', name: 'Breakfast', icon: 'sunny' },
  { id: 'lunch', name: 'Lunch', icon: 'restaurant' },
  { id: 'snack', name: 'Snack', icon: 'cafe' },
  { id: 'dinner', name: 'Dinner', icon: 'moon' },
];
const slotNow = (h = new Date().getHours()): MealSlot => (h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner');
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export default function Fuel() {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water[dayKey()] ?? 0);
  const sup = useStore((s) => s.supplements);
  const { addMeal, removeMeal, addWater, pickSupplement, takeSupplement } = useStore.getState();
  const [openSlot, setOpenSlot] = useState<MealSlot | null>(null);
  if (!profile) return null;

  // Gentle mode: no calorie, protein, weight, BMI or portion-size numbers anywhere on this screen.
  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));
  const t = targets(profile);
  const today = meals.filter((m) => m.day === dayKey());
  const inSlot = (id: MealSlot) => today.filter((m) => (m.slot ?? 'snack') === id); // meals logged before slots existed count as a snack
  const eaten = SLOTS.filter((x) => inSlot(x.id).length > 0).length;
  const kcal = today.reduce((a, m) => a + m.kcal, 0);
  const protein = today.reduce((a, m) => a + m.protein, 0);
  const left = t.kcal - kcal;
  const now = slotNow();
  const slotOf = (id: MealSlot) => SLOTS.find((x) => x.id === id)!;
  const has = (fd: Food) => inSlot(now).some((m) => m.name === fd.name);
  // One tap logs a food to the current meal, a second tap takes it back off.
  const toggle = (fd: Food) => {
    const hit = inSlot(now).filter((m) => m.name === fd.name).pop();
    if (hit) removeMeal(hit.id); else addMeal({ name: fd.name, kcal: fd.kcal, protein: fd.protein, slot: now });
  };
  const addFood = (slot: MealSlot, recipe?: string) => router.push({ pathname: '/food', params: recipe ? { slot, recipe } : { slot } });
  const plan = mealPlan(profile, gentle);
  const showSup = !gentle && (profile.goal === 'build muscle' || profile.goal === 'get stronger')
    && pregnancyWeek(profile) === null && postpartumWeek(profile) === null && profile.age >= 18;
  const picked = SUPPLEMENTS.filter((x) => sup.picked.includes(x.name));
  const taken = sup.taken[dayKey()] ?? [];
  const light = !gentle && profile.goal === 'lose fat' ? foodsFor(profile.diet).filter((fd) => fd.light) : [];
  const addHint = `Tap to add to ${slotOf(now).name.toLowerCase()}`;

  const foodRow = (fd: Food, sub: string, right?: ReactNode) => {
    const on = has(fd);
    return (
      <Tap key={fd.name} onPress={() => toggle(fd)} scale={0.98} style={s.food}>
        <IconBox icon={fd.icon} color={c.pink} size={32} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="body" numberOfLines={1}>{fd.name}</T>
          {!!sub && <T v="small" numberOfLines={1}>{sub}</T>}
        </View>
        {right}
        <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={on ? c.ok : c.dim} />
      </Tap>
    );
  };

  return (
    <Screen>
      <Rise><TabTitle title="Fuel" /></Rise>

      {/* Hero: the day's rings. Gentle mode counts meals instead of calories. */}
      <Rise i={1}>
        <Card style={{ marginTop: 20 }}>
          <T v="label" numberOfLines={1}>{gentle ? cap(profile.diet) : `${cap(profile.diet)} · ${cap(profile.goal)}`}</T>
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            {gentle ? (
              <Rings size={180} stroke={16} rings={[{ progress: eaten / 4, color: c.accent }]}>
                <T style={s.big}>{eaten}</T>
                <T v="label">of 4 meals</T>
              </Rings>
            ) : (
              <Rings size={180} stroke={14} rings={[{ progress: kcal / t.kcal, color: left < 0 ? c.danger : c.warm }, { progress: protein / t.protein, color: c.pink }]}>
                <T numberOfLines={1} adjustsFontSizeToFit style={[s.big, { maxWidth: 110, textAlign: 'center' }]}>{Math.abs(left)}</T>
                <T v="label">{left < 0 ? 'kcal over' : 'kcal left'}</T>
              </Rings>
            )}
          </View>
          {!gentle && (
            <Row style={{ marginTop: 16 }}>
              <Key icon="flame" color={left < 0 ? c.danger : c.warm} value={kcal} unit={`/ ${t.kcal} kcal`} label="Calories" />
              <Key icon="nutrition" color={c.pink} value={protein} unit={`/ ${t.protein} g`} label={protein >= t.protein ? 'Protein goal met' : 'Protein'} />
            </Row>
          )}
        </Card>
      </Rise>

      {/* The four meals as one grouped list. Tap a logged meal to see and remove its items. */}
      <Rise i={2}>
        <Section title="Meals">
          <Card style={{ paddingVertical: 4 }}>
            {SLOTS.map((x, i) => {
              const items = inSlot(x.id);
              const k = items.reduce((a, m) => a + m.kcal, 0);
              const names = items.map((m) => m.name).join(', ');
              const shown = openSlot === x.id && items.length > 0;
              return (
                <View key={x.id} style={i > 0 && s.sep}>
                  <Tap onPress={() => (items.length ? setOpenSlot(shown ? null : x.id) : addFood(x.id))} scale={0.99} feedback="none" style={s.slot}>
                    <IconBox icon={x.icon} color={items.length ? c.ok : c.muted} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="h3" numberOfLines={1}>{x.name}</T>
                      <Row gap={4}>
                        <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>{!items.length ? 'Nothing yet' : gentle ? names : `${k} kcal · ${names}`}</T>
                        {items.length > 0 && <Ionicons name={shown ? 'chevron-up' : 'chevron-down'} size={14} color={c.muted} />}
                      </Row>
                    </View>
                    <Tap onPress={() => addFood(x.id)} style={s.round}><Ionicons name="add" size={22} color={c.text} /></Tap>
                  </Tap>
                  {shown && (
                    <View style={{ paddingBottom: 8 }}>
                      {items.map((m) => (
                        <Animated.View key={m.id} entering={fade()} style={s.item}>
                          <T v="body" numberOfLines={1} style={{ flex: 1 }}>{m.name}</T>
                          {!gentle && <T v="small">{m.kcal} kcal</T>}
                          <Tap onPress={() => removeMeal(m.id)} style={s.x}><Ionicons name="close" size={18} color={c.muted} /></Tap>
                        </Animated.View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </Card>
        </Section>
      </Rise>

      <Rise i={3}>
        <Section title="Water">
          <Card>
            <Row>
              <IconBox icon="water" color={c.blue} />
              <View style={{ flex: 1 }}>
                <T v="h2" numberOfLines={1}>{water}<T v="small"> / {t.water} glasses</T></T>
                <T v="small" numberOfLines={1}>250 ml a glass</T>
              </View>
              <Tap onPress={() => addWater(-1)} disabled={!water} style={s.round}><Ionicons name="remove" size={20} color={c.text} /></Tap>
              <Tap onPress={() => addWater(1)} style={[s.round, { backgroundColor: c.blue }]}><Ionicons name="add" size={20} color={c.accentInk} /></Tap>
            </Row>
            <Row gap={0} style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {Array.from({ length: Math.max(t.water, water) }, (_, i) => (
                // Tap a drop to fill up to it; tap the last full drop again to empty it.
                <Tap key={i} onPress={() => addWater((i + 1 === water ? i : i + 1) - water)} scale={0.85} style={{ padding: 4 }}>
                  <Ionicons name={i < water ? 'water' : 'water-outline'} size={22} color={i < water ? c.blue : c.dim} />
                </Tap>
              ))}
            </Row>
          </Card>
        </Section>
      </Rise>

      {showSup && picked.length > 0 && (
        <Rise i={4}>
          <Section title="Supplements today">
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {picked.map((x) => {
                const on = taken.includes(x.name);
                return <Chip key={x.name} label={x.short} icon={on ? 'checkmark' : 'ellipse-outline'} on={on} color={c.ok} onPress={() => takeSupplement(x.name)} />;
              })}
            </Row>
          </Section>
        </Rise>
      )}

      {/* Occasional reading, closed until asked for. */}
      <Rise i={5} style={{ marginTop: 32, gap: 12 }}>
        <Fold title="Today's plan" icon="calendar">
          <T v="small" color={c.text}>{gentle ? plan.title : `${plan.title} · about ${Math.round(t.protein / plan.items.length)} g protein each`}</T>
          {plan.items.map((it, n) => {
            const nth = plan.items.slice(0, n).filter((x) => x.slot === it.slot).length; // second snack of the day
            const done = inSlot(it.slot).length > nth;
            return (
              <View key={n} style={[{ gap: 8 }, s.rule]}>
                <Row>
                  <IconBox icon={done ? 'checkmark' : slotOf(it.slot).icon} color={done ? c.ok : c.muted} size={32} />
                  <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{it.name}</T>
                </Row>
                <T v="small">{it.text}</T>
                {suggest(profile, plan.group, it.slot, 2, nth * 2).map((rc) => (
                  <Tap key={rc.id} onPress={() => addFood(it.slot, rc.id)} scale={0.98} style={s.pick}>
                    <Ionicons name="restaurant" size={14} color={c.pink} />
                    <T v="small" color={c.text} numberOfLines={1} style={{ flex: 1 }}>{rc.name}</T>
                    {!gentle && <T v="small" numberOfLines={1}>{perServing(rc).kcal} kcal</T>}
                    {today.some((m) => m.name === rc.name || m.name.startsWith(rc.name + ' ('))
                      ? <Ionicons name="checkmark-circle" size={16} color={c.ok} />
                      : <Ionicons name="chevron-forward" size={14} color={c.dim} />}
                  </Tap>
                ))}
              </View>
            );
          })}
          {!!plan.note && <T v="small" color={c.text} style={s.rule}>{plan.note}</T>}
        </Fold>

        <Fold title="Protein picks" icon="nutrition">
          <T v="small">{addHint}</T>
          {proteinPicks(profile.diet).map((fd) => foodRow(fd, gentle ? '' : fd.serving, !gentle && <T v="h3" color={c.pink}>{fd.protein} g</T>))}
        </Fold>

        {light.length > 0 && (
          <Fold title="Light, filling foods" icon="leaf">
            <T v="small">{addHint}</T>
            {light.map((fd) => foodRow(fd, `${fd.serving} · ${fd.kcal} kcal`))}
          </Fold>
        )}

        {showSup && (
          <Fold title="Supplements" icon="flask">
            {SUPPLEMENTS.map((x, n) => (
              <View key={x.name} style={[{ gap: 4 }, n > 0 && s.rule]}>
                <Row>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3" numberOfLines={1}>{x.name}</T>
                    <T v="small" color={c.text} numberOfLines={1}>{x.dose}</T>
                  </View>
                  <T v="small">I take this</T>
                  <Switch value={sup.picked.includes(x.name)} onValueChange={(v) => pickSupplement(x.name, v)} accessibilityLabel={`I take ${x.name}`}
                    trackColor={{ true: c.accent, false: c.line }} ios_backgroundColor={c.line} thumbColor={c.text} />
                </Row>
                <T v="small">{x.note}</T>
              </View>
            ))}
            <T v="small" color={c.dim} style={s.rule}>Not medical advice. Ask a doctor first if you have kidney problems, are pregnant or take medication.</T>
          </Fold>
        )}

        <Fold title="Foods that can cause bloating" icon="alert-circle">
          {BLOATING.map((x, n) => (
            <View key={x.food} style={[{ gap: 2 }, n > 0 && s.rule]}>
              <T v="body">{x.food}</T>
              <T v="small">{x.fix}</T>
            </View>
          ))}
        </Fold>
      </Rise>
    </Screen>
  );
}

// One number under the hero rings: icon, value with unit, short label.
const Key = ({ icon, color, value, unit, label }: { icon: Icon; color: string; value: number; unit: string; label: string }) => (
  <Row style={{ flex: 1 }}>
    <IconBox icon={icon} color={color} size={32} />
    <View style={{ flex: 1 }}>
      <T v="h3" numberOfLines={1}>{value}<T v="small"> {unit}</T></T>
      <T v="small" numberOfLines={1}>{label}</T>
    </View>
  </Row>
);

const s = StyleSheet.create({
  big: { fontFamily: f.display, fontSize: 44, lineHeight: 50 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  rule: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 52, minHeight: 44 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  food: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: r.sm, backgroundColor: c.card2 },
});
