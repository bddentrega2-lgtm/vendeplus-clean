-- Run against the linked database. All fixtures and events are rolled back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
declare
  v_driver public.transport_drivers%rowtype;
  v_request uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();
  v_transport uuid;
  v_status text;
  v_result jsonb;
  v_count integer;
  v_commerce public.transport_orders%rowtype;
begin
  select * into strict v_driver from public.transport_drivers where is_active order by id limit 1;
  insert into public.transport_particular_requests (
    id, public_code, agency_id, requester_name, requester_phone, requester_role,
    pickup_phone, pickup_address, pickup_lat, pickup_lng,
    delivery_phone, delivery_address, delivery_lat, delivery_lng,
    package_description, payment_method, delivery_fee_usd, idempotency_key
  ) values (
    v_request, 'QA-' || v_request::text, v_driver.agency_id, 'QA rollback', '584120000000', 'sender',
    '584120000000', 'QA origen', 10.2, -67.5,
    '584120000000', 'QA destino', 10.21, -67.51,
    'QA transaccional', 'cash', 2, v_key
  );
  select id into strict v_transport from public.transport_orders where particular_request_id = v_request;
  begin
    insert into public.transport_particular_requests
    select (jsonb_populate_record(null::public.transport_particular_requests,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'public_code', 'QA-duplicate-' || v_request::text))).*
    from public.transport_particular_requests r where id = v_request;
    raise exception 'Duplicate retry was accepted';
  exception when unique_violation then null;
  end;
  foreach v_status in array array['agency_accepted','driver_assigned','pickup_pending','picked_up','on_the_way','delivery_failed','issue_reported','delivered','cancelled'] loop
    v_result := public.mutate_transport_order_atomic(v_transport,
      jsonb_build_object('status', v_status, 'driver_id', v_driver.id, 'driver_name_snapshot', v_driver.name),
      jsonb_build_object('event_type', 'status_changed', 'status_to', v_status, 'actor_type', 'system', 'note', 'QA rollback'),
      v_status, v_status);
    if v_result->>'status' <> v_status or v_result->>'driver_id' <> v_driver.id::text then
      raise exception 'Assignment/status did not persist';
    end if;
    if not exists (select 1 from public.transport_particular_requests where id = v_request and status = v_status) then
      raise exception 'Particular status did not synchronize: %', v_status;
    end if;
  end loop;
  select count(*) into v_count from public.transport_order_events where transport_order_id = v_transport;
  if v_count <> 10 then raise exception 'Expected 10 events, got %', v_count; end if;
  begin
    perform public.mutate_transport_order_atomic(gen_random_uuid(), '{}'::jsonb, '{}'::jsonb);
    raise exception 'Missing order was accepted';
  exception when no_data_found then null;
  end;
  select * into strict v_commerce from public.transport_orders where order_id is not null order by id limit 1 for update;
  v_result := public.mutate_transport_order_atomic(v_commerce.id,
    jsonb_build_object('status', v_commerce.status),
    jsonb_build_object('event_type', 'status_changed', 'status_to', v_commerce.status, 'actor_type', 'system', 'note', 'QA rollback'),
    (select delivery_status from public.orders where id = v_commerce.order_id), null);
  if v_result->>'order_id' <> v_commerce.order_id::text then raise exception 'Commerce association changed'; end if;
  if has_function_privilege('anon', 'public.mutate_transport_order_atomic(uuid,jsonb,jsonb,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.mutate_transport_order_atomic(uuid,jsonb,jsonb,text,text)', 'execute') then
    raise exception 'RPC grants are unsafe';
  end if;
end;
$$;
rollback;
select 'PASS: creation, duplicate retry, assignment, 9 statuses, synchronization, 10 events, missing order, commerce regression and RPC permissions; fixtures rolled back' as result;
