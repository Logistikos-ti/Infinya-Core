alter type public.tipo_documento add value if not exists 'ETIQUETA';

alter table public.documentos_armazenados
add column if not exists pedido_expedicao_id uuid references public.pedidos_expedicao (id) on delete set null;

create index if not exists idx_documentos_armazenados_pedido_expedicao_id
on public.documentos_armazenados (pedido_expedicao_id);
