-- Adds Franchise Token summary columns and the last_tab conflict helper to databases created before tokens existed.
-- Safe to re-run (MariaDB 10.0.2+). Applied automatically by: php tools/install.php
ALTER TABLE saves
  ADD COLUMN IF NOT EXISTS tokens        DOUBLE       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_earned DOUBLE       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prestiges     INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_tab      VARCHAR(32)  NOT NULL DEFAULT '';
