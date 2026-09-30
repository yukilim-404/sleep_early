-- ============================================================
-- Sleep Early! — 002: one log per night + integrity checks
-- Run AFTER 001_initial_schema.sql (Supabase SQL Editor)
-- ============================================================

-- 1. Remove duplicate (user_id, date) rows, keeping the newest
delete from public.sleep_logs a
using public.sleep_logs b
where a.user_id = b.user_id
  and a.date = b.date
  and (a.created_at < b.created_at
       or (a.created_at = b.created_at and a.id < b.id));

-- 2. One log per user per night (enables upsert on user_id,date)
alter table public.sleep_logs
  add constraint sleep_logs_user_date_key unique (user_id, date);

-- 3. Only valid barrier tags
alter table public.sleep_logs
  add constraint sleep_logs_barrier_tag_check
  check (barrier_tag is null
         or barrier_tag in ('phone','gaming','work','overthinking','me_time'));

-- 4. Index for filtering real vs. demo rows
create index if not exists sleep_logs_user_seed_idx
  on public.sleep_logs (user_id, is_seed_data);
