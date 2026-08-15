create table if not exists public.panel_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  message text not null check (char_length(message) between 1 and 500),
  kind text not null default 'news' check (kind in ('news', 'challenge', 'feature', 'important')),
  action_label text check (action_label is null or char_length(action_label) <= 40),
  action_url text check (action_url is null or char_length(action_url) <= 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint panel_announcements_valid_dates check (ends_at is null or ends_at > starts_at)
);

create index if not exists panel_announcements_active_dates_idx
  on public.panel_announcements (is_active, starts_at desc, ends_at);

alter table public.panel_announcements enable row level security;

revoke all on table public.panel_announcements from anon, authenticated;
grant all on table public.panel_announcements to service_role;
