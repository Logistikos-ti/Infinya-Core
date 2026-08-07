-- Centralizes the physical stock debit at the shipping status boundary.
-- The routine is idempotent: retrying a transition never creates a second exit.
create or replace function public.garantir_baixa_fisica_pedido(
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
  v_movement record;
  v_physical numeric;
  v_reserved numeric;
  v_missing numeric;
  v_take numeric;
  v_count integer := 0;
begin
  select id, depositante_id
    into v_order
  from public.pedidos_expedicao
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de expedicao nao encontrado.';
  end if;

  if not exists (
    select 1
    from public.pedidos_expedicao_itens
    where pedido_expedicao_id = p_pedido_id
  ) then
    raise exception 'Pedido sem itens nao pode avancar para expedicao.';
  end if;

  -- Complete only the uncovered quantity of each item. Existing physical exits
  -- and active reservations are both respected, so retries remain safe.
  for v_item in
    select produto_id, sum(quantidade) as quantidade
    from public.pedidos_expedicao_itens
    where pedido_expedicao_id = p_pedido_id
    group by produto_id
  loop
    select coalesce(sum(quantidade), 0)
      into v_physical
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA')
      and tipo = 'SAIDA'
      and produto_id = v_item.produto_id;

    select coalesce(sum(quantidade), 0)
      into v_reserved
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and tipo = 'BLOQUEIO'
      and produto_id = v_item.produto_id;

    v_missing := greatest(coalesce(v_item.quantidade, 0) - v_physical - v_reserved, 0);

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
        'reserva-automatica-antes-da-baixa-fisica',
        p_usuario_id
      );

      v_missing := v_missing - v_take;
    end loop;

    if v_missing > 0 then
      raise exception 'Saldo insuficiente para baixar o produto %.', v_item.produto_id;
    end if;
  end loop;

  -- Convert active reservations into the physical exit in one transaction.
  for v_movement in
    select *
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and tipo = 'BLOQUEIO'
    order by created_at, id
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
        referencia_tipo = 'BAIXA_FISICA_CONFERENCIA',
        observacoes = coalesce(observacoes, '') || ' | baixa fisica automatica protegida pelo banco'
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  -- A final coverage check prevents any status transition from succeeding with
  -- only a partial debit.
  for v_item in
    select produto_id, sum(quantidade) as quantidade
    from public.pedidos_expedicao_itens
    where pedido_expedicao_id = p_pedido_id
    group by produto_id
  loop
    select coalesce(sum(quantidade), 0)
      into v_physical
    from public.movimentacoes_estoque
    where referencia_id = p_pedido_id
      and referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA')
      and tipo = 'SAIDA'
      and produto_id = v_item.produto_id;

    if v_physical < coalesce(v_item.quantidade, 0) then
      raise exception 'A baixa fisica do item % nao foi concluida.', v_item.produto_id;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.garantir_baixa_fisica_pedido(uuid, uuid) to service_role;

create or replace function public.proteger_transicao_estoque_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_status text;
begin
  if tg_op = 'INSERT' then
    v_status := new.status;
  elsif old.status is distinct from new.status then
    v_status := new.status;
  else
    return new;
  end if;

  if v_status = 'EM_CONFERENCIA' then
    perform public.reservar_pedido_para_conferencia(new.id, v_usuario_id);
  elsif v_status in ('CONFERIDO', 'PRONTO_ROMANEIO', 'EXPEDIDO') then
    perform public.garantir_baixa_fisica_pedido(new.id, v_usuario_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_transicao_estoque_pedido on public.pedidos_expedicao;
create trigger trg_proteger_transicao_estoque_pedido
before insert or update of status on public.pedidos_expedicao
for each row
execute function public.proteger_transicao_estoque_pedido();

-- Repair the reconciliation window created before the protection existed.
do $$
declare
  v_order record;
begin
  for v_order in
    select p.id
    from public.pedidos_expedicao p
    where p.created_at >= '2026-08-05T12:53:15.662061+00:00'::timestamptz
      and p.status in ('PRONTO_ROMANEIO', 'EXPEDIDO')
      and exists (select 1 from public.pedidos_expedicao_itens i where i.pedido_expedicao_id = p.id)
      and exists (
        select 1
        from (
          select i.produto_id, sum(i.quantidade) as quantidade
          from public.pedidos_expedicao_itens i
          where i.pedido_expedicao_id = p.id
          group by i.produto_id
        ) required
        where not exists (
          select 1
          from public.movimentacoes_estoque m
          where m.referencia_id = p.id
            and m.referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA')
            and m.tipo = 'SAIDA'
            and m.produto_id = required.produto_id
          group by m.produto_id
          having sum(m.quantidade) >= required.quantidade
        )
      )
  loop
    perform public.garantir_baixa_fisica_pedido(v_order.id, null);
  end loop;
end;
$$;
