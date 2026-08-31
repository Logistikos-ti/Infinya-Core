-- Anexos (fotos/documentos) nos comentários de chamados de depositantes.
-- Guardamos uma lista JSON de { url, nome, tipo } por comentário e criamos um
-- bucket público para servir os arquivos (upload feito pelo service_role no
-- endpoint, leitura pública para exibir no chat).
alter table public.suporte_comentarios
  add column if not exists anexos jsonb not null default '[]';

insert into storage.buckets (id, name, public)
values ('suporte-anexos', 'suporte-anexos', true)
on conflict (id) do nothing;
