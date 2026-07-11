-- Private, multi-tenant realtime notifications for commerce and delivery panels.
-- Payloads contain only identifiers; clients reload protected APIs for full data.

create schema if not exists private;

create or replace function private.can_receive_vendemas_broadcast(
  requested_topic text,
  requested_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  topic_id uuid;
  jwt_email text;
begin
  if requested_user_id is null or requested_user_id <> (select auth.uid()) then
    return false;
  end if;

  if requested_topic ~* '^store:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:orders$' then
    topic_id := split_part(requested_topic, ':', 2)::uuid;

    return exists (
      select 1
      from public.store_users membership
      where membership.user_id = requested_user_id
        and membership.store_id = topic_id
    );
  end if;

  if requested_topic ~* '^agency:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:transport-orders$' then
    topic_id := split_part(requested_topic, ':', 2)::uuid;
    jwt_email := lower(coalesce((select auth.jwt() ->> 'email'), ''));

    return exists (
      select 1
      from public.transport_agency_users membership
      where membership.agency_id = topic_id
        and (
          membership.user_id = requested_user_id
          or lower(membership.email) = jwt_email
        )
    );
  end if;

  return false;
end;
$$;

revoke all on function private.can_receive_vendemas_broadcast(text, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_receive_vendemas_broadcast(text, uuid) to authenticated;

drop policy if exists "vendemas private broadcast read" on realtime.messages;
create policy "vendemas private broadcast read"
  on realtime.messages
  for select
  to authenticated
  using (
    (select private.can_receive_vendemas_broadcast(
      (select realtime.topic()),
      (select auth.uid())
    ))
  );

create or replace function private.broadcast_store_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'order_id', new.id,
      'store_id', new.store_id,
      'operation', tg_op
    ),
    'order_changed',
    'store:' || new.store_id::text || ':orders',
    true
  );

  return null;
end;
$$;

revoke all on function private.broadcast_store_order_change() from public, anon, authenticated;

drop trigger if exists orders_private_broadcast_trigger on public.orders;
create trigger orders_private_broadcast_trigger
  after insert or update
  on public.orders
  for each row
  execute function private.broadcast_store_order_change();

create or replace function private.broadcast_transport_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

drop trigger if exists transport_orders_private_broadcast_trigger on public.transport_orders;
create trigger transport_orders_private_broadcast_trigger
  after insert or update
  on public.transport_orders
  for each row
  execute function private.broadcast_transport_order_change();
