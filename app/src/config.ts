import Constants from 'expo-constants';

/**
 * Where the PHP backend lives (no trailing slash). `EXPO_PUBLIC_API_BASE` overrides it for local testing:
 *   EXPO_PUBLIC_API_BASE=http://127.0.0.1:8125 npx expo start
 * The default comes from `extra.apiBase` in app.json.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string };
export const API_BASE = String(process.env.EXPO_PUBLIC_API_BASE || extra.apiBase || '').replace(/\/$/, '');
