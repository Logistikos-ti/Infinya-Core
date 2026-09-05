-- Mais 3 tipos de notificação: fatura gerada, fatura vencida, estoque
-- abaixo do mínimo. Pedido do usuário em 2026-09-05.

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'ROMANEIO_LIBERADO',
    'QUARENTENA_CRIADA',
    'INVENTARIO_DIVERGENTE',
    'RECEBIMENTO_CONCLUIDO',
    'RECEBIMENTO_DIVERGENTE',
    'EXPEDICAO_CANCELAMENTO_ABERTO',
    'EXPEDICAO_DIVERGENTE',
    'FATURA_GERADA',
    'FATURA_VENCIDA',
    'ESTOQUE_BAIXO'
  ));

-- ============================================================
-- 1. Fatura gerada -- direto dentro de garantir_ou_criar_fatura (não em
--    JS): essa função é chamada de ~10 lugares diferentes
--    (registrarLancamento* em src/lib/billing.ts), e já sabe distinguir
--    "acabei de criar agora" de "já existia" internamente (o
--    insert...on conflict do nothing returning id) -- editando só a
--    função, todos os 10 call sites ganham a notificação de graça, sem
--    editar nenhum deles nem arriscar esquecer um.
-- ============================================================

create or replace function public.garantir_ou_criar_fatura(
  p_depositante_id uuid,
  p_mes_ano text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fatura_id uuid;
  v_dep_nome text;
  v_codigo text;
begin
  select id into v_fatura_id
  from public.faturas
  where depositante_id = p_depositante_id
    and mes_ano = p_mes_ano;

  if found then
    return v_fatura_id;
  end if;

  select nome into v_dep_nome from public.depositantes where id = p_depositante_id;
  v_codigo := 'FAT-' || right(replace(p_mes_ano, '-', ''), 4) || '-' || upper(left(trim(coalesce(v_dep_nome, 'DEP')), 3));

  insert into public.faturas (depositante_id, mes_ano, status, codigo)
  values (p_depositante_id, p_mes_ano, 'ABERTA', v_codigo)
  on conflict (depositante_id, mes_ano) do nothing
  returning id into v_fatura_id;

  if v_fatura_id is not null then
    -- Só entra aqui quando ESSA chamada realmente criou a fatura (não
    -- achou nada no primeiro select, e o insert não bateu em conflito
    -- com uma chamada concorrente) -- nunca duplica notificação.
    insert into public.notificacoes (tipo, titulo, mensagem, link, depositante_id, referencia_tipo, referencia_id)
    values (
      'FATURA_GERADA',
      'Fatura gerada',
      'Fatura de ' || p_mes_ano || ' foi gerada (' || v_codigo || ').',
      '/financeiro',
      p_depositante_id,
      'fatura',
      v_fatura_id
    );
  else
    select id into v_fatura_id
    from public.faturas
    where depositante_id = p_depositante_id
      and mes_ano = p_mes_ano;
  end if;

  return v_fatura_id;
end;
$$;

-- ============================================================
-- 2. Estoque abaixo do mínimo -- estado indo/voltando (não uma tabela de
--    log): só existe UMA linha ativa (resolvido_em is null) por produto
--    por vez. Cron abre uma linha nova (+ notifica) quando o produto cruza
--    pra baixo do mínimo e não tinha alerta ativo; resolve (resolvido_em =
--    now()) quando volta a ficar OK -- só assim dá pra notificar de novo
--    numa próxima queda, sem re-notificar todo dia enquanto continuar
--    baixo (decisão explícita do usuário: só uma vez até normalizar).
-- ============================================================

create table if not exists public.estoque_baixo_alertas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  aberto_em timestamptz not null default timezone('utc', now()),
  resolvido_em timestamptz
);

-- Só uma linha ATIVA (resolvido_em null) por produto de cada vez.
create unique index if not exists uq_estoque_baixo_alertas_ativo
  on public.estoque_baixo_alertas (produto_id)
  where resolvido_em is null;

create index if not exists idx_estoque_baixo_alertas_depositante
  on public.estoque_baixo_alertas (depositante_id);

alter table public.estoque_baixo_alertas enable row level security;

drop policy if exists estoque_baixo_alertas_select on public.estoque_baixo_alertas;
create policy estoque_baixo_alertas_select on public.estoque_baixo_alertas
for select to authenticated
using (public.can_access_depositante(depositante_id));

-- Sem policy de insert/update/delete pra authenticated de propósito -- só
-- o cron (service_role, via src/app/api/cron/check-estoque-baixo) escreve
-- aqui, mesmo padrão de romaneios_carga/notificacoes/etc.
