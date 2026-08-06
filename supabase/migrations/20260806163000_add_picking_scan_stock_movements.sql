-- Wave picking reserves stock. The physical decrement happens only after conference.
create or replace function public.registrar_bipagem_separacao(
  p_pedido_id uuid,
  p_item_id uuid,
  p_estoque_id uuid,
  p_quantidade numeric,
  p_usuario_id uuid,
  p_scan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock public.estoque%rowtype;
  v_order record;
  v_item record;
  v_scan_marker text := 'scan:' || p_scan_id::text;
  v_next_quantity numeric;
  v_movement_id uuid;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade bipada deve ser maior que zero.';
  end if;

  select id, depositante_id
    into v_order
  from public.pedidos_expedicao
  where id = p_pedido_id;

  if not found then
    raise exception 'Pedido de expedicao nao encontrado.';
  end if;

  select id, produto_id, quantidade, quantidade_separada
    into v_item
  from public.pedidos_expedicao_itens
  where id = p_item_id
    and pedido_expedicao_id = p_pedido_id
  for update;

  if not found then
    raise exception 'Item do pedido nao encontrado.';
  end if;

  if coalesce(v_item.quantidade_separada, 0) >= coalesce(v_item.quantidade, 0) then
    return jsonb_build_object('already_processed', true, 'item_quantity', v_item.quantidade_separada);
  end if;

  select *
    into v_stock
  from public.estoque
  where id = p_estoque_id
  for update;

  if not found then
    raise exception 'O saldo do endereco selecionado nao foi encontrado.';
  end if;

  if v_stock.depositante_id <> v_order.depositante_id then
    raise exception 'O saldo selecionado nao pertence ao depositante do pedido.';
  end if;

  if v_stock.produto_id <> v_item.produto_id then
    raise exception 'O saldo selecionado nao pertence ao produto bipado.';
  end if;

  if v_stock.bloqueado then
    raise exception 'O endereco selecionado esta bloqueado para operacao.';
  end if;

  if exists (
    select 1
    from public.movimentacoes_estoque
    where referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and observacoes = v_scan_marker
  ) then
    return jsonb_build_object('already_processed', true, 'stock_id', v_stock.id);
  end if;

  if (v_stock.quantidade - v_stock.quantidade_reservada) < p_quantidade then
    raise exception 'Saldo insuficiente no endereco para concluir a bipagem.';
  end if;

  update public.estoque
  set quantidade_reservada = quantidade_reservada + p_quantidade
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
    v_stock.depositante_id,
    v_stock.id,
    v_stock.produto_id,
    v_stock.endereco_id,
    'BLOQUEIO',
    p_quantidade,
    'RESERVA_SEPARACAO_ONDA',
    p_pedido_id,
    v_scan_marker,
    p_usuario_id
  ) returning id into v_movement_id;

  v_next_quantity := least(
    coalesce(v_item.quantidade, 0),
    coalesce(v_item.quantidade_separada, 0) + p_quantidade
  );

  update public.pedidos_expedicao_itens
  set quantidade_separada = v_next_quantity
  where id = p_item_id
    and pedido_expedicao_id = p_pedido_id;

  return jsonb_build_object(
    'already_processed', false,
    'movement_id', v_movement_id,
    'stock_id', v_stock.id,
    'stock_quantity', v_stock.quantidade,
    'item_quantity', v_next_quantity
  );
end;
$$;

create or replace function public.estornar_baixas_separacao(
  p_pedido_id uuid,
  p_usuario_id uuid,
  p_motivo text default 'Retorno da onda de separacao'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
  v_count integer := 0;
begin
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
    set tipo = 'DESBLOQUEIO',
        referencia_tipo = 'RESERVA_SEPARACAO_ONDA_ESTORNADA',
        observacoes = coalesce(observacoes, '') || ' | estornado: ' || coalesce(p_motivo, 'Retorno da onda de separacao')
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Turns every active reservation of a checked order into a real stock exit.
create or replace function public.efetivar_baixa_conferencia(
  p_pedido_id uuid,
  p_usuario_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
  v_count integer := 0;
begin
  for v_movement in
    select *
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and tipo = 'BLOQUEIO'
    for update
  loop
    update public.estoque
    set quantidade = quantidade - v_movement.quantidade,
        quantidade_reservada = greatest(quantidade_reservada - v_movement.quantidade, 0)
    where id = v_movement.estoque_id
      and quantidade >= v_movement.quantidade;

    if not found then
      raise exception 'Saldo reservado nao esta mais disponivel para concluir a conferencia.';
    end if;

    update public.movimentacoes_estoque
    set tipo = 'SAIDA',
        referencia_tipo = 'BAIXA_FISICA_CONFERENCIA',
        observacoes = coalesce(observacoes, '') || ' | baixa fisica efetivada na conferencia'
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.registrar_bipagem_separacao(uuid, uuid, uuid, numeric, uuid, uuid) to service_role;
grant execute on function public.estornar_baixas_separacao(uuid, uuid, text) to service_role;
grant execute on function public.efetivar_baixa_conferencia(uuid, uuid) to service_role;
