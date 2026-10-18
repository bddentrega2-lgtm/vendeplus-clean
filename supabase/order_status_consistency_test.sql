-- Transactional QA. All synthetic rows and status changes are rolled back.
begin;
set local statement_timeout = '30s';
insert into public.stores(id,slug,name,table_orders_access_enabled,table_orders_enabled)
  values('a1000000-0000-4000-8000-000000000001','status-qa-store','Status QA',true,true);
insert into public.store_kitchen_settings(store_id,enabled,dispatch_mode)
  values('a1000000-0000-4000-8000-000000000001',true,'manual');
insert into public.transport_agencies(id,name,slug,contact_name,contact_email,contact_phone)
  values
  ('a1000000-0000-4000-8000-000000000002','QA Agency','status-qa-agency','QA','status-qa@example.invalid','0000000000'),
  ('a1000000-0000-4000-8000-000000000004','QA New Agency','status-qa-new','QA','new-qa@example.invalid','0000000002');
insert into public.transport_agencies(id,name,slug,contact_name,contact_email,contact_phone)
  select 'a1000000-0000-4000-8000-000000000003','QA Entrega2','entrega2','QA',
    'entrega2-qa@example.invalid','0000000001'
  where not exists (select 1 from public.transport_agencies where lower(slug) = 'entrega2');
insert into public.orders(id,public_code,store_id,customer_name,customer_phone,delivery_type,payment_method,status,delivery_provider,transport_agency_id,payment_status,delivery_pricing_type)
  values
  ('a1000000-0000-4000-8000-000000000011','STATUS-QA-PICKUP','a1000000-0000-4000-8000-000000000001','QA','000','pickup','Efectivo','received',null,null,'pending',null),
  ('a1000000-0000-4000-8000-000000000012','STATUS-QA-AGENCY','a1000000-0000-4000-8000-000000000001','QA','000','delivery','Efectivo','ready','transport_agency','a1000000-0000-4000-8000-000000000002','pending',null),
  ('a1000000-0000-4000-8000-000000000013','STATUS-QA-ENTREGA2','a1000000-0000-4000-8000-000000000001','QA','000','delivery','Efectivo','received','transport_agency',(select id from public.transport_agencies where lower(slug) = 'entrega2' limit 1),'pending',null),
  ('a1000000-0000-4000-8000-000000000014','STATUS-QA-TABLE','a1000000-0000-4000-8000-000000000001','QA','000','table','Efectivo','received',null,null,'pending',null),
  ('a1000000-0000-4000-8000-000000000015','STATUS-QA-BAR','a1000000-0000-4000-8000-000000000001','QA','000','pickup','Efectivo','received',null,null,'pending','bar'),
  ('a1000000-0000-4000-8000-000000000016','STATUS-QA-LATE-PAY','a1000000-0000-4000-8000-000000000001','QA','000','delivery','Efectivo','received','transport_agency','a1000000-0000-4000-8000-000000000002','pending',null),
  ('a1000000-0000-4000-8000-000000000017','STATUS-QA-OLD-AGENCY','a1000000-0000-4000-8000-000000000001','QA','000','delivery','Efectivo','received','transport_agency','a1000000-0000-4000-8000-000000000002','pending',null),
  ('a1000000-0000-4000-8000-000000000018','STATUS-QA-OWN','a1000000-0000-4000-8000-000000000001','QA','000','delivery','Efectivo','ready',null,null,'pending',null),
  ('a1000000-0000-4000-8000-000000000019','STATUS-QA-PAID-KITCHEN','a1000000-0000-4000-8000-000000000001','QA','000','table','Pago móvil','received',null,null,'pending',null),
  ('a1000000-0000-4000-8000-000000000020','STATUS-QA-DIRECT-E2','a1000000-0000-4000-8000-000000000001','QA','000','delivery','Efectivo','preparing','entrega2',null,'pending',null);
insert into public.transport_orders(id,agency_id,order_id,store_id,status)
  values
  ('a1000000-0000-4000-8000-000000000021','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000001','pending_agency'),
  ('a1000000-0000-4000-8000-000000000022','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000016','a1000000-0000-4000-8000-000000000001','pending_agency'),
  ('a1000000-0000-4000-8000-000000000023','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000017','a1000000-0000-4000-8000-000000000001','pending_agency');
insert into public.order_integrations(order_id,provider,external_id,status)
  values('a1000000-0000-4000-8000-000000000020','entrega2',
    'vendeplus_a1000000-0000-4000-8000-000000000020','sent');
insert into public.order_kitchen_tickets(order_id,store_id,state,dispatch_method)
  values('a1000000-0000-4000-8000-000000000016',
    'a1000000-0000-4000-8000-000000000001','queued','manual');

