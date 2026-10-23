-- Active agencies remain discoverable, but operational and payment fields are private.
revoke select on table public.transport_agencies from public, anon, authenticated;

do $$
declare
  columns_sql text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
    into columns_sql
    from pg_attribute
   where attrelid = 'public.transport_agencies'::regclass
     and attnum > 0 and not attisdropped;
  execute 'revoke select (' || columns_sql || ') on public.transport_agencies from public, anon, authenticated';
end;
$$;

grant select (
  id, name, slug, city, state, coverage_notes, logo_url,
  banner_image_url, marketplace_primary_color, marketplace_accent_color,
  status, is_active, rates_visibility
) on public.transport_agencies to anon, authenticated;

-- Connected merchants obtain private rates through the authorized server API.
-- Direct public reads must honor the agency's own visibility setting.
drop policy if exists "Public can read active transport agency rates" on public.transport_agency_rates;
create policy "Public can read active transport agency rates"
  on public.transport_agency_rates for select to anon, authenticated
  using (
    is_active = true and exists (
      select 1 from public.transport_agencies agency
       where agency.id = transport_agency_rates.agency_id
         and agency.status = 'active' and agency.is_active = true
         and agency.rates_visibility = 'public'
    )
  );

drop policy if exists "Public can read active transport agency zones" on public.transport_agency_zones;
create policy "Public can read active transport agency zones"
  on public.transport_agency_zones for select to anon, authenticated
  using (
    is_active = true and exists (
      select 1 from public.transport_agencies agency
       where agency.id = transport_agency_zones.agency_id
         and agency.status = 'active' and agency.is_active = true
         and agency.rates_visibility = 'public'
    )
  );

drop policy if exists "Public can read active transport agency distance rates" on public.transport_agency_distance_rates;
create policy "Public can read active transport agency distance rates"
  on public.transport_agency_distance_rates for select to anon, authenticated
  using (
    is_active = true and exists (
      select 1 from public.transport_agencies agency
       where agency.id = transport_agency_distance_rates.agency_id
         and agency.status = 'active' and agency.is_active = true
         and agency.rates_visibility = 'public'
    )
  );

notify pgrst, 'reload schema';
