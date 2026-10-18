-- Keep manual transitions and agency delivery in the same database transaction.
create or replace function public.transition_order_status_v3(
  p_store_id uuid, p_order_id uuid, p_expected_status text, p_status text,
  p_reason text, p_actor text
) returns public.orders language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_transport_status text;
  v_entrega2_status text;
begin
  select * into v_order from public.orders
    where id = p_order_id and store_id = p_store_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido no encontrado.';
  end if;
  if p_expected_status is null or v_order.status is distinct from p_expected_status then
    raise exception using errcode = 'P0001', message = 'El pedido cambió en otro dispositivo. Actualiza antes de continuar.';
  end if;
  if p_status is null or p_status not in ('received','accepted','preparing','ready','delivering','completed','cancelled') then
    raise exception using errcode = 'P0001', message = 'Estado inválido.';
  end if;
  if v_order.status = p_status then return v_order; end if;
  if v_order.status in ('cancelled','completed') then
    raise exception using errcode = 'P0001', message = 'El pedido ya está cerrado.';
  end if;
  if p_status <> 'cancelled' and
     array_position(array['received','accepted','preparing','ready','delivering','completed'],p_status) <
     array_position(array['received','accepted','preparing','ready','delivering','completed'],v_order.status) then
    raise exception using errcode = 'P0001', message = 'El pedido no puede volver a un estado anterior.';
  end if;
  if p_status = 'delivering' and v_order.delivery_type <> 'delivery' then
    raise exception using errcode = 'P0001', message = 'En camino solo aplica a delivery.';
  end if;

  if v_order.delivery_type = 'delivery' and v_order.delivery_provider in ('transport_agency','entrega2') then
    select t.status into v_transport_status from public.transport_orders t
      where t.order_id = p_order_id
        and (v_order.transport_agency_id is null or t.agency_id = v_order.transport_agency_id)
        and t.status not in ('agency_rejected','cancelled','delivery_failed')
      order by t.updated_at desc limit 1;
    if v_transport_status is not null then
      if p_status = 'cancelled' then
        raise exception using errcode = 'P0001', message = 'Cancela primero el servicio con la empresa delivery.';
      end if;
      if p_status = 'completed' and v_transport_status <> 'delivered' then
        raise exception using errcode = 'P0001', message = 'El pedido se completará cuando la empresa confirme la entrega.';
      end if;
      if v_transport_status in ('picked_up','on_the_way','delivered') and p_status <> 'completed' then
        raise exception using errcode = 'P0001', message = 'El pedido ya está en reparto.';
      end if;
    end if;
  end if;
  if v_order.delivery_type = 'delivery' and (
    v_order.delivery_provider = 'entrega2' or
    (v_order.delivery_provider = 'transport_agency' and exists (
      select 1 from public.transport_agencies a
      where a.id = v_order.transport_agency_id and lower(a.slug) = 'entrega2'
    ))
  ) then
    select i.status into v_entrega2_status from public.order_integrations i
      where i.order_id = p_order_id and i.provider = 'entrega2' limit 1;
    if v_entrega2_status in ('sending','sent','accepted','picking_up','delivering','issue','reconcile_required') then
      if p_status in ('cancelled','completed','delivering') then
        raise exception using errcode = 'P0001', message = 'Espera la confirmación de Entrega2 o cancela primero el servicio.';
      end if;
      if v_entrega2_status = 'delivering' then
        raise exception using errcode = 'P0001', message = 'El pedido ya está en reparto.';
      end if;
    end if;
  end if;
  if p_status = 'cancelled' and v_order.delivery_status = 'delivered' then
    raise exception using errcode = 'P0001', message = 'No puedes cancelar un pedido entregado.';
  end if;
  if p_status = 'cancelled' then
    if length(trim(coalesce(p_reason, ''))) not between 3 and 306 then
      raise exception using errcode = 'P0001', message = 'Selecciona el motivo de cancelación.';
    end if;
    v_order := public.cancel_order_with_reason(p_order_id, p_store_id, trim(p_reason));
    if v_order.delivery_type = 'table' then
      update public.orders set table_cancelled_by = nullif(trim(p_actor), '')
        where id = p_order_id returning * into v_order;
    end if;
  else
    update public.orders set status = p_status
      where id = p_order_id and store_id = p_store_id returning * into v_order;
  end if;
  return v_order;
