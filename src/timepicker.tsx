import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { c, r } from './theme';
import { haptic, T } from './ui';

const ITEM = 44;
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const HALF = ['AM', 'PM'];

// Alarm-style time picker: three snapping wheels (hour, minute, AM/PM) with the chosen row in a highlighted band.
// Works in 24-hour values: hour 0-23, minute 0-59.
export function TimePicker({ hour, minute, onChange }: { hour: number; minute: number; onChange: (hour: number, minute: number) => void }) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12, pm = hour >= 12;
  const set = (h: number, m: number, p: boolean) => onChange((h % 12) + (p ? 12 : 0), m);
  return (
    <View style={s.wrap}>
      <View pointerEvents="none" style={[s.band, { borderColor: c.accent }]} />
      <Wheel values={HOURS} index={h12 - 1} onPick={(i) => set(i + 1, minute, pm)} />
      <T v="h1" style={{ marginHorizontal: 2 }}>:</T>
      <Wheel values={MINUTES} index={minute} onPick={(i) => set(h12, i, pm)} />
      <Wheel values={HALF} index={pm ? 1 : 0} onPick={(i) => set(h12, minute, i === 1)} narrow />
    </View>
  );
}

function Wheel({ values, index, onPick, narrow }: { values: string[]; index: number; onPick: (i: number) => void; narrow?: boolean }) {
  const ref = useRef<ScrollView>(null);
  const at = useRef(index);
  // Follow outside changes (quick-pick chips) without fighting the user's own scroll.
  useEffect(() => {
    if (at.current !== index) { at.current = index; ref.current?.scrollTo({ y: index * ITEM, animated: true }); }
  }, [index]);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(values.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (i !== at.current) { at.current = i; haptic(); onPick(i); }
  };
  return (
    <ScrollView ref={ref} style={{ height: ITEM * 5, width: narrow ? 64 : 76 }} contentContainerStyle={{ paddingVertical: ITEM * 2 }}
      showsVerticalScrollIndicator={false} snapToInterval={ITEM} decelerationRate="fast" nestedScrollEnabled
      contentOffset={{ x: 0, y: index * ITEM }} onLayout={() => ref.current?.scrollTo({ y: index * ITEM, animated: false })}
      onMomentumScrollEnd={settle} onScrollEndDrag={(e) => { if (!e.nativeEvent.velocity?.y) settle(e); }}>
      {values.map((v, i) => (
        <View key={v} style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
          <T v={narrow ? 'h3' : 'h1'} color={i === index ? c.text : c.dim}>{v}</T>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: ITEM * 5 },
  band: { position: 'absolute', left: 0, right: 0, top: ITEM * 2, height: ITEM, borderRadius: r.md, borderWidth: 1, backgroundColor: c.card2 },
});
