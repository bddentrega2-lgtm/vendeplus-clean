alter table public.stores
  add column if not exists accepts_national_shipping boolean not null default false;

alter table public.store_delivery_settings
  add column if not exists national_shipping_enabled boolean not null default false;

comment on column public.stores.accepts_national_shipping
  is 'Legacy checkout flag for stores that accept national shipping orders.';

comment on column public.store_delivery_settings.national_shipping_enabled
  is 'Enables national shipping as a checkout fulfillment option. Price and agency are coordinated by WhatsApp.';
