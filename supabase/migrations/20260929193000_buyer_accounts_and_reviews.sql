begin;

create table public.buyer_order_accounts (
  order_id uuid primary key references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (order_id, store_id, buyer_user_id)
);
create index buyer_order_accounts_history_idx on public.buyer_order_accounts (buyer_user_id, created_at desc, order_id desc);
alter table public.buyer_order_accounts enable row level security;
revoke all on public.buyer_order_accounts from anon, authenticated;
grant all on public.buyer_order_accounts to service_role;

create table public.buyer_store_reviews (
  order_id uuid primary key,
  store_id uuid not null,
  buyer_user_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, store_id, buyer_user_id) references public.buyer_order_accounts(order_id, store_id, buyer_user_id) on delete cascade
);
create index buyer_store_reviews_store_idx on public.buyer_store_reviews (store_id);
alter table public.buyer_store_reviews enable row level security;
revoke all on public.buyer_store_reviews from anon, authenticated;
grant all on public.buyer_store_reviews to service_role;

-- Wrap the existing inventory/order transaction; never claim a guest order on replay.
create function public.create_buyer_order_atomic(p_order jsonb, p_items jsonb, p_buyer_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  result jsonb;
  saved_id uuid;
  saved_store uuid;
begin
  if p_buyer_id is null or not exists(select 1 from auth.users where id = p_buyer_id) then
    raise exception 'Invalid buyer';
  end if;
  result := public.create_order_atomic(p_order, p_items);
  saved_id := (result->'order'->>'id')::uuid;
  saved_store := (result->'order'->>'store_id')::uuid;
  if coalesce((result->>'idempotent_replay')::boolean, false) then
    if not exists(select 1 from public.buyer_order_accounts where order_id = saved_id and store_id = saved_store and buyer_user_id = p_buyer_id) then
      raise exception 'Buyer order ownership mismatch';
    end if;
  else
    insert into public.buyer_order_accounts(order_id, store_id, buyer_user_id) values (saved_id, saved_store, p_buyer_id);
  end if;
  return result;
end;
$$;
revoke all on function public.create_buyer_order_atomic(jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_buyer_order_atomic(jsonb, jsonb, uuid) to service_role;

create function public.save_buyer_store_review(p_order_id uuid, p_buyer_id uuid, p_rating integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_store uuid;
  target_status text;
begin
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Invalid rating'; end if;
  select o.store_id, o.status into target_store, target_status
    from public.orders o join public.buyer_order_accounts b on b.order_id = o.id and b.store_id = o.store_id
    where o.id = p_order_id and b.buyer_user_id = p_buyer_id for update of o;
  if target_store is null or target_status <> 'completed' then raise exception 'Review not allowed'; end if;
  if exists(select 1 from public.store_users su
    where su.store_id = target_store and su.user_id = p_buyer_id) then
    raise exception 'Review not allowed';
  end if;
  insert into public.buyer_store_reviews(order_id, store_id, buyer_user_id, rating)
    values(p_order_id, target_store, p_buyer_id, p_rating)
    on conflict(order_id) do update set rating = excluded.rating, updated_at = now()
    where buyer_store_reviews.buyer_user_id = p_buyer_id;
end;
$$;
revoke all on function public.save_buyer_store_review(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.save_buyer_store_review(uuid, uuid, integer) to service_role;

create function public.buyer_store_rating_summaries(p_store_ids uuid[])
returns table(store_id uuid, average numeric, count bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.store_id, round(avg(r.rating)::numeric, 1), count(*)
  from public.buyer_store_reviews r join public.orders o on o.id = r.order_id and o.store_id = r.store_id
  where r.store_id = any(p_store_ids[1:500]) and o.status = 'completed'
  group by r.store_id;
$$;
revoke all on function public.buyer_store_rating_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.buyer_store_rating_summaries(uuid[]) to service_role;

commit;
