import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { dayKey, targets } from '../../src/calc';
import { BLOATING, foodsFor, proteinPicks, type Food } from '../../src/data/foods';
import { mealPlan, perServing, suggest } from '../../src/data/recipes';
import { dayLabel, FoodSheet, isGentle, MealSheet, SLOTS, timeOf, type FoodTab } from '../../src/foodsheet';
import { Hint } from '../../src/hint';
import { CountUp, DoorCard, EASE } from '../../src/kit';
import { askPermission } from '../../src/notify';
import { Sheet } from '../../src/sheet';
import { answered, setKey } from '../../src/glance';
import { useStore, type Meal, type MealSlot, type Profile } from '../../src/store';
import { clock, SupplementTicks, useMySupplements } from '../../src/supps';
import { c, dom, f, r, tint } from '../../src/theme';
import { Button, Card, Chip, Fold, IconBox, Ring, Row, Screen, T, TabTitle, Tap } from '../../src/ui';
import { autoGoalMl, drink, ml, SIZES, sizeName, useWater } from '../../src/water';

type Ask = { slot?: MealSlot; tab?: FoodTab; query?: string; food?: string };
const DIETS: [Profile['diet'], string][] = [['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']];
const DAY = 86400000;
const BACK = 6; // days you can page back to fix or fill in

