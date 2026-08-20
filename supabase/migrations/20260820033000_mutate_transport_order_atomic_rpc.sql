create or replace function public.mutate_transport_order_atomic(
  p_transport_order_id uuid,
  p_transport_payload jsonb,
  p_event_payload jsonb,
  p_order_delivery_status text default null,
  p_integration_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_updated public.transport_orders%rowtype;
begin
  if p_transport_order_id is null then
    raise exception 'Falta el servicio delivery.' using errcode = '22023';
  end if;

  select order_id into v_order_id
    from public.transport_orders
    where id = p_transport_order_id
    for update;

  if v_order_id is null then
    raise exception 'Servicio delivery no encontrado.' using errcode = 'P0002';
  end if;

  update public.transport_orders as target
  set
    status = case when p_transport_payload ? 'status' then p_transport_payload->>'status' else target.status end,
    agency_status_note = case when p_transport_payload ? 'agency_status_note' then nullif(p_transport_payload->>'agency_status_note', '') else target.agency_status_note end,
    rejection_reason = case when p_transport_payload ? 'rejection_reason' then nullif(p_transport_payload->>'rejection_reason', '') else target.rejection_reason end,
    driver_id = case when p_transport_payload ? 'driver_id' then nullif(p_transport_payload->>'driver_id', '')::uuid else target.driver_id end,
    driver_name_snapshot = case when p_transport_payload ? 'driver_name_snapshot' then nullif(p_transport_payload->>'driver_name_snapshot', '') else target.driver_name_snapshot end,
    driver_commission_percent = case when p_transport_payload ? 'driver_commission_percent' then nullif(p_transport_payload->>'driver_commission_percent', '')::numeric else target.driver_commission_percent end,
    driver_payout_usd = case when p_transport_payload ? 'driver_payout_usd' then nullif(p_transport_payload->>'driver_payout_usd', '')::numeric else target.driver_payout_usd end,
    driver_assigned_at = case when p_transport_payload ? 'driver_assigned_at' then nullif(p_transport_payload->>'driver_assigned_at', '')::timestamptz else target.driver_assigned_at end,
    sent_to_agency_at = case when p_transport_payload ? 'sent_to_agency_at' then coalesce(target.sent_to_agency_at, nullif(p_transport_payload->>'sent_to_agency_at', '')::timestamptz) else target.sent_to_agency_at end,
    agency_received_at = case when p_transport_payload ? 'agency_received_at' then coalesce(target.agency_received_at, nullif(p_transport_payload->>'agency_received_at', '')::timestamptz) else target.agency_received_at end,
    accepted_at = case when p_transport_payload ? 'accepted_at' then coalesce(target.accepted_at, nullif(p_transport_payload->>'accepted_at', '')::timestamptz) else target.accepted_at end,
    rejected_at = case when p_transport_payload ? 'rejected_at' then coalesce(target.rejected_at, nullif(p_transport_payload->>'rejected_at', '')::timestamptz) else target.rejected_at end,
    assigned_at = case when p_transport_payload ? 'assigned_at' then coalesce(target.assigned_at, nullif(p_transport_payload->>'assigned_at', '')::timestamptz) else target.assigned_at end,
    picked_up_at = case when p_transport_payload ? 'picked_up_at' then coalesce(target.picked_up_at, nullif(p_transport_payload->>'picked_up_at', '')::timestamptz) else target.picked_up_at end,
    on_the_way_at = case when p_transport_payload ? 'on_the_way_at' then coalesce(target.on_the_way_at, nullif(p_transport_payload->>'on_the_way_at', '')::timestamptz) else target.on_the_way_at end,
    delivered_at = case when p_transport_payload ? 'delivered_at' then coalesce(target.delivered_at, nullif(p_transport_payload->>'delivered_at', '')::timestamptz) else target.delivered_at end,
    cancelled_at = case when p_transport_payload ? 'cancelled_at' then coalesce(target.cancelled_at, nullif(p_transport_payload->>'cancelled_at', '')::timestamptz) else target.cancelled_at end,
    updated_at = now()
  where target.id = p_transport_order_id
  returning target.* into v_updated;

  insert into public.transport_order_events (
    transport_order_id, event_type, status_from, status_to, note,
    actor_type, actor_user_id, actor_name
  ) values (
    p_transport_order_id,
    coalesce(nullif(p_event_payload->>'event_type', ''), 'status_changed'),
    nullif(p_event_payload->>'status_from', ''),
    nullif(p_event_payload->>'status_to', ''),
    nullif(p_event_payload->>'note', ''),
    coalesce(nullif(p_event_payload->>'actor_type', ''), 'system'),
    nullif(p_event_payload->>'actor_user_id', '')::uuid,
    nullif(p_event_payload->>'actor_name', '')
  );

  if p_order_delivery_status is not null then
    update public.orders
      set delivery_status = p_order_delivery_status,
          transport_agency_status = coalesce(p_integration_status, v_updated.status)
      where id = v_order_id;
  end if;

  if p_integration_status is not null then
    update public.order_integrations
      set status = p_integration_status, updated_at = now()
      where order_id = v_order_id and provider = 'transport_agency';
  end if;

  return to_jsonb(v_updated);
end;
$$;

revoke all on function public.mutate_transport_order_atomic(uuid, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.mutate_transport_order_atomic(uuid, jsonb, jsonb, text, text)
  to service_role;

comment on function public.mutate_transport_order_atomic(uuid, jsonb, jsonb, text, text) is
  'Atomically updates a transport service, its audit event, the source order and integration.';