do $$
declare
  v_store uuid := 'a1000000-0000-4000-8000-000000000001';
  v_pickup uuid := 'a1000000-0000-4000-8000-000000000011';
  v_agency uuid := 'a1000000-0000-4000-8000-000000000012';
  v_entrega2 uuid := 'a1000000-0000-4000-8000-000000000013';
  v_transport uuid := 'a1000000-0000-4000-8000-000000000021';
  v_failed boolean;
begin
  -- Reserve a generic agency service, then reject a stale reservation after closure.
  perform public.sync_transport_dispatch_v1(v_transport,'{"channel":"qa"}'::jsonb,'{}'::jsonb);
  if (select delivery_status from public.orders where id=v_agency) <> 'pending_agency'
     or (select status from public.order_integrations where order_id=v_agency and provider='transport_agency') <> 'pending_agency' then
    raise exception 'Initial agency dispatch did not synchronize';
  end if;

  perform public.transition_order_status_v3(v_store,v_pickup,'received','accepted',null,'QA');
  v_failed := false;
  begin
    perform public.transition_order_status_v3(v_store,v_pickup,'received','ready',null,'QA');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Accepted a stale commerce state'; end if;
  v_failed := false;
  begin
    perform public.transition_order_status_v3(v_store,v_pickup,'accepted','delivering',null,'QA');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Pickup entered delivery state'; end if;
  perform public.transition_order_status_v3(v_store,v_pickup,'accepted','completed',null,'QA');
  v_failed := false;
  begin
    perform public.transition_order_status_v3(v_store,v_pickup,'completed','cancelled','Prueba','QA');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Completed sale was cancelled'; end if;

  v_failed := false;
  begin
    perform public.transition_order_status_v3(v_store,v_agency,'ready','completed',null,'QA');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Agency sale completed before delivery'; end if;
  perform public.mutate_transport_order_atomic(v_transport,
    '{"status":"picked_up"}'::jsonb,
    '{"event_type":"status_changed","status_from":"pending_agency","status_to":"picked_up"}'::jsonb,
    'picked_up','picked_up');
  if (select status from public.orders where id=v_agency) <> 'ready' then
    raise exception 'Pickup incorrectly completed the sale';
  end if;
  -- A panel that read pending_agency before pickup may not write it back.
  v_failed := false;
  begin
    update public.transport_orders set status='sent_to_agency' where id=v_transport;
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Stale dispatch regressed courier pickup'; end if;
  perform public.sync_transport_dispatch_v1(v_transport,'{"channel":"qa"}'::jsonb,'{}'::jsonb);
  if (select delivery_status from public.orders where id=v_agency) <> 'picked_up'
     or (select status from public.order_integrations where order_id=v_agency and provider='transport_agency') <> 'picked_up' then
    raise exception 'Dispatch synchronization regressed courier pickup';
  end if;
  if exists(select 1 from public.order_kitchen_tickets where order_id=v_agency and state in ('queued','preparing','ready')) then
    raise exception 'Kitchen remained active after courier pickup';
  end if;
  v_failed := false;
  begin
    perform public.mutate_transport_order_atomic(v_transport,
      '{"status":"delivered"}'::jsonb,
      '{"event_type":"status_changed","status_from":"pending_agency","status_to":"delivered"}'::jsonb,
      'delivered','delivered');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Stale transport state overwrote pickup'; end if;
  perform public.mutate_transport_order_atomic(v_transport,
    '{"status":"delivered"}'::jsonb,
    '{"event_type":"status_changed","status_from":"picked_up","status_to":"delivered"}'::jsonb,
    'delivered','delivered');
  if (select status from public.orders where id=v_agency) <> 'completed'
     or (select state from public.order_kitchen_tickets where order_id=v_agency) <> 'completed' then
    raise exception 'Confirmed agency delivery did not close the sale';
  end if;
  v_failed := false;
  begin
    perform public.sync_transport_dispatch_v1(v_transport,'{}'::jsonb,'{}'::jsonb);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Closed agency order was dispatched again'; end if;

  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000014','received','preparing',null,'QA');
  if (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000014') <> 'preparing' then
    raise exception 'Mesa did not reach kitchen';
  end if;
  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000014','preparing','ready',null,'QA');
  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000014','ready','completed',null,'QA');
  if (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000014') <> 'completed' then
    raise exception 'Mesa did not close kitchen';
  end if;
  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000015','received','preparing',null,'QA');
  if (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000015') <> 'preparing' then
    raise exception 'Barra did not reach kitchen';
  end if;
  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000015','preparing','completed',null,'QA');
  if (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000015') <> 'completed' then
    raise exception 'Barra did not close kitchen';
  end if;

  perform public.mutate_transport_order_atomic('a1000000-0000-4000-8000-000000000022',
    '{"status":"picked_up"}'::jsonb,
    '{"status_from":"pending_agency","status_to":"picked_up"}'::jsonb,
    'picked_up','picked_up');
  perform public.update_order_payment_v2(v_store,'a1000000-0000-4000-8000-000000000016',
    'pending','verified','{}'::jsonb,null);
  if (select status from public.orders where id='a1000000-0000-4000-8000-000000000016') <> 'received'
     or (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000016') <> 'completed' then
    raise exception 'Late payment reopened kitchen after courier pickup';
  end if;
  v_failed := false;
  begin
    perform public.update_order_payment_v2(v_store,'a1000000-0000-4000-8000-000000000016',
      'pending','review','{}'::jsonb,null);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Stale payment update was accepted'; end if;

  update public.orders set transport_agency_id='a1000000-0000-4000-8000-000000000004'
    where id='a1000000-0000-4000-8000-000000000017';
  perform public.mutate_transport_order_atomic('a1000000-0000-4000-8000-000000000023',
    '{"status":"delivered"}'::jsonb,
    '{"status_from":"pending_agency","status_to":"delivered"}'::jsonb,
    'delivered','delivered');
  if (select status from public.orders where id='a1000000-0000-4000-8000-000000000017') <> 'received'
     or (select delivery_status from public.orders where id='a1000000-0000-4000-8000-000000000017') = 'delivered' then
    raise exception 'Old agency changed current commerce order';
  end if;
  v_failed := false;
  begin
    insert into public.transport_orders(id,agency_id,order_id,store_id,status)
      values('a1000000-0000-4000-8000-000000000024',
        'a1000000-0000-4000-8000-000000000002',
        'a1000000-0000-4000-8000-000000000017',v_store,'pending_agency');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Previous agency was dispatched after provider switch'; end if;
  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000017',
    'received','cancelled','Prueba cancelacion','QA');
  if (select status from public.orders where id='a1000000-0000-4000-8000-000000000017') <> 'cancelled' then
    raise exception 'Commerce could not resolve cancelled agency service';
  end if;
  v_failed := false;
  begin
    perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000020',
      'preparing','completed',null,'QA');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Commerce completed active Entrega2 delivery'; end if;
  update public.orders set delivery_status='delivering'
    where id='a1000000-0000-4000-8000-000000000020';
  if (select status from public.orders where id='a1000000-0000-4000-8000-000000000020') <> 'preparing'
     or (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000020') <> 'completed' then
    raise exception 'Direct Entrega2 handoff did not close kitchen independently of sale';
  end if;
  update public.order_integrations set status='delivering'
    where order_id='a1000000-0000-4000-8000-000000000020' and provider='entrega2';
  v_failed := false;
  begin
    perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000020',
      'preparing','ready',null,'QA');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Commerce changed preparation after Entrega2 pickup'; end if;
  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000018','ready','delivering',null,'QA');
  if (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000018') <> 'completed' then
    raise exception 'Own delivery handoff did not close kitchen';
  end if;
  perform public.transition_order_status_v3(v_store,'a1000000-0000-4000-8000-000000000018','delivering','completed',null,'QA');

  update public.store_kitchen_settings set dispatch_mode='paid' where store_id=v_store;
  perform public.update_order_payment_v2(v_store,'a1000000-0000-4000-8000-000000000019',
    'pending','verified','{"paymentReference":"123456"}'::jsonb,null);
  if (select status from public.orders where id='a1000000-0000-4000-8000-000000000019') <> 'accepted'
     or (select state from public.order_kitchen_tickets where order_id='a1000000-0000-4000-8000-000000000019') <> 'queued'
     or (select payment_reference from public.orders where id='a1000000-0000-4000-8000-000000000019') <> '123456' then
    raise exception 'Verified payment did not accept and dispatch Mesa to kitchen';
  end if;

  perform public.close_entrega2_order_v2(v_entrega2,'cancelled');
  if (select status from public.orders where id=v_entrega2) <> 'cancelled' then
    raise exception 'Entrega2 cancellation did not close the sale';
  end if;
  perform public.close_entrega2_order_v2(v_entrega2,'completed');
  if (select status from public.orders where id=v_entrega2) <> 'cancelled' then
    raise exception 'Terminal replay reopened a cancelled sale';
  end if;
  v_failed := false;
  begin
    insert into public.order_integrations(order_id,provider,external_id,status)
      values(v_entrega2,'entrega2','qa-closed-entrega2','sending')
      on conflict (order_id,provider) do update set status='sending';
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Closed Entrega2 order was dispatched again'; end if;
  if (select count(*) from public.orders where store_id=v_store) <> 10 then
    raise exception 'Unexpected fixture mutation';
  end if;
end;
$$;
rollback;
