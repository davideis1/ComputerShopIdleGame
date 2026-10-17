-- Optional email address per account (used only for password resets) and the password-reset tokens.
-- Safe to re-run. Applied automatically by: php tools/install.php
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254) NULL AFTER username;
-- NULLs are allowed many times; a real address can belong to one account only.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email);

-- One row per reset email. Only a SHA-256 of the token is stored, like api_tokens.
CREATE TABLE IF NOT EXISTS password_resets (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,   -- unix seconds
  expires_at BIGINT UNSIGNED NOT NULL,   -- unix seconds
  used_at    BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resets_hash (token_hash),
  KEY idx_resets_user (user_id, created_at),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
