alter table public.produtos
add column if not exists imagem_principal_url text,
add column if not exists imagem_principal_storage_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'wms-produtos-imagens',
  'wms-produtos-imagens',
  true,
  3145728,
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
