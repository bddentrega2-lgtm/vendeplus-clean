-- Deploy server-side storefront reads before applying this to production.
revoke select on table public.stores from public, anon, authenticated;

do $$
declare
  columns_sql text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
    into columns_sql
    from pg_attribute
   where attrelid = 'public.stores'::regclass
     and attnum > 0 and not attisdropped;
  execute 'revoke select (' || columns_sql || ') on public.stores from public, anon, authenticated';
end;
$$;

grant select (
  id, slug, name, description, address, latitude, longitude, whatsapp,
  cover_image_url, logo_url, is_active, accepts_delivery, accepts_pickup,
  created_at, business_type, opening_hours, delivery_estimate, pickup_estimate,
  payment_methods, usd_to_bs, whatsapp_message_note, primary_color, accent_color,
  button_text_color, payment_details, base_currency, exchange_rate_source,
  exchange_rate_updated_at, location_link, business_hours, manual_open_status,
  manual_open_note, show_prices_in_bs, auto_update_exchange_rate,
  service_fee_payer, accepts_national_shipping, updated_at,
  table_orders_enabled, table_payment_methods, table_order_fulfillment_mode,
  request_customer_id_number, marketplace_visible, checkout_note_placeholder,
  city_id, payment_proof_mode, payment_proof_required, catalog_layout,
  table_waiter_calls_enabled, table_waiter_call_label
) on public.stores to anon, authenticated;

notify pgrst, 'reload schema';
