do $$
declare
  v_entrega2_agency_id uuid;
begin
  select id
    into v_entrega2_agency_id
  from public.transport_agencies
  where lower(slug) = 'entrega2'
    and status = 'active'
    and is_active = true
  order by created_at asc
  limit 1;

  if v_entrega2_agency_id is null then
    raise exception 'No active Entrega2 transport agency found.';
  end if;

  update public.store_transport_agency_connections connection
  set is_default = false,
      updated_at = now()
  from public.store_delivery_settings settings
  where settings.store_id = connection.store_id
    and settings.delivery_provider = 'entrega2'
    and connection.agency_id <> v_entrega2_agency_id
    and connection.is_default = true
    and connection.status = 'active';

  insert into public.store_transport_agency_connections (
    store_id,
    agency_id,
    status,
    is_default,
    is_exclusive,
    delivery_billing_mode,
    connected_at,
    updated_at
  )
  select
    settings.store_id,
    v_entrega2_agency_id,
    'active',
    true,
    true,
    case when lower(stores.slug) = 'sabore' then 'cash' else 'credit' end,
    now(),
    now()
  from public.store_delivery_settings settings
  join public.stores stores on stores.id = settings.store_id
  where settings.delivery_provider = 'entrega2'
  on conflict (store_id, agency_id) do update
    set status = 'active',
        is_default = true,
        is_exclusive = true,
        delivery_billing_mode =
          case when exists (
            select 1
            from public.stores scoped_store
            where scoped_store.id = excluded.store_id
              and lower(scoped_store.slug) = 'sabore'
          ) then 'cash'
          else 'credit'
          end,
        disengagement_requested_at = null,
        disengagement_confirmed_at = null,
        disengagement_effective_at = null,
        disengagement_requested_by = null,
        disengagement_confirmed_by = null,
        disengagement_notes = null,
        updated_at = now();

  update public.store_delivery_settings settings
  set delivery_provider = 'transport_agency',
      transport_agency_id = v_entrega2_agency_id,
      transport_agency_connection_id = connection.id,
      updated_at = now()
  from public.store_transport_agency_connections connection
  where settings.store_id = connection.store_id
    and connection.agency_id = v_entrega2_agency_id
    and connection.status = 'active'
    and (
      settings.delivery_provider = 'entrega2'
      or settings.transport_agency_id = v_entrega2_agency_id
    );
end $$;
