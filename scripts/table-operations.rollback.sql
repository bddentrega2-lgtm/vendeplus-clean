-- Run as one transaction, in a staging database with at least one table order.
-- Every data mutation, including broadcasts and inventory movements, is rolled back.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
do $$
declare
  o public.orders%rowtype;
  result public.orders%rowtype;
  c public.table_waiter_calls%rowtype;
  again public.table_waiter_calls%rowtype;
  v_table_id uuid;
  next_status text;
  other_store uuid;
begin
  select * into o from public.orders where delivery_type = 'table' and status <> 'cancelled' order by created_at limit 1 for update;
  if not found then raise exception 'Fixture required: a non-cancelled table order'; end if;
  select id into other_store from public.stores where id <> o.store_id limit 1;
  update public.orders set status='received', payment_status='pending' where id=o.id;
  begin
    perform public.update_table_order_status(other_store,o.id,'received','accepted',null,'qa');
    raise exception 'FAIL: cross-tenant access';
  exception when sqlstate 'P0002' then null; end;
  result := public.update_table_order_status(o.store_id,o.id,'received','accepted',null,'qa');
  if result.status <> 'accepted' then raise exception 'FAIL: acceptance'; end if;
  begin
    perform public.update_table_order_status(o.store_id,o.id,'received','preparing',null,'qa');
    raise exception 'FAIL: stale state accepted';
  exception when others then
    if sqlerrm <> 'El pedido cambio en otro dispositivo. Actualiza antes de continuar.' then raise; end if;
  end;
  foreach next_status in array array['preparing','ready','delivering','completed'] loop
    begin
      perform public.update_table_order_status(o.store_id,o.id,'accepted',next_status,null,'qa');
      raise exception 'FAIL: unpaid preparation/delivery';
    exception when others then
      if sqlerrm <> 'Verifica el pago antes de preparar o entregar el pedido.' then raise; end if;
    end;
  end loop;
  update public.orders set payment_status='verified' where id=o.id;
  result := public.update_table_order_status(o.store_id,o.id,'accepted','preparing',null,'qa');
  if result.status <> 'preparing' then raise exception 'FAIL: paid preparation'; end if;
  begin
    perform public.update_table_order_status(o.store_id,o.id,'preparing','cancelled',null,'qa');
    raise exception 'FAIL: cancellation without reason';
  exception when others then
    if sqlerrm <> 'Indica el motivo de cancelacion.' then raise; end if;
  end;
  result := public.update_table_order_status(o.store_id,o.id,'preparing','cancelled','Pedido duplicado','qa');
  if result.status <> 'cancelled' or result.table_cancellation_reason <> 'Pedido duplicado'
     or result.table_cancelled_at is null or result.table_cancelled_by <> 'qa' then raise exception 'FAIL: cancellation audit'; end if;
  if exists(select 1 from public.order_item_inventory_allocations where order_id=o.id and status='allocated') then
    raise exception 'FAIL: inventory not released';
  end if;
  perform public.update_table_order_status(o.store_id,o.id,'cancelled','cancelled','Otro','second actor');
  select * into result from public.orders where id=o.id;
  if result.table_cancelled_by <> 'qa' then raise exception 'FAIL: duplicate cancellation overwrote audit'; end if;
  begin
    perform public.update_table_order_status(o.store_id,o.id,'cancelled','received',null,'qa');
    raise exception 'FAIL: reopening cancelled order';
  exception when others then
    if sqlerrm <> 'El pedido ya esta cerrado.' then raise; end if;
  end;

  select id into v_table_id from public.store_tables where store_id=o.store_id limit 1;
  if v_table_id is null then raise exception 'Fixture required: a table'; end if;
  update public.store_tables set is_enabled=true where id=v_table_id;
  update public.stores set is_active=true, table_orders_access_enabled=true, table_orders_enabled=true,
    table_waiter_calls_enabled=false, table_order_fulfillment_mode='table_service' where id=o.store_id;
  begin
    perform public.request_table_waiter(o.store_id,v_table_id);
    raise exception 'FAIL: waiter feature disabled';
  exception when others then
    if sqlerrm <> 'La llamada al mesero no esta disponible.' then raise; end if;
  end;
  update public.stores set table_waiter_calls_enabled=true where id=o.store_id;
  delete from public.table_waiter_calls where table_id=v_table_id and store_id=o.store_id;
  c := public.request_table_waiter(o.store_id,v_table_id);
  again := public.request_table_waiter(o.store_id,v_table_id);
  if c.requested_at <> again.requested_at or again.resolved_at is not null then raise exception 'FAIL: duplicate waiter call'; end if;
  update public.table_waiter_calls set resolved_at=now(), resolved_by='qa' where store_id=o.store_id;
  begin
    perform public.request_table_waiter(o.store_id,v_table_id);
    raise exception 'FAIL: waiter cooldown';
  exception when others then
    if sqlerrm <> 'Espera unos segundos antes de volver a llamar.' then raise; end if;
  end;
  update public.stores set table_order_fulfillment_mode='counter_pickup' where id=o.store_id;
  begin
    perform public.request_table_waiter(o.store_id,v_table_id);
    raise exception 'FAIL: waiter at counter';
  exception when others then
    if sqlerrm <> 'La llamada al mesero no esta disponible.' then raise; end if;
  end;
  if has_function_privilege('anon','public.request_table_waiter(uuid,uuid)','execute')
    or has_function_privilege('authenticated','public.update_table_order_status(uuid,uuid,text,text,text,text)','execute') then
    raise exception 'FAIL: public function permission';
  end if;
end $$;
rollback;
select 'Table operations assertions passed; all changes rolled back' as result;
