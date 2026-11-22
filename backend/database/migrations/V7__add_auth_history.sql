CREATE TABLE auth_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    event_type VARCHAR(16) NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_auth_history_user_time (user_id, occurred_at),
    CONSTRAINT fk_auth_history_user FOREIGN KEY (user_id) REFERENCES finsight_users (id)
);
