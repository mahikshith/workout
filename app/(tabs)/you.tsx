import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { targets } from '../../src/calc';
import { HOME_GEAR, title } from '../../src/data/exercises';
import { askPermission, reschedule } from '../../src/notify';
import { useStore, type Profile } from '../../src/store';
import { c } from '../../src/theme';
import { Button, Card, Chip, Rise, Row, Screen, Stepper, T, Tap } from '../../src/ui';

export default function You() {
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const setProfile = useStore((s) => s.setProfile);
  const reset = useStore((s) => s.reset);
  const [confirm, setConfirm] = useState(false);
  if (!profile) return null;
  const t = targets(profile);

  const save = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    if (patch.reminder) reschedule(next, sessions);
  };

  return (
    <Screen>
      <Rise>
        <Row>
          <View style={[s.avatar, { backgroundColor: c.accent }]}>{profile.name ? <T v="h1" color={c.accentInk}>{profile.name[0].toUpperCase()}</T> : <Ionicons name="person" size={28} color={c.accentInk} />}</View>
          <View style={{ flex: 1 }}>
            <T v="h1">{profile.name || 'Guest'}</T>
            <T v="small">{title(profile.gender === 'other' ? 'athlete' : profile.gender)} · {profile.age} y · {profile.heightCm} cm · {profile.weightKg} kg</T>
          </View>
        </Row>
      </Rise>

      <Rise i={1}>
        <Card style={{ marginTop: 18, gap: 12 }}>
          <Item icon="flag" label="Goal" value={title(profile.goal)} />
          <Item icon="restaurant" label="Diet" value={title(profile.diet)} />
          <Item icon="calendar" label="Days per week" value={String(profile.daysPerWeek)} />
          <Item icon="flame" label="Daily target" value={`${t.kcal} kcal · ${t.protein} g protein`} />
          <Button title={profile.name ? 'Edit profile' : 'Set up your profile'} kind="ghost" icon="create-outline" onPress={() => router.push('/onboarding')} />
        </Card>
      </Rise>

      <Rise i={2}>
        <Card style={{ marginTop: 14, gap: 14 }}>
          <T v="label">Where you train</T>
          <Row gap={8}>
            {(['gym', 'home', 'both'] as const).map((p) => <Chip key={p} label={title(p)} on={profile.place === p} onPress={() => save({ place: p })} />)}
          </Row>
          <T v="label" style={{ marginTop: 6 }}>Home equipment</T>
          <Row style={{ flexWrap: 'wrap' }} gap={8}>
            {HOME_GEAR.map((g) => (
              <Chip key={g} label={title(g)} on={profile.gear.includes(g)} color={c.blue}
                onPress={() => save({ gear: profile.gear.includes(g) ? profile.gear.filter((x) => x !== g) : [...profile.gear, g] })} />
            ))}
          </Row>
        </Card>
      </Rise>

      <Rise i={3}>
        <Card style={{ marginTop: 14, gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T v="h3">Daily nudges</T>
              <T v="small">Reminder at your training time, plus a streak alert.</T>
            </View>
            <Switch value={profile.reminder.on} trackColor={{ true: c.accent, false: c.card2 }} thumbColor={c.text}
              onValueChange={async (on) => { if (on) await askPermission(); save({ reminder: { ...profile.reminder, on } }); }} />
          </Row>
          {profile.reminder.on && (
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="body">Time</T>
              <Stepper value={profile.reminder.hour} onChange={(h) => save({ reminder: { ...profile.reminder, hour: (h + 24) % 24 } })} suffix=":00" />
            </Row>
          )}
        </Card>
      </Rise>

      <Rise i={4}>
        <Card style={{ marginTop: 14, gap: 8 }}>
          <T v="label">Coming soon</T>
          <Row><Ionicons name="images" size={18} color={c.pink} /><T v="body">Gym edits: turn your photos into share-ready posts with templates</T></Row>
        </Card>
      </Rise>

      <Rise i={5}>
        <View style={{ marginTop: 22 }}>
          {confirm ? (
            <View style={{ gap: 10 }}>
              <T v="body" color={c.danger}>This deletes your profile, workouts, meals and weights on this phone.</T>
              <Button title="Yes, erase everything" kind="danger" onPress={() => { reset(); router.replace('/'); }} />
              <Button title="Cancel" kind="ghost" onPress={() => setConfirm(false)} />
            </View>
          ) : (
            <Tap onPress={() => setConfirm(true)}><T v="small" color={c.danger} style={{ textAlign: 'center' }}>Erase all data</T></Tap>
          )}
        </View>
        <T v="small" color={c.dim} style={{ textAlign: 'center', marginTop: 24 }}>
          Exercise images and data: free-exercise-db (public domain). All your data stays on this phone.
        </T>
      </Rise>
    </Screen>
  );
}

const Item = ({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) => (
  <Row>
    <View style={s.itemIcon}><Ionicons name={icon} size={16} color={c.accent} /></View>
    <T v="body" color={c.muted} style={{ flex: 1 }}>{label}</T>
    <T v="h3">{value}</T>
  </Row>
);

const s = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  itemIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
});

