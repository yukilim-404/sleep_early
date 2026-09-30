-- ============================================================
-- Sleep Early! — Initial Schema Migration
-- Paste this into: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── 1. profiles ─────────────────────────────────────────────
create table if not exists public.profiles (
  id                 uuid        primary key references auth.users(id) on delete cascade,
  target_bedtime     time        not null default '23:00:00',
  wake_time          time        not null default '07:00:00',
  workdays           text[]      not null default array['mon','tue','wed','thu','fri'],
  timezone           text        not null default 'Asia/Singapore',
  baseline_barriers  text[]      not null default array[]::text[],
  created_at         timestamptz not null default now()
);

-- ── 2. sleep_logs ────────────────────────────────────────────
create table if not exists public.sleep_logs (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  date                    date        not null,
  bedtime                 time,
  fall_asleep_time        time,
  wake_time               time,
  barrier_tag             text,
  intervention_completed  boolean     not null default false,
  mood                    int         check (mood between 1 and 5),
  is_seed_data            boolean     not null default false,
  created_at              timestamptz not null default now()
);

-- ── 3. Row Level Security ─────────────────────────────────────
alter table public.profiles  enable row level security;
alter table public.sleep_logs enable row level security;

-- profiles: each user can only access their own row
create policy "profiles: select own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: insert own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: delete own"
  on public.profiles for delete
  using (id = auth.uid());

-- sleep_logs: each user can only access their own rows
create policy "sleep_logs: select own"
  on public.sleep_logs for select
  using (user_id = auth.uid());

create policy "sleep_logs: insert own"
  on public.sleep_logs for insert
  with check (user_id = auth.uid());

create policy "sleep_logs: update own"
  on public.sleep_logs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "sleep_logs: delete own"
  on public.sleep_logs for delete
  using (user_id = auth.uid());

-- ── 4. Useful index ───────────────────────────────────────────
create index if not exists sleep_logs_user_date_idx
  on public.sleep_logs (user_id, date desc);
