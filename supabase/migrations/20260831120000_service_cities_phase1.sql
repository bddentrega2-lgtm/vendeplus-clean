create table if not exists public.service_cities (
  id uuid primary key default gen_random_uuid(), country_code text not null default 'VE',
  state_name text not null, name text not null, slug text not null,
  center_latitude numeric, center_longitude numeric, is_active boolean not null default true,
  sort_order integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_cities_country_state_slug_unique unique (country_code, state_name, slug)
);
alter table public.stores add column if not exists city_id uuid references public.service_cities(id) on delete set null;
create table if not exists public.transport_agency_city_coverage (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  city_id uuid not null references public.service_cities(id) on delete cascade,
  is_base_city boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint transport_agency_city_coverage_unique unique (agency_id, city_id)
);
create index if not exists stores_city_id_idx on public.stores(city_id) where city_id is not null;
create index if not exists transport_agency_city_coverage_city_idx on public.transport_agency_city_coverage(city_id, is_active, agency_id);
insert into public.service_cities (country_code, state_name, name, slug, center_latitude, center_longitude, sort_order) values
('VE','Aragua','Maracay','maracay',10.2469,-67.5958,10),
('VE','Yaracuy','San Felipe','san-felipe',10.3399,-68.7425,20),
('VE','Carabobo','Valencia','valencia',10.1620,-68.0077,30),
('VE','Lara','Barquisimeto','barquisimeto',10.0678,-69.3474,40),
('VE','Táchira','San Cristóbal','san-cristobal',7.7669,-72.2250,50)
on conflict (country_code,state_name,slug) do update set name=excluded.name, center_latitude=excluded.center_latitude, center_longitude=excluded.center_longitude, is_active=true, sort_order=excluded.sort_order, updated_at=now();
update public.stores s set city_id=c.id from public.service_cities c where s.city_id is null and c.country_code='VE' and (
 (c.slug='san-felipe' and (lower(coalesce(s.name,''))='burger mas' or lower(coalesce(s.address,'')) like '%san felipe%')) or
 (c.slug='valencia' and (lower(coalesce(s.name,'')) in ('bodys style','santo sabor') or lower(coalesce(s.address,'')) like '%valencia%')) or
 (c.slug='barquisimeto' and (lower(coalesce(s.name,''))='shibui' or lower(coalesce(s.address,'')) like '%barquisimeto%')) or
 (c.slug='san-cristobal' and (lower(coalesce(s.name,''))='alkkon fit' or lower(coalesce(s.address,'')) like '%san cristóbal%' or lower(coalesce(s.address,'')) like '%san cristobal%')) or
 (c.slug='maracay' and (lower(coalesce(s.address,'')) like '%maracay%' or (s.longitude between -67.8 and -67.4 and s.latitude between 10.05 and 10.45)))
);
insert into public.transport_agency_city_coverage (agency_id,city_id,is_base_city,is_active)
select a.id,c.id,true,true from public.transport_agencies a join public.service_cities c on c.country_code='VE' and (
 (c.slug='maracay' and lower(trim(coalesce(a.city,'')))='maracay') or
 (c.slug='san-felipe' and lower(trim(coalesce(a.city,'')))='san felipe') or
 (c.slug='valencia' and lower(trim(coalesce(a.city,'')))='valencia') or
 (c.slug='barquisimeto' and lower(trim(coalesce(a.city,'')))='barquisimeto') or
 (c.slug='san-cristobal' and lower(trim(coalesce(a.city,''))) in ('san cristóbal','san cristobal')))
on conflict (agency_id,city_id) do update set is_base_city=true,is_active=true,updated_at=now();
alter table public.service_cities enable row level security;
alter table public.transport_agency_city_coverage enable row level security;
drop policy if exists "Public reads active service cities" on public.service_cities;
create policy "Public reads active service cities" on public.service_cities for select using (is_active=true);
drop policy if exists "Public reads active agency city coverage" on public.transport_agency_city_coverage;
create policy "Public reads active agency city coverage" on public.transport_agency_city_coverage for select using (is_active=true);
revoke all on public.service_cities from public;
revoke all on public.transport_agency_city_coverage from public;
grant select on public.service_cities to anon,authenticated;
grant select on public.transport_agency_city_coverage to anon,authenticated;
grant all on public.service_cities to service_role;
grant all on public.transport_agency_city_coverage to service_role;
