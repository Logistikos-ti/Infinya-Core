-- "Sem estoque" cancellation (cancelPickingOrderAction) reverses the item's
-- reservation via estornar_baixas_separacao but never touched estoque.quantidade.
-- The operator standing at the shelf is reporting a physical count of zero for
-- that address, exactly the same kind of signal the general-inventory cycle
-- count already treats as ground truth (finalize_general_inventory) -- but
-- here it was silently discarded. The WMS kept believing the phantom quantity
-- was still there, so the very next order for that SKU could reserve it again
-- and repeat the same "sem estoque" cancellation indefinitely (this is exactly
-- what happened to SKU JS200SPT00M / depositante John Skull on 2026-08-28).
--
-- This new function does what estornar_baixas_separacao does (release the
-- reservation) plus applies a matching AJUSTE_NEGATIVO to the exact
-- estoque_id rows that were reserved for this order, capped at each row's own
-- current quantidade so it can never go negative. It is intentionally NOT a
-- replacement for estornar_baixas_separacao: that function is also invoked by
-- the generic CANCELADO trigger (proteger_transicao_estoque_pedido) for
-- cancellations that have nothing to do with physical stock (e.g. customer
-- changed their mind) and must not zero out real inventory. Only
-- cancelPickingOrderAction -- the explicit "sem estoque" button an operator
-- clicks after physically checking the address -- calls this one.
create or replace function public.estornar_reserva_sem_estoque_fisico(
  p_pedido_id uuid,
  p_usuario_id uuid default null,
  p_motivo text default 'Cancelamento por falta de estoque'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
  v_stock record;
  v_take numeric;
  v_count integer := 0;
begin
  for v_movement in
    select m.*
    from public.movimentacoes_estoque m
    where m.referencia_id = p_pedido_id
      and m.referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and m.tipo = 'BLOQUEIO'
    order by m.created_at, m.id
    for update
  loop
    select id, quantidade
      into v_stock
    from public.estoque
    where id = v_movement.estoque_id
    for update;

    update public.estoque
    set quantidade_reservada = greatest(quantidade_reservada - v_movement.quantidade, 0)
    where id = v_movement.estoque_id;

    update public.movimentacoes_estoque
    set tipo = 'DESBLOQUEIO',
        referencia_tipo = 'RESERVA_SEPARACAO_ONDA_ESTORNADA',
        observacoes = coalesce(observacoes, '') || ' | estornado: ' || coalesce(p_motivo, 'Cancelamento do pedido')
    where id = v_movement.id;

    if v_stock.id is not null then
      v_take := least(v_movement.quantidade, coalesce(v_stock.quantidade, 0));
      if v_take > 0 then
        update public.estoque
        set quantidade = greatest(quantidade - v_take, 0)
        where id = v_stock.id;

        insert into public.movimentacoes_estoque (
          depositante_id, estoque_id, produto_id, endereco_origem_id,
          tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
        ) values (
          v_movement.depositante_id, v_stock.id, v_movement.produto_id, v_movement.endereco_origem_id,
          'AJUSTE_NEGATIVO', v_take, 'DIVERGENCIA_SEM_ESTOQUE_SEPARACAO', p_pedido_id,
          'Ajuste automatico: operador confirmou ausencia fisica no endereco durante a separacao (' || coalesce(p_motivo, 'Cancelamento por falta de estoque') || ').',
          p_usuario_id
        );
      end if;
    end if;

    v_count := v_count + 1;
  end loop;

  delete from public.bipagens_separacao
  where pedido_expedicao_id = p_pedido_id;

  return v_count;
end;
$$;

grant execute on function public.estornar_reserva_sem_estoque_fisico(uuid, uuid, text) to service_role;
