-- Drop duplicate indexes detected by Supabase advisors.
-- The original indexes from 20260708120000 already cover these access patterns.

drop index if exists public.transport_agency_zones_active_sort_idx;
drop index if exists public.transport_agency_distance_rates_active_sort_idx;
