-- Sign in with Game Center (iOS app): an account can be linked to one Game Center player (Apple's teamPlayerID).
-- Accounts created through Game Center have no password until the player sets one (has_password = 0).
-- Safe to re-run. Applied automatically by: php tools/install.php
ALTER TABLE users ADD COLUMN IF NOT EXISTS gc_player_id VARCHAR(128) NULL AFTER email;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_gc ON users (gc_player_id);

-- Signatures already used (replay protection). Only a SHA-256 is kept; rows older than an hour are swept.
CREATE TABLE IF NOT EXISTS gc_proofs (
  sig_hash   CHAR(64)        NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,   -- unix seconds
  PRIMARY KEY (sig_hash),
  KEY idx_gc_proofs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
