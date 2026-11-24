CREATE TABLE financial_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    description VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(8) NOT NULL,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_financial_transactions_user_date (user_id, transaction_date),
    CONSTRAINT fk_financial_transactions_user FOREIGN KEY (user_id) REFERENCES finsight_users (id)
);
