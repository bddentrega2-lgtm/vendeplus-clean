-- Keep payment, order and kitchen operations aligned without adding food-only states.
alter table public.store_kitchen_settings
  add column if not exists delay_alerts_enabled boolean not null default false;

create or replace function public.operate_kitchen_order(p_store_id uuid,p_order_id uuid,p_action text,p_expected_state text,p_actor text)
returns public.order_kitchen_tickets language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_ticket public.order_kitchen_tickets%rowtype;
begin
  if not exists(select 1 from public.stores s join public.store_kitchen_settings k on k.store_id=s.id
    where s.id=p_store_id and s.table_orders_access_enabled and s.table_orders_enabled and k.enabled) then
    raise exception 'Cocina no esta activa para este comercio.';
  end if;
  if p_action is null or p_action not in ('send','prepare','ready') then raise exception 'Accion de cocina invalida.'; end if;
  select * into v_order from public.orders where id=p_order_id and store_id=p_store_id for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.delivery_type not in ('delivery','pickup','table') or v_order.status in ('completed','cancelled','delivering') then
    raise exception 'El pedido ya no admite cambios en cocina.';
  end if;
  if exists(select 1 from public.transport_orders where order_id=p_order_id
    and (status in ('picked_up','on_the_way','delivered','delivery_failed') or picked_up_at is not null)) then
    raise exception 'El pedido ya esta en reparto.';
  end if;
  if p_action='send' then
    if v_order.status='received' then
      update public.orders set status='accepted' where id=p_order_id and store_id=p_store_id and status='received';
      v_order.status := 'accepted';
    end if;
    insert into public.order_kitchen_tickets(order_id,store_id,state,started_at,ready_at,dispatch_method,dispatched_by,payment_at_dispatch,last_actor)
    values(p_order_id,p_store_id,case when v_order.status in ('preparing','ready') then v_order.status else 'queued' end,
      case when v_order.status='preparing' then now() end,case when v_order.status='ready' then now() end,
      'manual',left(p_actor,120),v_order.payment_status,left(p_actor,120)) on conflict(order_id) do nothing;
  else
    select * into v_ticket from public.order_kitchen_tickets where order_id=p_order_id and store_id=p_store_id for update;
    if not found then raise exception 'Primero envia el pedido a cocina.'; end if;
    if (p_action='prepare' and v_ticket.state='preparing') or (p_action='ready' and v_ticket.state='ready') then return v_ticket; end if;
    if p_expected_state is null or v_ticket.state is distinct from p_expected_state then raise exception 'La comanda cambio. Actualiza e intenta nuevamente.'; end if;
    if not ((p_action='prepare' and v_ticket.state='queued') or (p_action='ready' and v_ticket.state='preparing')) then
      raise exception 'Transicion de cocina invalida.';
    end if;
    update public.orders set status=case when p_action='prepare' then 'preparing' else 'ready' end
      where id=p_order_id and store_id=p_store_id;
    update public.order_kitchen_tickets set last_actor=left(p_actor,120) where order_id=p_order_id and store_id=p_store_id;
  end if;
  select * into v_ticket from public.order_kitchen_tickets where order_id=p_order_id and store_id=p_store_id;
  return v_ticket;
end $$;
revoke all on function public.operate_kitchen_order(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.operate_kitchen_order(uuid,uuid,text,text,text) to service_role;

notify pgrst,'reload schema';
