-- Applies a one-time physical stock reconciliation for orders that were
-- completed before conference stock deduction became mandatory.
create or replace function public.conciliar_baixa_retroativa_pedido(
  p_pedido_id uuid,
  p_usuario_id uuid
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
  v_remaining numeric;
  v_quantity numeric;
  v_count integer := 0;
begin
  select id, depositante_id
    into v_order
  from public.pedidos_expedicao
  where id = p_pedido_id
    and status in ('PRONTO_ROMANEIO', 'EXPEDIDO')
  for update;

  if not found then
    raise exception 'Pedido nao elegivel para conciliacao retroativa.';
  end if;

  if exists (
    select 1
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA')
      and tipo = 'SAIDA'
  ) then
    raise exception 'Este pedido ja possui baixa fisica vinculada.';
  end if;

  for v_item in
    select id, produto_id, quantidade
    from public.pedidos_expedicao_itens
    where pedido_expedicao_id = p_pedido_id
    for update
  loop
    v_remaining := coalesce(v_item.quantidade, 0);

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
      exit when v_remaining <= 0;

      v_quantity := least(v_remaining, v_stock.quantidade - v_stock.quantidade_reservada);

      update public.estoque
      set quantidade = quantidade - v_quantity
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
        'SAIDA',
        v_quantity,
        'BAIXA_FISICA_CONCILIACAO_RETROATIVA',
        p_pedido_id,
        'Baixa fisica retroativa conciliada pelo painel administrativo.',
        p_usuario_id
      );

      v_remaining := v_remaining - v_quantity;
      v_count := v_count + 1;
    end loop;

    if v_remaining > 0 then
      raise exception 'Saldo insuficiente para conciliar o item %.', v_item.id;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.conciliar_baixa_retroativa_pedido(uuid, uuid) to service_role;
