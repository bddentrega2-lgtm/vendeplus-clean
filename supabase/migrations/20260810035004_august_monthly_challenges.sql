alter table public.orders
  add column if not exists first_responded_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists orders_store_monthly_response_idx
  on public.orders(store_id, created_at, first_responded_at)
  where status <> 'cancelled';

create or replace function public.track_order_milestone_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'received'
      and new.status in ('accepted', 'preparing', 'ready', 'delivering', 'completed')
      and new.first_responded_at is null then
      new.first_responded_at = now();
    end if;

    if new.status = 'completed' and new.completed_at is null then
      new.completed_at = now();
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.track_order_milestone_timestamps() from public, anon, authenticated;

drop trigger if exists orders_track_milestone_timestamps on public.orders;
create trigger orders_track_milestone_timestamps
before update on public.orders
for each row execute function public.track_order_milestone_timestamps();

create table if not exists public.monthly_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_key text not null unique,
  title text not null,
  description text not null,
  reward_label text not null,
  reward_type text not null check (reward_type in ('featured_product', 'fast_store_badge')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_challenges_valid_period check (ends_at > starts_at)
);

create index if not exists monthly_challenges_active_period_idx
  on public.monthly_challenges(is_active, starts_at, ends_at);

alter table public.monthly_challenges enable row level security;
revoke all on public.monthly_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.monthly_challenges to service_role;

create table if not exists public.store_promotion_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 95),
  activated_at timestamptz not null default now()
);

create index if not exists store_promotion_events_store_period_idx
  on public.store_promotion_events(store_id, activated_at desc);

alter table public.store_promotion_events enable row level security;
revoke all on public.store_promotion_events from public, anon, authenticated;
grant select, insert, update, delete on public.store_promotion_events to service_role;

create table if not exists public.store_monthly_challenge_rewards (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.monthly_challenges(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  source text not null default 'earned' check (source in ('earned', 'admin')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  progress_snapshot jsonb not null default '{}'::jsonb,
  earned_at timestamptz not null default now(),
  reward_starts_at timestamptz not null,
  reward_ends_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (challenge_id, store_id),
  constraint store_monthly_rewards_valid_period check (reward_ends_at > reward_starts_at)
);

create index if not exists store_monthly_rewards_marketplace_idx
  on public.store_monthly_challenge_rewards(status, reward_starts_at, reward_ends_at, challenge_id);
create index if not exists store_monthly_rewards_store_idx
  on public.store_monthly_challenge_rewards(store_id, earned_at desc);

alter table public.store_monthly_challenge_rewards enable row level security;
revoke all on public.store_monthly_challenge_rewards from public, anon, authenticated;
grant select, insert, update, delete on public.store_monthly_challenge_rewards to service_role;

insert into public.monthly_challenges (
  challenge_key,
  title,
  description,
  reward_label,
  reward_type,
  starts_at,
  ends_at,
  config
) values
  (
    'august_2026_discount_first_sale',
    'Tu producto puede ser protagonista',
    'Activa un descuento y completa la primera venta de ese producto durante agosto.',
    'Producto destacado durante 7 días en el Marketplace',
    'featured_product',
    '2026-08-10 00:00:00-04'::timestamptz,
    '2026-09-01 00:00:00-04'::timestamptz,
    '{"featured_days": 7}'::jsonb
  ),
  (
    'august_2026_fast_store',
    'Comercio rápido',
    'Gestiona al menos 10 pedidos y responde el 90% en menos de 15 minutos.',
    'Insignia Comercio rápido durante septiembre',
    'fast_store_badge',
    '2026-08-10 00:00:00-04'::timestamptz,
    '2026-09-01 00:00:00-04'::timestamptz,
    '{"minimum_orders": 10, "target_percent": 90, "response_minutes": 15}'::jsonb
  )
on conflict (challenge_key) do update set
  title = excluded.title,
  description = excluded.description,
  reward_label = excluded.reward_label,
  reward_type = excluded.reward_type,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  config = excluded.config,
  is_active = true,
  updated_at = now();
