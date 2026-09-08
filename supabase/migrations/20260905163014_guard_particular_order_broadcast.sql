create or replace function private.broadcast_transport_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.store_id is not null then
  perform realtime.send(
    jsonb_build_object(
      'transport_order_id', new.id,
      'order_id', new.order_id,
      'store_id', new.store_id,
      'agency_id', new.agency_id,
      'status', new.status,
      'operation', tg_op
    ),
    'transport_order_changed',
    'store:' || new.store_id::text || ':orders',
    true
  );

  end if;

  perform realtime.send(
    jsonb_build_object(
      'transport_order_id', new.id,
      'order_id', new.order_id,
      'agency_id', new.agency_id,
      'status', new.status,
      'operation', tg_op
    ),
    'transport_order_changed',
    'agency:' || new.agency_id::text || ':transport-orders',
    true
  );

  return null;
end;
$$;

revoke all on function private.broadcast_transport_order_change() from public, anon, authenticated;


alter table public.transport_particular_requests
  drop constraint transport_particular_status_check,
  add constraint transport_particular_status_check check (status in (
    'pending_agency', 'sent_to_agency', 'agency_received', 'agency_accepted',
    'agency_rejected', 'driver_assigned', 'pickup_pending', 'picked_up',
    'on_the_way', 'delivered', 'delivery_failed', 'issue_reported', 'cancelled'
  ));
