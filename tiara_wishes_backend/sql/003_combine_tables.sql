-- Combine tables that stored the same kind of row.
-- Applied only when the original separate tables are still present.
-- Fresh installs already create the combined schema in 001_schema.sql.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('refresh', 'password_reset') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  used_at DATETIME NULL,
  replaced_by_id BIGINT UNSIGNED NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_token_hash (token_hash),
  KEY idx_auth_tokens_user (user_id, purpose),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_auth_tokens_replaced FOREIGN KEY (replaced_by_id) REFERENCES auth_tokens (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO auth_tokens (
  id, user_id, purpose, token_hash, expires_at, revoked_at, replaced_by_id,
  ip_address, user_agent, created_at
)
SELECT
  id, user_id, 'refresh', token_hash, expires_at, revoked_at, replaced_by_id,
  ip_address, user_agent, created_at
FROM refresh_tokens;

INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at, used_at, created_at)
SELECT user_id, 'password_reset', token_hash, expires_at, used_at, created_at
FROM password_reset_tokens;

DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS refresh_tokens;

ALTER TABLE deliveries
  ADD COLUMN events_json JSON NULL;

UPDATE deliveries d
SET events_json = (
  SELECT JSON_ARRAYAGG(JSON_OBJECT(
    'id', e.id,
    'status', e.status,
    'note', e.note,
    'created_by', e.created_by,
    'created_at', DATE_FORMAT(e.created_at, '%%Y-%%m-%%dT%%H:%%i:%%sZ')
  ))
  FROM delivery_events e
  WHERE e.delivery_id = d.id
);

UPDATE deliveries SET events_json = JSON_ARRAY() WHERE events_json IS NULL;

ALTER TABLE deliveries
  MODIFY events_json JSON NOT NULL DEFAULT (JSON_ARRAY());

DROP TABLE IF EXISTS delivery_events;

ALTER TABLE orders
  ADD UNIQUE KEY uq_orders_user_promo (user_id, promotion_id);

DROP TABLE IF EXISTS promotion_usages;

ALTER TABLE site_content
  ADD COLUMN entry_type ENUM('content', 'setting') NOT NULL DEFAULT 'content' AFTER slug;

INSERT IGNORE INTO site_content (slug, entry_type, title, body, sort_order, is_active)
SELECT setting_key, 'setting', setting_key, IFNULL(setting_value, ''), 0, 1
FROM site_settings;

DROP TABLE IF EXISTS site_settings;

SET FOREIGN_KEY_CHECKS = 1;
