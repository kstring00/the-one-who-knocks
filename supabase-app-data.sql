-- ============================================================
-- The Faithfulness System — app_data sync upgrade
-- Run in the Supabase SQL editor. Both scripts are idempotent.
-- The old `entries` table is NOT touched — it remains as a backup.
-- ============================================================

-- ── SCRIPT 1: table, updated_at trigger, row level security ──

create table if not exists public.app_data (
  user_id uuid references auth.users not null,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- The app never sends updated_at; newest-wins merge depends on the DB
-- bumping it on every write. This trigger auto-bumps on UPDATE, but
-- respects an explicitly provided value (so the migration below can
-- preserve original timestamps).
create or replace function public.app_data_touch()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists app_data_touch on public.app_data;
create trigger app_data_touch
  before update on public.app_data
  for each row execute function public.app_data_touch();

alter table public.app_data enable row level security;

drop policy if exists "app_data select own" on public.app_data;
create policy "app_data select own" on public.app_data
  for select using (auth.uid() = user_id);

drop policy if exists "app_data insert own" on public.app_data;
create policy "app_data insert own" on public.app_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "app_data update own" on public.app_data;
create policy "app_data update own" on public.app_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "app_data delete own" on public.app_data;
create policy "app_data delete own" on public.app_data
  for delete using (auth.uid() = user_id);

-- ── SCRIPT 2: copy entries → app_data (idempotent, newest wins) ──
-- Safe to run repeatedly: inserts missing rows; on re-run it only
-- updates a row if the entries copy is strictly newer than what
-- app_data already holds, so it can never clobber fresher app data.
-- entries itself is read-only here.

insert into public.app_data (user_id, key, data, updated_at)
select e.user_id, e.date, e.data, e.updated_at
from public.entries e
where e.data is not null
on conflict (user_id, key) do update
  set data = excluded.data,
      updated_at = excluded.updated_at
  where public.app_data.updated_at < excluded.updated_at;

-- Optional sanity check after running:
--   select (select count(*) from public.entries) as entries_rows,
--          (select count(*) from public.app_data) as app_data_rows;
