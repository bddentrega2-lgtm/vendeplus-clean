insert into public.store_delivery_settings (
  store_id,
  delivery_enabled,
  pickup_enabled,
  delivery_provider,
  pricing_type,
  fixed_fee_usd,
  manual_quote_message
)
select
  stores.id,
  coalesce(stores.accepts_delivery, false),
  coalesce(stores.accepts_pickup, true),
  case
    when coalesce(stores.accepts_delivery, false) then 'own_delivery'
    else 'disabled'
  end,
  'manual',
  0,
  'Confirma el precio de tu delivery por WhatsApp con el comercio.'
from public.stores stores
where not exists (
  select 1
  from public.store_delivery_settings settings
  where settings.store_id = stores.id
);

update public.store_delivery_settings settings
set
  delivery_enabled = case
    when stores.accepts_delivery is true then true
    else settings.delivery_enabled
  end,
  pickup_enabled = case
    when stores.accepts_pickup is true then true
    else settings.pickup_enabled
  end,
  delivery_provider = case
    when stores.accepts_delivery is true and settings.delivery_provider = 'disabled' then 'own_delivery'
    else settings.delivery_provider
  end,
  updated_at = now()
from public.stores stores
where settings.store_id = stores.id
  and settings.delivery_enabled = false
  and settings.pickup_enabled = false
  and (
    stores.accepts_delivery is true
    or stores.accepts_pickup is true
  );
