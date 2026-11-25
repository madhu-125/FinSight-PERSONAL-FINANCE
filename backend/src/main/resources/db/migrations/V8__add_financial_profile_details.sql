ALTER TABLE finsight_users
    ADD COLUMN profile_monthly_income DECIMAL(19, 2) NULL,
    ADD COLUMN profile_occupation VARCHAR(100) NULL,
    ADD COLUMN profile_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN profile_savings_goals VARCHAR(500) NULL;
