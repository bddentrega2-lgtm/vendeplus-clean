-- Optional kitchen workflow. Existing order/payment/fee operations remain independent.
create table public.store_kitchen_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  enabled boolean not null default false,
  dispatch_mode text not null default 'manual' check (dispatch_mode in ('manual','paid')),
  updated_at timestamptz not null default now()
);
create table public.order_kitchen_tickets (
  order_id uuid primary key references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  state text not null default 'queued' check (state in ('queued','preparing','ready','completed','cancelled')),
  sent_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz,
  closed_at timestamptz,
  dispatched_by text,
  dispatch_method text not null check (dispatch_method in ('manual','paid','order_status')),
  payment_at_dispatch text,
  last_actor text,
  updated_at timestamptz not null default now()
);
create index kitchen_active_store_idx on public.order_kitchen_tickets(store_id,sent_at,order_id)
  where state in ('queued','preparing','ready');
alter table public.store_kitchen_settings enable row level security;
alter table public.order_kitchen_tickets enable row level security;
revoke all on public.store_kitchen_settings, public.order_kitchen_tickets from public, anon, authenticated;
grant all on public.store_kitchen_settings, public.order_kitchen_tickets to service_role;

create function public.sync_order_kitchen() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_settings public.store_kitchen_settings%rowtype;
begin
  select k.* into v_settings from public.store_kitchen_settings k join public.stores s on s.id=k.store_id
    where k.store_id=new.store_id and k.enabled and s.table_orders_access_enabled and s.table_orders_enabled;
  if found and new.delivery_type in ('delivery','pickup','table') and new.status not in ('completed','cancelled','delivering') then
    if (new.payment_status='verified' and v_settings.dispatch_mode='paid'
        and (tg_op='INSERT' or old.payment_status is distinct from 'verified'))
      or (new.status in ('preparing','ready') and (tg_op='INSERT' or old.status is distinct from new.status)) then
      insert into public.order_kitchen_tickets(order_id,store_id,state,started_at,ready_at,dispatch_method,dispatched_by,payment_at_dispatch)
        values(new.id,new.store_id,case when new.status in ('preparing','ready') then new.status else 'queued' end,
          case when new.status='preparing' then now() end,case when new.status='ready' then now() end,
          case when new.status in ('preparing','ready') then 'order_status' else 'paid' end,
          new.payment_verified_by::text,new.payment_status)
        on conflict(order_id) do nothing;
    end if;
  end if;
  if tg_op='INSERT' or old.status is distinct from new.status then
    update public.order_kitchen_tickets set
      state=case when new.status in ('completed','cancelled') then new.status
        when new.status='delivering' then 'completed' when new.status='ready' then 'ready'
        when new.status='preparing' then 'preparing' else 'queued' end,
      started_at=case when new.status in ('received','accepted') then null
        when new.status='preparing' then coalesce(started_at,now()) else started_at end,
      ready_at=case when new.status in ('received','accepted','preparing') then null
        when new.status='ready' then coalesce(ready_at,now()) else ready_at end,
      closed_at=case when new.status in ('completed','cancelled','delivering') then coalesce(closed_at,now()) else null end,
      updated_at=now()
    where order_id=new.id and store_id=new.store_id;
  end if;
  return new;
end $$;
revoke all on function public.sync_order_kitchen() from public,anon,authenticated;
create trigger orders_sync_kitchen after insert or update of status,payment_status on public.orders
  for each row execute function public.sync_order_kitchen();

create function public.operate_kitchen_order(p_store_id uuid,p_order_id uuid,p_action text,p_expected_state text,p_actor text)
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
    insert into public.order_kitchen_tickets(order_id,store_id,state,started_at,ready_at,dispatch_method,dispatched_by,payment_at_dispatch,last_actor)
    values(p_order_id,p_store_id,case when v_order.status in ('preparing','ready') then v_order.status else 'queued' end,
      case when v_order.status='preparing' then now() end,case when v_order.status='ready' then now() end,
      'manual',left(p_actor,120),v_order.payment_status,left(p_actor,120)) on conflict(order_id) do nothing;
  else
    select * into v_ticket from public.order_kitchen_tickets where order_id=p_order_id and store_id=p_store_id for update;
    if not found then raise exception 'Primero envia el pedido a cocina.'; end if;
    -- Retried acknowledgements are harmless, but stale transitions cannot regress a ticket.
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

create function public.broadcast_kitchen_change() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('store_id',new.store_id), 'kitchen_changed',
    'store:' || new.store_id::text || ':orders',true);
  return new;
end $$;
revoke all on function public.broadcast_kitchen_change() from public,anon,authenticated;
create trigger kitchen_ticket_broadcast after insert or update on public.order_kitchen_tickets
  for each row execute function public.broadcast_kitchen_change();
create trigger kitchen_settings_broadcast after insert or update on public.store_kitchen_settings
  for each row execute function public.broadcast_kitchen_change();

notify pgrst,'reload schema';
