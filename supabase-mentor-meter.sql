-- ============================================================
-- With Little — Stewardship Mentor meter (server-authoritative)
-- Run in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- The meter must NOT live in app_data: app_data is writable by the
-- user under RLS (the server previously used the anon key and acted
-- AS the user), so a user could set their own balance from the
-- browser console. This table is writable ONLY by the service role,
-- and the daily reset is computed in UTC on the server — never from a
-- client-supplied timezone.
-- ============================================================

create table if not exists public.mentor_meter (
  user_id      uuid primary key references auth.users on delete cascade,
  balance      integer     not null default 20,
  reset_date   date        not null default (now() at time zone 'utc')::date,
  window_start timestamptz,
  window_count integer     not null default 0,
  updated_at   timestamptz not null default now()
);

-- ── RLS: user may read their own row; only the service role writes ──
alter table public.mentor_meter enable row level security;

drop policy if exists "mentor_meter select own" on public.mentor_meter;
create policy "mentor_meter select own" on public.mentor_meter
  for select using (auth.uid() = user_id);
-- No insert / update / delete policies → denied for anon & authenticated.
-- The service role bypasses RLS, so the serverless function can write.

-- ── Atomic reserve: rate-limit check + balance decrement in one statement ──
-- Returns exactly one row. `allowed` false with balance 0 = out of messages;
-- `rate_limited` true = too many in the last minute (balance untouched).
-- reset_date/window are recomputed from UTC now() — client cannot influence.
create or replace function public.mentor_reserve(
  p_user_id   uuid,
  p_allowance integer,
  p_rate_limit integer
)
returns table(balance integer, allowed boolean, rate_limited boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_bal   integer;
  v_reset date;
  v_wstart timestamptz;
  v_wcount integer;
begin
  insert into public.mentor_meter as m (user_id, balance, reset_date, window_start, window_count)
    values (p_user_id, p_allowance, v_today, now(), 0)
    on conflict (user_id) do nothing;

  select m.balance, m.reset_date, m.window_start, m.window_count
    into v_bal, v_reset, v_wstart, v_wcount
    from public.mentor_meter m
    where m.user_id = p_user_id
    for update;

  -- Daily reset (fixed UTC midnight)
  if v_reset is distinct from v_today then
    v_bal := p_allowance;
    v_reset := v_today;
    v_wstart := null;
    v_wcount := 0;
  end if;

  -- Rate-limit window (rolling 60s)
  if v_wstart is null or now() - v_wstart > interval '60 seconds' then
    v_wstart := now();
    v_wcount := 0;
  end if;

  if v_wcount >= p_rate_limit then
    update public.mentor_meter m
      set reset_date = v_reset, window_start = v_wstart,
          window_count = v_wcount, updated_at = now()
      where m.user_id = p_user_id;
    return query select v_bal, false, true;
    return;
  end if;

  if v_bal <= 0 then
    update public.mentor_meter m
      set balance = 0, reset_date = v_reset, window_start = v_wstart,
          window_count = v_wcount, updated_at = now()
      where m.user_id = p_user_id;
    return query select 0, false, false;
    return;
  end if;

  -- Reserve one message before Claude is ever called
  v_bal := v_bal - 1;
  v_wcount := v_wcount + 1;
  update public.mentor_meter m
    set balance = v_bal, reset_date = v_reset, window_start = v_wstart,
        window_count = v_wcount, updated_at = now()
    where m.user_id = p_user_id;

  return query select v_bal, true, false;
end;
$$;

-- ── Refund: only called when the Anthropic call fails before any tokens ──
create or replace function public.mentor_refund(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mentor_meter m
    set balance = m.balance + 1,
        window_count = greatest(0, m.window_count - 1),
        updated_at = now()
    where m.user_id = p_user_id;
end;
$$;

-- Lock the RPCs down to the service role (the serverless function).
revoke all on function public.mentor_reserve(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.mentor_refund(uuid) from public, anon, authenticated;
grant execute on function public.mentor_reserve(uuid, integer, integer) to service_role;
grant execute on function public.mentor_refund(uuid) to service_role;
