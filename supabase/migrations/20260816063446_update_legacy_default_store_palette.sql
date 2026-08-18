update public.stores
set
  primary_color = '#1F464C',
  accent_color = '#F27533',
  button_text_color = '#042332',
  updated_at = now()
where
  (
    lower(primary_color) = '#2e3a79'
    and lower(accent_color) = '#ffb547'
    and lower(button_text_color) = '#25262b'
  )
  or (
    lower(primary_color) = '#3b4ca0'
    and lower(accent_color) = '#ffbe4d'
    and lower(button_text_color) = '#000000'
  );

alter table public.stores
  alter column primary_color set default '#1F464C',
  alter column accent_color set default '#F27533',
  alter column button_text_color set default '#042332';

comment on column public.stores.primary_color is
  'Color principal personalizado; los defaults de Somos usan la paleta vigente.';
