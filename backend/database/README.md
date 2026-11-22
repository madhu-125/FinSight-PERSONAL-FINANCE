# Database migrations

These Flyway scripts define the schema used by the Spring API. Migration files are versioned and may already be applied to a local database, so do not edit an existing script; add a new numbered migration for schema changes.

| Migration | Responsibility |
| --- | --- |
| `V1__create_auth_tables.sql` | Creates the initial user, session, and OTP tables. |
| `V2__create_auth_tables_for_existing_schema.sql` | Creates the authentication tables when an earlier schema already exists. |
| `V3__create_financial_transactions.sql` | Adds user-owned income and expense transactions. |
| `V4__create_accounts_and_monthly_budgets.sql` | Adds finance accounts and budget records. |
| `V5__add_password_authentication.sql` | Adds password authentication fields to user accounts. |
| `V6__add_profile_details_and_budget_periods.sql` | Adds profile details and weekly/two-month budget period fields. |
