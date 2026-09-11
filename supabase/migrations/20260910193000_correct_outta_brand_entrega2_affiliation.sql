-- Correct the accidental Outta Brand affiliation without deleting history or touching orders.
-- Exact identifiers and state guards make this a single-store, fail-closed repair.

do $$
declare
  v_now timestamptz := now();
  v_store_id constant uuid := '4e03663d-866c-44a0-8b5a-275aa45cba97';
  v_settings_id constant uuid := 'c5fd06b8-eff1-4e56-bdff-63144f5d13f6';
  v_entrega2_id constant uuid := '3db97653-4a7a-4ab0-854d-0ca847ff88a9';
  v_entrega2_request_id constant uuid := '9b86b144-7223-42d9-ad5c-5736022d9729';
  v_mandamelo_id constant uuid := '55d6f76d-bb0f-4751-9686-17496d8924ea';
  v_mandamelo_request_id constant uuid := '0e6ea11c-f7e7-4107-80d7-08025c66849d';
  v_mandamelo_connection_id constant uuid := '8180db49-7973-40ad-abcc-fa077a08f1c6';
  v_entrega2_connection_id uuid;
begin
  if not exists (
    select 1 from public.stores
    where id = v_store_id and lower(slug) = 'outta-brand'
  ) then
    raise exception 'Outta Brand identity guard failed.';
  end if;

  if not exists (
    select 1 from public.transport_agencies
    where id = v_entrega2_id and lower(slug) = 'entrega2' and status = 'active' and is_active = true
  ) then
    raise exception 'Entrega2 identity or active-state guard failed.';
  end if;

  if not exists (
    select 1 from public.transport_agencies
    where id = v_mandamelo_id and lower(slug) = 'mandamelo'
  ) then
    raise exception 'Mandamelo identity guard failed.';
  end if;

  if exists (
    select 1 from public.transport_orders
    where store_id = v_store_id and agency_id = v_mandamelo_id
  ) then
    raise exception 'Outta Brand already has Mandamelo transport orders; manual review required.';
  end if;

  if not exists (
    select 1 from public.store_transport_agency_connections
    where id = v_mandamelo_connection_id
      and store_id = v_store_id
      and agency_id = v_mandamelo_id
      and request_id = v_mandamelo_request_id
      and status = 'active'
      and is_default = true
      and is_exclusive = true
      and delivery_billing_mode = 'credit'
  ) then
    raise exception 'Mandamelo connection changed after review; repair aborted.';
  end if;

  if not exists (
    select 1 from public.store_transport_agency_requests
    where id = v_entrega2_request_id
      and store_id = v_store_id
      and agency_id = v_entrega2_id
      and status = 'pending'
  ) then
    raise exception 'Entrega2 request changed after review; repair aborted.';
  end if;

  if not exists (
    select 1 from public.store_transport_agency_requests
    where id = v_mandamelo_request_id
      and store_id = v_store_id
      and agency_id = v_mandamelo_id
      and status = 'approved'
  ) then
    raise exception 'Mandamelo request changed after review; repair aborted.';
  end if;

  if (
    select count(*)
    from public.store_transport_agency_requests
    where id = any(array[
      'e50c1668-36d8-4738-bb1e-ed90c0ce4861'::uuid,
      'ab009771-3144-42da-97d6-e59be167a4cd'::uuid,
      'bbdbfc27-6845-420f-96aa-6e84c270f5fa'::uuid,
      '8cd540b8-632c-4e3d-98eb-666a185b52ab'::uuid
    ])
      and store_id = v_store_id
      and status = 'pending'
  ) <> 4 then
    raise exception 'One or more pending Outta Brand requests changed after review; repair aborted.';
  end if;

  if not exists (
    select 1 from public.store_delivery_settings
    where id = v_settings_id
      and store_id = v_store_id
      and delivery_provider = 'manual_quote'
      and transport_agency_id is null
      and transport_agency_connection_id is null
  ) then
    raise exception 'Outta Brand delivery settings changed after review; repair aborted.';
  end if;

  if exists (
    select 1 from public.store_transport_agency_connections
    where store_id = v_store_id and agency_id = v_entrega2_id
  ) then
    raise exception 'An Entrega2 connection appeared after review; repair aborted.';
  end if;

  update public.store_transport_agency_connections
  set status = 'cancelled',
      is_default = false,
      paused_at = v_now,
      disengagement_requested_at = v_now,
      disengagement_requested_by = 'admin',
      disengagement_confirmed_at = v_now,
      disengagement_confirmed_by = 'admin',
      disengagement_effective_at = v_now,
      disengagement_notes = 'Afiliacion revertida por aprobacion administrativa en la empresa delivery equivocada.',
      updated_at = v_now
  where id = v_mandamelo_connection_id;

  update public.store_transport_agency_requests
  set status = 'cancelled',
      response_notes = 'Solicitud cancelada: el comercio trabajara exclusivamente con Entrega2.',
      updated_at = v_now
  where id = any(array[
    v_mandamelo_request_id,
    'e50c1668-36d8-4738-bb1e-ed90c0ce4861'::uuid,
    'ab009771-3144-42da-97d6-e59be167a4cd'::uuid,
    'bbdbfc27-6845-420f-96aa-6e84c270f5fa'::uuid,
    '8cd540b8-632c-4e3d-98eb-666a185b52ab'::uuid
  ]);

  update public.store_transport_agency_requests
  set status = 'approved',
      response_notes = 'Afiliacion exclusiva a credito confirmada para Entrega2.',
      updated_at = v_now
  where id = v_entrega2_request_id;

  insert into public.store_transport_agency_connections (
    store_id,
    agency_id,
    request_id,
    status,
    is_default,
    is_exclusive,
    delivery_billing_mode,
    connected_at,
    updated_at
  ) values (
    v_store_id,
    v_entrega2_id,
    v_entrega2_request_id,
    'active',
    true,
    true,
    'credit',
    v_now,
    v_now
  )
  returning id into v_entrega2_connection_id;

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
      and delivery_billing_mode = 'credit'
  ) <> 1 then
    raise exception 'Outta Brand postcondition failed: Entrega2 connection is not uniquely active.';
  end if;

  if exists (
    select 1 from public.store_transport_agency_requests
    where store_id = v_store_id
      and agency_id <> v_entrega2_id
      and status in ('pending', 'approved')
  ) then
    raise exception 'Outta Brand postcondition failed: another agency request remains open.';
  end if;
end
$$;
