-- Phase 10: central application settings
--
-- Why this exists:
--   The administrator's settings screen wrote to `localStorage`, so every setting it
--   offered — transfer rules, transaction retention — applied to that one browser.
--   A second administrator, or the same one on another device, saw the defaults, and
--   the staff who are supposed to follow those rules never received them at all.
--
--   Currency was worse: it was a build-time environment variable, so changing it meant
--   a rebuild and redeploy of the whole application.
--
-- This migration adds a key/value table that the admin screen writes and the whole
-- application reads. It is additive and safe to re-run; the client degrades to its
-- previous per-browser behaviour (and says so) until it is applied.
--
-- NOTE: this project already has an `app_settings` table from an earlier attempt, with
-- `key`, `value` and `updated_at` and a single `transfer_settings` row. It was never
-- wired to any screen — the admin UI read and wrote localStorage instead — which is why
-- settings never reached anyone. The statements below therefore *upgrade* that table
-- rather than assuming it is absent: `if not exists` everywhere, so this is safe to run
-- against both the existing table and a fresh database.
--
-- Apply with the other migrations. Nothing here depends on phase7/phase8, and nothing
-- in phase7/phase8 depends on it.

begin;

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Bring an existing table up to the shape the client expects. `updated_by` is the one
-- column the earlier version lacked; the client tolerates its absence, but it is what
-- makes "who changed this?" answerable.
alter table public.app_settings add column if not exists value      jsonb;
alter table public.app_settings add column if not exists updated_at timestamptz not null default now();
alter table public.app_settings add column if not exists updated_by text;

comment on table public.app_settings is
  'Central application settings written by the administrator settings screen and read by every client.';

-- ---------------------------------------------------------------------------
-- 2. Keep updated_at honest without the client having to send it
-- ---------------------------------------------------------------------------
create or replace function public.touch_app_settings()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_touch_app_settings on public.app_settings;
create trigger trigger_touch_app_settings
before update on public.app_settings
for each row execute function public.touch_app_settings();

-- ---------------------------------------------------------------------------
-- 3. Access
-- ---------------------------------------------------------------------------
-- Matches the rest of the schema today: the app has no Supabase Auth yet, so the
-- policy is permissive and the real boundary is the API key. Tighten this together
-- with RLS when Auth lands (see phase9_branch_permissions.sql and
-- PRODUCTION_AUDIT.md, risk 1).
alter table public.app_settings enable row level security;

drop policy if exists "Public Access" on public.app_settings;
create policy "Public Access" on public.app_settings
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 4. Defaults
-- ---------------------------------------------------------------------------
-- Only seeded when absent, so re-running never overwrites what an administrator set.
insert into public.app_settings (key, value) values
  ('currency',        '"SAR"'::jsonb),
  -- `transfer_settings` (below) may already be present from the earlier table; the
  -- conflict clause leaves whatever is stored alone.
  -- 0 means "never delete automatically", which is what a browser with no stored
  -- preference did before this table existed. Seeding 12 would silently start deleting
  -- transaction history on the next administrator login.
  ('retention_months', '0'::jsonb),
  ('transfer_settings', '{
     "enableSignatureCapture": false,
     "enablePhotoEvidence": false,
     "enableAutoReject": false,
     "autoRejectDays": 7
   }'::jsonb)
on conflict (key) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
--   select key, value, updated_at, updated_by from public.app_settings order by key;
