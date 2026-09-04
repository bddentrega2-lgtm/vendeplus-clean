insert into public.service_cities (
  country_code,
  state_name,
  name,
  slug,
  is_active,
  sort_order,
  updated_at
)
values
  ('VE', 'Amazonas', 'Puerto Ayacucho', 'puerto-ayacucho', true, 10, now()),
  ('VE', 'Anzoátegui', 'Barcelona', 'barcelona', true, 20, now()),
  ('VE', 'Apure', 'San Fernando de Apure', 'san-fernando-de-apure', true, 30, now()),
  ('VE', 'Aragua', 'Maracay', 'maracay', true, 40, now()),
  ('VE', 'Barinas', 'Barinas', 'barinas', true, 50, now()),
  ('VE', 'Bolívar', 'Ciudad Bolívar', 'ciudad-bolivar', true, 60, now()),
  ('VE', 'Carabobo', 'Valencia', 'valencia', true, 70, now()),
  ('VE', 'Cojedes', 'San Carlos', 'san-carlos', true, 80, now()),
  ('VE', 'Delta Amacuro', 'Tucupita', 'tucupita', true, 90, now()),
  ('VE', 'Distrito Capital', 'Caracas', 'caracas', true, 100, now()),
  ('VE', 'Falcón', 'Coro', 'coro', true, 110, now()),
  ('VE', 'Guárico', 'San Juan de los Morros', 'san-juan-de-los-morros', true, 120, now()),
  ('VE', 'La Guaira', 'La Guaira', 'la-guaira', true, 130, now()),
  ('VE', 'Lara', 'Barquisimeto', 'barquisimeto', true, 140, now()),
  ('VE', 'Mérida', 'Mérida', 'merida', true, 150, now()),
  ('VE', 'Miranda', 'Los Teques', 'los-teques', true, 160, now()),
  ('VE', 'Monagas', 'Maturín', 'maturin', true, 170, now()),
  ('VE', 'Nueva Esparta', 'La Asunción', 'la-asuncion', true, 180, now()),
  ('VE', 'Portuguesa', 'Guanare', 'guanare', true, 190, now()),
  ('VE', 'Sucre', 'Cumaná', 'cumana', true, 200, now()),
  ('VE', 'Táchira', 'San Cristóbal', 'san-cristobal', true, 210, now()),
  ('VE', 'Trujillo', 'Trujillo', 'trujillo', true, 220, now()),
  ('VE', 'Yaracuy', 'San Felipe', 'san-felipe', true, 230, now()),
  ('VE', 'Zulia', 'Maracaibo', 'maracaibo', true, 240, now())
on conflict (country_code, state_name, slug) do update
set
  name = excluded.name,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();
