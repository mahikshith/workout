import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { dayKey, postpartumWeek, pregnancyWeek, targets } from '../../src/calc';
import { BLOATING, SUPPLEMENTS, foodsFor, proteinPicks, type Food } from '../../src/data/foods';
import { mealPlan, perServing, suggest } from '../../src/data/recipes';
import { FoodSheet, isGentle, SLOTS, type FoodTab } from '../../src/foodsheet';
import { CountUp, DoorCard, EASE } from '../../src/kit';
import { Sheet } from '../../src/sheet';
import { answered, setKey } from '../../src/glance';
import { useStore, type MealSlot, type Profile } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Card, Chip, Fold, IconBox, Ring, Row, Screen, T, TabTitle, Tap } from '../../src/ui';

type Ask = { slot?: MealSlot; tab?: FoodTab; query?: string };
const DIETS: [Profile['diet'], string][] = [['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']];

export default function Fuel() {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water[dayKey()] ?? 0);
  const sup = useStore((s) => s.supplements);
  const removeMeal = useStore((s) => s.removeMeal);
  const addWater = useStore((s) => s.addWater);
  const pickSupplement = useStore((s) => s.pickSupplement);
  const takeSupplement = useStore((s) => s.takeSupplement);
  const setProfile = useStore((s) => s.setProfile);
  const dismissed = useStore((s) => s.dismissed);
  const dismiss = useStore((s) => s.dismiss);
  const still = useReducedMotion();
  const [openSlot, setOpenSlot] = useState<MealSlot | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null); // the food sheet, and what it opens on
  const [supOpen, setSupOpen] = useState(false);
  if (!profile) return null;

  // Gentle mode: no calorie, protein, weight, BMI or portion-size numbers anywhere on this screen.
  const gentle = isGentle(profile);
  const t = targets(profile);
  const today = meals.filter((m) => m.day === dayKey());
  const inSlot = (id: MealSlot) => today.filter((m) => (m.slot ?? 'snack') === id); // meals logged before slots existed count as a snack
  const eaten = SLOTS.filter((x) => inSlot(x.id).length > 0).length;
  const kcal = today.reduce((a, m) => a + m.kcal, 0);
  const protein = today.reduce((a, m) => a + m.protein, 0);
  const over = kcal > t.kcal;
  const plan = mealPlan(profile, gentle);
  const showSup = !gentle && (profile.goal === 'build muscle' || profile.goal === 'get stronger')
    && pregnancyWeek(profile) === null && postpartumWeek(profile) === null && profile.age >= 18;
  const picked = SUPPLEMENTS.filter((x) => sup.picked.includes(x.name));
  const taken = sup.taken[dayKey()] ?? [];
  const light = !gentle && profile.goal === 'lose fat' ? foodsFor(profile.diet).filter((fd) => fd.light) : [];
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));
  const openFood = (a: Ask = {}) => { setSupOpen(false); setAsk(a); };
  const findFood = (fd: Food) => openFood({ tab: 'foods', query: fd.name });
  // Diet is never assumed: until it is answered, one tap here sets it (food lists and tips follow it).
  const askDiet = !answered(profile, dismissed, 'diet');
  const pickDiet = (diet: Profile['diet']) => { setProfile({ ...useStore.getState().profile, diet }); dismiss(setKey('diet')); };

  return (
    <Screen>
      <Animated.View entering={enter(0)}><TabTitle title="Fuel" /></Animated.View>

      {askDiet && (
        <Animated.View entering={enter(1)}>
          <Card style={{ marginTop: 20, gap: 12 }}>
            <T v="h3">How do you eat?</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {DIETS.map(([v, label]) => <Chip key={v} label={label} onPress={() => pickDiet(v)} />)}
            </Row>
          </Card>
        </Animated.View>
      )}

      {/* Totals: the home of today's kcal, protein and water. Gentle mode counts meals instead. */}
      <Animated.View entering={enter(1)}>
        <Card style={[s.totals, { marginTop: askDiet ? 12 : 20 }]}>
          {gentle ? (
            <Total progress={eaten / 4} color={c.accent} value={eaten} label="of 4 meals" />
          ) : (
            <>
              <Total progress={kcal / t.kcal} color={over ? c.danger : c.warm} value={kcal} label={`of ${t.kcal.toLocaleString()} kcal`} />
              <Total progress={protein / t.protein} color={c.pink} value={protein} suffix="g" label={`of ${t.protein} g protein`} />
            </>
          )}
          <Total progress={water / t.water} color={c.blue} value={water} label={`of ${t.water} glasses`} />
        </Card>
      </Animated.View>

      {/* The four meals. Tap one to see and remove what's in it; an empty one opens the food sheet on that meal. */}
      <Card style={{ marginTop: 12, paddingVertical: 4 }}>
        {SLOTS.map((x, i) => {
          const items = inSlot(x.id);
          const k = items.reduce((a, m) => a + m.kcal, 0);
          const shown = openSlot === x.id && items.length > 0;
          return (
            <Animated.View key={x.id} entering={enter(i + 2)} style={i > 0 && s.sep}>
              <Tap onPress={() => (items.length ? setOpenSlot(shown ? null : x.id) : openFood({ slot: x.id }))} scale={0.99} feedback="none" style={s.slot}>
                <IconBox icon={x.icon} color={items.length ? c.ok : c.muted} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="h3" numberOfLines={1}>{x.name}</T>
                  <T v="small" numberOfLines={1}>{items.length ? items.map((m) => m.name).join(', ') : 'Nothing yet'}</T>
                </View>
                {!gentle && items.length > 0 && <T v="small" color={c.text}>{k} kcal</T>}
                <Ionicons name={!items.length ? 'add' : shown ? 'chevron-up' : 'chevron-down'} size={18} color={c.dim} />
              </Tap>
              {shown && (
                <View style={{ paddingBottom: 6 }}>
                  {items.map((m) => (
                    <Animated.View key={m.id} entering={still ? undefined : FadeIn.duration(200).easing(EASE)} style={s.item}>
                      <T v="body" numberOfLines={1} style={{ flex: 1 }}>{m.name}</T>
                      {!gentle && <T v="small">{m.kcal} kcal</T>}
                      <Tap onPress={() => removeMeal(m.id)} style={s.x}><Ionicons name="close" size={18} color={c.muted} /></Tap>
                    </Animated.View>
                  ))}
                  <Tap onPress={() => openFood({ slot: x.id })} scale={0.98} style={s.item}>
                    <Ionicons name="add" size={18} color={c.accent} />
                    <T v="small" color={c.accent}>Add to {x.name.toLowerCase()}</T>
                  </Tap>
                </View>
              )}
            </Animated.View>
          );
        })}
      </Card>

      <Animated.View entering={enter(6)}>
        <Button title="Add food" icon="add" onPress={() => openFood()} style={{ marginTop: 16 }} />
      </Animated.View>

      {/* Water: one tap a glass. */}
      <Animated.View entering={enter(6)}>
        <Card style={{ marginTop: 16, paddingVertical: 10 }}>
          <Row>
            <IconBox icon="water" color={c.blue} size={36} />
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>Water</T>
              <T v="small" numberOfLines={1}>250 ml a glass</T>
            </View>
            <Tap onPress={() => addWater(-1)} disabled={!water} style={s.round}><Ionicons name="remove" size={20} color={c.text} /></Tap>
            <T v="h2" style={{ minWidth: 28, textAlign: 'center' }}>{water}</T>
            <Tap onPress={() => addWater(1)} style={[s.round, { backgroundColor: c.blue }]}><Ionicons name="add" size={20} color={c.accentInk} /></Tap>
          </Row>
        </Card>
      </Animated.View>

      {/* Occasional reading, closed until asked for. */}
      <Animated.View entering={enter(6)} style={{ marginTop: 24 }}>
        <Fold title="Tips for you" icon="bulb">
          <Sub title="Today's plan" first>
            <T v="small" color={c.text}>{gentle ? plan.title : `${plan.title} · about ${Math.round(t.protein / plan.items.length)} g protein each`}</T>
            {plan.items.map((it, n) => {
              const nth = plan.items.slice(0, n).filter((x) => x.slot === it.slot).length; // second snack of the day
              const done = inSlot(it.slot).length > nth;
              return (
                <View key={n} style={{ gap: 6 }}>
                  <Row gap={8}>
                    <Ionicons name={done ? 'checkmark-circle' : SLOTS.find((x) => x.id === it.slot)!.icon} size={18} color={done ? c.ok : c.muted} />
                    <T v="h3" numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>{it.name}</T>
                  </Row>
                  <T v="small">{it.text}</T>
                  {suggest(profile, plan.group, it.slot, 2, nth * 2).map((rc) => (
                    <Tap key={rc.id} onPress={() => router.push({ pathname: '/food', params: { recipe: rc.id, slot: it.slot } })} scale={0.98} style={s.pick}>
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
            {!!plan.note && <T v="small" color={c.text}>{plan.note}</T>}
          </Sub>

          <Sub title="Protein picks">
            {proteinPicks(profile.diet).map((fd) => (
              <TipFood key={fd.name} fd={fd} sub={gentle ? undefined : fd.serving} right={!gentle ? `${fd.protein} g` : undefined} onPress={() => findFood(fd)} />
            ))}
          </Sub>

          {light.length > 0 && (
            <Sub title="Light, filling foods">
              {light.map((fd) => <TipFood key={fd.name} fd={fd} sub={`${fd.serving} · ${fd.kcal} kcal`} onPress={() => findFood(fd)} />)}
            </Sub>
          )}

          {showSup && (
            <Sub title="Supplements">
              {/* Tick what you took today; choose which you take in the sheet. */}
              {picked.length > 0 && (
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {picked.map((x) => {
                    const on = taken.includes(x.name);
                    return <Chip key={x.name} label={x.short} icon={on ? 'checkmark' : 'ellipse-outline'} on={on} color={c.ok} onPress={() => takeSupplement(x.name)} />;
                  })}
                </Row>
              )}
              <Tap onPress={() => { setAsk(null); setSupOpen(true); }} scale={0.98} style={s.pick}>
                <Ionicons name="flask" size={14} color={c.ok} />
                <T v="small" color={c.text} numberOfLines={1} style={{ flex: 1 }}>
                  {picked.length ? `${picked.filter((x) => taken.includes(x.name)).length} of ${picked.length} taken today · change` : 'Choose what you take'}
                </T>
                <Ionicons name="chevron-forward" size={14} color={c.dim} />
              </Tap>
              {SUPPLEMENTS.map((x) => (
                <View key={x.name} style={{ gap: 2 }}>
                  <T v="body">{x.name}</T>
                  <T v="small">{x.note}</T>
                </View>
              ))}
              <T v="small" color={c.dim}>Not medical advice. Ask a doctor first if you have kidney problems, are pregnant or take medication.</T>
            </Sub>
          )}

          <Sub title="Foods that can cause bloating">
            {BLOATING.map((x) => (
              <View key={x.food} style={{ gap: 2 }}>
                <T v="body">{x.food}</T>
                <T v="small">{x.fix}</T>
              </View>
            ))}
          </Sub>
        </Fold>
      </Animated.View>

      {/* History of water, protein, calories and meals lives on its own chart screen. */}
      <Animated.View entering={enter(6)} style={{ marginTop: 12 }}>
        <DoorCard compact icon="stats-chart" color={c.blue} title="Trends" meta={gentle ? 'Meals and water over time' : 'Calories, protein, water and meals'} onPress={() => router.push('/chart/fuel')} />
      </Animated.View>

      <FoodSheet open={!!ask} onClose={() => setAsk(null)} slot={ask?.slot} tab={ask?.tab} query={ask?.query} />

      {/* Choose which supplements you take. */}
      <Sheet open={supOpen} onClose={() => setSupOpen(false)}>
        <T v="h2" style={{ marginBottom: 12 }}>Supplements</T>
        <View style={{ gap: 4 }}>
          {SUPPLEMENTS.map((x, n) => (
            <Row key={x.name} style={[{ minHeight: 56 }, n > 0 && s.sep]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3" numberOfLines={1}>{x.name}</T>
                <T v="small" numberOfLines={1}>{x.dose}</T>
              </View>
              <Switch value={sup.picked.includes(x.name)} onValueChange={(v) => pickSupplement(x.name, v)} accessibilityLabel={`I take ${x.name}`}
                trackColor={{ true: c.accent, false: c.line }} ios_backgroundColor={c.line} thumbColor={c.text} />
            </Row>
          ))}
        </View>
        <T v="small" color={c.dim} style={{ marginTop: 12 }}>Switch on the ones you take, then tick them off each day.</T>
      </Sheet>
    </Screen>
  );
}

// One column of the totals card: a ring with the count-up number inside, the target below.
const Total = ({ progress, color, value, suffix, label }: { progress: number; color: string; value: number; suffix?: string; label: string }) => (
  <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
    <Ring size={84} stroke={7} progress={progress} color={color}>
      <CountUp value={value} suffix={suffix} style={{ fontSize: 22, lineHeight: 28 }} />
    </Ring>
    <T v="small" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</T>
  </View>
);

// A sub-heading inside the tips fold.
const Sub = ({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) => (
  <View style={[s.sub, first && { paddingTop: 0, borderTopWidth: 0 }]}>
    <T v="label">{title}</T>
    {children}
  </View>
);

// A tip food: tapping it opens the food sheet on that food, ready to log.
const TipFood = ({ fd, sub, right, onPress }: { fd: Food; sub?: string; right?: string; onPress: () => void }) => (
  <Tap onPress={onPress} scale={0.98} style={s.food}>
    <IconBox icon={fd.icon} color={c.pink} size={32} />
    <View style={{ flex: 1, gap: 2 }}>
      <T v="body" numberOfLines={1}>{fd.name}</T>
      {sub ? <T v="small" numberOfLines={1}>{sub}</T> : null}
    </View>
    {right ? <T v="h3" color={c.pink}>{right}</T> : null}
    <Ionicons name="chevron-forward" size={16} color={c.dim} />
  </Tap>
);

const s = StyleSheet.create({
  totals: { flexDirection: 'row', gap: 8, paddingVertical: 18, paddingHorizontal: 8 },
  round: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  sub: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 48, minHeight: 44 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  food: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: r.sm, backgroundColor: c.card2 },
});
