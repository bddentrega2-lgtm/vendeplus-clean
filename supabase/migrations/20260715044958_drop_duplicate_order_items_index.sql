-- Supabase advisor reported this as a duplicate of idx_order_items_order_id.
-- Keep the historical index and remove the newer duplicate created by the
-- performance pass.

drop index if exists public.order_items_order_id_idx;
