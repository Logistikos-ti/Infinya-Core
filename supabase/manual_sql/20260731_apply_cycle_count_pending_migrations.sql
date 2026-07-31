-- Aplica as 2 migrações do inventário cíclico que existem no repositório
-- mas nunca foram rodadas no banco de produção (schema drift detectado
-- em 2026-07-31 ao testar o novo fluxo mobile de contagem cíclica).
-- Fontes: 20260708101000_add_cycle_count_adjustment_approval.sql
--         20260708113000_add_blind_and_second_cycle_count.sql
-- 100% aditivo (ADD COLUMN IF NOT EXISTS) -- não apaga nem altera dado existente.

alter table public.contagens_estoque_itens
add column if not exists ajuste_status text not null default 'NAO_NECESSARIO',
add column if not exists ajuste_observacoes text,
add column if not exists ajuste_aprovado_por uuid references public.usuarios (id) on delete set null,
add column if not exists ajuste_aprovado_em timestamptz,
add column if not exists ajuste_aplicado_em timestamptz;

create index if not exists idx_contagens_estoque_itens_ajuste_status
on public.contagens_estoque_itens (ajuste_status);

alter table public.contagens_estoque
add column if not exists contagem_cega boolean not null default false;

alter table public.contagens_estoque_itens
add column if not exists segunda_quantidade_contada numeric(12, 3),
add column if not exists segunda_divergencia numeric(12, 3) not null default 0,
add column if not exists segunda_observacoes text,
add column if not exists segunda_contado_por uuid references public.usuarios (id) on delete set null,
add column if not exists segunda_contado_em timestamptz;

notify pgrst, 'reload schema';
