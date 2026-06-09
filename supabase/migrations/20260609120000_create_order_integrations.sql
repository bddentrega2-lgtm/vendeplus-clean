create table if not exists public.order_integrations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  external_id text,
  status text not null default 'pending',
  request_payload jsonb,
  last_payload jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists order_integrations_order_provider_idx
  on public.order_integrations(order_id, provider);

create index if not exists order_integrations_provider_external_idx
  on public.order_integrations(provider, external_id);

create index if not exists order_integrations_order_id_idx
  on public.order_integrations(order_id);

alter table public.order_integrations enable row level security;
