-- finalize_general_inventory previously applied a divergent count to a
-- SINGLE stock row (the one with the largest quantidade in the item's
-- estoque_snapshot), even when the product's stock is spread across
-- multiple addresses. That's harmless for a surplus (increase), but for a
-- shortage (reduction) larger than what the single largest bin alone holds,
-- it raised a confusing "abaixo do saldo reservado" error and blocked the
-- whole inventory from being confirmed, even though the counted total was
-- perfectly valid once distributed across every address that holds the
-- product.
--
-- This redefinition keeps crediting a surplus to the largest bin (unchanged,
-- always safe) but now consumes a shortage across every bin in the
-- snapshot -- largest first -- never taking any single bin below its own
-- reserved quantity, mirroring the FEFO-style consumption already used by
-- garantir_baixa_fisica_pedido.
create or replace function public.finalize_general_inventory(
  p_inventory_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.inventarios_gerais%rowtype;
  v_item record;
  v_snapshot_row record;
  v_stock record;
  v_delta numeric;
  v_remaining numeric;
  v_take numeric;
  v_new_quantity numeric;
  v_divergent integer := 0;
  v_zeroed integer := 0;
  v_increased integer := 0;
  v_decreased integer := 0;
  v_adjusted integer := 0;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
begin
  select * into v_inventory
  from public.inventarios_gerais
  where id = p_inventory_id
  for update;

  if not found then
    raise exception 'Inventário geral não encontrado.';
  end if;

  if v_inventory.status <> 'EM_CONTAGEM' then
    raise exception 'Este inventário geral já foi encerrado.';
  end if;

  if v_inventory.data_operacional <> v_today then
    raise exception 'O inventário geral precisa ser concluído no mesmo dia em que foi iniciado.';
  end if;

  if exists (
    select 1 from public.inventarios_gerais_itens
    where inventario_id = p_inventory_id and status = 'PENDENTE'
  ) then
    raise exception 'Ainda existem produtos sem contagem.';
  end if;

  for v_item in
    select * from public.inventarios_gerais_itens
    where inventario_id = p_inventory_id
    for update
  loop
    if v_item.status = 'DIVERGENTE' then
      v_divergent := v_divergent + 1;
    end if;

    v_delta := coalesce(v_item.quantidade_contada, 0) - coalesce(v_item.quantidade_sistema, 0);

    if v_delta > 0 then
      -- Surplus: credited entirely to the bin with the largest balance. A
      -- positive adjustment can never drive any bin negative, so a single
      -- destination is always safe.
      select x.id, x.quantidade, x.endereco_id
      into v_snapshot_row
      from jsonb_to_recordset(v_item.estoque_snapshot) as x(id uuid, quantidade numeric, endereco_id uuid)
      order by x.quantidade desc nulls last
      limit 1;

      if not found then
        raise exception 'O produto % foi contado com saldo maior que o sistema, mas não possui endereço de estoque para receber o ajuste.', v_item.nome_produto;
      end if;

      select id, quantidade, quantidade_reservada
      into v_stock
      from public.estoque
      where id = v_snapshot_row.id
      for update;

      if not found then
        raise exception 'O saldo de estoque do produto % não está mais disponível.', v_item.nome_produto;
      end if;

      v_new_quantity := coalesce(v_stock.quantidade, 0) + v_delta;

      update public.estoque
      set quantidade = v_new_quantity
      where id = v_stock.id;

      insert into public.movimentacoes_estoque (
        depositante_id, estoque_id, produto_id, endereco_origem_id, endereco_destino_id,
        tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
      )
      values (
        v_item.depositante_id, v_stock.id, v_item.produto_id,
        null, v_snapshot_row.endereco_id,
        'AJUSTE_POSITIVO', v_delta, 'INVENTARIO_GERAL', p_inventory_id,
        'Ajuste consolidado pelo inventário geral diário.', p_user_id
      );

      v_adjusted := v_adjusted + 1;
      v_increased := v_increased + 1;
    elsif v_delta < 0 then
      -- Shortage: consumed across every bin in the snapshot, largest first,
      -- never taking any single bin below its own reserved quantity.
      v_remaining := abs(v_delta);

      for v_snapshot_row in
        select x.id, x.quantidade, x.endereco_id
        from jsonb_to_recordset(v_item.estoque_snapshot) as x(id uuid, quantidade numeric, endereco_id uuid)
        order by x.quantidade desc nulls last
      loop
        exit when v_remaining <= 0;

        select id, quantidade, quantidade_reservada
        into v_stock
        from public.estoque
        where id = v_snapshot_row.id
        for update;

        if not found then
          continue;
        end if;

        v_take := least(v_remaining, greatest(coalesce(v_stock.quantidade, 0) - coalesce(v_stock.quantidade_reservada, 0), 0));
        if v_take <= 0 then
          continue;
        end if;

        update public.estoque
        set quantidade = quantidade - v_take
        where id = v_stock.id;

        insert into public.movimentacoes_estoque (
          depositante_id, estoque_id, produto_id, endereco_origem_id, endereco_destino_id,
          tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
        )
        values (
          v_item.depositante_id, v_stock.id, v_item.produto_id,
          v_snapshot_row.endereco_id, null,
          'AJUSTE_NEGATIVO', v_take, 'INVENTARIO_GERAL', p_inventory_id,
          'Ajuste consolidado pelo inventário geral diário.', p_user_id
        );

        v_remaining := v_remaining - v_take;
      end loop;

      if v_remaining > 0 then
        raise exception 'A contagem do produto % ficou abaixo do saldo reservado em todos os endereços disponíveis.', v_item.nome_produto;
      end if;

      v_adjusted := v_adjusted + 1;
      v_decreased := v_decreased + 1;
    end if;

    if coalesce(v_item.quantidade_contada, 0) = 0 then
      v_zeroed := v_zeroed + 1;
    end if;

    update public.inventarios_gerais_itens
    set observacoes = coalesce(observacoes, '') || case when observacoes is null then '' else ' ' end || 'Fechado pelo inventário geral.',
        updated_at = timezone('utc', now())
    where id = v_item.id;
  end loop;

  update public.inventarios_gerais
  set status = 'CONCLUIDO', concluido_em = timezone('utc', now()), observacoes = coalesce(observacoes, '')
  where id = p_inventory_id;

  update public.inventarios_gerais_participantes
  set finalizado_em = timezone('utc', now())
  where inventario_id = p_inventory_id and usuario_id = p_user_id;

  return jsonb_build_object(
    'divergentes', v_divergent,
    'zerados', v_zeroed,
    'aumentos', v_increased,
    'reducoes', v_decreased,
    'ajustesAplicados', v_adjusted
  );
end;
$$;

grant execute on function public.finalize_general_inventory(uuid, uuid) to authenticated;
