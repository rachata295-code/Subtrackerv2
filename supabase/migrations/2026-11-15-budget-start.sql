-- Adds settings.budget_start_period: the pay period where the pot rollover chain starts (carryIn = 0).
-- Idempotent: safe to re-run, and a no-op on fresh installs that already got the column from schema.sql.
-- Existing rows get NULL, which keeps the old behaviour (chain starts at the first period with data).
alter table public.settings
  add column if not exists budget_start_period text
  check (budget_start_period ~ '^\d{4}-\d{2}$');
