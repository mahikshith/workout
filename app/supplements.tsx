import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { postpartumWeek, pregnancyWeek } from '../src/calc';
import { EASE, Header, useMiniBarSpace } from '../src/kit';
import { askPermission, hasPermission } from '../src/notify';
import { SafetyNote } from '../src/safety';
import { Sheet } from '../src/sheet';
import { addSupplement, catalogue, clock, dayList, removeSupplement, SupplementTicks, useMySupplements, type MySupp } from '../src/supps';
import { TimePicker } from '../src/timepicker';
import { useStore, type SupplementReminder } from '../src/store';
import { c, f, r, tint } from '../src/theme';
import { Button, Card, IconBox, Row, T, Tap } from '../src/ui';
import { Ambient } from '../src/glass';

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first; the store counts 0 = Sunday
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const web = Platform.OS === 'web';
const MAX_TIMES = 3;

// What you take (protein shake, creatine, caffeine, vitamins, your own), ticked off each day, each with optional
// reminder times. Every change saves at once; src/notify.ts schedules the reminders.
export default function Supplements() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const still = useReducedMotion();
  const profile = useStore((s) => s.profile);
  const quietFrom = useStore((s) => s.nudges.quietFrom);
  const mine = useMySupplements();
  const [edit, setEdit] = useState<string | null>(null); // name of the one being edited
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState('');
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    hasPermission().then((g) => setGranted(web || g));
    const sub = AppState.addEventListener('change', async (a) => { if (a === 'active') setGranted(web || (await hasPermission())); });
    return () => sub.remove();
  }, []);

  const enter = (i: number) => (still ? undefined : FadeInDown.delay(Math.min(i, 6) * 60).duration(380).easing(EASE));
  const options = catalogue(profile).filter((x) => !mine.some((m) => m.name === x.name));
  const pregnant = pregnancyWeek(profile) !== null || postpartumWeek(profile) !== null;
  const caution = pregnant
    ? 'Pregnant or breastfeeding: check with your doctor before taking anything new, and keep caffeine under about 200 mg a day.'
    : profile.age < 18 ? 'Under 18: food first. Pre-workout and creatine are left out; ask a doctor before any supplement.' : null;
  const item = mine.find((m) => m.name === edit) ?? null;
  const add = (n: string) => { addSupplement(n); setEdit(n); };
  const addCustom = () => { const n = name.trim(); if (!n) return; setCustom(false); setName(''); setTimeout(() => add(n.charAt(0).toUpperCase() + n.slice(1)), 250); };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Ambient />
        <Header title="Supplements" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: ins.bottom + 40 + mini }} showsVerticalScrollIndicator={false}>
          <T v="small" style={{ marginTop: 4 }}>Tick what you take each day. Set a reminder for anything you take daily.</T>

          {caution && (
            <Animated.View entering={enter(1)} style={[s.note, { borderColor: tint(c.pink, 2.5), backgroundColor: tint(c.pink, 0.6) }]}>
              <Ionicons name="heart" size={18} color={c.pink} />
              <T v="small" color={c.text} style={{ flex: 1 }}>{caution}</T>
            </Animated.View>
          )}

          {!granted && mine.some((m) => m.times.some((x) => x.on)) && (
            <Animated.View entering={enter(1)} style={[s.note, { borderColor: tint(c.accent, 2.5) }]}>
              <Ionicons name="notifications-off-outline" size={18} color={c.accent} />
              <T v="small" color={c.text} style={{ flex: 1 }}>Notifications are off, so reminders can’t ring.</T>
              <Tap onPress={async () => { if (await askPermission()) setGranted(true); else Linking.openSettings(); }} style={s.textBtn}>
                <T v="small" color={c.accent} style={{ fontFamily: f.semi }}>Turn on</T>
              </Tap>
            </Animated.View>
          )}

          {/* Nothing added yet: the list to add from is the whole screen. */}
          {mine.length > 0 && (
            <Animated.View entering={enter(2)}>
              <T v="h2" style={{ marginTop: 20, marginBottom: 12 }}>Today</T>
              <Card style={{ gap: 14 }}>
                <SupplementTicks items={mine} />
              </Card>
            </Animated.View>
          )}

          {mine.length > 0 && (
            <Animated.View entering={enter(3)}>
              <T v="h2" style={{ marginTop: 32, marginBottom: 12 }}>What you take</T>
              <Card style={{ paddingVertical: 4 }}>
                {mine.map((m, i) => (
                  <Tap key={m.name} onPress={() => setEdit(m.name)} scale={0.99} feedback="none" style={[s.row, i > 0 && s.sep]} accessibilityLabel={`${m.short}, reminders and dose`}>
                    <IconBox icon={m.icon} color={c.ok} size={36} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="h3" numberOfLines={1}>{m.short}</T>
                      <T v="small" numberOfLines={1}>{summary(m)}</T>
                    </View>
                    {m.times.some((x) => x.on) && <Ionicons name="notifications" size={16} color={c.accent} />}
                    <Ionicons name="chevron-forward" size={16} color={c.muted} />
                  </Tap>
                ))}
              </Card>
            </Animated.View>
          )}

          <Animated.View entering={enter(4)}>
            <T v="h2" style={{ marginTop: mine.length ? 32 : 20, marginBottom: 12 }}>{mine.length ? 'Add more' : 'Add what you take'}</T>
            <Card style={{ paddingVertical: 4 }}>
              {options.map((x, i) => (
                <Tap key={x.name} onPress={() => add(x.name)} scale={0.99} feedback="light" style={[s.row, i > 0 && s.sep, { alignItems: 'flex-start', paddingVertical: 12 }]}
                  accessibilityLabel={`Add ${x.short}`}>
                  <IconBox icon={x.icon} color={c.muted} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3" numberOfLines={1}>{x.short}</T>
                    <T v="small">{x.note}</T>
                  </View>
                  <Ionicons name="add-circle" size={28} color={c.accent} style={{ marginTop: 4 }} />
                </Tap>
              ))}
              <Tap onPress={() => setCustom(true)} scale={0.99} style={[s.row, options.length > 0 && s.sep]} accessibilityLabel="Add something else">
                <IconBox icon="create-outline" color={c.accent} size={36} />
                <View style={{ flex: 1 }}>
                  <T v="h3" numberOfLines={1}>Something else</T>
                  <T v="small" numberOfLines={1}>Iron, magnesium, a daily habit…</T>
                </View>
                <Ionicons name="add-circle" size={28} color={c.accent} />
              </Tap>
            </Card>
          </Animated.View>

          <View style={{ marginTop: 12 }}>
            <SafetyNote text="Supplements are your choice. Read the label, and ask a doctor first if you are pregnant, have a health condition or take medication." />
          </View>
        </ScrollView>
      </View>

      <EditSheet item={item} quietFrom={quietFrom} onClose={() => setEdit(null)} onPermission={setGranted} />

      <Sheet open={custom} onClose={() => setCustom(false)}>
        <View style={{ gap: 14 }}>
          <T v="h2">Add your own</T>
          <TextInput value={name} onChangeText={setName} placeholder="Name, e.g. Magnesium" maxLength={30} placeholderTextColor={c.muted}
            style={s.input} returnKeyType="done" onSubmitEditing={addCustom} accessibilityLabel="Name" />
          <Button title="Add" icon="add" disabled={!name.trim()} onPress={addCustom} />
        </View>
      </Sheet>
    </>
  );
}

