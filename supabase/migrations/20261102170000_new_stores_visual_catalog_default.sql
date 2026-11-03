-- Los comercios existentes conservan su preferencia. Solo cambia el valor
-- inicial de los catalogos creados despues de aplicar esta migracion.
alter table public.stores
  alter column catalog_layout set default 'visual';
