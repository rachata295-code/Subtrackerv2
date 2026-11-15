-- SubTracker v2 Phase 2 migration (SPEC §6)
-- Idempotent migration: safe to run multiple times in Supabase SQL Editor.

-- 1. Recurring incomes (fixed-amount scheduled income like mom's allowance on day 10 & 24)
create table if not exists public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  day_of_month integer not null check (day_of_month between 1 and 31),
  source_id uuid not null references public.payment_sources(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recurring_incomes_user
  on public.recurring_incomes (user_id);

-- 2. Expand transactions category constraint and add Phase 2 columns
alter table public.transactions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists recurring_income_id uuid references public.recurring_incomes(id) on delete set null,
  add column if not exists income_due_on date;

alter table public.bill_payments
  add column if not exists created_at timestamptz not null default now();

alter table public.transactions
  drop constraint if exists transactions_category_check;

alter table public.transactions
  add constraint transactions_category_check
  check (category in (
    'food', 'transport', 'shopping', 'entertainment', 'health', 'bills', 'other',
    'savings', 'unknown', 'allowance', 'parttime', 'freelance'
  ));

-- 3. Bank balance reference checkpoints (SPEC §5 C2 & §6)
create table if not exists public.balance_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id uuid not null references public.payment_sources(id) on delete cascade,
  checked_on date not null,
  actual numeric(12, 2) not null,
  expected_before numeric(12, 2),
  adjustment_tx_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_balance_checks_user
  on public.balance_checks (user_id);

create index if not exists idx_balance_checks_user_source_checked
  on public.balance_checks (user_id, source_id, checked_on desc, created_at desc);

-- 4. Pay-period plan items (must-pay & savings items per period, SPEC §5 C4 & §6)
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_key text not null check (period_key ~ '^\d{4}-\d{2}$'),
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  kind text not null check (kind in ('pay', 'save')),
  source_id uuid not null references public.payment_sources(id) on delete restrict,
  due_on date,
  category text not null check (category in (
    'food', 'transport', 'shopping', 'entertainment', 'health', 'bills', 'other',
    'savings', 'unknown', 'allowance', 'parttime', 'freelance'
  )),
  done_tx_id uuid references public.transactions(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_plan_items_user
  on public.plan_items (user_id);

create index if not exists idx_plan_items_user_period
  on public.plan_items (user_id, period_key, sort_order);

-- 5. Row Level Security for Phase 2 tables (idempotent drop + create)
alter table public.recurring_incomes enable row level security;
drop policy if exists "recurring_incomes_select_own" on public.recurring_incomes;
create policy "recurring_incomes_select_own" on public.recurring_incomes
  for select using (user_id = auth.uid());
drop policy if exists "recurring_incomes_insert_own" on public.recurring_incomes;
create policy "recurring_incomes_insert_own" on public.recurring_incomes
  for insert with check (user_id = auth.uid());
drop policy if exists "recurring_incomes_update_own" on public.recurring_incomes;
create policy "recurring_incomes_update_own" on public.recurring_incomes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "recurring_incomes_delete_own" on public.recurring_incomes;
create policy "recurring_incomes_delete_own" on public.recurring_incomes
  for delete using (user_id = auth.uid());

alter table public.balance_checks enable row level security;
drop policy if exists "balance_checks_select_own" on public.balance_checks;
create policy "balance_checks_select_own" on public.balance_checks
  for select using (user_id = auth.uid());
drop policy if exists "balance_checks_insert_own" on public.balance_checks;
create policy "balance_checks_insert_own" on public.balance_checks
  for insert with check (user_id = auth.uid());
drop policy if exists "balance_checks_update_own" on public.balance_checks;
create policy "balance_checks_update_own" on public.balance_checks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "balance_checks_delete_own" on public.balance_checks;
create policy "balance_checks_delete_own" on public.balance_checks
  for delete using (user_id = auth.uid());

alter table public.plan_items enable row level security;
drop policy if exists "plan_items_select_own" on public.plan_items;
create policy "plan_items_select_own" on public.plan_items
  for select using (user_id = auth.uid());
drop policy if exists "plan_items_insert_own" on public.plan_items;
create policy "plan_items_insert_own" on public.plan_items
  for insert with check (user_id = auth.uid());
drop policy if exists "plan_items_update_own" on public.plan_items;
create policy "plan_items_update_own" on public.plan_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "plan_items_delete_own" on public.plan_items;
create policy "plan_items_delete_own" on public.plan_items
  for delete using (user_id = auth.uid());
