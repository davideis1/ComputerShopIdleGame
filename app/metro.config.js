// Metro only watches the project folder by default; the shared simulation lives in ../core.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const core = path.resolve(__dirname, '../core');
config.watchFolders = [...(config.watchFolders || []), core];
config.resolver.extraNodeModules = { '@core': core };
module.exports = config;
