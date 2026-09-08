create table if not exists public.transport_particular_requests (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  requester_name text not null,
  requester_phone text not null,
  requester_role text not null,
  pickup_phone text not null,
  pickup_address text not null,
  pickup_reference text,
  pickup_lat numeric not null,
  pickup_lng numeric not null,
  delivery_phone text not null,
  delivery_address text not null,
  delivery_reference text,
  delivery_lat numeric not null,
  delivery_lng numeric not null,
  package_description text not null,
  payment_method text not null,
  distance_km numeric,
  delivery_fee_usd numeric,
  pricing_type text,
  quote_source text,
  status text not null default 'pending_agency',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_particular_requester_role_check check (requester_role in ('sender', 'receiver')),
  constraint transport_particular_text_lengths_check check (
    char_length(requester_name) between 1 and 100 and
    char_length(requester_phone) between 1 and 24 and
    char_length(pickup_phone) between 1 and 24 and
    char_length(delivery_phone) between 1 and 24 and
    char_length(pickup_address) between 1 and 240 and
    char_length(delivery_address) between 1 and 240 and
    char_length(package_description) between 1 and 300
  ),
  constraint transport_particular_status_check check (status in ('pending_agency','agency_accepted','agency_rejected','driver_assigned','picked_up','on_the_way','delivered','issue_reported','cancelled')),
  constraint transport_particular_coordinates_check check (
    pickup_lat between -90 and 90 and pickup_lng between -180 and 180 and
    delivery_lat between -90 and 90 and delivery_lng between -180 and 180
  ),
  constraint transport_particular_fee_check check (delivery_fee_usd is null or delivery_fee_usd >= 0)
);

create index if not exists transport_particular_requests_agency_status_created_idx
  on public.transport_particular_requests(agency_id, status, created_at desc);

alter table public.transport_particular_requests enable row level security;
revoke all on public.transport_particular_requests from public, anon, authenticated;

comment on table public.transport_particular_requests is
  'Solicitudes publicas de delivery creadas por particulares y aisladas por empresa delivery.';
