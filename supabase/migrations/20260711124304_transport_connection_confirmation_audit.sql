-- Track which side requested/confirmed transport agency disengagement.
-- Non-destructive: existing rows keep their current timestamps and get inferred metadata.

alter table public.store_transport_agency_connections
  add column if not exists disengagement_requested_by text,
  add column if not exists disengagement_confirmed_by text;

alter table public.store_transport_agency_connections
  drop constraint if exists store_transport_agency_connections_disengagement_requested_by_check;

alter table public.store_transport_agency_connections
  add constraint store_transport_agency_connections_disengagement_requested_by_check
    check (
      disengagement_requested_by is null
      or disengagement_requested_by in ('commerce', 'agency', 'admin')
    );

alter table public.store_transport_agency_connections
  drop constraint if exists store_transport_agency_connections_disengagement_confirmed_by_check;

alter table public.store_transport_agency_connections
  add constraint store_transport_agency_connections_disengagement_confirmed_by_check
    check (
      disengagement_confirmed_by is null
      or disengagement_confirmed_by in ('commerce', 'agency', 'admin')
    );

update public.store_transport_agency_connections
set
  disengagement_requested_by = coalesce(disengagement_requested_by, 'admin'),
  disengagement_confirmed_by = coalesce(disengagement_confirmed_by, 'admin')
where disengagement_requested_at is not null
  and disengagement_confirmed_at is not null
  and disengagement_requested_by is null
  and disengagement_confirmed_by is null;

create index if not exists store_transport_agency_connections_disengagement_pending_idx
  on public.store_transport_agency_connections(status, disengagement_requested_by, disengagement_requested_at)
  where disengagement_requested_at is not null
    and disengagement_confirmed_at is null;
