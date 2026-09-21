create or replace function public.refresh_customer_product_metrics(p_store_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  with raw_phones as (
    select
      orders.id,
      regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9]', '', 'g') as digits
    from public.orders
    where orders.customer_phone_normalized is null
      and orders.customer_phone is not null
      and (p_store_ids is null or orders.store_id = any(p_store_ids))
  ),
  normalized_phones as (
    select
      id,
      case
        when digits like '00%' then substring(digits from 3)
        when length(digits) = 11 and digits like '0%' then '58' || substring(digits from 2)
        when length(digits) = 10 and digits like '4%' then '58' || digits
        else digits
      end as phone_normalized
    from raw_phones
    where digits <> ''
  )
  update public.orders
  set customer_phone_normalized = normalized_phones.phone_normalized
  from normalized_phones
  where orders.id = normalized_phones.id;

  update public.orders
  set customer_id = customers.id
  from public.customers
  where orders.store_id = customers.store_id
    and orders.customer_phone_normalized = customers.phone_normalized
    and orders.customer_id is distinct from customers.id
    and (p_store_ids is null or orders.store_id = any(p_store_ids));

  with eligible_customers as (
    select customers.id, customers.store_id, customers.phone_normalized
    from public.customers
    where p_store_ids is null or customers.store_id = any(p_store_ids)
  ),
  valid_orders as (
    select
      eligible_customers.id as customer_id,
      orders.id,
      orders.created_at,
      orders.payment_method,
      orders.delivery_type,
      orders.delivery_reference,
      coalesce(
        orders.subtotal_usd,
        greatest(coalesce(orders.total_usd, 0) - coalesce(orders.delivery_usd, 0), 0)
      )::numeric as product_value_usd
    from eligible_customers
    join public.orders
      on orders.store_id = eligible_customers.store_id
     and (
       orders.customer_id = eligible_customers.id
       or (
         orders.customer_id is null
         and eligible_customers.phone_normalized is not null
         and orders.customer_phone_normalized = eligible_customers.phone_normalized
       )
     )
    where lower(coalesce(orders.status, '')) not in ('cancelled', 'canceled', 'cancelado')
  ),
  order_metrics as (
    select
      customer_id,
      count(*)::integer as orders_count,
      coalesce(sum(product_value_usd), 0)::numeric as product_value_usd,
      (array_agg(id order by created_at desc, id desc))[1] as last_order_id,
      max(created_at) as last_order_at,
      mode() within group (order by payment_method) filter (where nullif(payment_method, '') is not null) as preferred_payment_method,
      mode() within group (order by delivery_type) filter (where nullif(delivery_type, '') is not null) as preferred_fulfillment,
      mode() within group (order by delivery_reference) filter (where nullif(delivery_reference, '') is not null) as frequent_address
    from valid_orders
    group by customer_id
  ),
  product_totals as (
    select
      valid_orders.customer_id,
      case
        when nullif(order_items.variant_name, '') is not null
          then order_items.product_name || ' (' || order_items.variant_name || ')'
        else order_items.product_name
      end as product_name,
      coalesce(sum(order_items.quantity), 0)::numeric as quantity,
      count(distinct valid_orders.id)::integer as orders
    from valid_orders
    join public.order_items on order_items.order_id = valid_orders.id
    group by valid_orders.customer_id, 2
  ),
  ranked_products as (
    select *, row_number() over (partition by customer_id order by quantity desc, product_name) as position
    from product_totals
  ),
  favorite_products as (
    select
      customer_id,
      jsonb_agg(
        jsonb_build_object('name', product_name, 'quantity', quantity, 'orders', orders)
        order by quantity desc, product_name
      ) as products
    from ranked_products
    where position <= 5
    group by customer_id
  ),
  refreshed as (
    select
      eligible_customers.id,
      coalesce(order_metrics.orders_count, 0) as orders_count,
      coalesce(order_metrics.product_value_usd, 0) as product_value_usd,
      order_metrics.last_order_id,
      order_metrics.last_order_at,
      order_metrics.preferred_payment_method,
      order_metrics.preferred_fulfillment,
      order_metrics.frequent_address,
      coalesce(favorite_products.products, '[]'::jsonb) as favorite_products
    from eligible_customers
    left join order_metrics on order_metrics.customer_id = eligible_customers.id
    left join favorite_products on favorite_products.customer_id = eligible_customers.id
  )
  update public.customers
  set
    orders_count = refreshed.orders_count,
    total_spent_usd = refreshed.product_value_usd,
    average_ticket_usd = case
      when refreshed.orders_count > 0 then refreshed.product_value_usd / refreshed.orders_count
      else 0
    end,
    last_order_id = refreshed.last_order_id,
    last_order_at = refreshed.last_order_at,
    preferred_payment_method = refreshed.preferred_payment_method,
    preferred_fulfillment = refreshed.preferred_fulfillment,
    frequent_address = refreshed.frequent_address,
    favorite_products = refreshed.favorite_products,
    updated_at = now()
  from refreshed
  where customers.id = refreshed.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.refresh_customer_product_metrics(uuid[]) from public, anon, authenticated;
grant execute on function public.refresh_customer_product_metrics(uuid[]) to service_role;

select public.refresh_customer_product_metrics(null);

comment on function public.refresh_customer_product_metrics(uuid[]) is
  'Rebuilds customer order counts and product value from non-cancelled orders, excluding delivery.';
