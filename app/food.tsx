import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '../src/calc';
import { perServing, recipeById, totals, type Recipe } from '../src/data/recipes';
import { swapFor } from '../src/data/swaps';
import { FoodPicker, isGentle, servings, slotName, slotNow, SLOTS } from '../src/foodsheet';
import { EASE, goBack, Header, useMiniBarSpace } from '../src/kit';
import { useStore, type MealSlot } from '../src/store';
import { c, dom, r } from '../src/theme';
import { Meta as MetaLine, Tip } from '../src/tip';
import { Button, Card, haptic, Row, Section, Stepper, T, Tap, Tile } from '../src/ui';

type Icon = keyof typeof Ionicons.glyphMap;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const plural = (n: number) => `${Number.isInteger(n * 2) ? servings(n) : fmt(n)} serving${n === 1 ? '' : 's'}`; // ½, 1½
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const weighed = (amount: string) => /\d\s?(g|ml)\b/.test(amount); // gentle mode hides gram and ml amounts
const isSlot = (x?: string): x is MealSlot => !!x && SLOTS.some((s) => s.id === x);

// /food?recipe=<id> is the recipe page. Without a recipe it is the full food list (kept so old links still work).
export default function FoodPage() {
  const { slot, recipe } = useLocalSearchParams<{ slot?: string; recipe?: string }>();
  const rc = recipe ? recipeById[recipe] : undefined;
  if (rc) return <RecipePage rc={rc} slot={isSlot(slot) ? slot : undefined} />;
  return <AllFoods slot={isSlot(slot) ? slot : undefined} />;
}

function AllFoods({ slot }: { slot?: MealSlot }) {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Add food" />
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + mini }}>
        <FoodPicker slot={slot} onRecipe={(id, at) => router.push({ pathname: '/food', params: { recipe: id, slot: at } })} />
      </View>
    </KeyboardAvoidingView>
  );
}

