alter table if exists public.transport_drivers
  add column if not exists document_number text;

create index if not exists idx_transport_drivers_agency_document_number
  on public.transport_drivers (agency_id, document_number)
  where document_number is not null and btrim(document_number) <> '';
