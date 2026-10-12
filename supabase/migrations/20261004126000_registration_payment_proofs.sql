insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commerce-registration-assets', 'commerce-registration-assets', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set file_size_limit = 5242880;