function RecipePage({ rc, slot: slotParam }: { rc: Recipe; slot?: MealSlot }) {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const still = useReducedMotion();
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const addMeal = useStore((s) => s.addMeal);
  const removeMeal = useStore((s) => s.removeMeal);
  const [serv, setServ] = useState(1);
  const now = slotNow();
  const slot: MealSlot = slotParam ?? (rc.slots.includes(now) ? now : rc.slots[0] ?? now);

  const gentle = isGentle(profile);
  const per = perServing(rc);
  const whole = totals(rc);
  const already = meals.find((m) => m.day === dayKey() && (m.name === rc.name || m.name.startsWith(rc.name + ' (')));
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));
  const logIt = () => {
    addMeal({ name: serv === 1 ? rc.name : `${rc.name} (${plural(serv)})`, kcal: gentle ? 0 : Math.round(per.kcal * serv), protein: gentle ? 0 : Math.round(per.protein * serv), slot });
    haptic('success');
    goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Recipe" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <T v="h1">{rc.name}</T>
          <Row gap={16} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <Meta icon="time-outline" text={`${rc.minutes} min`} />
            <Meta icon="people-outline" text={`Serves ${fmt(rc.serves)}`} />
            <Meta icon="restaurant-outline" text={cap(rc.slots.join(', '))} />
          </Row>
          {!gentle && <T v="small" style={{ marginTop: 12 }}>{rc.why}</T>}
          {rc.group === 'Pregnancy-friendly' && (
            <View style={{ marginTop: 16 }}>
              <Row gap={8} style={s.preg}>
                <Ionicons name="heart" size={18} color={c.pink} />
                <T v="body" color={c.text} style={{ flex: 1 }}>Pregnancy-safe</T>
                <Tip title="Pregnancy-safe" text="Cooked through and pasteurised. Ask your doctor about your needs." />
              </Row>
            </View>
          )}
          {!gentle && (
            <Row style={{ marginTop: 16 }}>
              <Tile icon="flame" color={c.warm} value={per.kcal} unit="kcal" label="Per serving" />
              <Tile icon="nutrition" color={c.pink} value={per.protein} unit="g" label="Protein" />
            </Row>
          )}
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Section title="Ingredients">
            <Card style={{ paddingVertical: 4 }}>
              {rc.ing.map(([n, amount, k, p], i) => {
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
                          <Pill color={c.warm} icon="flame" text={`${k} kcal`} />
                          <Pill color={c.pink} icon="nutrition" text={`${p} g`} />
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
                  <T v="small" numberOfLines={1}>Makes {plural(rc.serves)}</T>
                </View>
                {!gentle && <MetaLine color={c.text} items={[{ icon: 'flame', text: `${whole.kcal} kcal`, color: c.warm }, { icon: 'nutrition', text: `${whole.protein} g`, color: c.pink }]} />}
              </Row>
            </Card>
          </Section>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <Section title="Steps">
            <Card style={{ gap: 16 }}>
              {rc.steps.map((x, n) => (
                <Row key={n} style={{ alignItems: 'flex-start' }}>
                  <View style={[s.num, { backgroundColor: c.accent + '22' }]}><T v="small" color={c.accent}>{n + 1}</T></View>
                  <T v="body" style={{ flex: 1 }}>{x}</T>
                </Row>
              ))}
            </Card>
          </Section>
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <Section title="More">
            <Card style={{ paddingVertical: 4 }}>
              <LinkRow icon="search" text="Search the web" url={`https://www.google.com/search?q=${encodeURIComponent(rc.name + ' recipe')}`} />
              <View style={s.sep} />
              <LinkRow icon="logo-youtube" text="Watch a video" url={`https://www.youtube.com/results?search_query=${encodeURIComponent('how to make ' + rc.name)}`} />
            </Card>
          </Section>
        </Animated.View>
      </ScrollView>

      {/* Footer: servings and the one primary button. */}
      <Animated.View entering={FadeIn.duration(280).easing(EASE)} style={[s.foot, { paddingBottom: ins.bottom + 12 + mini }]}>
        {already ? (
          <Row>
            <Row gap={6} style={{ flex: 1 }}>
              <Ionicons name="checkmark-circle" size={20} color={c.ok} />
              <T v="small" color={c.text} style={{ flex: 1 }}>{`Logged${already.slot ? ` · ${slotName(already.slot)}` : ' today'}`}</T>
            </Row>
            <Button title="Remove" icon="trash-outline" kind="ghost" onPress={() => removeMeal(already.id)} style={{ height: 48, paddingHorizontal: 16 }} />
          </Row>
        ) : (
          <>
            <MetaLine style={{ marginBottom: 8 }} items={[
              { icon: SLOTS.find((x) => x.id === slot)!.icon, text: slotName(slot) },
              !gentle && { icon: 'flame', text: `${Math.round(per.kcal * serv)} kcal`, color: dom.kcal },
              !gentle && { icon: 'nutrition', text: `${Math.round(per.protein * serv)} g protein`, color: dom.protein },
            ]} />
            <Row>
              <Stepper value={serv} onChange={setServ} step={0.5} min={0.5} />
              <Button title="Log" icon="add" onPress={logIt} style={{ flex: 1, height: 52, paddingHorizontal: 12 }} />
            </Row>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const LinkRow = ({ icon, text, url }: { icon: Icon; text: string; url: string }) => (
  <Tap onPress={() => Linking.openURL(url)} scale={0.98} style={s.link}>
    <Ionicons name={icon} size={20} color={c.muted} />
    <T v="body" style={{ flex: 1 }}>{text}</T>
    <Ionicons name="open-outline" size={16} color={c.dim} />
  </Tap>
);

const Meta = ({ icon, text }: { icon: Icon; text: string }) => (
  <Row gap={6}><Ionicons name={icon} size={16} color={c.muted} /><T v="small" color={c.text}>{text}</T></Row>
);

const Pill = ({ color, icon, text }: { color: string; icon: Icon; text: string }) => (
  <Row gap={4} style={[s.pill, { backgroundColor: color + '22' }]}><Ionicons name={icon} size={12} color={color} /><T v="small" color={color} numberOfLines={1}>{text}</T></Row>
);

const s = StyleSheet.create({
  ing: { paddingVertical: 12 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  preg: { minHeight: 52, paddingLeft: 14, paddingRight: 6, borderRadius: r.md, borderWidth: 1, borderColor: c.pink + '55', backgroundColor: c.card },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  foot: { paddingHorizontal: 12, paddingTop: 12, backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, borderTopLeftRadius: r.lg, borderTopRightRadius: r.lg },
});
