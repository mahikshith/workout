const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// zustand's ESM build uses import.meta, which breaks the classic-script web bundle; resolve the CJS build instead.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = config;
