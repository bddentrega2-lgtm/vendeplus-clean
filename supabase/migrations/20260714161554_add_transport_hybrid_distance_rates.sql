-- Existing distance ranges remain fixed. New hybrid agencies can mix fixed
-- brackets with cumulative per-kilometre brackets without changing old data.
alter table public.transport_agency_distance_rates
  add column if not exists calculation_type text not null default 'fixed';

alter table public.transport_agency_distance_rates
  drop constraint if exists transport_agency_distance_rates_calculation_type_check;

alter table public.transport_agency_distance_rates
  add constraint transport_agency_distance_rates_calculation_type_check
  check (calculation_type in ('fixed', 'incremental_per_km'));

comment on column public.transport_agency_distance_rates.calculation_type is
  'fixed charges fee_usd for the bracket; incremental_per_km adds fee_usd for each kilometre within the bracket to prior brackets.';

-- Seed the new provider as inactive so preview can be reviewed without exposing
-- it to merchants before its contact information and account are completed.
do $$
declare
  rapidito_id uuid;
begin
  insert into public.transport_agencies (
    name,
    slug,
    legal_name,
    contact_name,
    contact_email,
    contact_phone,
    coverage_notes,
    modality,
    pricing_type,
    status,
    is_active,
    billing_currency,
    rates_visibility
  )
  values (
    'Despachos Rapidito',
    'despachos-rapidito',
    'Despachos Rapidito',
    'Por completar',
    'pendiente@despachos-rapidito.invalid',
    'Por completar',
    'Tarifa progresiva por distancia. Pendiente completar contacto, ciudad y WhatsApp antes de activar.',
    'mixed',
    'distance_ranges',
    'pending',
    false,
    'USD',
    'private'
  )
  on conflict (slug) do update set
    pricing_type = excluded.pricing_type,
    status = 'pending',
    is_active = false,
    rates_visibility = 'private',
    updated_at = now()
  returning id into rapidito_id;

  insert into public.transport_agency_rates (
    agency_id,
    flat_fee_usd,
    max_distance_km,
    is_active,
    updated_at
  )
  values (rapidito_id, 0, 100, true, now())
  on conflict (agency_id) do update set
    max_distance_km = excluded.max_distance_km,
    is_active = true,
    updated_at = now();

  delete from public.transport_agency_distance_rates
  where agency_id = rapidito_id;

  insert into public.transport_agency_distance_rates (
    agency_id, min_km, max_km, fee_usd, calculation_type, sort_order, is_active
  ) values
    (rapidito_id, 0.00, 1.00, 1.50, 'fixed', 1, true),
    (rapidito_id, 1.01, 3.00, 2.00, 'fixed', 2, true),
    (rapidito_id, 3.01, 5.50, 0.70, 'incremental_per_km', 3, true),
    (rapidito_id, 5.51, 7.50, 0.60, 'incremental_per_km', 4, true),
    (rapidito_id, 7.51, 9.50, 0.55, 'incremental_per_km', 5, true),
    (rapidito_id, 9.51, 11.00, 0.50, 'incremental_per_km', 6, true),
    (rapidito_id, 11.01, null, 0.45, 'incremental_per_km', 7, true);
end
$$;
