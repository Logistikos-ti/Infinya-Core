-- Dedicated "divergence pending decision" status for shipping orders. When a
-- conference divergence is reported, the order moves here instead of being
-- hard-cancelled straight to CANCELADO -- which would fire
-- estornar_baixas_separacao and DELETE bipagens_separacao, losing the
-- bin-level pick history the return-to-stock scan needs later. Sitting in
-- EM_DIVERGENCIA keeps that history intact and keeps the reservation in place
-- while the order waits for the depositante's tratativa (prosseguir /
-- retornar à fila / cancelar definitivo). Only "cancelar definitivo" then
-- routes into the mandatory return-scan flow (EM_CANCELAMENTO), and because
-- the pick data survived, the physical restock lands on the correct bin.
alter type public.status_pedido_expedicao add value if not exists 'EM_DIVERGENCIA';
commit;

-- Same body as 20260827190000_add_shipping_order_cancellation_status.sql, with
-- EM_DIVERGENCIA added to the early-return exclusion list so a resync (e.g.
-- Bling reposting the order) while it sits in divergence review can't trigger
-- a live stock reservation on top of the one already held.
create or replace function public.reservar_item_pedido_expedicao(
  p_item_id uuid,
  p_usuario_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_requirement record;
  v_stock record;
  v_required numeric;
  v_covered numeric;
  v_missing numeric;
  v_take numeric;
  v_marker text;
  v_withdrawal_method text;
  v_count integer := 0;
begin
  select i.id, i.pedido_expedicao_id, p.status
    into v_item
  from public.pedidos_expedicao_itens i
  join public.pedidos_expedicao p on p.id = i.pedido_expedicao_id
  where i.id = p_item_id
  for update of i, p;

  if not found then
    raise exception 'Item do pedido de expedicao nao encontrado.';
  end if;

  if v_item.status in ('CANCELADO', 'CONFERIDO', 'PRONTO_ROMANEIO', 'EXPEDIDO', 'EM_CANCELAMENTO', 'EM_DIVERGENCIA') then
    return 0;
  end if;

  -- Integrations may receive an order before its SKU is linked to the WMS
  -- catalog. The item remains pending and is reserved automatically as soon
  -- as produto_id is filled by the linkage flow.
  if not exists (
    select 1
    from public.pedidos_expedicao_itens i
    where i.id = p_item_id
      and i.produto_id is not null
  ) then
    return 0;
  end if;

  for v_requirement in
    select r.produto_id, sum(r.quantidade) as quantidade
    from public.requisitos_estoque_item_expedicao(p_item_id) r
    group by r.produto_id
  loop
    v_required := v_requirement.quantidade;
    select coalesce(p.metodo_retirada::text, 'FEFO')
      into v_withdrawal_method
    from public.produtos p
    where p.id = v_requirement.produto_id;

    v_withdrawal_method := coalesce(v_withdrawal_method, 'FEFO');
    v_marker := format(
      'reserva-criacao:item:%s:produto:%s',
      p_item_id::text,
      v_requirement.produto_id::text
    );

    select coalesce(sum(m.quantidade), 0)
      into v_covered
    from public.movimentacoes_estoque m
    where m.referencia_id = v_item.pedido_expedicao_id
      and m.produto_id = v_requirement.produto_id
      and m.observacoes like v_marker || '%'
      and (
        (m.referencia_tipo = 'RESERVA_SEPARACAO_ONDA' and m.tipo = 'BLOQUEIO')
        or (m.referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA') and m.tipo = 'SAIDA')
      );

    v_missing := greatest(v_required - v_covered, 0);

    for v_stock in
      select e.id, e.depositante_id, e.produto_id, e.quantidade,
             e.quantidade_reservada, e.endereco_id
      from public.estoque e
      where e.produto_id = v_requirement.produto_id
        and e.bloqueado = false
        and e.quantidade > e.quantidade_reservada
      order by
        case when v_withdrawal_method = 'FEFO' then e.validade_em end asc nulls last,
        case when v_withdrawal_method = 'LIFO' then e.created_at end desc nulls last,
        case when v_withdrawal_method in ('FEFO', 'FIFO') then e.created_at end asc nulls last,
        e.id
      for update
    loop
      exit when v_missing <= 0;

      v_take := least(v_missing, v_stock.quantidade - v_stock.quantidade_reservada);
      if v_take <= 0 then
        continue;
      end if;

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
        v_stock.depositante_id,
        v_stock.id,
        v_stock.produto_id,
        v_stock.endereco_id,
        'BLOQUEIO',
        v_take,
        'RESERVA_SEPARACAO_ONDA',
        v_item.pedido_expedicao_id,
        v_marker,
        p_usuario_id
      );

      v_missing := v_missing - v_take;
      v_count := v_count + 1;
    end loop;

    if v_missing > 0 then
      raise exception 'Estoque insuficiente para reservar o produto %. Solicitado: %, disponivel: %.',
        v_requirement.produto_id,
        v_required,
        greatest(v_required - v_missing, 0);
    end if;
  end loop;

  return v_count;
end;
$$;
