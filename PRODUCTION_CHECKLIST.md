# Vende+ Production Checklist

## 1. Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOUNDER_EMAILS`
- `ENTREGA2_API_BASE_URL` when Entrega2 is enabled
- `ENTREGA2_API_KEY` when Entrega2 is enabled
- `ENTREGA2_WEBHOOK_SECRET` when Entrega2 webhooks are enabled
- `NEXT_PUBLIC_ALLOW_DEMO_FALLBACKS=false` or unset in production

## 2. Supabase

- Apply every migration in `supabase/migrations`.
- Confirm the base schema already has `stores`, `categories`, `products`, `product_variants`, `orders`, and `order_items`.
- Run Supabase advisors before launch.
- Confirm RLS is enabled on public tables.
- Confirm `customers`, `order_integrations`, and `order_item_options` are not exposed to `anon` or `authenticated`.
- Confirm public read access works for active stores, products, delivery settings, zones, rates, option groups, and option values.
- Create the `product-images` storage bucket and make public read URLs work.

## 3. Critical Flows

- Public catalog loads on a 3G-throttled mobile browser.
- Product with variants can be added to cart.
- Product with required options cannot be added without a valid selection.
- Checkout with pickup creates an order.
- Checkout with delivery by zone creates an order.
- Checkout with delivery by distance works with GPS without loading the map.
- Checkout with delivery by distance works after loading/tapping the map.
- Server recalculates price and rejects stale or invalid products/options.
- WhatsApp opens with a complete order message.
- Panel user sees only assigned stores.
- Founder admin sees all stores and assignments.
- Payment status can be marked verified.
- Entrega2 order send works in staging before enabling in production.

## 4. Performance

- Uploaded product/cover images should be WebP/JPG/PNG and below 2 MB after browser compression.
- Prefer list view for dense catalogs.
- Test with Chrome DevTools network throttling set to slow 3G.
- Avoid forcing map load in checkout unless the customer needs to adjust the point.

## 5. Release Gates

- `npm.cmd run lint`
- `npm.cmd run build`
- Verify there are no unexpected demo fallbacks in production logs.
- Verify no uncommitted generated logs are included in deploy.
