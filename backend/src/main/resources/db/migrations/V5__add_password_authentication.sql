ALTER TABLE finsight_users
    ADD COLUMN password_hash VARCHAR(100),
    ADD COLUMN failed_password_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN password_locked_until TIMESTAMP NULL;
