-- Repair the partial Entrega2 approval for Mis Accesorios without changing historical orders.
-- Exact identifiers and state guards keep this production correction fail-closed and idempotent.

do $$
declare
  v_now timestamptz := now();
  v_store_id constant uuid := '7984f09a-18ad-4528-8a73-0f1b3cd3f25f';
  v_settings_id constant uuid := 'eceda41a-45f9-4bc6-9d25-1c89706ec7bf';
  v_entrega2_id constant uuid := '3db97653-4a7a-4ab0-854d-0ca847ff88a9';
  v_entrega2_request_id constant uuid := '22ec6a82-92f6-47a5-a39f-43574a1ab44f';
  v_mandamelo_id constant uuid := '55d6f76d-bb0f-4751-9686-17496d8924ea';
  v_mandamelo_connection_id constant uuid := '4aa80b58-cbcc-44fe-8419-f2412fca3cc9';
  v_entrega2_connection_id uuid;
begin
  if not exists (
    select 1 from public.stores
    where id = v_store_id and lower(slug) = 'mis-accesorios'
  ) then
    raise exception 'Mis Accesorios identity guard failed.';
  end if;

  if not exists (
    select 1 from public.transport_agencies
    where id = v_entrega2_id
      and lower(slug) = 'entrega2'
      and status = 'active'
      and is_active = true
      and pricing_type = 'distance_ranges'
  ) then
    raise exception 'Entrega2 identity, state or pricing guard failed.';
  end if;

  if not exists (
    select 1 from public.store_transport_agency_requests
    where id = v_entrega2_request_id
      and store_id = v_store_id
      and agency_id = v_entrega2_id
      and status = 'approved'
  ) then
    raise exception 'Entrega2 approved request guard failed.';
  end if;

  if not exists (
    select 1 from public.store_transport_agency_connections
    where id = v_mandamelo_connection_id
      and store_id = v_store_id
      and agency_id = v_mandamelo_id
      and status = 'active'
      and is_default = true
      and is_exclusive = true
      and disengagement_confirmed_at is not null
      and disengagement_effective_at is not null
  ) then
    if exists (
      select 1 from public.store_transport_agency_connections
      where store_id = v_store_id
        and agency_id = v_entrega2_id
        and status = 'active'
        and is_default = true
        and is_exclusive = true
        and delivery_billing_mode = 'cash'
    ) then
      return;
    end if;
    raise exception 'Mandamelo ended connection guard failed.';
  end if;

  if not exists (
    select 1 from public.store_delivery_settings
    where id = v_settings_id
      and store_id = v_store_id
      and delivery_provider = 'manual_quote'
      and transport_agency_id is null
      and transport_agency_connection_id is null
  ) then
    raise exception 'Mis Accesorios delivery settings changed after review.';
  end if;

  if exists (
    select 1 from public.store_transport_agency_connections
    where store_id = v_store_id
      and agency_id <> v_mandamelo_id
      and agency_id <> v_entrega2_id
      and status = 'active'
      and disengagement_effective_at is null
  ) then
    raise exception 'Another active delivery relationship appeared; repair aborted.';
  end if;

  update public.store_transport_agency_connections
  set status = 'cancelled',
      is_default = false,
      is_exclusive = false,
      paused_at = coalesce(paused_at, disengagement_effective_at, v_now),
      updated_at = v_now
  where id = v_mandamelo_connection_id;

  insert into public.store_transport_agency_connections (
    store_id,
    agency_id,
    request_id,
    status,
    is_default,
    is_exclusive,
    delivery_billing_mode,
    connected_at,
    updated_at,
    disengagement_requested_at,
    disengagement_confirmed_at,
    disengagement_effective_at,
    disengagement_requested_by,
    disengagement_confirmed_by,
    disengagement_notes
  ) values (
    v_store_id,
    v_entrega2_id,
    v_entrega2_request_id,
    'active',
    true,
    true,
    'cash',
    v_now,
    v_now,
    null,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (store_id, agency_id) do update
  set request_id = excluded.request_id,
      status = 'active',
      is_default = true,
      is_exclusive = true,
      delivery_billing_mode = 'cash',
      connected_at = excluded.connected_at,
      paused_at = null,
      updated_at = excluded.updated_at,
      disengagement_requested_at = null,
      disengagement_confirmed_at = null,
      disengagement_effective_at = null,
      disengagement_requested_by = null,
      disengagement_confirmed_by = null,
      disengagement_notes = null
  returning id into v_entrega2_connection_id;

  update public.store_transport_agency_requests
  set status = 'approved',
      response_notes = 'Afiliacion exclusiva de contado confirmada para Entrega2.',
      updated_at = v_now
  where id = v_entrega2_request_id;

  update public.store_delivery_settings
  set delivery_enabled = true,
      delivery_provider = 'transport_agency',
      pricing_type = 'distance_ranges',
      fixed_fee_usd = 0,
      max_distance_km = 30,
      distance_factor = 0.45,
      manual_quote_message = 'El delivery lo confirma Entrega2 por WhatsApp.',
      transport_agency_id = v_entrega2_id,
      transport_agency_connection_id = v_entrega2_connection_id,
      updated_at = v_now
  where id = v_settings_id;

  update public.stores
  set accepts_delivery = true
  where id = v_store_id;

  if (
    select count(*)
    from public.store_transport_agency_connections
    where store_id = v_store_id
      and status = 'active'
      and is_default = true
      and agency_id = v_entrega2_id
      and is_exclusive = true
      and delivery_billing_mode = 'cash'
      and disengagement_effective_at is null
  ) <> 1 then
    raise exception 'Mis Accesorios postcondition failed: Entrega2 is not uniquely active.';
  end if;

  if exists (
    select 1 from public.store_transport_agency_connections
    where store_id = v_store_id
      and agency_id <> v_entrega2_id
      and status = 'active'
  ) then
    raise exception 'Mis Accesorios postcondition failed: another active relationship remains.';
  end if;
end
$$;
