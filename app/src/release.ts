// The app's release info: the same version number and change log the website shows (app/src/release.json is written
// from ../version.json and ../changelog.json by tools/sync-release.js; CI checks it).
import data from './release.json';

export type ReleaseEntry = { build: number; date?: string; title: string; changes: string[] };
const v = data.version;
export const VERSION = v.major + '.' + v.minor + '.' + v.build;
export const BUILD = v.build as number;
/** Numbered entries, newest first ("next" entries are not released yet). */
export const RELEASES: ReleaseEntry[] = (data.changelog as any[]).filter((e) => typeof e.build === 'number');

/** What a player has not seen: entries newer than their last seen build, at most `max`; an existing player's first run on this
    feature gets only the latest one (`lastSeen` null), a brand-new player none. */
export function unseen(lastSeen: number | null, existingPlayer: boolean, max = 5): ReleaseEntry[] {
  if (lastSeen == null) return existingPlayer ? RELEASES.slice(0, 1) : [];
  return RELEASES.filter((e) => e.build > lastSeen).slice(0, max);
}
