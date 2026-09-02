-- conciliar_baixa_retroativa_pedido (painel de "Conciliacao de Pedidos") was
-- built for orders that shipped before conference stock deduction was
-- mandatory -- it assumed those orders had no reservation at all, so it only
-- ever debited estoque.quantidade and picked stock filtered by
-- `quantidade > quantidade_reservada` to avoid touching reserved units.
--
-- That assumption was wrong for orders that already carried a BLOQUEIO from
-- the (older, pre-2026-08-21) wave/scan picking flow: the function debited
-- quantidade for those too, but the pre-existing quantidade_reservada was
-- never released, leaking a permanently stuck reservation on whichever stock
-- row happened to have room. A batch run of this tool on 2026-08-06 left 7
-- orders / 16 movements stuck this way (SKU 00055 among them, reported
-- 2026-08-28) -- data corrected separately. This fixes the function itself so
-- using this admin tool again can't repeat it.
--
-- Fix: before falling back to arbitrary unreserved stock, settle any
-- existing BLOQUEIO reservation for this order directly -- same UPDATE moves
-- quantidade and quantidade_reservada together, exactly like
-- garantir_baixa_fisica_pedido already does. The per-item loop then only
-- needs to cover whatever quantity wasn't already accounted for that way.
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
  v_movement record;
  v_remaining numeric;
  v_quantity numeric;
  v_covered numeric;
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

  for v_movement in
    select m.*
    from public.movimentacoes_estoque m
    where m.referencia_id = p_pedido_id
      and m.referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and m.tipo = 'BLOQUEIO'
    order by m.created_at, m.id
    for update
  loop
    update public.estoque
    set quantidade = quantidade - v_movement.quantidade,
        quantidade_reservada = greatest(quantidade_reservada - v_movement.quantidade, 0)
    where id = v_movement.estoque_id
      and quantidade >= v_movement.quantidade;

    if not found then
      raise exception 'Saldo reservado nao esta mais disponivel para o pedido %.', p_pedido_id;
    end if;

    update public.movimentacoes_estoque
    set tipo = 'SAIDA',
        referencia_tipo = 'BAIXA_FISICA_CONCILIACAO_RETROATIVA',
        observacoes = coalesce(observacoes, '') || ' | baixa fisica retroativa conciliada pelo painel administrativo'
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  for v_item in
    select id, produto_id, quantidade
    from public.pedidos_expedicao_itens
    where pedido_expedicao_id = p_pedido_id
    for update
  loop
    select coalesce(sum(m.quantidade), 0)
      into v_covered
    from public.movimentacoes_estoque m
    where m.referencia_id = p_pedido_id
      and m.referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA')
      and m.tipo = 'SAIDA'
      and m.produto_id = v_item.produto_id;

    v_remaining := coalesce(v_item.quantidade, 0) - v_covered;

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
