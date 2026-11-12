// Today's challenge pane. Running: name, day X of N, today's task and one small action. None running: an invitation
// with the challenge picked for this person. Compact on purpose: Today is busy, and its button is tonal because
// Today's one filled button is the workout's Start.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { challenges, newMilestone, taskTitle } from '../data/challenges';
import { DoorCard } from '../kit';
import { useStore } from '../store';
import { c, dom, r, tint } from '../theme';
import { IconBox, Ring, T, Tap } from '../ui';
import { goalColor, nextUp, openChallenge, tick, useRecommended, useRun, useTaskActions } from './use';

export function ChallengeCard() {
  const { ch, prog, ctx } = useRun();
  const recs = useRecommended();
  const { act, sheet } = useTaskActions();
  const hints = useStore((s) => s.hints);

  if (!ch || !prog) {
    const top = recs[0];
    if (!top) return null;
    return (
      <Tap onPress={() => router.push('/challenges')} style={s.card} scale={0.98} accessibilityLabel={`Try a ${top.days}-day challenge picked for you: ${top.name}`}>
        <IconBox icon="trophy" color={dom.streak} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T v="h3" numberOfLines={1}>{top.name}</T>
          <T v="small" numberOfLines={1}>Challenge for you</T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </Tap>
    );
  }

  const col = goalColor(ch);
  const day = prog.today;
  const todayNext = prog.over ? null : nextUp(day, act);
  const makeUp = !prog.over && !todayNext && prog.makeUp ? nextUp(prog.makeUp, act) : null; // today's first, then a missed day
  const next = todayNext ?? makeUp;
  const todo = day?.tasks.find((t) => !t.done);
  const star = newMilestone(prog, hints);
  const steps = !next && !!todo && !day?.done && !prog.over; // only things the app can't start (steps): a tick instead
  const sub = prog.over
    ? (prog.completed ? 'Finished! Get your badge' : `Over · ${prog.done}/${prog.required}`)
    : star ? `${star.label}!`
    : makeUp && prog.makeUp ? `make up day ${prog.makeUp.i + 1}`
    : !day?.tasks.length ? 'rest day'
    : day.done ? 'done for today'
    : taskTitle((next?.state ?? todo ?? day.tasks[0]).task, ctx);
  return (
    <>
      <Tap onPress={() => openChallenge(ch.id)} style={s.card} scale={0.98} accessibilityLabel={`${ch.name}, day ${Math.min(prog.todayIdx + 1, ch.days)} of ${ch.days}`}>
        <Ring size={48} stroke={5} progress={prog.pct} color={col}>
          {prog.over && prog.completed
            ? <Ionicons name="trophy" size={18} color={dom.streak} />
            : <T v="h3" style={{ fontSize: 15 }}>{Math.min(prog.todayIdx + 1, ch.days)}</T>}
        </Ring>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T v="h3" numberOfLines={1}>{ch.name}</T>
          <T v="small" numberOfLines={1} color={star ? dom.streak : makeUp ? c.warm : day?.done || (prog.over && prog.completed) ? c.ok : c.muted}>
            {prog.over || star ? sub : `Day ${prog.todayIdx + 1}/${ch.days} · ${sub}`}
          </T>
        </View>
        {next ? (
          <Tap onPress={next.action.go} style={[s.act, { backgroundColor: tint(col, 1.2) }]} scale={0.94} accessibilityLabel={next.action.label}>
            <Ionicons name={next.action.icon} size={16} color={col} />
            <T v="small" color={col} style={{ fontSize: 15 }}>{next.action.short}</T>
          </Tap>
        ) : steps && day ? (
          <Tap onPress={() => tick(day.key, true)} style={[s.act, { backgroundColor: tint(col, 1.2) }]} scale={0.94} accessibilityLabel="Mark today done">
            <Ionicons name="checkmark" size={16} color={col} />
            <T v="small" color={col} style={{ fontSize: 15 }}>Did it</T>
          </Tap>
        ) : day?.done && !prog.over ? (
          <Ionicons name="checkmark-circle" size={28} color={c.ok} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        )}
      </Tap>
      {sheet}
    </>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  act: { height: 40, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
});

// Train's doorway to Challenges: the running one's day, or how many there are to pick from.
export function ChallengesDoor() {
  const { ch, prog } = useRun();
  const meta = ch && prog
    ? (prog.over ? `${ch.name} · finished` : `${ch.name} · day ${prog.todayIdx + 1}/${ch.days}`)
    : `${challenges.length} challenges`;
  return <DoorCard icon="trophy" color={dom.streak} title="Challenges" meta={meta} onPress={() => router.push('/challenges')} />;
}
