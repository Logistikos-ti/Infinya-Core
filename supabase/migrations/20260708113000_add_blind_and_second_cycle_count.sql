alter table public.contagens_estoque
add column if not exists contagem_cega boolean not null default false;

alter table public.contagens_estoque_itens
add column if not exists segunda_quantidade_contada numeric(12, 3),
add column if not exists segunda_divergencia numeric(12, 3) not null default 0,
add column if not exists segunda_observacoes text,
add column if not exists segunda_contado_por uuid references public.usuarios (id) on delete set null,
add column if not exists segunda_contado_em timestamptz;
