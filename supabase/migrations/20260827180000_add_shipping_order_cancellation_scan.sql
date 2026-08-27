-- Mandatory scan-to-return cancellation flow for pedidos_expedicao.
--
-- Mirrors the existing pedidos_expedicao / pedidos_expedicao_itens /
-- bipagens_separacao triad rather than the full recebimento task-workflow
-- model -- this is a single linear scan pass, not a multi-stage process.
--
-- Reuses the existing tipo_movimentacao_estoque enum (AJUSTE_POSITIVO) with a
-- new referencia_tipo string, following the project's established pattern of
-- never extending that enum -- every prior distinction (quarentena, baixa
-- fisica, etc.) disambiguates via referencia_tipo instead.

create table public.pedidos_expedicao_cancelamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_expedicao_id uuid not null references public.pedidos_expedicao (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  status text not null default 'EM_ANDAMENTO'
    check (status in ('EM_ANDAMENTO', 'CONCLUIDO', 'ABANDONADO')),
  requer_bipagem boolean not null,
  status_pedido_na_abertura text not null,
  motivo text,
  aberto_por uuid references public.usuarios (id) on delete set null,
  aberto_em timestamptz not null default timezone('utc', now()),
  concluido_por uuid references public.usuarios (id) on delete set null,
  concluido_em timestamptz,
  resumo jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Only one active cancellation process per order at a time.
create unique index idx_pedidos_expedicao_cancelamentos_ativa
  on public.pedidos_expedicao_cancelamentos (pedido_expedicao_id)
  where status = 'EM_ANDAMENTO';

create index idx_pedidos_expedicao_cancelamentos_pedido
  on public.pedidos_expedicao_cancelamentos (pedido_expedicao_id);

create index idx_pedidos_expedicao_cancelamentos_status
  on public.pedidos_expedicao_cancelamentos (status);

-- One line per (item, bin) that picking history says needs a physical return.
create table public.pedidos_expedicao_cancelamento_itens (
  id uuid primary key default gen_random_uuid(),
  cancelamento_id uuid not null references public.pedidos_expedicao_cancelamentos (id) on delete cascade,
  item_pedido_id uuid not null references public.pedidos_expedicao_itens (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete restrict,
  estoque_id uuid references public.estoque (id) on delete set null,
  endereco_esperado_id uuid references public.enderecos (id) on delete set null,
  quantidade_esperada numeric(12, 3) not null check (quantidade_esperada > 0),
  quantidade_confirmada numeric(12, 3) not null default 0
    check (quantidade_confirmada >= 0),
  quantidade_confirmada_avariada numeric(12, 3) not null default 0
    check (quantidade_confirmada_avariada >= 0),
  quantidade_divergente numeric(12, 3) not null default 0
    check (quantidade_divergente >= 0),
  motivo_divergencia text,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'CONCLUIDO', 'DIVERGENTE')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_pedidos_expedicao_cancelamento_itens_cancelamento
  on public.pedidos_expedicao_cancelamento_itens (cancelamento_id);

-- Append-only scan log, idempotent on client-generated id (same shape as
-- bipagens_separacao).
create table public.bipagens_cancelamento_expedicao (
  id uuid primary key,
  cancelamento_item_id uuid not null references public.pedidos_expedicao_cancelamento_itens (id) on delete cascade,
  endereco_id uuid not null references public.enderecos (id) on delete restrict,
  estoque_id uuid references public.estoque (id) on delete set null,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  condicao text not null default 'BOM' check (condicao in ('BOM', 'AVARIADO')),
  criado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_bipagens_cancelamento_expedicao_item
  on public.bipagens_cancelamento_expedicao (cancelamento_item_id);

-- RLS enabled, no policies -- same lockdown as bipagens_separacao. All access
-- goes through the admin client (server actions) or these security definer
-- RPCs, never the RLS-respecting client.
alter table public.pedidos_expedicao_cancelamentos enable row level security;
alter table public.pedidos_expedicao_cancelamento_itens enable row level security;
alter table public.bipagens_cancelamento_expedicao enable row level security;

create trigger pedidos_expedicao_cancelamentos_set_updated_at
before update on public.pedidos_expedicao_cancelamentos
for each row
execute function public.set_current_timestamp_updated_at();

create trigger pedidos_expedicao_cancelamento_itens_set_updated_at
before update on public.pedidos_expedicao_cancelamento_itens
for each row
execute function public.set_current_timestamp_updated_at();

create trigger auditoria_pedidos_expedicao_cancelamentos
  after insert or update or delete on public.pedidos_expedicao_cancelamentos
  for each row execute function public.registrar_auditoria_tabela('EXPEDICAO');

create trigger auditoria_pedidos_expedicao_cancelamento_itens
  after insert or update or delete on public.pedidos_expedicao_cancelamento_itens
  for each row execute function public.registrar_auditoria_tabela('EXPEDICAO');

create trigger auditoria_bipagens_cancelamento_expedicao
  after insert or update or delete on public.bipagens_cancelamento_expedicao
  for each row execute function public.registrar_auditoria_tabela('SEPARACAO');

-- ---------------------------------------------------------------------------
-- registrar_bipagem_cancelamento_expedicao: one scan (address + product) of
-- a return-to-stock line. Mirrors registrar_bipagem_separacao's idempotency
-- and locking shape. Does not touch estoque/movimentacoes_estoque -- that is
-- deferred to conclusion so the whole cancellation nets/restocks atomically.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_bipagem_cancelamento_expedicao(
  p_cancelamento_item_id uuid,
  p_endereco_id uuid,
  p_estoque_id uuid,
  p_produto_id uuid,
  p_quantidade numeric,
  p_usuario_id uuid,
  p_scan_id uuid,
  p_condicao text default 'BOM'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.pedidos_expedicao_cancelamento_itens%rowtype;
  v_condicao text := upper(btrim(coalesce(p_condicao, 'BOM')));
  v_next_confirmada numeric;
  v_next_avariada numeric;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade bipada deve ser maior que zero.';
  end if;

  if v_condicao not in ('BOM', 'AVARIADO') then
    raise exception 'Condicao de bipagem invalida.';
  end if;

  if exists (select 1 from public.bipagens_cancelamento_expedicao where id = p_scan_id) then
    return jsonb_build_object('already_processed', true, 'scan_id', p_scan_id);
  end if;

  select *
    into v_item
  from public.pedidos_expedicao_cancelamento_itens
  where id = p_cancelamento_item_id
  for update;

  if not found then
    raise exception 'Item de cancelamento nao encontrado.';
  end if;

  if v_item.status = 'CONCLUIDO' then
    raise exception 'Este item ja foi confirmado por completo.';
  end if;

  if p_produto_id is distinct from v_item.produto_id then
    raise exception 'O produto bipado nao confere com o esperado para este item.';
  end if;

  -- Only enforced when we actually know the expected bin (the common case,
  -- seeded from the original picking scan). Items picked without a formal
  -- scan (e.g. manual quantity entry) have no known origin bin, so the first
  -- scan establishes it instead of being rejected outright.
  if v_item.endereco_esperado_id is not null and p_endereco_id is distinct from v_item.endereco_esperado_id then
    raise exception 'O endereco bipado nao confere com o endereco esperado para este item.';
  end if;

  if v_item.estoque_id is not null and p_estoque_id is distinct from v_item.estoque_id then
    raise exception 'O saldo de origem bipado nao confere com o esperado para este item.';
  end if;

  if v_item.quantidade_confirmada + p_quantidade > v_item.quantidade_esperada then
    raise exception 'A leitura ultrapassa a quantidade esperada para devolucao deste item.';
  end if;

  insert into public.bipagens_cancelamento_expedicao (
    id, cancelamento_item_id, endereco_id, estoque_id, quantidade, condicao, criado_por
  ) values (
    p_scan_id, p_cancelamento_item_id, p_endereco_id, p_estoque_id, p_quantidade, v_condicao, p_usuario_id
  );

  v_next_confirmada := v_item.quantidade_confirmada + p_quantidade;
  v_next_avariada := v_item.quantidade_confirmada_avariada
    + case when v_condicao = 'AVARIADO' then p_quantidade else 0 end;

  update public.pedidos_expedicao_cancelamento_itens
  set quantidade_confirmada = v_next_confirmada,
      quantidade_confirmada_avariada = v_next_avariada,
      endereco_esperado_id = coalesce(endereco_esperado_id, p_endereco_id),
      estoque_id = coalesce(estoque_id, p_estoque_id),
      status = case when v_next_confirmada >= quantidade_esperada then 'CONCLUIDO' else 'PENDENTE' end,
      updated_at = timezone('utc', now())
  where id = p_cancelamento_item_id;

  return jsonb_build_object(
    'already_processed', false,
    'scan_id', p_scan_id,
    'quantidade_confirmada', v_next_confirmada,
    'quantidade_esperada', v_item.quantidade_esperada
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- concluir_cancelamento_pedido_expedicao: atomically closes the process --
-- restores physical estoque.quantidade where a physical debit had already
-- posted (garantir_baixa_fisica_pedido), quarantines damaged returns, resets
-- quantidade_separada for every item of the order (single source of truth,
-- fixes the reset gap that existed across the old direct-cancel call sites),
-- then flips the order to CANCELADO -- which fires the existing
-- proteger_transicao_estoque_pedido trigger -> estornar_baixas_separacao on
-- its own, releasing the reservation. This function does not reimplement
-- that part.
--
-- Known limitation: physical-debit netting assumes at most one pick/cancel
-- cycle per (pedido, estoque_id). A third-plus reopen-and-recancel cycle on
-- the same order could double-count if reservar_estoque_pedido_criado tags
-- each cycle with a distinct observacoes marker -- not verified here.
-- ---------------------------------------------------------------------------
create or replace function public.concluir_cancelamento_pedido_expedicao(
  p_cancelamento_id uuid,
  p_usuario_id uuid,
  p_forcar_divergencia boolean default false,
  p_motivo_divergencia text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelamento public.pedidos_expedicao_cancelamentos%rowtype;
  v_linha record;
  v_pendentes integer;
  v_fisico numeric;
  v_ja_devolvido numeric;
  v_boa numeric;
  v_avariada numeric;
  v_restaurar numeric;
  v_total_restaurado numeric := 0;
  v_total_quarentena numeric := 0;
  v_total_divergente numeric := 0;
begin
  select *
    into v_cancelamento
  from public.pedidos_expedicao_cancelamentos
  where id = p_cancelamento_id
  for update;

  if not found then
    raise exception 'Processo de cancelamento nao encontrado.';
  end if;

  if v_cancelamento.status <> 'EM_ANDAMENTO' then
    raise exception 'Este processo de cancelamento ja foi finalizado.';
  end if;

  select count(*)
    into v_pendentes
  from public.pedidos_expedicao_cancelamento_itens
  where cancelamento_id = p_cancelamento_id
    and quantidade_confirmada < quantidade_esperada;

  if v_pendentes > 0 and not p_forcar_divergencia then
    raise exception 'Ainda ha % item(ns) sem confirmacao completa de devolucao.', v_pendentes;
  end if;

  for v_linha in
    select *
    from public.pedidos_expedicao_cancelamento_itens
    where cancelamento_id = p_cancelamento_id
    for update
  loop
    if v_linha.quantidade_confirmada < v_linha.quantidade_esperada then
      update public.pedidos_expedicao_cancelamento_itens
      set status = 'DIVERGENTE',
          quantidade_divergente = quantidade_esperada - quantidade_confirmada,
          motivo_divergencia = coalesce(p_motivo_divergencia, motivo_divergencia),
          updated_at = timezone('utc', now())
      where id = v_linha.id;

      v_total_divergente := v_total_divergente + (v_linha.quantidade_esperada - v_linha.quantidade_confirmada);
    end if;

    v_boa := v_linha.quantidade_confirmada - v_linha.quantidade_confirmada_avariada;
    v_avariada := v_linha.quantidade_confirmada_avariada;

    if v_boa > 0 and v_linha.estoque_id is not null then
      select coalesce(sum(m.quantidade), 0)
        into v_fisico
      from public.movimentacoes_estoque m
      where m.referencia_id = v_cancelamento.pedido_expedicao_id
        and m.referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA')
        and m.tipo = 'SAIDA'
        and m.estoque_id = v_linha.estoque_id
        and m.observacoes like 'reserva-criacao:item:' || v_linha.item_pedido_id::text || ':%';

      if v_fisico > 0 then
        select coalesce(sum(m.quantidade), 0)
          into v_ja_devolvido
        from public.movimentacoes_estoque m
        where m.referencia_id = v_cancelamento.pedido_expedicao_id
          and m.referencia_tipo = 'RETORNO_CANCELAMENTO_EXPEDICAO'
          and m.tipo = 'AJUSTE_POSITIVO'
          and m.estoque_id = v_linha.estoque_id;

        v_restaurar := least(v_boa, greatest(v_fisico - v_ja_devolvido, 0));

        if v_restaurar > 0 then
          update public.estoque
          set quantidade = quantidade + v_restaurar
          where id = v_linha.estoque_id;

          insert into public.movimentacoes_estoque (
            depositante_id, estoque_id, produto_id, endereco_destino_id,
            tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
          ) values (
            v_cancelamento.depositante_id, v_linha.estoque_id, v_linha.produto_id, v_linha.endereco_esperado_id,
            'AJUSTE_POSITIVO', v_restaurar, 'RETORNO_CANCELAMENTO_EXPEDICAO', v_cancelamento.pedido_expedicao_id,
            'Devolucao ao estoque por cancelamento (processo ' || p_cancelamento_id::text || ')', p_usuario_id
          );

          v_total_restaurado := v_total_restaurado + v_restaurar;
        end if;
      end if;
    end if;

    if v_avariada > 0 then
      insert into public.estoque_quarentena (
        depositante_id, produto_id, estoque_id, endereco_id, quantidade, motivo, tipo, criado_por
      ) values (
        v_cancelamento.depositante_id, v_linha.produto_id, v_linha.estoque_id, v_linha.endereco_esperado_id, v_avariada,
        'Avaria identificada na devolucao do cancelamento do pedido ' || v_cancelamento.pedido_expedicao_id::text,
        'AVARIA', p_usuario_id
      );

      insert into public.movimentacoes_estoque (
        depositante_id, estoque_id, produto_id, endereco_destino_id,
        tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
      ) values (
        v_cancelamento.depositante_id, v_linha.estoque_id, v_linha.produto_id, v_linha.endereco_esperado_id,
        'BLOQUEIO', v_avariada, 'QUARENTENA_CANCELAMENTO_EXPEDICAO', v_cancelamento.pedido_expedicao_id,
        'Quarentena por avaria na devolucao do cancelamento (processo ' || p_cancelamento_id::text || ')', p_usuario_id
      );

      v_total_quarentena := v_total_quarentena + v_avariada;
    end if;
  end loop;

  update public.pedidos_expedicao_itens
  set quantidade_separada = 0
  where pedido_expedicao_id = v_cancelamento.pedido_expedicao_id;

  update public.pedidos_expedicao
  set status = 'CANCELADO'
  where id = v_cancelamento.pedido_expedicao_id;

  update public.pedidos_expedicao_cancelamentos
  set status = 'CONCLUIDO',
      concluido_por = p_usuario_id,
      concluido_em = timezone('utc', now()),
      resumo = jsonb_build_object(
        'total_restaurado', v_total_restaurado,
        'total_quarentena', v_total_quarentena,
        'total_divergente', v_total_divergente
      ),
      updated_at = timezone('utc', now())
  where id = p_cancelamento_id;

  return jsonb_build_object(
    'ok', true,
    'total_restaurado', v_total_restaurado,
    'total_quarentena', v_total_quarentena,
    'total_divergente', v_total_divergente
  );
end;
$$;

revoke all on function public.registrar_bipagem_cancelamento_expedicao(uuid, uuid, uuid, uuid, numeric, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_bipagem_cancelamento_expedicao(uuid, uuid, uuid, uuid, numeric, uuid, uuid, text) to service_role;

revoke all on function public.concluir_cancelamento_pedido_expedicao(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.concluir_cancelamento_pedido_expedicao(uuid, uuid, boolean, text) to service_role;
