import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { targets } from '../../src/calc';
import { ContextFields } from '../../src/context';
import { HOME_GEAR, title } from '../../src/data/exercises';
import { UNLOCK } from '../../src/engine';
import { useStore, type Profile } from '../../src/store';
import { ACCENTS, c, type AccentId } from '../../src/theme';
import { Button, Card, Chip, Rise, Row, Screen, T, Tap } from '../../src/ui';

const LEVELS: [Profile['level'], string][] = [['beginner', 'New'], ['intermediate', 'Some experience'], ['advanced', 'Seasoned']];

export default function You() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const reset = useStore((s) => s.reset);
  const [confirm, setConfirm] = useState(false);
  const t = targets(profile);
  const gentle = profile.gentle || profile.concerns?.includes('food');
  const save = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch });
  // Changing the accent remounts the app from the root; come straight back here afterwards.
  const pickAccent = (accent: AccentId) => { if (accent === (profile.accent ?? 'lime')) return; save({ accent }); setTimeout(() => router.push('/you'), 60); };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tap onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        <T v="label">Profile</T>
        <View style={{ width: 40 }} />
      </Row>

      <Rise>
        <Row style={{ marginTop: 14 }}>
          <View style={[s.avatar, { backgroundColor: c.accent }]}>
            {profile.name ? <T v="h1" color={c.accentInk}>{profile.name[0].toUpperCase()}</T> : <Ionicons name="person" size={28} color={c.accentInk} />}
          </View>
          <View style={{ flex: 1 }}>
            <T v="h1" numberOfLines={1}>{profile.name || 'Guest'}</T>
            <T v="small" numberOfLines={1}>
              {profile.age} y · {profile.heightCm} cm{gentle ? '' : ` · ${profile.weightKg} kg`}
            </T>
          </View>
        </Row>
      </Rise>

      <Rise i={1}>
        <Card style={{ marginTop: 18, gap: 12 }}>
          <Item icon="flag" label="Goal" value={title(profile.goal)} />
          <Item icon="restaurant" label="Diet" value={title(profile.diet)} />
          <Item icon="calendar" label="Days per week" value={String(profile.daysPerWeek)} />
          {!gentle && <Item icon="flame" label="Daily target" value={`${t.kcal} kcal · ${t.protein} g`} />}
          <Button title={profile.name ? 'Edit profile' : 'Set up your profile'} kind="ghost" icon="create-outline" onPress={() => router.push('/onboarding')} />
        </Card>
      </Rise>

      <Rise i={2}>
        <Tap onPress={() => router.push('/reminders')} style={[s.row, { marginTop: 14 }]} scale={0.98}>
          <View style={[s.rowIcon, { backgroundColor: c.accent + '22' }]}><Ionicons name="notifications" size={18} color={c.accent} /></View>
          <View style={{ flex: 1 }}>
            <T v="h3">Reminders</T>
            <T v="small" numberOfLines={1}>Workouts, water, meals and desk breaks</T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Tap>
      </Rise>

      <Rise i={3}>
        <Card style={{ marginTop: 14, gap: 12 }}>
          <T v="label">Training experience</T>
          <Row style={{ flexWrap: 'wrap' }} gap={8}>
            {LEVELS.map(([v, label]) => <Chip key={v} label={label} on={profile.level === v} onPress={() => save({ level: v })} />)}
          </Row>
          <T v="small">
            {profile.level === 'beginner'
              ? `Harder moves unlock after ${UNLOCK.intermediate} sessions, expert ones after ${UNLOCK.expert}. It keeps the first weeks fun instead of painful.`
              : profile.level === 'intermediate' ? `Expert moves unlock after ${UNLOCK.expert} sessions.` : 'Everything is unlocked. Train smart.'}
          </T>
        </Card>
      </Rise>

      <Rise i={4}>
        <Card style={{ marginTop: 14, gap: 12 }}>
          <ContextFields p={profile} up={save} />
          <Row style={{ justifyContent: 'space-between', marginTop: 8 }} gap={12}>
            <View style={{ flex: 1 }}>
              <T v="h3">Gentle mode</T>
              <T v="small">Hide calories, weight and BMI everywhere.</T>
            </View>
            <Switch value={!!gentle} trackColor={{ true: c.accent, false: c.card2 }} thumbColor={c.text}
              onValueChange={(on) => save({ gentle: on, concerns: on ? profile.concerns : profile.concerns?.filter((x) => x !== 'food') })} />
          </Row>
        </Card>
      </Rise>

      <Rise i={5}>
        <Card style={{ marginTop: 14, gap: 12 }}>
          <T v="label">Accent colour</T>
          <Row style={{ flexWrap: 'wrap' }} gap={14}>
            {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
              const on = (profile.accent ?? 'lime') === id;
              return (
                <Tap key={id} onPress={() => pickAccent(id)} style={{ alignItems: 'center', gap: 6, width: 60 }} scale={0.92}>
                  <View style={[s.swatch, { backgroundColor: ACCENTS[id].hex, borderColor: on ? c.text : 'transparent' }]}>
                    {on && <Ionicons name="checkmark" size={20} color={c.accentInk} />}
                  </View>
                  <T v="small" numberOfLines={2} style={{ textAlign: 'center' }} color={on ? c.text : c.muted}>{ACCENTS[id].name}</T>
                </Tap>
              );
            })}
          </Row>
        </Card>
      </Rise>

      <Rise i={6}>
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

      <Rise i={7}>
        <Card style={{ marginTop: 14, gap: 8 }}>
          <T v="label">Coming soon</T>
          <Row style={{ alignItems: 'flex-start' }}><Ionicons name="images" size={18} color={c.pink} /><T v="body" style={{ flex: 1 }}>Gym edits: turn your photos into share-ready posts with templates</T></Row>
          <Row style={{ alignItems: 'flex-start' }}><Ionicons name="leaf" size={18} color={c.ok} /><T v="body" style={{ flex: 1 }}>Yoga and guided meditation</T></Row>
        </Card>
      </Rise>

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
        All your data stays on this phone. Not medical advice: check with a doctor before starting if you have a health condition.
      </T>
    </Screen>
  );
}

const Item = ({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) => (
  <Row>
    <View style={s.itemIcon}><Ionicons name={icon} size={16} color={c.accent} /></View>
    <T v="body" color={c.muted} style={{ flex: 1 }}>{label}</T>
    <T v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{value}</T>
  </Row>
);

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  itemIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 24, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
