import { Anton_400Regular } from '@expo-google-fonts/anton';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from '../src/store';
import { c } from '../src/theme';

SplashScreen.preventAutoHideAsync();

export default function Root() {
  const [fonts] = useFonts({ Anton_400Regular, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);
  const ready = fonts && hydrated;
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  const hasProfile = useStore((s) => !!s.profile);
  const seg = useSegments();

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      {!hasProfile && seg[0] !== 'onboarding' && <Redirect href="/onboarding" />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="summary" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="exercise/[id]" />
        <Stack.Screen name="library" />
        <Stack.Screen name="plan/[id]" />
      </Stack>
    </GestureHandlerRootView>
  );
}
