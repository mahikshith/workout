import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { cheer, challengeById, challenges, GOALS, LEVELS, type Challenge, type GoalTag, type Level } from '../src/data/challenges';
import { Header } from '../src/kit';
import { extraPills, goalColor, goalTint, openChallenge, Pill, TodayTasks, useRecommended, useRun, useTaskActions } from '../src/challenges/use';
import { useStore } from '../src/store';
import { SafetyNote } from '../src/safety';
import { c, dom, f, r, tint } from '../src/theme';
import { Button, Chip, IconBox, Ring, Row, Screen, Section, T, Tap } from '../src/ui';
import { Enter } from './library';

// Challenges: yours on top (progress ring, today's task, one button), then every challenge, picked-for-you first,
// filtered by level and goal. Depth: Challenges -> challenge.

// The catalogue itself, shared by this screen and the Plans tab (Challenges segment).
export function ChallengesBody() {
  const { ch: mine, prog } = useRun();
  const recs = useRecommended();
  const past = useStore((s) => s.pastChallenges);
  const { act, sheet } = useTaskActions();
  const [level, setLevel] = useState<Level | 'All'>('All');
  const [goal, setGoal] = useState<GoalTag | 'Any'>('Any');

  const forYou = useMemo(() => new Set(recs.slice(0, 3).map((x) => x.id)), [recs]);
  const finished = useMemo(() => new Set(past.filter((x) => x.completed).map((x) => x.id)), [past]);
  const badges = useMemo(() => past.filter((x) => x.completed && challengeById[x.id]).reverse(), [past]);
  const list = recs.filter((x) => (level === 'All' || x.level === level) && (goal === 'Any' || x.goal === goal));
  const goals = GOALS.filter((g) => challenges.some((x) => x.goal === g));
  const top = recs[0];
  // With no filter on, the catalogue is short: three picked for you, then one block per goal showing its best two
  // (in fit order) and "See all n" (which sets that goal's filter). A filter shows the plain matching list.
  const filtered = level !== 'All' || goal !== 'Any';
  const picks = recs.filter((x) => x.id !== mine?.id && (mine || x.id !== top?.id)).slice(0, 3);
  const shownPicks = new Set(picks.map((x) => x.id));
  const groups = goals.map((g) => ({ g, total: recs.filter((x) => x.goal === g).length, all: recs.filter((x) => x.goal === g && !shownPicks.has(x.id) && x.id !== mine?.id && (mine || x.id !== top?.id)) }))
    .filter((x) => x.all.length > 0);

  const join = (ch: Challenge) => {
    useStore.getState().joinChallenge(ch.id);
    openChallenge(ch.id);
  };

  return (
    <>
        {/* Yours: the running challenge, or the one picked for you. */}
        {mine && prog ? (
          <Enter>
            <Tap onPress={() => openChallenge(mine.id)} style={[s.hero, { borderColor: tint(goalColor(mine), 1.6) }]} scale={0.99}>
              <LinearGradient colors={[tint(goalColor(mine), 1.4), c.card]} locations={[0, 0.7]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <T v="label" color={goalColor(mine)}>Your challenge</T>
              <Row gap={16}>
                <Ring size={84} stroke={8} progress={prog.pct} color={goalColor(mine)}>
                  <T v="h2" style={{ lineHeight: 24 }}>{Math.min(prog.todayIdx + 1, mine.days)}</T>
                  <T v="small" style={{ fontSize: 12, lineHeight: 14 }}>{`of ${mine.days}`}</T>
                </Ring>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <T v="h2" numberOfLines={2}>{mine.name}</T>
                  <T v="small" color={c.soft} numberOfLines={2}>{cheer(prog)}</T>
                </View>
              </Row>
              {prog.over ? (
                <Button title={prog.completed ? 'Collect your badge' : 'See how it went'} icon={prog.completed ? 'trophy' : 'arrow-forward'} onPress={() => openChallenge(mine.id)} />
              ) : (
                <View style={s.today}>
                  <T v="label" style={{ marginBottom: 10 }}>{`Today · day ${prog.todayIdx + 1}`}</T>
                  <TodayTasks prog={prog} act={act} showMakeUp={false} />
                </View>
              )}
            </Tap>
          </Enter>
        ) : top ? (
          <Enter>
            <View style={[s.hero, { borderColor: tint(goalColor(top), 1.6) }]}>
              <LinearGradient colors={[tint(goalColor(top), 1.4), c.card]} locations={[0, 0.7]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <T v="label" color={goalColor(top)}>Picked for you</T>
              <Row gap={14}>
                <IconBox icon={top.icon} color={goalColor(top)} size={56} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <T v="h1" numberOfLines={2}>{top.name}</T>
                  <T v="small" color={c.soft} numberOfLines={2}>{top.tagline}</T>
                </View>
              </Row>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                <Pill icon="speedometer-outline" text={top.level} />
                <Pill icon="calendar-outline" text={`${top.days} days`} />
                <Pill icon="time-outline" text={top.effort} />
              </Row>
              <Button title="Start this challenge" icon="flag" onPress={() => join(top)} />
              <Tap onPress={() => openChallenge(top.id)} style={{ height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -4 }} feedback="none">
                <T v="small" color={c.text}>See what’s involved</T>
              </Tap>
            </View>
          </Enter>
        ) : null}

        {/* Badges earned: the trophy shelf. */}
        {badges.length > 0 && (
          <Enter i={1}>
            <Section title="Your badges">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -12 }}>
                <View style={{ width: 4 }} />
                {badges.map((b, k) => {
                  const ch = challengeById[b.id];
                  return (
                    <Tap key={k} onPress={() => openChallenge(ch.id)} style={s.badge} scale={0.96}>
                      <View style={[s.medal, { backgroundColor: tint(dom.streak, 1.4) }]}><Ionicons name="trophy" size={20} color={dom.streak} /></View>
                      <T v="h3" numberOfLines={1} style={{ fontSize: 15 }}>{ch.badge}</T>
                      <T v="small" numberOfLines={1} style={{ fontSize: 12 }}>{ch.name}</T>
                    </Tap>
                  );
                })}
                <View style={{ width: 4 }} />
              </ScrollView>
            </Section>
          </Enter>
        )}

        {/* Choosing is never a lock-in: say so where people choose. */}
        <View style={{ marginTop: 12 }}>
          <SafetyNote text="Switch or stop any time; your done days and badges stay. General fitness ideas, not medical advice." />
        </View>

        <Enter i={2}>
          <Section title={mine ? 'More challenges' : 'All challenges'}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }} style={{ marginHorizontal: -12 }}>
              {(['All', ...LEVELS] as const).map((l) => <Chip key={l} label={l} on={level === l} onPress={() => setLevel(l)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }} style={{ marginHorizontal: -12, marginTop: 8 }}>
              {(['Any', ...goals] as const).map((g) => (
                <Chip key={g} label={g === 'Any' ? 'Any goal' : g} on={goal === g} onPress={() => setGoal(g)} color={g === 'Any' ? c.accent : goalTint(g)} />
              ))}
            </ScrollView>
            <View style={{ gap: 12, marginTop: 16 }}>
              {!filtered && picks.length > 0 && <T v="h3">Recommended for you</T>}
              {!filtered && picks.map((ch) => <ChallengeRow key={ch.id} ch={ch} running={false} done={finished.has(ch.id)} forYou={forYou.has(ch.id)} />)}
              {!filtered && groups.map(({ g, all, total }) => (
                <View key={g} style={{ gap: 12, marginTop: 12 }}>
                  <Row gap={8}>
                    <View style={[s.dot, { backgroundColor: goalTint(g) }]} />
                    <T v="h3" style={{ flex: 1 }}>{g}</T>
                    {all.length > 2 && (
                      <Tap onPress={() => setGoal(g)} style={s.seeAll} scale={0.96} accessibilityLabel={`See all ${g} challenges`}>
                        <T v="small" color={c.accent} style={{ fontFamily: f.semi }}>{`See all ${total}`}</T>
                        <Ionicons name="chevron-forward" size={14} color={c.accent} />
                      </Tap>
                    )}
                  </Row>
                  {all.slice(0, 2).map((ch) => <ChallengeRow key={ch.id} ch={ch} running={false} done={finished.has(ch.id)} forYou={false} grouped />)}
                </View>
              ))}
              {filtered && list.map((ch) => (
                <ChallengeRow key={ch.id} ch={ch} running={mine?.id === ch.id} done={finished.has(ch.id)} forYou={forYou.has(ch.id)} />
              ))}
              {filtered && !list.length && (
                <View style={s.empty}>
                  <T v="body" color={c.muted} style={{ textAlign: 'center' }}>No challenge matches both filters.</T>
                  <Tap onPress={() => { setLevel('All'); setGoal('Any'); }} style={{ height: 44, justifyContent: 'center' }}><T v="h3" color={c.accent}>Show all</T></Tap>
                </View>
              )}
            </View>
          </Section>
        </Enter>
      {sheet}
    </>
  );
}

