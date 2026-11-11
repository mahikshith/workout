import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sheet } from './sheet';
import { c, dom, r } from './theme';
import { Row, Stepper, T } from './ui';

// Plate calculator (Strong, Hevy): which plates go on each side of the bar for a total weight. Round 13.
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

// Greedy fill per side. `left` is what can't be made with these plates (shown so nobody is misled).
export function platesFor(total: number, bar = 20, plates = PLATES_KG): { side: number[]; left: number } {
  let per = Math.max(0, (total - bar) / 2);
  const side: number[] = [];
  for (const p of plates) while (per + 1e-9 >= p) { side.push(p); per = Math.round((per - p) * 100) / 100; }
  return { side, left: Math.round(per * 2 * 100) / 100 };
}

const COLORS: Record<string, string> = { '25': '#D64545', '20': '#2F6FDB', '15': '#E0B021', '10': '#2E9E5B', '5': '#ECECEC', '2.5': '#555A63', '1.25': '#9AA0A8' };

export function PlateSheet({ open, onClose, kg }: { open: boolean; onClose: () => void; kg: number }) {
  const [bar, setBar] = useState(20);
  const [total, setTotal] = useState(kg);
  useEffect(() => { if (open) setTotal(kg); }, [open, kg]);
  const { side, left } = platesFor(total, bar);
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <T v="h2">Plates for {total} kg</T>
        {total < bar ? (
          <T v="body" color={c.soft}>That's less than the bar ({bar} kg). Use a lighter bar or dumbbells.</T>
        ) : (
          <>
            <T v="small">Each side of the bar, from the inside out:</T>
            <Row gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <View style={[s.bar]} />
              {side.length ? side.map((p, i) => (
                <View key={i} style={[s.plate, { height: 40 + p * 2, backgroundColor: COLORS[String(p)] ?? c.card2 }]}>
                  <T v="small" color={p === 5 ? '#14161A' : '#FFFFFF'} style={{ fontSize: 12 }}>{p}</T>
                </View>
              )) : <T v="body" color={c.soft}>Just the bar</T>}
            </Row>
            {side.length > 0 && <T v="body">{side.join(' + ')} kg on each side</T>}
            {left > 0 && <T v="small" color={dom.kcal}>{left} kg can't be made with standard plates. Round to the nearest you can load.</T>}
          </>
        )}
        <Row gap={12} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="body">Total</T>
          <Stepper value={total} step={2.5} min={0} onChange={setTotal} suffix=" kg" />
        </Row>
        <Row gap={12} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="body">Bar</T>
          <Stepper value={bar} step={5} min={5} onChange={setBar} suffix=" kg" />
        </Row>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  bar: { width: 28, height: 10, borderRadius: 3, backgroundColor: c.dim },
  plate: { width: 26, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
});
