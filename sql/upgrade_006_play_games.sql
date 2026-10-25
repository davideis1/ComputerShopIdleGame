-- Sign in with Google Play Games (Android app): an account can be linked to one Play Games player
-- (the player id Google's Games API returns for the signed-in player). Accounts created this way have no password
-- until the player sets one (users.has_password = 0, see upgrade_005).
-- Safe to re-run. Applied automatically by: php tools/install.php
ALTER TABLE users ADD COLUMN IF NOT EXISTS pg_player_id VARCHAR(128) NULL AFTER gc_player_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_pg ON users (pg_player_id);
