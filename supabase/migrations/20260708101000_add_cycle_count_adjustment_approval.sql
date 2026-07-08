alter table public.contagens_estoque_itens
add column if not exists ajuste_status text not null default 'NAO_NECESSARIO',
add column if not exists ajuste_observacoes text,
add column if not exists ajuste_aprovado_por uuid references public.usuarios (id) on delete set null,
add column if not exists ajuste_aprovado_em timestamptz,
add column if not exists ajuste_aplicado_em timestamptz;

create index if not exists idx_contagens_estoque_itens_ajuste_status
on public.contagens_estoque_itens (ajuste_status);
