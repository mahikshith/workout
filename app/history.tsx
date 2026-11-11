// Calendar (Consistency): the one home of the streak and the month calendar. Each day shows what happened, from our
// own log and from the watch; tapping a day opens its sheet (details, delete, mark as rest or excused).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appList, DaySheet, kcalShort, Legend, MonthGrid, monthDays, monthSummary, SourceBadge, syncedAgo } from '../src/calendar';
import { Bars } from '../src/charts';
import { PHONE_ORIGINS } from '../src/health/guides';
import { energyFor, useEnergyData } from '../src/health/useEnergy';
import { sessionMinutes } from '../src/glance';
import { bestStreak, dayKey, streak, targets } from '../src/calc';
import { EASE, Header, useMiniBarSpace } from '../src/kit';
import { useStore } from '../src/store';
import { useTracker } from '../src/tracker';
import { c, dom, r, tint } from '../src/theme';
import { Card, IconBox, ListRow, Row, Section, T, Tap } from '../src/ui';

export default function History() {
  const sessions = useStore((s) => s.sessions);
  const profile = useStore((s) => s.profile);
  const water = useStore((s) => s.water);
  const excuses = useStore((s) => s.excuses);
  const reminders = useStore((s) => s.reminders);
  const planId = useStore((s) => s.planId);
  const planStart = useStore((s) => s.planStart);
  const workouts = useTracker((t) => t.workouts);
  const merged = useTracker((t) => t.merged);
  const daily = useTracker((t) => t.daily);
  const hc = useTracker((t) => t.hc);
  const ring = useTracker((t) => t.ring);
  const strap = useTracker((t) => t.strap);
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const still = useReducedMotion();
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [day, setDay] = useState<string | null>(null);
  const gentle = !!(profile?.gentle || profile?.concerns?.includes('food'));

  const data = useEnergyData();
  const days = useMemo(() => monthDays(month, { sessions, workouts, merged, daily, excuses, reminders, planId, planStart, energy: (x) => energyFor(x, data, profile) }),
    [month, sessions, workouts, merged, daily, excuses, reminders, planId, planStart, data, profile]);
  // The last workouts with what they burned and the heart rate, newest first.
  const recentOurs = useMemo(() => sessions.filter((x) => x.endedAt).sort((a, b) => b.startedAt - a.startedAt).slice(0, 5).map((x) => ({ s: x, e: energyFor(x, data, profile) })),
    [sessions, data, profile]);
  const sum = monthSummary(days);
  const showKcal = !gentle && sum.kcal !== undefined;
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const thisMonth = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
  const st = streak(sessions), best = bestStreak(sessions);
  const monthName = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  // Sessions per week: four weeks back, this week, three weeks still to come (Monday to Sunday).
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const back = (k: number) => { const x = new Date(mon); x.setDate(mon.getDate() - 7 * k); return x; };
  const weekOf = (k: number) => { const a = back(k).getTime(), b = back(k - 1).getTime(); return sessions.filter((s) => s.startedAt >= a && s.startedAt < b).length; };
  const perWeek = Array.from({ length: 8 }, (_, i) => ({ label: i === 4 ? 'Now' : String(back(4 - i).getDate()), value: i > 4 ? 0 : weekOf(4 - i) }));

  // Glance for the fuel and water charts (their home is /chart/fuel).
  const t = targets(profile);
  const fortnight = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); return dayKey(d); });
  const waterDays = fortnight.filter((k) => (water[k] ?? 0) >= t.water).length;

  // What the watch apps sent in the last 30 days, and when they last synced.
  const cut = dayKey(Date.now() - 30 * 86400000);
  const recent = Object.values(daily).filter((d) => d.date >= cut);
  const recentW = Object.values({ ...workouts, ...merged }).filter((w) => w.start.slice(0, 10) >= cut);
  // Watch apps only: the phone's own step counter isn't "from your watch".
  const apps = appList([...recent.flatMap((d) => d.origin ?? []), ...recentW.flatMap((w) => (w.originApp ? [w.originApp] : []))].filter((p) => !PHONE_ORIGINS.includes(p)));
  const kinds = [recentW.length ? 'workouts' : null, !gentle && recent.some((d) => d.activeKcal !== undefined) ? 'calories' : null,
    recent.some((d) => d.steps !== undefined) ? 'steps' : null, recent.some((d) => d.sleep) ? 'sleep' : null].filter(Boolean) as string[];
  const lastSync = [hc.lastSync, ring?.lastSync, strap?.lastConnected].filter(Boolean).sort().pop();
  const hasWatch = hc.connected || !!ring || !!strap || recent.length > 0 || recentW.length > 0;

  const stats = [
    { value: String(sum.workouts), label: sum.workouts === 1 ? 'workout' : 'workouts' },
    { value: String(sum.active), label: 'active days' },
    { value: String(sum.rest), label: 'rest days' },
    ...(gentle ? [] : [{ value: sum.kcal !== undefined ? kcalShort(sum.kcal) : '–', label: 'kcal burned' }]),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Calendar" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + 120 + mini }} showsVerticalScrollIndicator={false}>
        {/* The streak, calm: one line and its rule. */}
        <Animated.View entering={enter(0)}>
          <View style={[s.streak, { backgroundColor: tint(dom.streak, 0.9), borderColor: tint(dom.streak, 1.6) }]}>
            <IconBox icon="flame" color={dom.streak} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="h2">{st ? `${st} day streak` : sessions.length ? 'Start a new streak' : 'Your streak starts here'}</T>
              <T v="small" numberOfLines={2}>{sessions.length ? `Best ${best} · ${sessions.length} workouts in all · 3 days off ends it` : 'Log a workout and this calendar fills in'}</T>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Card style={{ marginTop: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Tap onPress={() => shift(-1)} style={s.nav} accessibilityLabel="Last month"><Ionicons name="chevron-back" size={18} color={c.text} /></Tap>
              {thisMonth ? <T v="h3">{monthName}</T> : (
                <Tap onPress={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonth(d); }} scale={0.98} feedback="none"
                  accessibilityLabel={`${monthName}. Back to this month`} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
                  <T v="h3">{monthName}</T>
                  <T v="small" color={c.accent}>Back to today</T>
                </Tap>
              )}
              <Tap onPress={() => shift(1)} style={s.nav} accessibilityLabel="Next month"><Ionicons name="chevron-forward" size={18} color={c.text} /></Tap>
            </Row>

            {/* The month in numbers. */}
            <View style={s.sumRow}>
              {stats.map((x, i) => (
                <View key={x.label} style={[s.sumCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.line }]}>
                  <T v="h2" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{x.value}</T>
                  <T v="small" numberOfLines={1}>{x.label}</T>
                </View>
              ))}
            </View>

            {/* Calories burned: the month's total and a weekly average. */}
            {showKcal && (sum.kcalPerWeek !== undefined || sum.kcalEst) && (
              <Row gap={8} style={{ marginTop: 10, paddingHorizontal: 4 }}>
                <Ionicons name="flame" size={16} color={dom.kcal} />
                <T v="small" color={c.text} numberOfLines={1} style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
                  {sum.kcalPerWeek !== undefined ? `About ${sum.kcalPerWeek.toLocaleString()} kcal a week` : `${sum.kcal!.toLocaleString()} kcal so far`}
                </T>
                {sum.kcalEst && <T v="small" color={c.dim}>{days.every((d) => !d || d.kcal === undefined || d.est) ? 'estimated' : 'part estimated'}</T>}
              </Row>
            )}

            <Animated.View key={month.toISOString()} entering={still ? undefined : FadeIn.duration(220)}>
              <MonthGrid days={days} onPick={setDay} onSwipe={shift} showKcal={showKcal} />
            </Animated.View>
            <Legend showKcal={showKcal} />
            <T v="small" color={c.dim} style={{ marginTop: 10 }}>{showKcal ? 'The number under a day is the calories burned · tap a day for details' : 'Tap a day for details · swipe for other months'}</T>
          </Card>
        </Animated.View>

        {/* Where the watch numbers come from. */}
        <Animated.View entering={enter(2)} style={{ marginTop: 12 }}>
          {hasWatch ? (
            <Tap onPress={() => router.push('/tracker')} style={s.watch} scale={0.98} accessibilityLabel="From your watch: open Tracker">
              <IconBox icon="watch-outline" color={c.blue} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3" numberOfLines={1}>From your watch</T>
                <T v="small" numberOfLines={2}>{[apps.length ? apps.join(', ') : hc.connected ? 'Health Connect' : ring?.name ?? strap?.name ?? 'Your watch', lastSync ? `synced ${syncedAgo(lastSync)}` : null].filter(Boolean).join(' · ')}</T>
                <T v="small" numberOfLines={1} color={c.dim}>{kinds.length ? `Sends ${kinds.join(', ')}` : 'Nothing synced lately'}</T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.dim} />
            </Tap>
          ) : (
            <ListRow icon="watch-outline" color={c.blue} title="Add your watch" sub={gentle ? 'Its runs and walks show here' : 'Its runs and calories show here'}
              onPress={() => router.push('/watch')} style={s.watch} />
          )}
        </Animated.View>

        {recentOurs.length > 0 && (
          <Animated.View entering={enter(3)}>
            <Section title="Recent workouts">
              <View style={{ gap: 8 }}>
                {recentOurs.map(({ s: x, e }) => {
                  const when = new Date(x.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
                  const hr = e.avgHr ? (e.maxHr ? `${e.avgHr} avg · ${e.maxHr} max bpm` : `avg ${e.avgHr} bpm`) : null;
                  return (
                    <Tap key={x.id} onPress={() => setDay(dayKey(x.startedAt))} style={s.recent} scale={0.98} accessibilityLabel={`${x.title}, ${when}. Open the day`}>
                      <Row gap={12}>
                        <IconBox icon={x.place === 'home' ? 'home' : 'barbell'} color={dom.train} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <T v="h3" numberOfLines={1}>{x.title}</T>
                          <T v="small" numberOfLines={1}>{when} · {sessionMinutes(x)} min</T>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={c.dim} />
                      </Row>
                      {((!gentle && e.kcal > 0) || hr) && (
                        <Row gap={12} style={{ flexWrap: 'wrap', rowGap: 6 }}>
                          {!gentle && e.kcal > 0 && <Row gap={6}><Ionicons name="flame" size={14} color={dom.kcal} /><T v="small" color={c.text} style={{ fontVariant: ['tabular-nums'] }}>{e.source === 'watch' ? '' : 'about '}{e.kcal} kcal</T></Row>}
                          {hr && <Row gap={6}><Ionicons name="heart" size={14} color={dom.heart} /><T v="small" color={c.text} style={{ fontVariant: ['tabular-nums'] }}>{hr}</T></Row>}
                          {!gentle && e.kcal > 0 && <SourceBadge source={e.source} />}
                        </Row>
                      )}
                    </Tap>
                  );
                })}
              </View>
            </Section>
          </Animated.View>
        )}

        <Animated.View entering={enter(4)}>
          <Section title="Sessions per week">
            <Card>
              {sessions.length ? <Bars items={perWeek} now={4} color={dom.train} /> : <T v="body" color={c.muted}>No sessions yet</T>}
            </Card>
          </Section>
        </Animated.View>

        <Section title="Habits">
          <ListRow icon="water" color={c.blue} title="Fuel and water" sub={`Water on target ${waterDays} of 14 days`} onPress={() => router.push('/chart/fuel')} />
        </Section>
      </ScrollView>
      <DaySheet day={day} onClose={() => setDay(null)} />
    </View>
  );
}


const s = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.lg, borderWidth: 1 },
  nav: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  sumRow: { flexDirection: 'row', marginTop: 14, paddingVertical: 10, borderRadius: r.md, backgroundColor: c.card2 },
  sumCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4 },
  recent: { gap: 10, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
});