export default function Fuel() {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const setProfile = useStore((s) => s.setProfile);
  const dismissed = useStore((s) => s.dismissed);
  const dismiss = useStore((s) => s.dismiss);
  const still = useReducedMotion();
  const [day, setDay] = useState(dayKey());
  const [ask, setAsk] = useState<Ask | null>(null); // the food sheet, and what it opens on
  const [edit, setEdit] = useState<Meal | null>(null);
  const [waterOpen, setWaterOpen] = useState(false);
  const supps = useMySupplements();
  if (!profile) return null;

  // Gentle mode: no calorie, protein, weight, BMI or portion-size numbers anywhere on this screen.
  const gentle = isGentle(profile);
  const t = targets(profile);
  const today = dayKey();
  const isToday = day === today;
  const back = Math.round((Date.parse(today) - Date.parse(day)) / DAY);
  const shift = (by: number) => setDay(dayKey(Date.parse(day + 'T12:00') + by * DAY));
  const list = meals.filter((m) => m.day === day);
  const inSlot = (id: MealSlot) => list.filter((m) => (m.slot ?? 'snack') === id); // meals logged before slots existed count as a snack
  const eaten = SLOTS.filter((x) => inSlot(x.id).length > 0).length;
  const kcal = list.reduce((a, m) => a + m.kcal, 0);
  const protein = list.reduce((a, m) => a + m.protein, 0);
  const over = kcal > t.kcal;
  const plan = mealPlan(profile, gentle);
  const light = !gentle && (profile.goal === 'lose fat' || profile.goal === 'tone up') ? foodsFor(profile.diet).filter((fd) => fd.light) : [];
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));
  const openFood = (a: Ask = {}) => { setEdit(null); setWaterOpen(false); setAsk(a); };
  const findFood = (fd: Food) => openFood({ food: fd.name });
  // Diet is never assumed: until it is answered, one tap here sets it (food lists and tips follow it).
  const askDiet = !answered(profile, dismissed, 'diet');
  const pickDiet = (diet: Profile['diet']) => { setProfile({ ...useStore.getState().profile, diet }); dismiss(setKey('diet')); };

  return (
    <Screen tone={[dom.kcal, dom.water, dom.protein]}>
      <Animated.View entering={enter(0)}><TabTitle title="Fuel" /></Animated.View>

      {/* Which day: today, or up to six days back to fill in something forgotten. */}
      <Animated.View entering={enter(0)}>
        <Row style={s.days}>
          <Tap onPress={() => shift(-1)} disabled={back >= BACK} style={s.dayBtn} scale={0.9} accessibilityLabel="Day before"><Ionicons name="chevron-back" size={20} color={c.text} /></Tap>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T v="h3" numberOfLines={1}>{dayLabel(day)}</T>
          </View>
          <Tap onPress={() => (back > 1 ? shift(1) : setDay(today))} disabled={isToday} style={s.dayBtn} scale={0.9} accessibilityLabel="Next day"><Ionicons name="chevron-forward" size={20} color={c.text} /></Tap>
        </Row>
      </Animated.View>

      {askDiet && (
        <Animated.View entering={enter(1)}>
          <Card style={{ marginTop: 12, gap: 12 }}>
            <T v="h3">How do you eat?</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {DIETS.map(([v, label]) => <Chip key={v} label={label} onPress={() => pickDiet(v)} />)}
            </Row>
          </Card>
        </Animated.View>
      )}

      {/* Totals: kcal left, protein and water. Gentle mode counts meals instead. Each number keeps its domain colour
          everywhere (food orange, protein pink, water blue). */}
      <Animated.View entering={enter(1)}>
        <View style={[s.hero, { borderColor: tint(dom.kcal, 1.6) }]}>
          <LinearGradient colors={[tint(dom.kcal, 1.4), tint(dom.protein, 0.5), c.card]} locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ alignItems: 'center', gap: 6 }}>
            {gentle ? (
              <Ring size={116} stroke={10} progress={eaten / 4} color={dom.kcal} track={tint(dom.kcal, 1.4)}>
                <CountUp value={eaten} style={{ fontSize: 28, lineHeight: 34 }} />
                <T v="small">of 4 meals</T>
              </Ring>
            ) : (
              <Ring size={116} stroke={10} progress={kcal / t.kcal} color={over ? c.danger : dom.kcal} track={tint(dom.kcal, 1.4)}>
                <CountUp value={Math.abs(t.kcal - kcal)} style={{ fontSize: 26, lineHeight: 32 }} />
                <T v="small" color={over ? c.danger : c.muted}>{over ? 'kcal over' : isToday ? 'kcal left' : 'kcal under'}</T>
              </Ring>
            )}
            {!gentle && <T v="small" color={c.text} numberOfLines={1}>{`${kcal.toLocaleString('en-US')} of ${t.kcal.toLocaleString('en-US')}`}</T>}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 14, justifyContent: 'center' }}>
            {!gentle && <Meter icon="nutrition" color={dom.protein} label="Protein" value={`${protein}`} goal={`${t.protein} g`} progress={protein / t.protein} />}
            <WaterMeter day={day} />
          </View>
        </View>
      </Animated.View>

      {/* The one primary action: logging food. Two taps for a common food: this, then its +. */}
      <Animated.View entering={enter(2)}>
        <Button title={isToday ? 'Log food' : `Log food to ${dayLabel(day).toLowerCase()}`} icon="add" onPress={() => openFood()} style={{ marginTop: 12 }} />
      </Animated.View>

      {/* The four meals with what's in them. + logs straight to that meal; a food opens to change or remove it. */}
      <Animated.View entering={enter(3)}>
        <Card style={{ marginTop: 12, paddingVertical: 4 }}>
          {SLOTS.map((x, i) => {
            const items = inSlot(x.id);
            const k = items.reduce((a, m) => a + m.kcal, 0), p = items.reduce((a, m) => a + m.protein, 0);
            const first = items.map((m) => m.at ?? 0).filter(Boolean).sort((a, b) => a - b)[0];
            const sub = !items.length ? 'Nothing yet' : [timeOf(first), `${items.length} ${items.length === 1 ? 'food' : 'foods'}`].filter(Boolean).join(' · ');
            return (
              <View key={x.id} style={i > 0 && s.sep}>
                <View style={s.slot}>
                  <Tap onPress={() => openFood({ slot: x.id })} scale={0.99} feedback="none" style={s.slotMain} accessibilityLabel={`Log food to ${x.name.toLowerCase()}`}>
                    <IconBox icon={x.icon} color={items.length ? dom.kcal : c.muted} size={36} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="h3" numberOfLines={1}>{x.name}</T>
                      <T v="small" numberOfLines={1}>{sub}</T>
                    </View>
                    {!gentle && items.length > 0 && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <T v="small" color={c.text}>{Math.round(k).toLocaleString('en-US')} kcal</T>
                        <T v="small" color={dom.protein}>{Math.round(p)} g</T>
                      </View>
                    )}
                  </Tap>
                  <Tap onPress={() => openFood({ slot: x.id })} scale={0.9} style={[s.add, { backgroundColor: tint(c.accent, 1.2) }]}
                    accessibilityLabel={`Log food to ${x.name.toLowerCase()}`}>
                    <Ionicons name="add" size={22} color={c.accent} />
                  </Tap>
                </View>
                {items.map((m) => (
                  <Animated.View key={m.id} entering={still ? undefined : FadeIn.duration(200).easing(EASE)}>
                    <Tap onPress={() => { setAsk(null); setEdit(m); }} scale={0.99} feedback="none" style={s.item} accessibilityLabel={`${m.name}. Change or remove`}>
                      <T v="body" numberOfLines={1} style={{ flex: 1 }}>{m.name}</T>
                      {!gentle && <T v="small" numberOfLines={1}>{`${Math.round(m.kcal).toLocaleString('en-US')} kcal · ${Math.round(m.protein)} g`}</T>}
                      <Ionicons name="chevron-forward" size={14} color={c.dim} />
                    </Tap>
                  </Animated.View>
                ))}
              </View>
            );
          })}
        </Card>
      </Animated.View>
      {list.length > 0 && <Hint id="fuel-edit" text="Tap a food to fix its numbers, move it or remove it." style={{ marginTop: 8 }} />}

      {/* Protein: what's left today and the foods that close the gap fastest for this diet. */}
      <Animated.View entering={enter(4)}>
        <ProteinCard day={day} left={t.protein - protein} goal={t.protein} gentle={gentle} diet={profile.diet} onPick={findFood} />
      </Animated.View>

      {/* Water: a glass (or bottle) a tap, in ml, with the goal and glass size one tap away. */}
      <Animated.View entering={enter(5)}>
        <WaterCard day={day} onSettings={() => { setAsk(null); setEdit(null); setWaterOpen(true); }} />
      </Animated.View>

      {/* Supplements and daily habits: today's ticks, and the way to reminders. */}
      {isToday && (
        <Animated.View entering={enter(6)}>
          <Card style={{ marginTop: 12, gap: 12 }}>
            <Row gap={12}>
              <IconBox icon="flask" color={c.ok} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3" numberOfLines={1}>Supplements</T>
                {supps.length > 0 && <T v="small" numberOfLines={1}>Tick what you’ve had today</T>}
              </View>
              {supps.length > 0 && (
                <Tap onPress={() => router.push('/supplements')} style={s.link} scale={0.95} accessibilityLabel="Supplements and reminders">
                  <T v="small" color={c.accent}>Reminders</T>
                  <Ionicons name="chevron-forward" size={14} color={c.accent} />
                </Tap>
              )}
            </Row>
            {supps.length ? <SupplementTicks items={supps} /> : (
              <>
                <T v="small">Protein shake, creatine, coffee, vitamins? Add what you take and get a reminder at your time.</T>
                <Button title="Add what you take" kind="ghost" icon="add" onPress={() => router.push('/supplements')} />
              </>
            )}
          </Card>
        </Animated.View>
      )}

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
                      {list.some((m) => m.name === rc.name || m.name.startsWith(rc.name + ' ('))
                        ? <Ionicons name="checkmark-circle" size={16} color={c.ok} />
                        : <Ionicons name="chevron-forward" size={14} color={c.dim} />}
                    </Tap>
                  ))}
                </View>
              );
            })}
            {!!plan.note && <T v="small" color={c.text}>{plan.note}</T>}
          </Sub>

          {light.length > 0 && (
            <Sub title="Light, filling foods">
              {light.map((fd) => <TipFood key={fd.name} fd={fd} sub={`${fd.serving} · ${fd.kcal} kcal`} onPress={() => findFood(fd)} />)}
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
        <DoorCard compact icon="stats-chart" color={dom.kcal} title="Trends" meta={gentle ? 'Meals and water over time' : 'Calories, protein, water and meals'} onPress={() => router.push('/chart/fuel')} />
      </Animated.View>

      <FoodSheet open={!!ask} onClose={() => setAsk(null)} slot={ask?.slot} tab={ask?.tab} query={ask?.query} food={ask?.food} day={day} />
      <MealSheet meal={edit} onClose={() => setEdit(null)} />
      <WaterSheet open={waterOpen} onClose={() => setWaterOpen(false)} />
    </Screen>
  );
}

