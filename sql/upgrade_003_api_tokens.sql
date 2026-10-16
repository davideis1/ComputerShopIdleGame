-- Adds the api_tokens table for the native app. Safe to re-run. Applied automatically by: php tools/install.php
-- Long-lived API tokens for the native app (the website keeps using cookie sessions).
-- Only a SHA-256 of the token is stored, so a database leak does not leak working logins.
CREATE TABLE IF NOT EXISTS api_tokens (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  token_hash   CHAR(64)     NOT NULL,
  label        VARCHAR(40)  NOT NULL DEFAULT '',     -- e.g. "iPhone", shown if we ever list devices
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at BIGINT UNSIGNED NOT NULL,             -- unix seconds
  expires_at   BIGINT UNSIGNED NOT NULL,             -- unix seconds; sliding, see TOKEN_LIFETIME
  PRIMARY KEY (id),
  UNIQUE KEY uq_tokens_hash (token_hash),
  KEY idx_tokens_user (user_id, id),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
