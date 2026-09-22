-- Only the authorized Smash (Test) fixture, all mutations rolled back.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
do $$
declare
  o public.orders%rowtype;
  result public.orders%rowtype;
  payment text;
  next_status text;
  expected text;
begin
  select * into o from public.orders
    where store_id = '47f344a7-46f2-4871-9266-489c79361c4d' and delivery_type = 'table'
    order by created_at desc limit 1 for update;
  if not found then raise exception 'Smash Test fixture required'; end if;
  foreach payment in array array['pending','review','verified','rejected'] loop
    update public.orders set status='accepted', payment_status=payment where id=o.id;
    expected := 'accepted';
    foreach next_status in array array['preparing','ready','completed'] loop
      result := public.update_table_order_status_v2(o.store_id,o.id,expected,next_status,null,'qa');
      if result.status <> next_status or result.payment_status <> payment then raise exception 'Payment/status independence failed'; end if;
      expected := next_status;
    end loop;
  end loop;
  update public.orders set status='accepted', payment_status='pending' where id=o.id;
  begin
    perform public.update_table_order_status_v2('00000000-0000-4000-8000-000000000001',o.id,'accepted','preparing',null,'qa');
    raise exception 'FAIL cross tenant';
  exception when sqlstate 'P0002' then null; end;
  begin
    perform public.update_table_order_status_v2(o.store_id,o.id,'received','preparing',null,'qa');
    raise exception 'FAIL stale state';
  exception when others then
    if sqlerrm <> 'El pedido cambio en otro dispositivo. Actualiza antes de continuar.' then raise; end if;
  end;
  begin
    perform public.update_table_order_status_v2(o.store_id,o.id,'accepted','cancelled',null,'qa');
    raise exception 'FAIL reason';
  exception when others then
    if sqlerrm <> 'Indica el motivo de cancelacion.' then raise; end if;
  end;
  -- Existing deployments retain their original behavior.
  begin
    perform public.update_table_order_status(o.store_id,o.id,'accepted','preparing',null,'qa');
    raise exception 'FAIL old RPC changed';
  exception when others then
    if sqlerrm <> 'Verifica el pago antes de preparar o entregar el pedido.' then raise; end if;
  end;
  if has_function_privilege('authenticated','public.update_table_order_status_v2(uuid,uuid,text,text,text,text)','execute')
    or has_function_privilege('anon','public.update_table_order_status_v2(uuid,uuid,text,text,text,text)','execute') then
    raise exception 'FAIL public RPC permission';
  end if;
end $$;
rollback;
