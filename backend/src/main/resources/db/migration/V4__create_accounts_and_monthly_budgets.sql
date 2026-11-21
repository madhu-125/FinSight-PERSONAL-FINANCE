CREATE TABLE finance_accounts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    type VARCHAR(12) NOT NULL,
    balance DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_finance_accounts_user_name (user_id, name),
    CONSTRAINT fk_finance_accounts_user FOREIGN KEY (user_id) REFERENCES finsight_users (id)
);

CREATE TABLE monthly_budgets (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    category VARCHAR(60) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    period_start DATE NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    UNIQUE INDEX uq_monthly_budgets_user_category_period (user_id, category, period_start),
    INDEX idx_monthly_budgets_user_period (user_id, period_start),
    CONSTRAINT fk_monthly_budgets_user FOREIGN KEY (user_id) REFERENCES finsight_users (id)
);
