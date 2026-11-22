ALTER TABLE finsight_users
    ADD COLUMN profile_age INT NULL,
    ADD COLUMN profile_gender VARCHAR(40) NULL,
    ADD COLUMN profile_mobile VARCHAR(30) NULL,
    ADD COLUMN profile_address VARCHAR(500) NULL;

ALTER TABLE monthly_budgets
    ADD COLUMN period_type VARCHAR(12) NOT NULL DEFAULT 'MONTHLY',
    DROP INDEX uq_monthly_budgets_user_category_period,
    ADD UNIQUE INDEX uq_monthly_budgets_user_category_period_type
        (user_id, category, period_type, period_start);
