import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { byId, title } from '../../src/data/exercises';
import { planById } from '../../src/data/plans';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Card, Rise, Row, Screen, T, Tap, Thumb } from '../../src/ui';

export default function PlanDetail() {
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  const plan = planById[id];
  const planId = useStore((s) => s.planId);
  const name = useStore((s) => s.profile?.name);
  const setPlan = useStore((s) => s.setPlan);
  if (!plan) return null;
  const isCurrent = plan.id === planId;
  const leave = () => (welcome ? router.replace('/') : router.back());

  return (
    <Screen>
      <View style={s.hero}>
        <LinearGradient colors={[plan.color + '66', plan.color + '00']} style={StyleSheet.absoluteFill} />
        {!welcome && <Tap onPress={leave} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>}
        <Rise>
          {welcome ? <T v="label" color={plan.color} style={{ marginTop: 8 }}>Your plan is ready, {name}</T> : <T v="label" color={plan.color} style={{ marginTop: 16 }}>{plan.place === 'any' ? 'Anywhere' : title(plan.place)} · {plan.level}</T>}
          <T v="display" style={{ marginTop: 6 }}>{plan.name}</T>
          <T v="body" color={c.muted}>{plan.tagline}</T>
          {welcome && <T v="small" style={{ marginTop: 10 }}>Picked from your goal, place, experience and schedule. You can switch plans anytime in Plans.</T>}
        </Rise>
      </View>

      {plan.days.map((d, i) => (
        <Rise key={d.name} i={i + 1}>
          <Card style={{ marginTop: 14 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T v="h2">{d.name}</T>
                <T v="small">{d.focus}</T>
              </View>
              <T v="label" color={plan.color}>Day {i + 1}</T>
            </Row>
            <View style={{ gap: 10, marginTop: 14 }}>
              {d.slots.map((sl) => (
                <Tap key={sl.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: sl.id } })} style={s.slot} scale={0.98}>
                  <Thumb ex={byId[sl.id]} size={44} />
                  <T v="h3" style={{ flex: 1 }} numberOfLines={1}>{byId[sl.id].name}</T>
                  <T v="small" color={c.text}>{sl.sets} × {sl.reps}</T>
                </Tap>
              ))}
            </View>
          </Card>
        </Rise>
      ))}

      <View style={{ marginTop: 22, gap: 10 }}>
        {welcome ? (
          <Button title="Let’s go" icon="flash" onPress={() => router.replace('/')} />
        ) : isCurrent ? (
          <Button title="This is your current plan" kind="ghost" icon="checkmark" disabled />
        ) : (
          <Button title="Switch to this plan" icon="swap-horizontal" onPress={() => { setPlan(plan.id); router.back(); }} />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { marginHorizontal: -20, marginTop: -12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: r.sm },
});
