create table if not exists public.store_achievement_resets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  achievement_key text not null,
  reset_at timestamptz not null default now(),
  reset_by text not null default 'admin' check (reset_by in ('admin')),
  progress_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (store_id, achievement_key)
);

create index if not exists store_achievement_resets_store_idx
  on public.store_achievement_resets(store_id, reset_at desc);

alter table public.store_achievement_resets enable row level security;
revoke all on public.store_achievement_resets from public, anon, authenticated;
grant select, insert, update, delete on public.store_achievement_resets to service_role;
