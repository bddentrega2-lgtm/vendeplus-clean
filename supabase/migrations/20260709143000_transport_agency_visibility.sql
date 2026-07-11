-- Add public/private rates visibility for delivery companies.

alter table public.transport_agencies
  add column if not exists rates_visibility text not null default 'public';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transport_agencies_rates_visibility_check'
  ) then
    alter table public.transport_agencies
      add constraint transport_agencies_rates_visibility_check
      check (rates_visibility in ('public', 'private'));
  end if;
end $$;

update public.transport_agencies
set rates_visibility = 'public'
where rates_visibility is null;
