-- Keep Armario as a no-delivery fashion demo.
-- Cancels previous transport-agency links and clears delivery settings without touching order history.

do $$
declare
  armario_id uuid;
begin
  select id
    into armario_id
  from public.stores
  where lower(slug) = 'armario'
     or lower(name) = 'armario'
  limit 1;

  if armario_id is null then
    return;
  end if;

  update public.store_transport_agency_connections
  set
    status = 'cancelled',
    is_default = false,
    updated_at = now(),
    disengagement_requested_at = coalesce(disengagement_requested_at, now()),
    disengagement_confirmed_at = coalesce(disengagement_confirmed_at, now()),
    disengagement_effective_at = coalesce(disengagement_effective_at, now()),
    disengagement_notes = coalesce(disengagement_notes, 'Demo Armario sin delivery configurado.')
  where store_id = armario_id
    and status = 'active';

  update public.store_delivery_settings
  set
    delivery_enabled = false,
    pickup_enabled = true,
    delivery_provider = 'disabled',
    pricing_type = 'manual',
    fixed_fee_usd = 0,
    free_delivery_min_usd = null,
    max_distance_km = null,
    distance_factor = null,
    transport_agency_connection_id = null,
    transport_agency_id = null,
    updated_at = now()
  where store_id = armario_id;

  update public.store_delivery_distance_rates
  set is_active = false, updated_at = now()
  where store_id = armario_id;

  update public.store_delivery_zones
  set is_active = false, updated_at = now()
  where store_id = armario_id;

  update public.stores
  set
    accepts_delivery = false,
    accepts_pickup = true,
    delivery_estimate = 'No configurado'
  where id = armario_id;
end $$;
