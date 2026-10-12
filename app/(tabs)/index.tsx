import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { dayKey, streak as calcStreak, targets } from '../../src/calc';
import { greeting } from '../../src/coach';
import { available, byId, exercises, type Place } from '../../src/data/exercises';
import { planById, type Day } from '../../src/data/plans';
import { motivation } from '../../src/data/motivation';
import { asDay } from '../../src/data/quick';
import { gate, insights, quickFor, suggest } from '../../src/engine';
import { useStore, type Mood } from '../../src/store';
import { c, f, r } from '../../src/theme';
import { Button, Chip, Ring, Rise, Row, Screen, T, Tap, Thumb } from '../../src/ui';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MOODS: { v: Mood; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 1, label: 'Drained', icon: 'battery-dead' },
  { v: 2, label: 'Meh', icon: 'cloudy' },
  { v: 3, label: 'Good', icon: 'sunny' },
  { v: 4, label: 'Fired up', icon: 'flash' },
];
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const WHERE: Record<string, string> = { office: 'Desk', home: 'Home', gym: 'Gym', anywhere: 'Anywhere' };

export default function Today() {
  const st = useStore();
  const { profile, sessions, active, meals, checkins, start, checkIn, dismiss } = st;
  const [later, setLater] = useState(false);
  const [editMood, setEditMood] = useState(false);
  const [spin, setSpin] = useState(0);
  const [place, setPlace] = useState<Place>(profile.place === 'home' ? 'home' : 'gym');

  const today = dayKey();
  const mood = checkins[today];
  const sug = suggest(st);
  const tip = insights(st)[0];
  const plan = planById[st.planId] ?? planById['full-body-gym'];
  const streak = calcStreak(sessions);
  const t = targets(profile);
  const gentle = profile.gentle || profile.concerns?.includes('food');
  const todays = meals.filter((m) => m.day === today);
  const protein = todays.reduce((a, m) => a + m.protein, 0);
  const water = st.water[today] ?? 0;
  const trainedToday = sessions.some((s) => dayKey(s.startedAt) === today);
  const trained = new Set(sessions.map((s) => dayKey(s.startedAt)));
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const replaced = sug.day.slots.filter((sl) => !available(byId[sl.id], place, profile.gear) || gate(byId[sl.id], profile, sessions.length).locked).length;
  const qs = quickFor(profile);
  const anywhere = exercises.filter((e) => e.art && e.equipment === 'body only' && e.level === 'beginner' && e.category === 'strength').slice(0, 8);
  const lastAt = sessions[sessions.length - 1]?.startedAt;
  const daysOff = lastAt ? Math.floor((Date.now() - lastAt) / 86400000) : 0;
  const slot = Math.floor(Date.now() / (3 * 3600000)); // a new line every 3 hours, or on tap
  const quote = motivation(profile, daysOff, slot + spin);
  const label = { plan: `Up next · ${plan.name}`, light: 'Lighter today', rest: 'Recovery', gentle: 'Gentle today' }[sug.kind];

  const go = (d: Day, pl: Place, planId?: string, dayIndex?: number) => { start(d, pl, planId, dayIndex); router.push('/session'); };

  return (
    <Screen>
      <Rise>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T v="small">{greeting()}</T>
            <T v="display" numberOfLines={1} adjustsFontSizeToFit>{profile.name || 'Welcome'}</T>
          </View>
          <Row gap={8}>
            <Tap onPress={() => router.push('/history')} style={s.pill}>
              <Ionicons name="flame" size={18} color={c.warm} />
              <T v="h3">{streak}</T>
            </Tap>
            <Tap onPress={() => router.push('/you')} style={[s.avatar, { backgroundColor: c.accent }]}>
              {profile.name ? <T v="h3" color={c.accentInk}>{profile.name[0].toUpperCase()}</T> : <Ionicons name="person" size={18} color={c.accentInk} />}
            </Tap>
          </Row>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 14 }} gap={6}>
          {WEEK.map((w, i) => {
            const d = new Date(monday); d.setDate(monday.getDate() + i);
            const k = dayKey(d), did = trained.has(k), now = k === today;
            return (
              <View key={i} style={[s.wd, now && { borderWidth: 1.5, borderColor: c.text }, did && { backgroundColor: c.accent }]}>
                <T v="label" color={did ? c.accentInk : now ? c.text : c.muted}>{w}</T>
                <T v="h3" color={did ? c.accentInk : c.text}>{d.getDate()}</T>
              </View>
            );
          })}
        </Row>
      </Rise>

      <Rise i={1}>
        <Tap onPress={() => setSpin(spin + 1)} scale={0.99} feedback="none" style={s.quote}>
          <View style={[s.quoteBar, { backgroundColor: c.accent }]} />
          <Animated.View key={quote} entering={FadeIn.duration(350).easing(EASE)} style={{ flex: 1 }}>
            <T v="h2" style={{ lineHeight: 28 }}>{quote}</T>
          </Animated.View>
        </Tap>
      </Rise>

      {!profile.name && !later && (
        <Rise i={1}>
          <View style={[s.card, { marginTop: 16, borderColor: c.accent + '55' }]}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">Make it yours</T>
                <T v="small">A few quick questions and we'll tailor your plan, home alternatives and food targets. Everything works without it too.</T>
              </View>
              <Tap onPress={() => setLater(true)} style={{ padding: 4 }}><Ionicons name="close" size={18} color={c.muted} /></Tap>
            </Row>
            <Row style={{ marginTop: 14 }} gap={10}>
              <Button title="Personalize" icon="sparkles" style={{ height: 46, flex: 1 }} onPress={() => router.push('/onboarding')} />
              <Button title="Not now" kind="ghost" style={{ height: 46 }} onPress={() => setLater(true)} />
            </Row>
          </View>
        </Rise>
      )}

      <Rise i={2}>
        {mood && !editMood ? (
          <Tap onPress={() => setEditMood(true)} style={[s.card, s.moodLine]} scale={0.98}>
            <Ionicons name={MOODS[mood - 1].icon} size={18} color={c.accent} />
            <T v="body" style={{ flex: 1 }}>Feeling {MOODS[mood - 1].label.toLowerCase()} today</T>
            <T v="small">Change</T>
          </Tap>
        ) : (
          <Animated.View entering={FadeIn.duration(250).easing(EASE)} style={[s.card, { marginTop: 16 }]}>
            <T v="h3">How are you feeling?</T>
            <T v="small" style={{ marginTop: 2 }}>Today's suggestion adapts to your answer.</T>
            <Row style={{ marginTop: 14 }} gap={8}>
              {MOODS.map((m) => {
                const on = mood === m.v;
                return (
                  <Tap key={m.v} onPress={() => { checkIn(m.v); setEditMood(false); }} style={[s.mood, on && { backgroundColor: c.accent, borderColor: c.accent }]} scale={0.95}>
                    <Ionicons name={m.icon} size={22} color={on ? c.accentInk : c.text} />
                    <T v="small" color={on ? c.accentInk : c.text} numberOfLines={1}>{m.label}</T>
                  </Tap>
                );
              })}
            </Row>
          </Animated.View>
        )}
      </Rise>

      <Rise i={3}>
        <Tap onPress={() => router.push('/fuel')} scale={0.98} style={[s.card, { marginTop: 12 }]}>
          <Row style={{ justifyContent: 'space-around' }}>
            <RingStat progress={trainedToday ? 1 : 0} color={c.accent} icon="barbell" value={trainedToday ? 'Done' : 'To do'} label="Workout" />
            {gentle ? (
              <RingStat progress={new Set(todays.map((m) => m.slot ?? m.id)).size / 4} color={c.pink} icon="restaurant" value={`${new Set(todays.map((m) => m.slot ?? m.id)).size} of 4`} label="Meals" />
            ) : (
              <RingStat progress={protein / t.protein} color={c.pink} icon="nutrition" value={`${protein}/${t.protein}g`} label="Protein" />
            )}
            <RingStat progress={water / t.water} color={c.blue} icon="water" value={`${water}/${t.water}`} label="Water" />
          </Row>
        </Tap>
      </Rise>

      {active && (
        <Rise i={4}>
          <Tap onPress={() => router.push('/session')} style={[s.resume, { backgroundColor: c.accent }]}>
            <Ionicons name="play" size={18} color={c.accentInk} />
            <T v="h3" color={c.accentInk} style={{ flex: 1 }} numberOfLines={1}>Resume {active.title}</T>
            <Ionicons name="chevron-forward" size={18} color={c.accentInk} />
          </Tap>
        </Rise>
      )}

      <Rise i={4}>
        <View style={s.hero}>
          <LinearGradient colors={[plan.color + '4D', plan.color + '0D', c.card]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label" color={plan.color} numberOfLines={1} style={{ flex: 1 }}>{label}</T>
            <Tap onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })} style={{ padding: 4 }}>
              <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
            </Tap>
          </Row>
          <T v="display" style={{ marginTop: 4 }} numberOfLines={2}>{sug.title}</T>
          <T v="small" style={{ marginTop: 2 }}>About {sug.minutes} min · {sug.day.slots.length} exercises</T>
          <Row style={{ marginTop: 14, alignItems: 'flex-start' }} gap={8}>
            <Ionicons name="sparkles" size={16} color={c.accent} style={{ marginTop: 3 }} />
            <T v="body" style={{ flex: 1 }}>{sug.reason}</T>
          </Row>
          <Row style={{ marginTop: 16 }} gap={8}>
            {sug.day.slots.slice(0, 5).map((sl) => <Thumb key={sl.id} ex={byId[sl.id]} size={46} />)}
            {sug.day.slots.length > 5 && <T v="small">+{sug.day.slots.length - 5}</T>}
          </Row>
          <Row style={{ marginTop: 16 }} gap={8}>
            <Chip label="Gym" icon="barbell" on={place === 'gym'} onPress={() => setPlace('gym')} />
            <Chip label="Home" icon="home" on={place === 'home'} onPress={() => setPlace('home')} />
          </Row>
          {replaced > 0 && (
            <T v="small" color={c.warm} style={{ marginTop: 10 }}>
              {replaced} exercise{replaced > 1 ? 's' : ''} will use {place === 'home' ? 'home-friendly' : 'beginner-friendly'} alternatives.
            </T>
          )}
          <Button title={active ? 'Resume your workout' : 'Start'} icon="play" style={{ marginTop: 16 }}
            onPress={() => (active ? router.push('/session') : go(sug.day, place, sug.planId, sug.dayIndex))} />
        </View>
      </Rise>

      {tip && (
        <Rise i={5}>
          <View style={[s.card, { marginTop: 12 }]}>
            <Row style={{ alignItems: 'flex-start' }} gap={12}>
              <View style={[s.tipIcon, { backgroundColor: c.accent + '22' }]}><Ionicons name={tip.icon} size={18} color={c.accent} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">{tip.title}</T>
                <T v="body" color={c.muted}>{tip.body}</T>
              </View>
            </Row>
            <Tap onPress={() => dismiss(tip.id)} style={s.gotIt}><T v="small" color={c.text}>Got it</T></Tap>
          </View>
        </Rise>
      )}

      <Rise i={6}>
        <T v="label" style={{ marginTop: 26, marginBottom: 12 }}>Quick sessions</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {qs.map((q) => (
            <Tap key={q.id} onPress={() => (active ? router.push('/session') : go(asDay(q), place))} style={s.quick}>
              <View style={[s.quickIcon, { backgroundColor: c.accent + '22' }]}><Ionicons name={q.icon} size={20} color={c.accent} /></View>
              <T v="h3" style={{ marginTop: 14 }} numberOfLines={1}>{q.name}</T>
              <T v="small" numberOfLines={2}>{q.minutes} min · {WHERE[q.where[0]] ?? 'Anywhere'}</T>
            </Tap>
          ))}
        </ScrollView>
      </Rise>

      <Rise i={7}>
        <Row style={{ marginTop: 26, marginBottom: 12, justifyContent: 'space-between' }}>
          <T v="label">No equipment needed</T>
          <Tap onPress={() => router.push('/exercises')}><T v="small" color={c.accent}>See all</T></Tap>
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {anywhere.map((e) => (
            <Tap key={e.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })} style={s.anyCard} scale={0.97}>
              <Thumb ex={e} size={120} />
              <View style={{ padding: 10, gap: 2 }}>
                <T v="h3" numberOfLines={1}>{e.name}</T>
                <Row gap={4}><Ionicons name="home" size={12} color={c.muted} /><T v="small">Home or office</T></Row>
              </View>
            </Tap>
          ))}
        </ScrollView>
      </Rise>
    </Screen>
  );
}

function RingStat({ progress, color, icon, value, label }: { progress: number; color: string; icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Ring size={72} stroke={7} progress={progress} color={color}>
        <Ionicons name={icon} size={20} color={color} />
      </Ring>
      <T v="h3" numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: f.semi }}>{value}</T>
      <T v="label">{label}</T>
    </View>
  );
}

const s = StyleSheet.create({
  quote: { marginTop: 18, flexDirection: 'row', gap: 14, paddingVertical: 4 },
  quoteBar: { width: 3, borderRadius: 2 },
  card: { padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card2, paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.line },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wd: { flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: c.card },
  moodLine: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  mood: { flex: 1, height: 68, borderRadius: r.md, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  hero: { marginTop: 12, borderRadius: r.xl, padding: 22, overflow: 'hidden', backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  resume: { marginTop: 12, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  tipIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gotIt: { alignSelf: 'flex-end', marginTop: 12, paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: c.card2, justifyContent: 'center' },
  quick: { width: 150, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  quickIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  anyCard: { width: 120, borderRadius: r.md, backgroundColor: c.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
});
