alter table if exists public.transport_agencies
  add column if not exists driver_whatsapp_dispatch_enabled boolean not null default false;

create index if not exists idx_transport_agencies_driver_whatsapp_dispatch
  on public.transport_agencies (driver_whatsapp_dispatch_enabled)
  where driver_whatsapp_dispatch_enabled = true;