end;
$$;
revoke all on function public.transition_order_status_v3(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.transition_order_status_v3(uuid,uuid,text,text,text,text) to service_role;

-- Payment and optional auto-accept share the order lock. A courier handoff may
-- close the kitchen ticket without completing the sale yet.
create or replace function public.update_order_payment_v2(
  p_store_id uuid, p_order_id uuid, p_expected_payment_status text,
  p_payment_status text, p_fields jsonb, p_actor uuid
) returns public.orders language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_handed_off boolean;
begin
  if p_payment_status not in ('pending','review','verified','incomplete','cash_on_delivery','cancelled') then
    raise exception using errcode = 'P0001', message = 'Estado de pago inválido.';
  end if;
  select * into v_order from public.orders
    where id = p_order_id and store_id = p_store_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado.'; end if;
  if v_order.payment_status is distinct from p_expected_payment_status then
    raise exception using errcode = 'P0001', message = 'El pago cambió en otro dispositivo. Actualiza antes de continuar.';
  end if;

  v_handed_off := v_order.delivery_type = 'delivery' and (
    v_order.delivery_status in ('picked_up','on_the_way','delivering','completed','delivered')
    or exists (
      select 1 from public.transport_orders t
      where t.order_id = p_order_id
        and (v_order.transport_agency_id is null or t.agency_id = v_order.transport_agency_id)
        and (t.status in ('picked_up','on_the_way','delivered') or t.picked_up_at is not null)
    )
  );
  update public.orders set
    payment_status = p_payment_status,
    payment_reference = case when p_fields ? 'paymentReference'
      then nullif(p_fields->>'paymentReference','') else v_order.payment_reference end,
    payment_currency = case when p_fields ? 'paymentCurrency'
      then nullif(p_fields->>'paymentCurrency','') else v_order.payment_currency end,
    amount_paid = case when p_fields ? 'amountPaid'
      then nullif(p_fields->>'amountPaid','')::numeric else v_order.amount_paid end,
    payment_bank = case when p_fields ? 'paymentBank'
      then nullif(p_fields->>'paymentBank','') else v_order.payment_bank end,
    payment_notes = case when p_fields ? 'paymentNotes'
      then nullif(p_fields->>'paymentNotes','') else v_order.payment_notes end,
    payment_verified_at = case when p_payment_status = 'verified' then now() else null end,
    payment_verified_by = case when p_payment_status = 'verified' then p_actor else null end,
    status = case when p_payment_status = 'verified' and v_order.status = 'received' and not v_handed_off
      then 'accepted' else v_order.status end
    where id = p_order_id and store_id = p_store_id returning * into v_order;
  return v_order;
end;
$$;
revoke all on function public.update_order_payment_v2(uuid,uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.update_order_payment_v2(uuid,uuid,text,text,jsonb,uuid) to service_role;

-- Recheck the agency's observed state after locking the service. Both the
-- status button and driver assignment pass status_from in the event payload.
create or replace function public.mutate_transport_order_atomic(
  p_transport_order_id uuid, p_transport_payload jsonb, p_event_payload jsonb,
  p_order_delivery_status text default null, p_integration_status text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order_id uuid;
  v_current public.transport_orders%rowtype;
  v_updated public.transport_orders%rowtype;
begin
  if p_transport_order_id is null then
    raise exception using errcode = '22023', message = 'Falta el servicio delivery.';
  end if;
  select * into v_current from public.transport_orders
    where id = p_transport_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Servicio delivery no encontrado.';
  end if;
  if nullif(p_event_payload->>'status_from', '') is null
     or v_current.status is distinct from p_event_payload->>'status_from' then
    raise exception using errcode = 'P0001', message = 'El servicio cambió en otro dispositivo. Actualiza e intenta de nuevo.';
  end if;
  if v_current.status in ('delivered','cancelled','agency_rejected')
     and p_transport_payload ? 'status'
     and p_transport_payload->>'status' is distinct from v_current.status then
    raise exception using errcode = 'P0001', message = 'Este servicio ya está cerrado.';
  end if;
  v_order_id := v_current.order_id;

  update public.transport_orders as target set
    status = case when p_transport_payload ? 'status' then p_transport_payload->>'status' else target.status end,
    agency_status_note = case when p_transport_payload ? 'agency_status_note' then nullif(p_transport_payload->>'agency_status_note','') else target.agency_status_note end,
    rejection_reason = case when p_transport_payload ? 'rejection_reason' then nullif(p_transport_payload->>'rejection_reason','') else target.rejection_reason end,
    driver_id = case when p_transport_payload ? 'driver_id' then nullif(p_transport_payload->>'driver_id','')::uuid else target.driver_id end,
    driver_name_snapshot = case when p_transport_payload ? 'driver_name_snapshot' then nullif(p_transport_payload->>'driver_name_snapshot','') else target.driver_name_snapshot end,
    driver_commission_percent = case when p_transport_payload ? 'driver_commission_percent' then nullif(p_transport_payload->>'driver_commission_percent','')::numeric else target.driver_commission_percent end,
    driver_payout_usd = case when p_transport_payload ? 'driver_payout_usd' then nullif(p_transport_payload->>'driver_payout_usd','')::numeric else target.driver_payout_usd end,
    driver_assigned_at = case when p_transport_payload ? 'driver_assigned_at' then nullif(p_transport_payload->>'driver_assigned_at','')::timestamptz else target.driver_assigned_at end,
    sent_to_agency_at = case when p_transport_payload ? 'sent_to_agency_at' then coalesce(target.sent_to_agency_at,nullif(p_transport_payload->>'sent_to_agency_at','')::timestamptz) else target.sent_to_agency_at end,
    agency_received_at = case when p_transport_payload ? 'agency_received_at' then coalesce(target.agency_received_at,nullif(p_transport_payload->>'agency_received_at','')::timestamptz) else target.agency_received_at end,
    accepted_at = case when p_transport_payload ? 'accepted_at' then coalesce(target.accepted_at,nullif(p_transport_payload->>'accepted_at','')::timestamptz) else target.accepted_at end,
    rejected_at = case when p_transport_payload ? 'rejected_at' then coalesce(target.rejected_at,nullif(p_transport_payload->>'rejected_at','')::timestamptz) else target.rejected_at end,
    assigned_at = case when p_transport_payload ? 'assigned_at' then coalesce(target.assigned_at,nullif(p_transport_payload->>'assigned_at','')::timestamptz) else target.assigned_at end,
    picked_up_at = case when p_transport_payload ? 'picked_up_at' then coalesce(target.picked_up_at,nullif(p_transport_payload->>'picked_up_at','')::timestamptz) else target.picked_up_at end,
    on_the_way_at = case when p_transport_payload ? 'on_the_way_at' then coalesce(target.on_the_way_at,nullif(p_transport_payload->>'on_the_way_at','')::timestamptz) else target.on_the_way_at end,
    delivered_at = case when p_transport_payload ? 'delivered_at' then coalesce(target.delivered_at,nullif(p_transport_payload->>'delivered_at','')::timestamptz) else target.delivered_at end,
    cancelled_at = case when p_transport_payload ? 'cancelled_at' then coalesce(target.cancelled_at,nullif(p_transport_payload->>'cancelled_at','')::timestamptz) else target.cancelled_at end,
    updated_at = now()
    where target.id = p_transport_order_id returning target.* into v_updated;

  insert into public.transport_order_events (
    transport_order_id,event_type,status_from,status_to,note,actor_type,actor_user_id,actor_name
  ) values (
    p_transport_order_id,coalesce(nullif(p_event_payload->>'event_type',''),'status_changed'),
    v_current.status,nullif(p_event_payload->>'status_to',''),nullif(p_event_payload->>'note',''),
    coalesce(nullif(p_event_payload->>'actor_type',''),'system'),
    nullif(p_event_payload->>'actor_user_id','')::uuid,nullif(p_event_payload->>'actor_name','')
  );
  if v_order_id is not null and p_order_delivery_status is not null then
    update public.orders set delivery_status = p_order_delivery_status,
      transport_agency_status = coalesce(p_integration_status,v_updated.status)
      where id = v_order_id and delivery_type = 'delivery'
        and delivery_provider = 'transport_agency'
        and transport_agency_id = v_current.agency_id;
  end if;
  if v_order_id is not null and p_integration_status is not null then
    update public.order_integrations set status = p_integration_status,updated_at = now()
      where order_id = v_order_id and provider = 'transport_agency'
        and exists (select 1 from public.orders o where o.id = v_order_id
          and o.delivery_type = 'delivery' and o.delivery_provider = 'transport_agency'
          and o.transport_agency_id = v_current.agency_id);
  end if;
  return to_jsonb(v_updated);
end;
$$;
revoke all on function public.mutate_transport_order_atomic(uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.mutate_transport_order_atomic(uuid,jsonb,jsonb,text,text) to service_role;

-- A retried terminal webhook can safely reconcile a partially processed event.
-- Recheck the current provider while holding the order lock.
create or replace function public.close_entrega2_order_v2(
  p_order_id uuid, p_terminal_status text
) returns public.orders language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_agency_slug text;
begin
  if p_terminal_status not in ('cancelled','completed') then
    raise exception using errcode = 'P0001', message = 'Estado terminal inválido.';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado.'; end if;
  if v_order.transport_agency_id is not null then
    select slug into v_agency_slug from public.transport_agencies where id = v_order.transport_agency_id;
  end if;
  if v_order.delivery_type <> 'delivery' or not (
    v_order.delivery_provider = 'entrega2' or
    (v_order.delivery_provider = 'transport_agency' and lower(v_agency_slug) = 'entrega2')
  ) then
    return v_order;
  end if;
  if v_order.status in ('cancelled','completed') then return v_order; end if;
  if p_terminal_status = 'cancelled' then
    v_order := public.cancel_order_with_reason(p_order_id, v_order.store_id, 'Entrega2 canceló el delivery.');
  else
    update public.orders set status = 'completed', delivery_status = 'completed'
      where id = p_order_id returning * into v_order;
  end if;
  return v_order;
end;
$$;
revoke all on function public.close_entrega2_order_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.close_entrega2_order_v2(uuid,text) to service_role;

-- Dispatch reservations serialize with courier updates on the transport row.
-- A stale panel read cannot create or reopen a service for a closed order.
create or replace function public.guard_transport_dispatch() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  if new.order_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status not in ('pending_agency','sent_to_agency') then return new; end if;
  if tg_op = 'UPDATE' and old.status not in
     ('pending_agency','sent_to_agency','agency_rejected','cancelled','delivery_failed') then
    raise exception using errcode = 'P0001', message = 'El servicio cambió en otro dispositivo. Actualiza antes de enviarlo.';
  end if;
  select * into v_order from public.orders where id = new.order_id for update;
  if not found or v_order.status in ('cancelled','completed')
     or v_order.delivery_type <> 'delivery'
     or v_order.delivery_provider <> 'transport_agency'
     or v_order.transport_agency_id is distinct from new.agency_id then
    raise exception using errcode = 'P0001', message = 'El pedido ya no admite este envío a delivery.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_transport_dispatch() from public,anon,authenticated;
drop trigger if exists transport_dispatch_guard on public.transport_orders;
create trigger transport_dispatch_guard before insert or update of status on public.transport_orders
  for each row execute function public.guard_transport_dispatch();

-- Direct Entrega2 dispatch reserves the order before the external HTTP call.
create or replace function public.guard_entrega2_dispatch() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  if new.order_id is null or new.provider <> 'entrega2' or new.status <> 'sending' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'sending' then return new; end if;
  select * into v_order from public.orders where id = new.order_id for update;
  if not found or v_order.status in ('cancelled','completed')
     or v_order.delivery_type <> 'delivery'
     or not (v_order.delivery_provider = 'entrega2' or
       (v_order.delivery_provider = 'transport_agency' and exists (
         select 1 from public.transport_agencies a
         where a.id = v_order.transport_agency_id and lower(a.slug) = 'entrega2'
       ))) then
    raise exception using errcode = 'P0001', message = 'El pedido ya no admite este envío a Entrega2.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_entrega2_dispatch() from public,anon,authenticated;
drop trigger if exists entrega2_dispatch_guard on public.order_integrations;
create trigger entrega2_dispatch_guard before insert or update of status on public.order_integrations
  for each row execute function public.guard_entrega2_dispatch();

-- Read the actual courier status under the same lock used by agency mutations.
-- This replaces a stale two-step write from the panel after the WhatsApp link is built.
create or replace function public.sync_transport_dispatch_v1(
  p_transport_order_id uuid, p_request_payload jsonb, p_last_payload jsonb
) returns public.transport_orders language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_transport public.transport_orders%rowtype;
  v_order public.orders%rowtype;
  v_delivery_status text;
begin
  select * into v_transport from public.transport_orders
    where id = p_transport_order_id for update;
  if not found or v_transport.order_id is null then
    raise exception using errcode = 'P0002', message = 'Servicio delivery no encontrado.';
  end if;
  select * into v_order from public.orders where id = v_transport.order_id for update;
  if not found or v_order.status in ('cancelled','completed')
     or v_order.delivery_type <> 'delivery'
     or v_order.delivery_provider <> 'transport_agency'
     or v_order.transport_agency_id is distinct from v_transport.agency_id then
    raise exception using errcode = 'P0001', message = 'El pedido ya no admite este envío a delivery.';
  end if;
  v_delivery_status := case v_transport.status
    when 'pending_agency' then 'pending_agency'
    when 'sent_to_agency' then 'sent_to_agency'
    when 'agency_received' then 'agency_received'
    when 'agency_accepted' then 'accepted'
    when 'agency_rejected' then 'rejected'
    when 'driver_assigned' then 'assigned'
    when 'pickup_pending' then 'pickup_pending'
    when 'picked_up' then 'picked_up'
    when 'on_the_way' then 'delivering'
    when 'delivery_failed' then 'delivery_failed'
    when 'issue_reported' then 'issue_reported'
    when 'cancelled' then 'cancelled'
    when 'delivered' then 'delivered'
    else null end;
  insert into public.order_integrations (
    order_id,provider,external_id,status,request_payload,last_payload,last_error,updated_at
  ) values (
    v_order.id,'transport_agency','agency-' || v_order.id::text,v_transport.status,
    p_request_payload,p_last_payload,null,now()
  ) on conflict (order_id,provider) do update set
    status = excluded.status, request_payload = excluded.request_payload,
    last_payload = excluded.last_payload, last_error = null, updated_at = now();
  update public.orders set delivery_status = v_delivery_status,
    transport_agency_status = v_transport.status where id = v_order.id;
  return v_transport;
end;
$$;
revoke all on function public.sync_transport_dispatch_v1(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sync_transport_dispatch_v1(uuid,jsonb,jsonb) to service_role;

-- The transport row is locked by its existing mutation RPC. A confirmed delivery
-- closes the matching commerce order; pickup closes kitchen, but not the sale.
create or replace function public.sync_agency_delivery_to_order() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  if new.order_id is null or new.status is not distinct from old.status then return new; end if;
  if new.status not in ('picked_up','on_the_way','delivered') then return new; end if;
  select * into v_order from public.orders where id = new.order_id for update;
  if not found or v_order.delivery_type <> 'delivery'
     or v_order.delivery_provider <> 'transport_agency'
     or v_order.transport_agency_id is distinct from new.agency_id then return new; end if;

  if new.status in ('picked_up','on_the_way') then
    update public.order_kitchen_tickets set state = 'completed', closed_at = coalesce(closed_at, now()), updated_at = now()
      where order_id = new.order_id and state in ('queued','preparing','ready');
  elsif new.status = 'delivered' and v_order.status not in ('cancelled','completed') then
    update public.orders set status = 'completed', delivery_status = 'delivered'
      where id = new.order_id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_agency_delivery_to_order() from public,anon,authenticated;
drop trigger if exists transport_order_sync_delivery on public.transport_orders;
create trigger transport_order_sync_delivery after update of status on public.transport_orders
  for each row execute function public.sync_agency_delivery_to_order();

-- Direct Entrega2 webhooks advance delivery_status before the final sale
-- status. "Llevando" means the courier already took the food from Cocina.
create or replace function public.sync_entrega2_handoff_to_kitchen() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.delivery_type <> 'delivery'
     or new.delivery_status not in ('delivering','completed')
     or new.delivery_status is not distinct from old.delivery_status then return new; end if;
  if new.delivery_provider <> 'entrega2' and not (
    new.delivery_provider = 'transport_agency' and exists (
      select 1 from public.transport_agencies a
      where a.id = new.transport_agency_id and lower(a.slug) = 'entrega2'
    )
  ) then return new; end if;
  update public.order_kitchen_tickets
    set state = 'completed', closed_at = coalesce(closed_at, now()), updated_at = now()
    where order_id = new.id and state in ('queued','preparing','ready');
  return new;
end;
$$;
revoke all on function public.sync_entrega2_handoff_to_kitchen() from public,anon,authenticated;
drop trigger if exists orders_entrega2_handoff_kitchen on public.orders;
create trigger orders_entrega2_handoff_kitchen after update of delivery_status on public.orders
  for each row execute function public.sync_entrega2_handoff_to_kitchen();

notify pgrst, 'reload schema';
