# Database migrations

These Flyway scripts define the schema used by the Spring API. Do not edit a migration after it has succeeded in a shared database; add a new numbered migration for schema changes. A failed migration may be corrected before it is retried.

On TiDB, do not add a column and reference it in an index in the same `ALTER TABLE` statement. TiDB validates all changes against the table's schema before the statement runs, so add the column in one statement and create the index in a later statement.

| Migration | Responsibility |
| --- | --- |
| `V1__create_auth_tables.sql` | Creates the initial user, session, and OTP tables. |
| `V2__create_auth_tables_for_existing_schema.sql` | Creates the authentication tables when an earlier schema already exists. |
| `V3__create_financial_transactions.sql` | Adds user-owned income and expense transactions. |
| `V4__create_accounts_and_monthly_budgets.sql` | Adds finance accounts and budget records. |
| `V5__add_password_authentication.sql` | Adds password authentication fields to user accounts. |
| `V6__add_profile_details_and_budget_periods.sql` | Adds profile details and weekly/two-month budget period fields. |
