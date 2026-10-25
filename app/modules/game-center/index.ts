import { NativeModule, requireOptionalNativeModule } from 'expo';

export type GcPlayer = { authenticated: boolean; name?: string; error?: string };
/** Signed identity for api/auth_gamecenter.php, or { error }. */
export type GcProof = { playerId: string; bundleId: string; publicKeyUrl: string; signature: string; salt: string; timestamp: string; name: string } | { error: string };
type Events = { onAuthChange: (p: GcPlayer) => void };

declare class GameCenterNative extends NativeModule<Events> {
  isAuthenticated(): boolean;
  authenticate(): Promise<GcPlayer>;
  report(progress: Record<string, number>): Promise<void>;
  showAchievements(): Promise<boolean>;
  identityProof(): Promise<GcProof>;
}

/** The native module, or null where there is no Game Center (Android, Expo Go, web). */
export default requireOptionalNativeModule<GameCenterNative>('MBGameCenter');
