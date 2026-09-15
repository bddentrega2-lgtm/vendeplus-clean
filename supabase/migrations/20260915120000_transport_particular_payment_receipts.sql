create table if not exists public.transport_particular_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  particular_request_id uuid references public.transport_particular_requests(id) on delete cascade,
  storage_path text unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  deleted_at timestamptz,
  constraint transport_particular_payment_receipts_single_request unique (particular_request_id)
);

alter table public.transport_agencies
  add column if not exists particular_payment_proof_mode text not null default 'disabled',
  add column if not exists particular_payment_proof_required boolean not null default false;

alter table public.transport_agencies drop constraint if exists transport_agencies_particular_payment_proof_mode_check;
alter table public.transport_agencies add constraint transport_agencies_particular_payment_proof_mode_check
  check (particular_payment_proof_mode in ('disabled', 'reference', 'image'));

alter table public.transport_agencies drop constraint if exists transport_agencies_particular_payment_proof_required_check;
alter table public.transport_agencies add constraint transport_agencies_particular_payment_proof_required_check
  check (particular_payment_proof_mode <> 'disabled' or particular_payment_proof_required = false);

create index if not exists transport_particular_payment_receipts_cleanup_idx
  on public.transport_particular_payment_receipts (expires_at)
  where deleted_at is null and storage_path is not null;

create index if not exists transport_particular_payment_receipts_agency_request_idx
  on public.transport_particular_payment_receipts (agency_id, particular_request_id);

alter table public.transport_particular_payment_receipts enable row level security;
revoke all on table public.transport_particular_payment_receipts from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
