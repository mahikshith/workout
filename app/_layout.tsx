import { Anton_400Regular } from '@expo-google-fonts/anton';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useHealthSync } from '../src/health';
import { DockedMiniBar, registerRestDay } from '../src/kit';
import { useNudgeSync } from '../src/notify';
import { isRestDay, RestDaySheet } from '../src/restday';
import { useStore } from '../src/store';
import { retheme, useLook } from '../src/look';
import { c, now } from '../src/theme';

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

  // The palette was chosen before any screen loaded (index.js, src/look.ts). When it changes in place (a new accent,
  // or light/dark on a release phone build), `v` bumps and the key below remounts everything so every colour updates.
  const v = useLook((s) => s.v);
  const path = usePathname();
  const where = useRef(path);
  where.current = path;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // If the remount started the stack again on Today, go back to the screen you were on.
    const to = where.current;
    if (to && to !== '/') setTimeout(() => { if (where.current !== to) router.push(to as Href); }, 120);
  }, [v]);
  // Theme "System": follow the phone switching between light and dark.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const p = useLook.getState();
      if (p.mode === 'system' && (colorScheme === 'light' || colorScheme === 'dark') && colorScheme !== now.scheme) retheme(p, colorScheme);
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;
  return (
    <GestureHandlerRootView key={v} style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
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