// One line of the totals card: label, number of goal, and a bar in the domain colour.
const Meter = ({ icon, color, label, value, goal, progress }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string; goal: string; progress: number }) => (
  <View style={{ gap: 6 }}>
    <Row gap={6}>
      <Ionicons name={icon} size={14} color={color} />
      <T v="label" numberOfLines={1} style={{ flex: 1 }}>{label}</T>
    </Row>
    <T v="small" color={c.muted} numberOfLines={1}><T v="h3" color={c.text}>{value}</T>{` / ${goal}`}</T>
    <Bar color={color} progress={progress} />
  </View>
);

const Bar = ({ color, progress, height = 6 }: { color: string; progress: number; height?: number }) => (
  <View style={{ height, borderRadius: height / 2, backgroundColor: tint(color, 1.4), overflow: 'hidden' }}>
    <View style={{ width: `${Math.max(0, Math.min(1, progress || 0)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
  </View>
);

function WaterMeter({ day }: { day: string }) {
  const w = useWater(day);
  return <Meter icon="water" color={dom.water} label="Water" value={w.ml.toLocaleString('en-US')} goal={ml(w.goal)} progress={w.ml / w.goal} />;
}

// Protein focus: grams to go, a pair of foods that would cover it, and diet-aware quick picks (tap = choose servings).
function ProteinCard({ day, left, goal, gentle, diet, onPick }: {
  day: string; left: number; goal: number; gentle: boolean; diet: Profile['diet']; onPick: (fd: Food) => void;
}) {
  const picks = proteinPicks(diet, 6);
  const isToday = day === dayKey();
  // The two picks whose protein together comes closest to what's left (without going far over).
  let pair: Food[] = [];
  if (!gentle && left > 8) {
    let best = Infinity;
    for (let i = 0; i < picks.length; i++) {
      const one = picks[i].protein;
      if (Math.abs(left - one) < best && one <= left + 8) { best = Math.abs(left - one); pair = [picks[i]]; }
      for (let j = i + 1; j < picks.length; j++) {
        const sum = one + picks[j].protein;
        if (sum <= left + 8 && Math.abs(left - sum) < best) { best = Math.abs(left - sum); pair = [picks[i], picks[j]]; }
      }
    }
  }
  const head = gentle ? 'Protein ideas'
    : left <= 0 ? (isToday ? 'Protein goal reached' : 'Protein goal reached that day')
    : isToday ? `${left} g protein to go` : `${goal - left} of ${goal} g protein`;
  return (
    <Card style={{ marginTop: 12, gap: 12 }}>
      <Row gap={12}>
        <IconBox icon="nutrition" color={dom.protein} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3" numberOfLines={1}>{head}</T>
          <T v="small" numberOfLines={2}>
            {gentle ? 'Foods that help you recover. Tap one to log it.'
              : left <= 0 ? 'Nice work. Anything more is a bonus.'
              : !isToday ? 'Forgot something? Tap a food to add it to that day.'
              : pair.length ? `Try ${pair.map((x, i) => (i ? x.name.toLowerCase() : x.name)).join(' and ')}: about ${pair.reduce((a, x) => a + x.protein, 0)} g.`
              : `Your goal is ${goal} g a day. Tap a food to log it.`}
          </T>
        </View>
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {picks.map((fd) => (
          <Tap key={fd.name} onPress={() => onPick(fd)} scale={0.95} style={s.chip} accessibilityLabel={`${fd.name}${gentle ? '' : `, ${fd.protein} grams of protein`}. Choose servings`}>
            <T v="small" color={c.text} numberOfLines={1}>{fd.name}</T>
            {!gentle && <T v="small" color={dom.protein} style={{ fontFamily: f.semi }}>{`+${fd.protein} g`}</T>}
          </Tap>
        ))}
      </Row>
    </Card>
  );
}

// Water today: ml of the goal, a bar, − and + a glass (with undo). Earlier days show what was drunk.
function WaterCard({ day, onSettings }: { day: string; onSettings: () => void }) {
  const w = useWater(day);
  const hydration = useStore((s) => s.hydration);
  const isToday = day === dayKey();
  const [undo, setUndo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const add = () => {
    drink(1);
    setUndo(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(false), 3500);
  };
  const takeBack = () => { drink(-1); setUndo(false); };
  const done = w.ml >= w.goal;
  return (
    <View style={[s.water, { backgroundColor: tint(dom.water, 0.6), borderColor: tint(dom.water, 1.6) }]}>
      <Row gap={12}>
        <IconBox icon="water" color={dom.water} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3" numberOfLines={1}>{done ? 'Water goal reached' : 'Water'}</T>
          <T v="small" numberOfLines={1}>{`${ml(w.glass)} a tap · ${hydration.on ? `reminder every ${hydration.every} min` : 'no reminders'}`}</T>
        </View>
        <Tap onPress={onSettings} style={s.gear} scale={0.9} accessibilityLabel="Water goal, glass size and reminders">
          <Ionicons name="options-outline" size={20} color={c.text} />
        </Tap>
      </Row>
      <View style={{ gap: 8 }}>
        <T v="small" color={c.muted}><T v="h2" color={c.text}>{w.ml.toLocaleString('en-US')}</T>{` of ${ml(w.goal)}`}</T>
        <Bar color={dom.water} progress={w.ml / w.goal} height={10} />
      </View>
      {isToday ? (
        <Row gap={10}>
          <Tap onPress={() => drink(-1)} disabled={w.ml <= 0} style={[s.round, { backgroundColor: c.card }]} accessibilityLabel={`Take back ${ml(w.glass)}`}>
            <Ionicons name="remove" size={20} color={c.text} />
          </Tap>
          <Tap onPress={add} style={[s.drink, { backgroundColor: tint(dom.water, 1.6), borderColor: dom.water }]} scale={0.97} accessibilityLabel={`Add ${ml(w.glass)} of water`}>
            <Ionicons name="add" size={20} color={dom.water} />
            <T v="h3" color={c.text}>{`${sizeName(w.glass)} · ${ml(w.glass)}`}</T>
          </Tap>
        </Row>
      ) : (
        <T v="small">{`${dayLabel(day)}. Water is logged on the day you drink it.`}</T>
      )}
      {undo && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)} style={s.toast}>
          <Ionicons name="checkmark-circle" size={18} color={c.ok} />
          <T v="small" color={c.text} style={{ flex: 1 }}>{`Added ${ml(w.glass)}`}</T>
          <Tap onPress={takeBack} feedback="none" style={s.undo} accessibilityLabel="Undo"><T v="small" color={c.accent} style={{ fontFamily: f.semi }}>Undo</T></Tap>
        </Animated.View>
      )}
    </View>
  );
}

// Water settings: daily goal (from body weight unless changed), glass size and the drink reminder.
function WaterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useStore((s) => s.profile);
  const prefs = useStore((s) => s.waterPrefs);
  const hydration = useStore((s) => s.hydration);
  const setPrefs = useStore((s) => s.setWaterPrefs);
  const setHydration = useStore((s) => s.setHydration);
  const w = useWater();
  const auto = autoGoalMl(profile);
  const setGoal = (g: number) => setPrefs({ ...prefs, goalMl: Math.min(6000, Math.max(1000, g)), auto: false });
  const remind = async (on: boolean) => {
    setHydration({ ...hydration, on });
    if (on && Platform.OS !== 'web') await askPermission();
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <T v="h2">Water</T>
        <View style={{ gap: 8 }}>
          <T v="label">Daily goal</T>
          <Row style={{ justifyContent: 'space-between' }}>
            <Tap onPress={() => setGoal(w.goal - 250)} style={s.step} scale={0.9} accessibilityLabel="250 ml less"><Ionicons name="remove" size={22} color={c.text} /></Tap>
            <T v="display">{ml(w.goal)}</T>
            <Tap onPress={() => setGoal(w.goal + 250)} style={s.step} scale={0.9} accessibilityLabel="250 ml more"><Ionicons name="add" size={22} color={c.text} /></Tap>
          </Row>
          {w.auto ? (
            <T v="small" style={{ textAlign: 'center' }}>From your body weight: about 35 ml per kg</T>
          ) : (
            <Tap onPress={() => setPrefs({ ...prefs, goalMl: auto, auto: true })} style={s.reset} scale={0.97}>
              <Ionicons name="refresh" size={14} color={c.accent} />
              <T v="small" color={c.accent}>{`Use my body weight (${ml(auto)})`}</T>
            </Tap>
          )}
        </View>
        <View style={{ gap: 8 }}>
          <T v="label">One tap adds</T>
          <Row gap={6}>
            {SIZES.map((x) => {
              const on = x.ml === prefs.glassMl;
              return (
                <Tap key={x.ml} onPress={() => setPrefs({ ...prefs, glassMl: x.ml })} scale={0.95} style={[s.size, on && { backgroundColor: dom.water, borderColor: dom.water }]}
                  accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${x.label}, ${x.ml} ml`}>
                  <T v="small" color={on ? c.accentInk : c.text} style={{ fontFamily: f.semi }}>{x.ml}</T>
                  <T v="small" color={on ? c.accentInk : c.muted} style={{ fontSize: 11, lineHeight: 14 }}>ml</T>
                </Tap>
              );
            })}
          </Row>
          <T v="small" style={{ textAlign: 'center' }}>{sizeName(prefs.glassMl)}</T>
        </View>
        <View style={s.rule} />
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">Remind me to drink</T>
            <T v="small">{`Every ${hydration.every} min, ${clock(hydration.from, 0)}–${clock(hydration.to, 0)} · stops at your goal`}</T>
          </View>
          <Switch value={hydration.on} onValueChange={remind} accessibilityLabel="Remind me to drink"
            trackColor={{ true: c.accent, false: c.line }} ios_backgroundColor={c.line} thumbColor="#FFFFFF" />
        </Row>
        <Tap onPress={() => { onClose(); setTimeout(() => router.push('/reminders'), 180); }} style={s.reset} scale={0.97}>
          <T v="small" color={c.accent}>Change times in Reminders</T>
          <Ionicons name="chevron-forward" size={14} color={c.accent} />
        </Tap>
        <Button title="Done" onPress={onClose} />
      </View>
    </Sheet>
  );
}

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
    <Ionicons name="chevron-forward" size={16} color={c.muted} />
  </Tap>
);

const s = StyleSheet.create({
  days: { marginTop: 12, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 0 },
  dayBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, padding: 16, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1, overflow: 'hidden' },
  water: { gap: 12, marginTop: 12, padding: 16, borderRadius: r.lg, borderWidth: 1 },
  slotMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  round: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  drink: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center' },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  sub: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 48, minHeight: 44, paddingRight: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 44, paddingLeft: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  food: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: r.sm, backgroundColor: c.card2 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: r.md, backgroundColor: c.card },
  undo: { height: 44, paddingHorizontal: 14, justifyContent: 'center' },
  step: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  reset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44 },
  size: { flex: 1, height: 52, borderRadius: r.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.line },
});
