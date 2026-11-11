import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { c } from './theme';
import { T, Tap } from './ui';

// Round 13: the safety disclaimer. One full page (app/safety.tsx) and one short line with a link, used where a
// person commits to something physical (setup's plan step, joining a challenge, supplements, You).

export const SAFETY_SHORT = 'Gym Buddy gives general fitness ideas, not medical advice. You choose what to do and train at your own risk.';

export const SAFETY_POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'medkit', title: 'Not medical advice', body: 'Plans, challenges, food targets and supplement notes are general suggestions for healthy adults. They are not a diagnosis or treatment, and they are not a substitute for a doctor, physiotherapist or dietitian.' },
  { icon: 'person', title: 'Check with a professional first', body: 'Talk to a doctor before you start if you are new to exercise, pregnant or recently gave birth, over 65, have a heart, blood pressure, joint or other condition, take medication, or have had an injury.' },
  { icon: 'hand-left', title: 'Stop if something feels wrong', body: 'Stop straight away and get help if you feel chest pain, dizziness, faintness, unusual shortness of breath or sharp pain. Soreness the next day is normal; pain during a move is not.' },
  { icon: 'barbell', title: 'Your choices, your pace', body: 'You decide what to train, how heavy to lift and whether to take, pause or leave a challenge. Use good form, a spotter for heavy lifts, and equipment you know how to use. Gym Buddy and its makers are not responsible for injury, illness or loss from using the app.' },
  { icon: 'nutrition', title: 'Food and supplements', body: 'Calorie, protein and water numbers are estimates. Supplements (protein, creatine, caffeine, pre-workout) are your own choice: read the label, keep caffeine moderate, and ask a professional if you are under 18, pregnant or have a health condition.' },
  { icon: 'watch', title: 'Watch data is approximate', body: 'Heart rate, calories, sleep and readiness come from your watch and its app. They can be wrong and are not for medical use.' },
];

// A short line with "Safety and disclaimer ›". Put it under a commit button (setup plan, Join challenge, supplements).
export function SafetyNote({ text = SAFETY_SHORT, center }: { text?: string; center?: boolean }) {
  return (
    <Tap onPress={() => router.push('/safety')} scale={0.99} feedback="none" accessibilityRole="link" accessibilityLabel="Safety and disclaimer"
      style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 8, justifyContent: center ? 'center' : 'flex-start' }}>
      <Ionicons name="shield-checkmark-outline" size={16} color={c.muted} style={{ marginTop: 2 }} />
      <View style={{ flexShrink: 1 }}>
        <T v="small" color={c.muted} style={{ fontSize: 13, lineHeight: 18, textAlign: center ? 'center' : 'left' }}>
          {text} <T v="small" color={c.accent} style={{ fontSize: 13, lineHeight: 18 }}>Safety and disclaimer ›</T>
        </T>
      </View>
    </Tap>
  );
}
