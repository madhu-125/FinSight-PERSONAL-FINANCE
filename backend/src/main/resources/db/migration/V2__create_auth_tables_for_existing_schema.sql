CREATE TABLE IF NOT EXISTS finsight_users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    channel VARCHAR(8) NOT NULL,
    destination VARCHAR(254) NOT NULL,
    display_name VARCHAR(120),
    created_at TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_finsight_user_identity UNIQUE (channel, destination)
);

CREATE TABLE IF NOT EXISTS otp_challenges (
    challenge_key VARCHAR(264) NOT NULL,
    channel VARCHAR(8) NOT NULL,
    destination VARCHAR(254) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    resend_at TIMESTAMP NOT NULL,
    attempts INT NOT NULL,
    PRIMARY KEY (challenge_key),
    INDEX idx_otp_challenges_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (token_hash),
    INDEX idx_auth_sessions_expires_at (expires_at),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES finsight_users (id)
);
