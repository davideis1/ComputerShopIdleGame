import Constants from 'expo-constants';
import { VERSION } from './release';

/**
 * Where the PHP backend lives (no trailing slash). `EXPO_PUBLIC_API_BASE` overrides it for local testing:
 *   EXPO_PUBLIC_API_BASE=http://127.0.0.1:8125 npx expo start
 * The default comes from `extra.apiBase` in app.json.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string };
export const API_BASE = String(process.env.EXPO_PUBLIC_API_BASE || extra.apiBase || '').replace(/\/$/, '');

/** Public pages the app stores require; they live on the same site as the API. */
export const PRIVACY_URL = API_BASE + '/privacy.php';
export const SUPPORT_URL = API_BASE + '/support.php';

/** The same number the website shows ("1.1.24"), plus the native build number when there is one: "1.1.24 (3)". */
const build = Constants.nativeBuildVersion;
export const APP_VERSION = VERSION + (build ? ' (' + build + ')' : '');
