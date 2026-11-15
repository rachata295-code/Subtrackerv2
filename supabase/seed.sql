-- SubTracker v2 initial user seed (SPEC §1 & §3)
-- Idempotent RPC invoked after first login so each authenticated user starts with
-- default settings, 3 payment sources, and 2 budget pots under their own RLS scope.

create or replace function public.seed_defaults()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bank_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.settings (user_id, salary, pay_day)
  values (v_user_id, 10200.00, 10)
  on conflict (user_id) do nothing;

  if not exists (
    select 1 from public.payment_sources where user_id = v_user_id
  ) then
    insert into public.payment_sources (
      user_id, name, kind, hue, archived,
      statement_close_day, due_day, due_month_offset, pay_from_source_id
    )
    values (
      v_user_id, 'บัญชี', 'bank', 'stone', false,
      null, null, null, null
    )
    returning id into v_bank_id;

    insert into public.payment_sources (
      user_id, name, kind, hue, archived,
      statement_close_day, due_day, due_month_offset, pay_from_source_id
    )
    values
      (v_user_id, 'บัตรเครดิต', 'credit_card', 'sky', false, 10, 24, 0, v_bank_id),
      (v_user_id, 'SPayLater', 'paylater', 'apricot', false, null, 10, 1, v_bank_id);
  end if;

  if not exists (
    select 1 from public.pots where user_id = v_user_id
  ) then
    insert into public.pots (user_id, name, per_period, rollover, hue)
    values
      (v_user_id, 'ใช้ตามใจ', 3000.00, true, 'teal'),
      (v_user_id, 'ใช้จ่ายจำเป็น', 7200.00, false, 'stone');
  end if;
end;
$$;

revoke all on function public.seed_defaults() from public;
grant execute on function public.seed_defaults() to authenticated;
