import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { dayKey, postpartumWeek, pregnancyWeek, targets } from '../../src/calc';
import { BLOATING, SUPPLEMENTS, foodsFor, proteinPicks, type Food } from '../../src/data/foods';
import { mealPlan, perServing, suggest } from '../../src/data/recipes';
import { Rings } from '../../src/rings';
import { useStore, type MealSlot } from '../../src/store';
import { c, f } from '../../src/theme';
import { Card, Rise, Row, Screen, T, Tap, TabTitle } from '../../src/ui';

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const fade = () => FadeIn.duration(280).easing(EASE);
type Icon = keyof typeof Ionicons.glyphMap;
const SLOTS: { id: MealSlot; name: string; icon: Icon }[] = [
  { id: 'breakfast', name: 'Breakfast', icon: 'sunny-outline' },
  { id: 'lunch', name: 'Lunch', icon: 'restaurant-outline' },
  { id: 'snack', name: 'Snack', icon: 'cafe-outline' },
  { id: 'dinner', name: 'Dinner', icon: 'moon-outline' },
];
const slotNow = (h = new Date().getHours()): MealSlot => (h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner');
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

// Sections fade up on entry and slide smoothly when one above them grows or shrinks.
const Sec = ({ i, children }: { i: number; children: ReactNode }) => (
  <Animated.View entering={FadeInDown.delay(i * 50).duration(380).easing(EASE)} layout={LinearTransition.duration(300).easing(EASE)} style={{ marginTop: 14 }}>
    {children}
  </Animated.View>
);

export default function Fuel() {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water[dayKey()] ?? 0);
  const sup = useStore((s) => s.supplements);
  const { addMeal, removeMeal, addWater, pickSupplement, takeSupplement } = useStore.getState();
  const [open, setOpen] = useState({ plan: true, sup: false, gas: false, light: false });
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
  const nameOf = (id: MealSlot) => SLOTS.find((x) => x.id === id)!.name.toLowerCase();
  const has = (fd: Food, slot: MealSlot) => inSlot(slot).some((m) => m.name === fd.name);
  // One tap logs a food, a second tap takes it back off.
  const toggle = (fd: Food, slot: MealSlot) => {
    const hit = inSlot(slot).filter((m) => m.name === fd.name).pop();
    if (hit) removeMeal(hit.id); else addMeal({ name: fd.name, kcal: fd.kcal, protein: fd.protein, slot });
  };
  const addFood = (slot: MealSlot, recipe?: string) => router.push({ pathname: '/food', params: recipe ? { slot, recipe } : { slot } });
  const plan = mealPlan(profile, gentle);
  const showSup = !gentle && (profile.goal === 'build muscle' || profile.goal === 'get stronger')
    && pregnancyWeek(profile) === null && postpartumWeek(profile) === null && profile.age >= 18;
  const picked = SUPPLEMENTS.filter((x) => sup.picked.includes(x.name));
  const taken = sup.taken[dayKey()] ?? [];

  const foodRow = (fd: Food, slot: MealSlot, sub: string, right?: ReactNode) => {
    const on = has(fd, slot);
    return (
      <Tap key={fd.name} onPress={() => toggle(fd, slot)} scale={0.98} style={s.food}>
        <View style={s.icon}><Ionicons name={fd.icon} size={16} color={c.warm} /></View>
        <View style={{ flex: 1 }}>
          <T v="body" numberOfLines={1}>{fd.name}</T>
          {!!sub && <T v="small" numberOfLines={1}>{sub}</T>}
        </View>
        {right}
        <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={on ? c.accent : c.dim} />
      </Tap>
    );
  };

  return (
    <Screen>
      <Rise><TabTitle title="Fuel" /></Rise>
      <Rise i={1}><T v="small" numberOfLines={1}>{gentle ? cap(profile.diet) : `${cap(profile.diet)} · ${cap(profile.goal)}`}</T></Rise>

      <Sec i={2}>
        <Card style={{ alignItems: 'center' }}>
          {gentle ? (
            <Rings size={200} stroke={16} rings={[{ progress: eaten / 4, color: c.accent }]}>
              <T style={{ fontFamily: f.display, fontSize: 48, lineHeight: 54 }}>{eaten}</T>
              <T v="label">of 4 meals</T>
            </Rings>
          ) : (
            <Rings size={200} stroke={14} rings={[{ progress: kcal / t.kcal, color: left < 0 ? c.danger : c.warm }, { progress: protein / t.protein, color: c.pink }]}>
              <T numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: f.display, fontSize: 40, lineHeight: 46, maxWidth: 120, textAlign: 'center' }}>{Math.abs(left)}</T>
              <T v="label">{left < 0 ? 'kcal over' : 'kcal left'}</T>
              <T v="small" color={c.pink} numberOfLines={1} style={{ marginTop: 4 }}>{protein} / {t.protein} g</T>
            </Rings>
          )}
          {gentle ? (
            <T v="small" style={{ marginTop: 14, textAlign: 'center' }}>Regular meals keep your energy steady.</T>
          ) : (
            <Row style={{ marginTop: 16, alignSelf: 'stretch' }}>
              <Key color={left < 0 ? c.danger : c.warm} label="Calories" value={`${kcal} / ${t.kcal} kcal`} />
              <Key color={c.pink} label="Protein" value={protein >= t.protein ? 'Goal reached' : `${t.protein - protein} g to go`} />
            </Row>
          )}
        </Card>
      </Sec>

      <Sec i={3}>
        <Card>
          <Head title={`Today's plan: ${plan.title}`} open={open.plan} onPress={() => setOpen({ ...open, plan: !open.plan })} />
          {open.plan && (
            <Animated.View entering={fade()} style={{ marginTop: 6 }}>
              {plan.items.map((it, n) => {
                const nth = plan.items.slice(0, n).filter((x) => x.slot === it.slot).length; // second snack of the day
                const done = inSlot(it.slot).length > nth;
                return (
                  <View key={n} style={s.row}>
                    <Row gap={8}>
                      <Ionicons name={done ? 'checkmark-circle' : SLOTS.find((x) => x.id === it.slot)!.icon} size={18} color={done ? c.accent : c.muted} />
                      <T v="h3" numberOfLines={1} style={{ flex: 1, flexShrink: 1 }}>{it.name}</T>
                    </Row>
                    <T v="small" numberOfLines={3} style={{ marginTop: 2 }}>{it.text}</T>
                    {suggest(profile, plan.group, it.slot, 2, nth * 2).map((rc) => (
                      <Tap key={rc.id} onPress={() => addFood(it.slot, rc.id)} scale={0.98} style={s.pick}>
                        <Ionicons name="restaurant-outline" size={14} color={c.accent} />
                        <T v="small" color={c.text} numberOfLines={1} style={{ flex: 1, flexShrink: 1 }}>{rc.name}</T>
                        {!gentle && <T v="small" numberOfLines={1}>{perServing(rc).kcal} kcal</T>}
                        {today.some((m) => m.name === rc.name || m.name.startsWith(rc.name + ' ('))
                          ? <Ionicons name="checkmark-circle" size={16} color={c.accent} />
                          : <Ionicons name="chevron-forward" size={14} color={c.dim} />}
                      </Tap>
                    ))}
                  </View>
                );
              })}
              {!!plan.note && <T v="small" color={c.text} numberOfLines={6} style={{ marginTop: 10 }}>{plan.note}</T>}
            </Animated.View>
          )}
        </Card>
      </Sec>

      <Sec i={4}>
        <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <T v="h3">Meals</T>
          {!gentle && <T v="small">{eaten} of 4 eaten</T>}
        </Row>
        <View style={{ gap: 10, marginTop: 10 }}>
          {SLOTS.map((x) => {
            const items = inSlot(x.id);
            const k = items.reduce((a, m) => a + m.kcal, 0), p = items.reduce((a, m) => a + m.protein, 0);
            return (
              <Card key={x.id} style={{ padding: 14 }}>
                <Row>
                  <View style={[s.icon, items.length > 0 && { backgroundColor: c.accent + '22' }]}>
                    <Ionicons name={x.icon} size={18} color={items.length ? c.accent : c.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h3" numberOfLines={1}>{x.name}</T>
                    <T v="small" numberOfLines={1}>{!items.length ? 'Nothing yet' : gentle ? 'Logged' : `${k} kcal · ${p} g protein`}</T>
                  </View>
                  <Tap onPress={() => addFood(x.id)} style={s.round}><Ionicons name="add" size={22} color={c.text} /></Tap>
                </Row>
                {items.map((m) => (
                  <Animated.View key={m.id} entering={fade()} style={s.item}>
                    <T v="body" numberOfLines={1} style={{ flex: 1, flexShrink: 1 }}>{m.name}</T>
                    {!gentle && <T v="small">{m.kcal} kcal</T>}
                    <Tap onPress={() => removeMeal(m.id)} style={s.x}><Ionicons name="close" size={16} color={c.muted} /></Tap>
                  </Animated.View>
                ))}
              </Card>
            );
          })}
        </View>
        <T v="small" numberOfLines={2} style={{ marginTop: 10 }}>
          {gentle ? `Aim for ${plan.title}. Regular meals help you train.` : `Aim for ${plan.title}, about ${Math.round(t.protein / plan.items.length)} g of protein each time.`}
        </T>
      </Sec>

      <Sec i={5}>
        <Card>
          <T v="h3">Best protein for you</T>
          <T v="small" numberOfLines={2} style={{ marginTop: 4, marginBottom: 4 }}>
            {gentle ? 'Good protein foods for your diet.' : 'The most protein for the calories.'} Tap to add to {nameOf(now)}.
          </T>
          {proteinPicks(profile.diet).map((fd) => foodRow(fd, now, gentle ? '' : fd.serving, !gentle && <T v="h3" color={c.pink}>{fd.protein} g</T>))}
        </Card>
      </Sec>

      {!gentle && profile.goal === 'lose fat' && (
        <Sec i={6}>
          <Card>
            <Head title="Filling foods that are light on calories" open={open.light} onPress={() => setOpen({ ...open, light: !open.light })} />
            {open.light && (
              <Animated.View entering={fade()} style={{ marginTop: 6 }}>
                <T v="small" numberOfLines={2}>They fill you up for few calories. Tap to add to {nameOf(now)}.</T>
                {foodsFor(profile.diet).filter((fd) => fd.light).map((fd) => foodRow(fd, now, `${fd.serving} · ${fd.kcal} kcal`))}
              </Animated.View>
            )}
          </Card>
        </Sec>
      )}

      {showSup && (
        <Sec i={6}>
          <Card>
            <Head title="Supplements (optional)" open={open.sup} onPress={() => setOpen({ ...open, sup: !open.sup })} />
            {picked.length > 0 && (
              <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <T v="label">Today</T>
                {picked.map((x) => {
                  const on = taken.includes(x.name);
                  return (
                    <Tap key={x.name} onPress={() => takeSupplement(x.name)} style={[s.tick, on && { backgroundColor: c.accent, borderColor: c.accent }]}>
                      <Ionicons name={on ? 'checkmark' : 'ellipse-outline'} size={14} color={on ? c.accentInk : c.muted} />
                      <T v="small" color={on ? c.accentInk : c.text} numberOfLines={1}>{x.short}</T>
                    </Tap>
                  );
                })}
              </Row>
            )}
            {open.sup && (
              <Animated.View entering={fade()} style={{ marginTop: 6 }}>
                {SUPPLEMENTS.map((x) => (
                  <View key={x.name} style={s.row}>
                    <T v="body" numberOfLines={2}>{x.name}</T>
                    <T v="small" color={c.text} numberOfLines={2}>{x.dose}</T>
                    <T v="small" numberOfLines={3}>{x.note}</T>
                    <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                      <T v="small" color={c.text} numberOfLines={1} style={{ flexShrink: 1 }}>I take this</T>
                      <Switch value={sup.picked.includes(x.name)} onValueChange={(v) => pickSupplement(x.name, v)}
                        trackColor={{ true: c.accent, false: c.line }} ios_backgroundColor={c.line} thumbColor={c.text} />
                    </Row>
                  </View>
                ))}
                <T v="small" numberOfLines={4} style={{ marginTop: 10 }}>Not medical advice. Check with a doctor first if you have kidney problems, are pregnant, or take medication.</T>
              </Animated.View>
            )}
          </Card>
        </Sec>
      )}

      <Sec i={7}>
        <Card>
          <Head title="Foods that can cause bloating or gas" open={open.gas} onPress={() => setOpen({ ...open, gas: !open.gas })} />
          {open.gas && (
            <Animated.View entering={fade()} style={{ marginTop: 6 }}>
              {BLOATING.map((x) => (
                <View key={x.food} style={s.row}>
                  <T v="body" numberOfLines={2}>{x.food}</T>
                  <T v="small" numberOfLines={3}>{x.fix}</T>
                </View>
              ))}
            </Animated.View>
          )}
        </Card>
      </Sec>

      <Sec i={8}>
        <Card>
          <Row>
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>Water · 250 ml a glass</T>
              <T v="h3" numberOfLines={1} style={{ marginTop: 4 }}>{water} of {t.water} glasses</T>
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
      </Sec>

    </Screen>
  );
}

// Row that opens and closes a collapsible card.
const Head = ({ title, open, onPress }: { title: string; open: boolean; onPress: () => void }) => (
  <Tap onPress={onPress} scale={0.99} style={s.head}>
    <T v="h3" numberOfLines={2} style={{ flex: 1, flexShrink: 1 }}>{title}</T>
    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
  </Tap>
);

const Key = ({ color, label, value }: { color: string; label: string; value: string }) => (
  <View style={{ flex: 1 }}>
    <Row gap={6}><View style={[s.dot, { backgroundColor: color }]} /><T v="label" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</T></Row>
    <T v="small" color={c.text} numberOfLines={1} style={{ marginTop: 4 }}>{value}</T>
  </View>
);

const s = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  food: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  row: { gap: 2, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 12, height: 40, borderRadius: 12, backgroundColor: c.card2 },
});
