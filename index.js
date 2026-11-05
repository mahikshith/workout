// App entry (package.json "main"). Same as expo-router/entry, with one step first: pick the colour theme.
//
// Screens build their StyleSheets when their module first runs, so the palette in src/theme.ts must be final before
// any screen module loads. This file registers a tiny root at once, reads the saved theme (synchronously from
// localStorage on the web, from AsyncStorage on a phone), fills the palette, and only then requires expo-router's
// app (which loads the screens) and renders it. The native splash screen stays up meanwhile.
//
// `@expo/metro-runtime` must be the first import so Fast Refresh works on the web.
import '@expo/metro-runtime';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { createElement, useEffect, useState } from 'react';
import { bootAsync, bootSync } from './src/look';

const loadApp = () => require('expo-router/build/qualified-entry').App;

function Boot() {
  const [App, setApp] = useState(() => (bootSync() ? loadApp() : null));
  useEffect(() => {
    if (!App) bootAsync().then(() => setApp(() => loadApp()));
  }, []);
  return App ? createElement(App) : null;
}

renderRootComponent(Boot);
