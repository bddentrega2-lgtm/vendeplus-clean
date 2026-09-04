create table if not exists public.store_print_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  is_enabled boolean not null default false,
  trigger_mode text not null default 'received'
    check (trigger_mode in ('received', 'paid', 'both')),
  paper_width_mm integer not null default 58 check (paper_width_mm in (58, 80)),
  printer_name text,
  copies integer not null default 1 check (copies between 1 and 3),
  include_prices boolean not null default false,
  connector text not null default 'qz' check (connector in ('qz')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_print_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('received', 'paid')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'printed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_by text,
  locked_until timestamptz,
  last_error text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, order_id, event_type)
);

create index if not exists order_print_jobs_claim_idx
  on public.order_print_jobs (store_id, status, created_at)
  where status in ('pending', 'processing', 'failed');

alter table public.store_print_settings enable row level security;
alter table public.order_print_jobs enable row level security;
revoke all on table public.store_print_settings from public, anon, authenticated;
revoke all on table public.order_print_jobs from public, anon, authenticated;
grant all on table public.store_print_settings to service_role;
grant all on table public.order_print_jobs to service_role;

create or replace function public.enqueue_store_print_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.store_print_settings%rowtype;
begin
  select * into v_settings
  from public.store_print_settings
  where store_id = new.store_id and is_enabled = true;

  if not found then return new; end if;

  if tg_op = 'INSERT' and v_settings.trigger_mode in ('received', 'both') then
    insert into public.order_print_jobs (store_id, order_id, event_type)
    values (new.store_id, new.id, 'received')
    on conflict (store_id, order_id, event_type) do nothing;
  end if;

  if v_settings.trigger_mode in ('paid', 'both')
    and new.payment_status = 'verified'
    and (tg_op = 'INSERT' or old.payment_status is distinct from 'verified') then
    insert into public.order_print_jobs (store_id, order_id, event_type)
    values (new.store_id, new.id, 'paid')
    on conflict (store_id, order_id, event_type) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enqueue_print_job on public.orders;
create trigger orders_enqueue_print_job
after insert or update of payment_status on public.orders
for each row execute function public.enqueue_store_print_job();

revoke all on function public.enqueue_store_print_job() from public, anon, authenticated;
grant execute on function public.enqueue_store_print_job() to service_role;

create or replace function public.claim_store_print_jobs(
  p_store_id uuid,
  p_device_id text,
  p_limit integer default 3
)
returns setof public.order_print_jobs
language sql
security invoker
set search_path = public
as $$
  with claimable as (
    select id
    from public.order_print_jobs
    where store_id = p_store_id
      and attempts < 5
      and (
        status = 'pending'
        or status = 'failed'
        or (status = 'processing' and locked_until < now())
      )
    order by created_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 1), 1), 10)
  )
  update public.order_print_jobs jobs
  set status = 'processing',
      attempts = jobs.attempts + 1,
      claimed_by = left(p_device_id, 120),
      locked_until = now() + interval '2 minutes',
      last_error = null,
      updated_at = now()
  from claimable
  where jobs.id = claimable.id
  returning jobs.*;
$$;

revoke all on function public.claim_store_print_jobs(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_store_print_jobs(uuid, text, integer)
  to service_role;
