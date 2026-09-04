alter table public.transport_agencies
  add column if not exists marketplace_primary_color text not null default '#143D42',
  add column if not exists marketplace_accent_color text not null default '#FF7133';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transport_agencies_marketplace_primary_color_hex'
  ) then
    alter table public.transport_agencies
      add constraint transport_agencies_marketplace_primary_color_hex
      check (marketplace_primary_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transport_agencies_marketplace_accent_color_hex'
  ) then
    alter table public.transport_agencies
      add constraint transport_agencies_marketplace_accent_color_hex
      check (marketplace_accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

comment on column public.transport_agencies.marketplace_primary_color is
  'Color principal hexadecimal del Marketplace publico de la empresa delivery.';

comment on column public.transport_agencies.marketplace_accent_color is
  'Color de acento hexadecimal del Marketplace publico de la empresa delivery.';
