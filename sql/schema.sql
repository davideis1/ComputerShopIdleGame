-- Mega Byte Computers: MariaDB 10.3+ / MySQL 5.7+ schema.
-- Apply with:  php tools/install.php   (or import this file in phpMyAdmin)

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(20)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)          -- case-insensitive via collation
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One current save per player. The full game state is the JSON in `state`;
-- the other columns are denormalised summaries for stats / leaderboards.
CREATE TABLE IF NOT EXISTS saves (
  user_id         INT UNSIGNED NOT NULL,
  state           MEDIUMTEXT   NOT NULL,
  rev             INT UNSIGNED NOT NULL DEFAULT 1,   -- bumped on every save; used to detect two tabs/devices
  schema_version  SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  server_saved_at BIGINT UNSIGNED NOT NULL,          -- unix seconds; offline progress is measured from this
  shop_name       VARCHAR(30)  NOT NULL DEFAULT '',
  game_years      DOUBLE       NOT NULL DEFAULT 0,   -- in-game years elapsed since Jan 1993
  cash            DOUBLE       NOT NULL DEFAULT 0,
  total_sold      DOUBLE       NOT NULL DEFAULT 0,
  total_built     DOUBLE       NOT NULL DEFAULT 0,
  play_seconds    DOUBLE       NOT NULL DEFAULT 0,
  achievements    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  tokens          DOUBLE       NOT NULL DEFAULT 0,   -- unspent Franchise Tokens
  tokens_earned   DOUBLE       NOT NULL DEFAULT 0,
  prestiges       INT UNSIGNED NOT NULL DEFAULT 0,   -- franchises opened (resets)
  last_tab        VARCHAR(32)  NOT NULL DEFAULT '',  -- browser tab that wrote last; a reload of that tab is never a conflict
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_saves_cash (cash),
  CONSTRAINT fk_saves_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rolling safety snapshots (at most one per 10 minutes, newest 5 kept per player).
CREATE TABLE IF NOT EXISTS save_backups (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  state      MEDIUMTEXT   NOT NULL,
  rev        INT UNSIGNED NOT NULL,
  game_years DOUBLE       NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_backups_user (user_id, id),
  CONSTRAINT fk_backups_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id       INT UNSIGNED NOT NULL,
  theme         ENUM('auto','win95','xp','flat','rgb') NOT NULL DEFAULT 'auto',
  show_ticker   TINYINT(1) NOT NULL DEFAULT 1,
  show_walkers  TINYINT(1) NOT NULL DEFAULT 1,
  updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Failed logins only, for throttling brute-force attempts.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username     VARCHAR(20)  NOT NULL,
  ip           VARBINARY(16) NOT NULL,
  attempted_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_attempts_user (username, attempted_at),
  KEY idx_attempts_ip (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
