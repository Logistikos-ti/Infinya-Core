alter table public.depositantes
add column if not exists configuracoes jsonb not null default '{}'::jsonb;

update public.depositantes
set configuracoes = case
  when observacoes is null or btrim(observacoes) = '' then '{}'::jsonb
  when left(btrim(observacoes), 1) = '{' then observacoes::jsonb
  else jsonb_build_object('observacoes', observacoes)
end
where configuracoes = '{}'::jsonb;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'wms-depositantes-logos',
  'wms-depositantes-logos',
  true,
  2097152,
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