export default function Challenges() {
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Challenges" />
      <Screen top={4}><ChallengesBody /></Screen>
    </View>
  );
}

function ChallengeRow({ ch, running, done, forYou, grouped }: { ch: Challenge; running: boolean; done: boolean; forYou: boolean; grouped?: boolean }) {
  const col = goalColor(ch);
  const extra = extraPills(ch)[0];
  return (
    <Tap onPress={() => openChallenge(ch.id)} style={s.card} scale={0.98} accessibilityLabel={`${ch.name}, ${ch.level}, ${ch.days} days`}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <IconBox icon={ch.icon} color={col} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Row gap={8}>
            <T v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{ch.name}</T>
            {running ? <Tag text="Yours" color={c.accent} /> : done ? <Tag text="Finished" color={c.ok} icon="checkmark" /> : forYou ? <Tag text="For you" color={col} /> : null}
          </Row>
          <T v="small" numberOfLines={2}>{ch.tagline}</T>
          {/* One line of pills: level, days, then the goal (or, inside a goal's block, the kit / who it's for); the last
              one shrinks rather than wrapping. */}
          <Row gap={6} style={{ marginTop: 8 }}>
            <Pill text={ch.level} />
            <Pill text={`${ch.days} days`} />
            {grouped
              ? extra && <Pill text={extra.text} shrink />
              : <Pill text={ch.goal} color={col} bg={tint(col, 0.9)} shrink />}
          </Row>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.muted} style={{ alignSelf: 'center' }} />
      </Row>
    </Tap>
  );
}

const Tag = ({ text, color, icon }: { text: string; color: string; icon?: keyof typeof Ionicons.glyphMap }) => (
  <Row gap={3} style={{ height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: tint(color, 1.2) }}>
    {icon && <Ionicons name={icon} size={12} color={color} />}
    <T v="small" color={color} style={{ fontSize: 12, lineHeight: 15 }}>{text}</T>
  </Row>
);

const s = StyleSheet.create({
  hero: { gap: 14, padding: 18, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  today: { padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  card: { padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  badge: { width: 128, gap: 6, padding: 12, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  medal: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 44, paddingLeft: 8 },
  empty: { alignItems: 'center', gap: 4, padding: 20, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
});
