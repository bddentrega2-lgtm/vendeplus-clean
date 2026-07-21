-- Cancel the unlaunched Rapidito pilot and restore simple fixed distance ranges.
-- The existing agency-level distance_factor_usd remains available for one
-- optional per-kilometre surcharge beyond the final configured range.
delete from public.transport_agencies
where slug = 'despachos-rapidito';

alter table public.transport_agency_distance_rates
  drop constraint if exists transport_agency_distance_rates_calculation_type_check;

alter table public.transport_agency_distance_rates
  drop column if exists calculation_type;
