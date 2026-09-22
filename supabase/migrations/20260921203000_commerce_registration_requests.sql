create table if not exists public.commerce_registration_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  store_name text not null,
  representative_name text not null,
  representative_id_number text not null,
  email text not null,
  whatsapp text not null,
  business_type text not null,
  city_id uuid not null references public.service_cities(id) on delete restrict,
  referral_store_id uuid references public.stores(id) on delete set null,
  weekly_order_volume text not null,
  logo_path text not null,
  logo_mime_type text not null,
  status text not null default 'pending',
  auth_user_id uuid,
  store_id uuid references public.stores(id) on delete set null,
  activation_error text,
  access_email_sent_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_registration_requests_code_check
    check (request_code ~ '^SOL-[A-Z0-9]{6}$'),
  constraint commerce_registration_requests_name_check
    check (char_length(trim(store_name)) between 2 and 120),
  constraint commerce_registration_requests_representative_check
    check (char_length(trim(representative_name)) between 3 and 120),
  constraint commerce_registration_requests_id_check
    check (representative_id_number ~ '^[VEJGP]-[0-9]{5,12}$'),
  constraint commerce_registration_requests_email_check
    check (position('@' in email) > 1),
  constraint commerce_registration_requests_volume_check
    check (weekly_order_volume in ('starting', 'one_to_ten', 'eleven_to_thirty', 'over_thirty')),
  constraint commerce_registration_requests_status_check
    check (status in ('pending', 'activating', 'approved', 'rejected', 'activation_error'))
);

create index if not exists commerce_registration_requests_status_created_idx
  on public.commerce_registration_requests(status, created_at desc);

create index if not exists commerce_registration_requests_volume_created_idx
  on public.commerce_registration_requests(weekly_order_volume, created_at desc);

create unique index if not exists commerce_registration_requests_pending_email_uidx
  on public.commerce_registration_requests(lower(email))
  where status in ('pending', 'activating', 'activation_error');

alter table public.commerce_registration_requests enable row level security;
revoke all on table public.commerce_registration_requests from public, anon, authenticated;
grant all on table public.commerce_registration_requests to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commerce-registration-assets',
  'commerce-registration-assets',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.commerce_registration_requests is
  'Commerce applications awaiting founder review. No auth user or store is created before approval.';
