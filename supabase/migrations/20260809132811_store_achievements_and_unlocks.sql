-- Permanent achievement unlocks and referral/promotion evidence.

create table if not exists public.store_achievement_unlocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  achievement_key text not null,
  source text not null default 'earned',
  progress_snapshot jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint store_achievement_unlocks_source_check
    check (source in ('earned', 'inherited', 'admin')),
  constraint store_achievement_unlocks_store_key_unique
    unique (store_id, achievement_key)
);

create index if not exists store_achievement_unlocks_store_idx
  on public.store_achievement_unlocks(store_id, unlocked_at desc);

alter table public.store_achievement_unlocks enable row level security;
revoke all on public.store_achievement_unlocks from public, anon, authenticated;
grant select, insert, update, delete on public.store_achievement_unlocks to service_role;

create table if not exists public.store_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_store_id uuid not null references public.stores(id) on delete cascade,
  referred_store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'registered',
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint store_referrals_status_check
    check (status in ('registered', 'qualified', 'rejected')),
  constraint store_referrals_referred_unique unique (referred_store_id),
  constraint store_referrals_not_self check (referrer_store_id <> referred_store_id)
);

create index if not exists store_referrals_referrer_status_idx
  on public.store_referrals(referrer_store_id, status);

alter table public.store_referrals enable row level security;
revoke all on public.store_referrals from public, anon, authenticated;
grant select, insert, update, delete on public.store_referrals to service_role;

create table if not exists public.store_promotion_activations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  first_activated_at timestamptz not null default now(),
  constraint store_promotion_activations_store_product_unique
    unique (store_id, product_id)
);

create index if not exists store_promotion_activations_store_idx
  on public.store_promotion_activations(store_id, first_activated_at);

alter table public.store_promotion_activations enable row level security;
revoke all on public.store_promotion_activations from public, anon, authenticated;
grant select, insert, update, delete on public.store_promotion_activations to service_role;

-- Existing stores keep every feature they already had.
insert into public.store_achievement_unlocks (store_id, achievement_key, source)
select stores.id, achievement.key, 'inherited'
from public.stores
cross join (
  values
    ('setup_delivery'),
    ('orders_10_basic_stats'),
    ('orders_50_full_stats'),
    ('referral_brand_colors'),
    ('promo_20_customers'),
    ('promos_3_three_months_customer_details')
) as achievement(key)
on conflict (store_id, achievement_key) do nothing;
