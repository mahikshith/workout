import { Anton_400Regular } from '@expo-google-fonts/anton';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useHealthSync } from '../src/health';
import { DockedMiniBar, registerRestDay } from '../src/kit';
import { useNudgeSync } from '../src/notify';
import { isRestDay, RestDaySheet } from '../src/restday';
import { useStore } from '../src/store';
import { c, setAccent } from '../src/theme';

SplashScreen.preventAutoHideAsync();

// Holds the rest-day sheet for the whole app, so every Start (centre button, Today, Train) opens the same one.
function RestDayHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => registerRestDay(() => { if (!isRestDay()) return false; setOpen(true); return true; }), []);
  return <RestDaySheet open={open} onClose={() => setOpen(false)} />;
}

export default function Root() {
  const [fonts] = useFonts({ Anton_400Regular, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);
  const ready = fonts && hydrated;
  useNudgeSync(); // keeps every reminder, hydration and motivation nudge in step with the store
  useHealthSync(); // Health Connect sync on launch/foreground, strap reconnect, finished workouts written back
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);

  const accent = useStore((s) => s.profile.accent ?? 'lime');
  setAccent(accent); // before children render; the key below remounts them so every inline colour updates

  if (!ready) return null;
  return (
    <GestureHandlerRootView key={accent} style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      {/* Pushed screens are places: slide in from the right, swipe back from the edge (iOS; Android uses Back and its
          predictive back gesture). The workout slides up and swipes down to minimise (it keeps running in the mini
          bar). Setup and Summary fade; Summary is the end of a workout: no swipe back. */}
      <Stack screenOptions={{
        headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right', animationDuration: 300,
        gestureEnabled: true, fullScreenGestureEnabled: true, animationMatchesGesture: true,
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="session" options={{ animation: 'slide_from_bottom', gestureEnabled: true, gestureDirection: 'vertical', fullScreenGestureEnabled: false }} />
        <Stack.Screen name="summary" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="+not-found" options={{ animation: 'fade' }} />
      </Stack>
      {/* One workout mini bar for the whole app, above every screen except the workout, its summary and setup. */}
      <DockedMiniBar />
      <RestDayHost />
    </GestureHandlerRootView>
  );
}