const summary = (m: MySupp) => {
  const on = m.times.filter((x) => x.on);
  const when = on.length ? on.map((x) => clock(x.hour, x.minute)).join(', ') + ` · ${dayList(on[0].days)}` : 'No reminder';
  return m.dose ? `${m.dose} · ${when}` : when;
};

// One supplement: dose, guidance, reminder times (each with days and on/off), remove.
function EditSheet({ item, quietFrom, onClose, onPermission }: { item: MySupp | null; quietFrom: number; onClose: () => void; onPermission: (g: boolean) => void }) {
  const [sel, setSel] = useState<string | null>(null); // the time being edited
  const [last, setLast] = useState<MySupp | null>(item);
  useEffect(() => { if (item) { setLast(item); setSel((cur) => (item.times.some((x) => x.id === cur) ? cur : item.times[0]?.id ?? null)); } }, [item]);
  const m = item ?? last;
  const rems = useStore((s) => s.supplementReminders);
  const setRems = useStore((s) => s.setSupplementReminders);
  const nudges = useStore((s) => s.nudges);
  if (!m) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const t = m.times.find((x) => x.id === sel) ?? m.times[0];

  const patch = (id: string, p: Partial<SupplementReminder>) => setRems(rems.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const turnOn = async (id: string, on: boolean) => {
    patch(id, { on });
    if (on && !web) onPermission(await askPermission()); // asked the moment a reminder is switched on
  };
  const setDose = (dose: string) => setRems(rems.map((x) => (x.name === m.name ? { ...x, dose } : x)));
  const addTime = () => {
    const base = m.times[m.times.length - 1];
    const r: SupplementReminder = { id: Date.now().toString(36), name: m.name, dose: m.dose, hour: base ? (base.hour + 4) % 24 : 9, minute: base?.minute ?? 0, days: base?.days ?? [], on: true };
    setRems([...rems, r]);
    setSel(r.id);
    if (!web) askPermission().then(onPermission);
  };
  const removeTime = (id: string) => { setRems(rems.filter((x) => x.id !== id)); setSel(null); };
  const min = t ? t.hour * 60 + t.minute : 0;
  const quiet = (() => { const x = nudges.quietFrom * 60, y = nudges.quietTo * 60; return x < y ? min >= x && min < y : x > y && (min >= x || min < y); })();
  // Caffeine within about 6 hours of bedtime (quiet hours' start stands in for bedtime).
  const late = !!m.cat?.caffeine && !!t && (quiet || ((quietFrom * 60 - min + 1440) % 1440) < 360);

  return (
    <Sheet open={!!item} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
        <Row gap={12}>
          <IconBox icon={m.icon} color={c.ok} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h2" numberOfLines={1}>{m.short}</T>
            {m.cat && <T v="small">{m.cat.note}</T>}
          </View>
        </Row>
        <View style={{ gap: 6 }}>
          <T v="label">Dose</T>
          <TextInput value={m.dose} onChangeText={setDose} placeholder="e.g. 1 scoop, 5 g, 1 tablet" maxLength={30} placeholderTextColor={c.muted}
            style={s.input} accessibilityLabel="Dose" />
        </View>

        <View style={{ gap: 10 }}>
          <T v="label">Reminders</T>
          {m.times.map((x) => (
            <Row key={x.id} gap={8}>
              <Tap onPress={() => setSel(x.id)} scale={0.98} style={[s.time, x.id === t?.id && { borderColor: c.accent }]} accessibilityLabel={`Reminder at ${clock(x.hour, x.minute)}, change time`}>
                <T v="h2" color={x.on ? c.text : c.muted}>{clock(x.hour, x.minute)}</T>
                <T v="small" numberOfLines={1} style={{ flex: 1 }}>{dayList(x.days)}</T>
              </Tap>
              <Switch value={x.on} onValueChange={(on) => turnOn(x.id, on)} accessibilityLabel={`Reminder at ${clock(x.hour, x.minute)}`}
                trackColor={{ true: c.accent, false: c.line }} thumbColor="#FFFFFF" ios_backgroundColor={c.line} />
            </Row>
          ))}
          {t && (
            <View style={{ gap: 10 }}>
              <TimePicker hour={t.hour} minute={t.minute} onChange={(hour, minute) => patch(t.id, { hour, minute })} />
              <Row gap={6}>
                {WEEK.map((d) => {
                  const on = t.days.includes(d);
                  return (
                    <Tap key={d} onPress={() => patch(t.id, { days: on ? t.days.filter((x) => x !== d) : [...t.days, d] })} style={[s.day, on && { backgroundColor: c.accent }]} scale={0.92}
                      accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                      <T v="h3" color={on ? c.accentInk : c.text}>{LETTER[d]}</T>
                    </Tap>
                  );
                })}
              </Row>
              <T v="small">{t.days.length && t.days.length < 7 ? `Only on ${dayList(t.days)}` : 'No days picked means every day.'}</T>
              {quiet && t.on && !late && <Line icon="moon-outline" text="This is inside your quiet hours. It will still ring, because you picked it." />}
              {late && <Line icon="warning-outline" color={c.warm} text={`Caffeine this late can cost you sleep. Try before ${clock((quietFrom + 18) % 24, 0)}.`} />}
              {m.times.length > 1 && (
                <Tap onPress={() => removeTime(t.id)} style={s.textBtn}><T v="small" color={c.danger}>Remove this time</T></Tap>
              )}
            </View>
          )}
          {m.times.length < MAX_TIMES && (
            <Tap onPress={addTime} style={s.addTime} scale={0.97}>
              <Ionicons name="add" size={18} color={c.accent} />
              <T v="small" color={c.accent} style={{ fontFamily: f.semi }}>{m.times.length ? 'Add another time' : 'Add a reminder'}</T>
            </Tap>
          )}
        </View>

        <Row gap={10} style={{ marginTop: 4 }}>
          <Button title="Remove" kind="danger" icon="trash-outline" style={{ flex: 1, paddingHorizontal: 12 }} onPress={() => { removeSupplement(m.name); onClose(); }} />
          <Button title="Done" style={{ flex: 1, paddingHorizontal: 12 }} onPress={onClose} />
        </Row>
      </ScrollView>
    </Sheet>
  );
}

const Line = ({ icon, text, color = c.muted }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) => (
  <Row gap={8} style={{ alignItems: 'flex-start' }}>
    <Ionicons name={icon} size={16} color={color} style={{ marginTop: 2 }} />
    <T v="small" color={color === c.muted ? c.muted : c.text} style={{ flex: 1 }}>{text}</T>
  </Row>
);

const s = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, minHeight: 44, borderRadius: r.md, borderWidth: 1, backgroundColor: c.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  input: { height: 48, borderRadius: r.md, backgroundColor: c.card2, paddingHorizontal: 14, color: c.text, fontFamily: f.medium, fontSize: 15 },
  time: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: r.md, backgroundColor: c.card2, borderWidth: 1, borderColor: 'transparent' },
  day: { flex: 1, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  addTime: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44 },
  textBtn: { height: 44, paddingHorizontal: 12, justifyContent: 'center', alignSelf: 'flex-start' },
});
