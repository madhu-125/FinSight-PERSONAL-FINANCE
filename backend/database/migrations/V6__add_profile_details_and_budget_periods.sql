ALTER TABLE finsight_users
    ADD COLUMN IF NOT EXISTS (
        profile_age INT NULL,
        profile_gender VARCHAR(40) NULL,
        profile_mobile VARCHAR(30) NULL,
        profile_address VARCHAR(500) NULL
    );

ALTER TABLE monthly_budgets
    ADD COLUMN IF NOT EXISTS period_type VARCHAR(12) NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE monthly_budgets
    DROP INDEX uq_monthly_budgets_user_category_period,
    ADD UNIQUE INDEX uq_monthly_budgets_user_category_period_type
        (user_id, category, period_type, period_start);
