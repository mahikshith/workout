const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// zustand's ESM build uses import.meta, which breaks the classic-script web bundle; resolve the CJS build instead.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

// the live 3D viewer is one self-contained page, shipped as an asset (see src/live3d.tsx)
config.resolver.assetExts.push('html');

module.exports = config;
