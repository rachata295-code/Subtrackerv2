-- SubTracker v2 Phase 1 schema (SPEC §3)
-- Every table is scoped by user_id and protected by Row Level Security.

create extension if not exists pgcrypto;

-- 1. User settings (one row per user)
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  salary numeric(12, 2) not null check (salary >= 0),
  pay_day integer not null check (pay_day between 1 and 31),
  created_at timestamptz not null default now()
);

-- 2. Payment sources (bank accounts, credit cards, paylater)
create table if not exists public.payment_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bank', 'credit_card', 'paylater')),
  hue text not null check (hue in ('sky', 'apricot', 'teal', 'stone', 'lilac', 'rose')),
  archived boolean not null default false,
  statement_close_day integer check (statement_close_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  due_month_offset smallint check (due_month_offset in (0, 1)),
  pay_from_source_id uuid references public.payment_sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_sources_user
  on public.payment_sources (user_id);

-- 3. Budget pots
create table if not exists public.pots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  per_period numeric(12, 2) not null check (per_period >= 0),
  rollover boolean not null default false,
  hue text not null check (hue in ('sky', 'apricot', 'teal', 'stone', 'lilac', 'rose')),
  created_at timestamptz not null default now()
);

create index if not exists idx_pots_user
  on public.pots (user_id);

-- 4. Recurring subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  frequency text not null check (frequency in ('monthly', 'yearly')),
  billing_day integer not null check (billing_day between 1 and 31),
  billing_month integer check (billing_month between 1 and 12),
  source_id uuid not null references public.payment_sources(id) on delete restrict,
  pot_id uuid references public.pots(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_source
  on public.subscriptions (user_id, source_id);

-- 5. Fixed-term installments
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  per_installment numeric(12, 2) not null check (per_installment > 0),
  count integer not null check (count > 0),
  first_charge_date date not null,
  source_id uuid not null references public.payment_sources(id) on delete restrict,
  pot_id uuid references public.pots(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_installments_user_source
  on public.installments (user_id, source_id);

create index if not exists idx_installments_user_first_charge_date
  on public.installments (user_id, first_charge_date);

-- 6. Manual income / expense transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  direction text not null check (direction in ('out', 'in')),
  source_id uuid not null references public.payment_sources(id) on delete restrict,
  pot_id uuid references public.pots(id) on delete set null,
  category text not null check (category in ('food', 'transport', 'shopping', 'entertainment', 'health', 'bills', 'other')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc);

create index if not exists idx_transactions_user_source
  on public.transactions (user_id, source_id);

-- 7. Idempotent statement bill payments
create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id uuid not null references public.payment_sources(id) on delete restrict,
  statement_key text not null check (statement_key ~ '^\d{4}-\d{2}$'),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null,
  created_at timestamptz not null default now(),
  constraint bill_payments_user_source_statement_unique unique (user_id, source_id, statement_key)
);

create index if not exists idx_bill_payments_user_paid_on
  on public.bill_payments (user_id, paid_on desc);

create index if not exists idx_bill_payments_user_source
  on public.bill_payments (user_id, source_id);

-- Row Level Security: 4 policies per table scoped strictly to the authenticated owner.
alter table public.settings enable row level security;
create policy "settings_select_own" on public.settings
  for select using (user_id = auth.uid());
create policy "settings_insert_own" on public.settings
  for insert with check (user_id = auth.uid());
create policy "settings_update_own" on public.settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "settings_delete_own" on public.settings
  for delete using (user_id = auth.uid());

alter table public.payment_sources enable row level security;
create policy "payment_sources_select_own" on public.payment_sources
  for select using (user_id = auth.uid());
create policy "payment_sources_insert_own" on public.payment_sources
  for insert with check (user_id = auth.uid());
create policy "payment_sources_update_own" on public.payment_sources
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "payment_sources_delete_own" on public.payment_sources
  for delete using (user_id = auth.uid());

alter table public.pots enable row level security;
create policy "pots_select_own" on public.pots
  for select using (user_id = auth.uid());
create policy "pots_insert_own" on public.pots
  for insert with check (user_id = auth.uid());
create policy "pots_update_own" on public.pots
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pots_delete_own" on public.pots
  for delete using (user_id = auth.uid());

alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid());
create policy "subscriptions_insert_own" on public.subscriptions
  for insert with check (user_id = auth.uid());
create policy "subscriptions_update_own" on public.subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "subscriptions_delete_own" on public.subscriptions
  for delete using (user_id = auth.uid());

alter table public.installments enable row level security;
create policy "installments_select_own" on public.installments
  for select using (user_id = auth.uid());
create policy "installments_insert_own" on public.installments
  for insert with check (user_id = auth.uid());
create policy "installments_update_own" on public.installments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "installments_delete_own" on public.installments
  for delete using (user_id = auth.uid());

alter table public.transactions enable row level security;
create policy "transactions_select_own" on public.transactions
  for select using (user_id = auth.uid());
create policy "transactions_insert_own" on public.transactions
  for insert with check (user_id = auth.uid());
create policy "transactions_update_own" on public.transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions_delete_own" on public.transactions
  for delete using (user_id = auth.uid());

alter table public.bill_payments enable row level security;
create policy "bill_payments_select_own" on public.bill_payments
  for select using (user_id = auth.uid());
create policy "bill_payments_insert_own" on public.bill_payments
  for insert with check (user_id = auth.uid());
create policy "bill_payments_update_own" on public.bill_payments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bill_payments_delete_own" on public.bill_payments
  for delete using (user_id = auth.uid());
