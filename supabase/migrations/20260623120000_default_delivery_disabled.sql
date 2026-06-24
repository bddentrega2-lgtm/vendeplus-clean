alter table public.store_delivery_settings
  alter column delivery_enabled set default false,
  alter column pickup_enabled set default true,
  alter column delivery_provider set default 'disabled',
  alter column pricing_type set default 'manual';

alter table public.stores
  alter column accepts_delivery set default false,
  alter column accepts_pickup set default true;

update public.stores
set accepts_delivery = false
where accepts_delivery is distinct from false
  and not exists (
    select 1
    from public.store_delivery_settings settings
    where settings.store_id = stores.id
  );
