-- Novo fluxo: Retirada de mercadoria pelo depositante.
-- Depositante solicita retirada pelo portal; pedido nasce AGUARDANDO_NF_DEVOLUCAO,
-- estoque e reservado imediatamente (FEFO) usando o mesmo referencia_tipo do fluxo
-- de onda para que garantir_baixa_fisica_pedido enxergue e efetive na conferencia.

alter type public.status_pedido_expedicao add value if not exists 'AGUARDANDO_NF_DEVOLUCAO';
commit;

alter table public.pedidos_expedicao
add column if not exists tipo_operacao text not null default 'VENDA';

alter table public.pedidos_expedicao
drop constraint if exists pedidos_expedicao_tipo_operacao_check;

alter table public.pedidos_expedicao
add constraint pedidos_expedicao_tipo_operacao_check
check (tipo_operacao in ('VENDA','RETIRADA'));

create index if not exists idx_pedidos_expedicao_tipo_operacao
on public.pedidos_expedicao (tipo_operacao);

-- Reserva FEFO upfront para uma retirada.
-- Grava movimentacoes_estoque tipo BLOQUEIO com referencia_tipo=RESERVA_SEPARACAO_ONDA
-- para reaproveitar toda a maquinaria de baixa fisica ja existente.
create or replace function public.reservar_estoque_retirada(
  p_pedido_id uuid,
  p_usuario_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item record;
  v_stock record;
  v_missing numeric;
  v_take numeric;
  v_count integer := 0;
begin
  select id, depositante_id, tipo_operacao, status
    into v_order
  from public.pedidos_expedicao
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de expedicao nao encontrado.';
  end if;

  if v_order.tipo_operacao is distinct from 'RETIRADA' then
    raise exception 'RPC exclusiva para pedidos de tipo RETIRADA.';
  end if;

  for v_item in
    select produto_id, sum(quantidade) as quantidade
    from public.pedidos_expedicao_itens
    where pedido_expedicao_id = p_pedido_id
    group by produto_id
  loop
    -- Nao reserva de novo o que ja foi reservado (idempotencia em retries).
    select greatest(coalesce(v_item.quantidade, 0) - coalesce(sum(quantidade), 0), 0)
      into v_missing
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and tipo = 'BLOQUEIO'
      and produto_id = v_item.produto_id;

    for v_stock in
      select id, quantidade, quantidade_reservada, endereco_id
      from public.estoque
      where depositante_id = v_order.depositante_id
        and produto_id = v_item.produto_id
        and bloqueado = false
        and quantidade > quantidade_reservada
      order by validade_em asc nulls last, id
      for update
    loop
      exit when v_missing <= 0;

      v_take := least(v_missing, v_stock.quantidade - v_stock.quantidade_reservada);

      update public.estoque
      set quantidade_reservada = quantidade_reservada + v_take
      where id = v_stock.id;

      insert into public.movimentacoes_estoque (
        depositante_id,
        estoque_id,
        produto_id,
        endereco_origem_id,
        tipo,
        quantidade,
        referencia_tipo,
        referencia_id,
        observacoes,
        criado_por
      ) values (
        v_order.depositante_id,
        v_stock.id,
        v_item.produto_id,
        v_stock.endereco_id,
        'BLOQUEIO',
        v_take,
        'RESERVA_SEPARACAO_ONDA',
        p_pedido_id,
        'reserva-retirada-depositante',
        p_usuario_id
      );

      v_missing := v_missing - v_take;
      v_count := v_count + 1;
    end loop;

    if v_missing > 0 then
      raise exception 'Saldo insuficiente para reservar o produto %.', v_item.produto_id;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.reservar_estoque_retirada(uuid, uuid) to service_role;

-- Libera as reservas de uma retirada (usada no cancelamento).
create or replace function public.liberar_reserva_retirada(
  p_pedido_id uuid,
  p_motivo text default null,
  p_usuario_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_movement record;
  v_count integer := 0;
begin
  select id, tipo_operacao, status
    into v_order
  from public.pedidos_expedicao
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de expedicao nao encontrado.';
  end if;

  if v_order.tipo_operacao is distinct from 'RETIRADA' then
    raise exception 'RPC exclusiva para pedidos de tipo RETIRADA.';
  end if;

  if v_order.status in ('EXPEDIDO') then
    raise exception 'Nao e possivel liberar reservas de um pedido ja expedido.';
  end if;

  for v_movement in
    select *
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and tipo = 'BLOQUEIO'
    for update
  loop
    update public.estoque
    set quantidade_reservada = greatest(quantidade_reservada - v_movement.quantidade, 0)
    where id = v_movement.estoque_id;

    update public.movimentacoes_estoque
    set referencia_tipo = 'RESERVA_SEPARACAO_ONDA_ESTORNADA',
        observacoes = coalesce(observacoes, '') || ' | ' || coalesce(p_motivo, 'cancelamento-retirada')
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.liberar_reserva_retirada(uuid, text, uuid) to service_role;
