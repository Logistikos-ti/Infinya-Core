-- Administrative status changes to conference must follow the same stock safety rules as wave picking.
create or replace function public.reservar_pedido_para_conferencia(
  p_pedido_id uuid,
  p_usuario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item record;
  v_stock record;
  v_remaining numeric;
  v_reserve_quantity numeric;
  v_reserved_total numeric := 0;
begin
  select id, depositante_id
    into v_order
  from public.pedidos_expedicao
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de expedicao nao encontrado.';
  end if;

  for v_item in
    select id, produto_id, quantidade, quantidade_separada
    from public.pedidos_expedicao_itens
    where pedido_expedicao_id = p_pedido_id
    for update
  loop
    v_remaining := greatest(coalesce(v_item.quantidade, 0) - coalesce(v_item.quantidade_separada, 0), 0);

    if v_remaining = 0 then
      continue;
    end if;

    for v_stock in
      select id, quantidade, quantidade_reservada, endereco_id
      from public.estoque
      where depositante_id = v_order.depositante_id
        and produto_id = v_item.produto_id
        and bloqueado = false
        and quantidade > quantidade_reservada
      order by validade asc nulls last, id
      for update
    loop
      exit when v_remaining = 0;

      v_reserve_quantity := least(v_remaining, v_stock.quantidade - v_stock.quantidade_reservada);

      update public.estoque
      set quantidade_reservada = quantidade_reservada + v_reserve_quantity
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
        v_reserve_quantity,
        'RESERVA_SEPARACAO_ONDA',
        p_pedido_id,
        'reserva-administrativa-conferencia:' || v_item.id::text,
        p_usuario_id
      );

      v_remaining := v_remaining - v_reserve_quantity;
      v_reserved_total := v_reserved_total + v_reserve_quantity;
    end loop;

    if v_remaining > 0 then
      raise exception 'Saldo insuficiente para reservar todos os itens antes da conferencia.';
    end if;

    update public.pedidos_expedicao_itens
    set quantidade_separada = quantidade
    where id = v_item.id;
  end loop;

  return jsonb_build_object('reserved_quantity', v_reserved_total);
end;
$$;

grant execute on function public.reservar_pedido_para_conferencia(uuid, uuid) to service_role;
