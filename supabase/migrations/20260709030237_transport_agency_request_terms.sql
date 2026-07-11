-- Add agency payment terms and store snapshots for affiliation requests.

alter table public.transport_agencies
  add column if not exists billing_rate_bs numeric,
  add column if not exists payment_terms text,
  add column if not exists credit_terms text;

alter table public.store_transport_agency_requests
  add column if not exists store_name_snapshot text,
  add column if not exists store_phone_snapshot text,
  add column if not exists store_contact_name_snapshot text,
  add column if not exists store_address_snapshot text,
  add column if not exists store_latitude_snapshot numeric,
  add column if not exists store_longitude_snapshot numeric,
  add column if not exists store_schedule_snapshot text,
  add column if not exists store_description_snapshot text;

alter table public.store_transport_agency_connections
  add column if not exists disengagement_requested_at timestamptz,
  add column if not exists disengagement_effective_at timestamptz,
  add column if not exists disengagement_confirmed_at timestamptz,
  add column if not exists disengagement_notes text;
