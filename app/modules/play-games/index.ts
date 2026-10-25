import { requireOptionalNativeModule } from 'expo';

export type PgPlayer = { authenticated: boolean; name?: string; error?: string };

declare class PlayGamesNative {
  authenticate(signInFirst: boolean): Promise<PgPlayer>;
  report(percent: Record<string, number>): Promise<boolean>;
  showAchievements(): Promise<boolean>;
  serverAuthCode(webClientId: string): Promise<{ code?: string; error?: string }>;
}

/** The native module, or null where there is no Play Games (iOS, Expo Go, web). */
export default requireOptionalNativeModule<PlayGamesNative>('MBPlayGames');
