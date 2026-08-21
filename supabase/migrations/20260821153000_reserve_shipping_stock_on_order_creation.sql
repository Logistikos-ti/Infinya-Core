-- Reserve shipping stock as soon as each order item is created.
-- Picking only confirms the allocation; conference converts it into a physical exit.

create table if not exists public.bipagens_separacao (
  id uuid primary key,
  pedido_expedicao_id uuid not null references public.pedidos_expedicao (id) on delete cascade,
  item_pedido_id uuid not null references public.pedidos_expedicao_itens (id) on delete cascade,
  estoque_id uuid not null references public.estoque (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  criado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_bipagens_separacao_pedido_item
  on public.bipagens_separacao (pedido_expedicao_id, item_pedido_id);

create index if not exists idx_bipagens_separacao_estoque
  on public.bipagens_separacao (estoque_id);

alter table public.bipagens_separacao enable row level security;

create or replace function public.requisitos_estoque_item_expedicao(
  p_item_id uuid
)
returns table (
  produto_id uuid,
  quantidade numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.pedidos_expedicao_itens%rowtype;
  v_component jsonb;
  v_component_id_text text;
  v_component_quantity numeric;
  v_has_payload_components boolean := false;
  v_product_type text;
begin
  select *
    into v_item
  from public.pedidos_expedicao_itens
  where id = p_item_id;

  if not found then
    raise exception 'Item do pedido de expedicao nao encontrado.';
  end if;

  if coalesce(v_item.quantidade, 0) <= 0 then
    raise exception 'A quantidade do item deve ser maior que zero.';
  end if;

  if jsonb_typeof(v_item.payload_origem #> '{kit_operacional,componentes}') = 'array' then
    if jsonb_array_length(v_item.payload_origem #> '{kit_operacional,componentes}') > 0 then
      v_has_payload_components := true;

      for v_component in
        select value
        from jsonb_array_elements(v_item.payload_origem #> '{kit_operacional,componentes}')
      loop
        v_component_id_text := nullif(btrim(v_component ->> 'produtoComponenteId'), '');
        v_component_quantity := coalesce(
          nullif(v_component ->> 'quantidadePorKit', '')::numeric,
          nullif(v_component ->> 'quantidade', '')::numeric,
          0
        );

        if v_component_id_text is null
           or v_component_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           or v_component_quantity <= 0 then
          raise exception 'A configuracao operacional do kit esta incompleta.';
        end if;

        produto_id := v_component_id_text::uuid;
        quantidade := v_item.quantidade * v_component_quantity;
        return next;
      end loop;
    end if;
  end if;

  if v_has_payload_components then
    return;
  end if;

  if v_item.produto_id is null then
    raise exception 'O produto % ainda nao esta vinculado ao catalogo.', coalesce(v_item.nome, 'sem nome');
  end if;

  select p.tipo_produto::text
    into v_product_type
  from public.produtos p
  where p.id = v_item.produto_id;

  if coalesce(v_product_type, 'SIMPLES') = 'KIT'
     and exists (
       select 1
       from public.produto_kit_componentes c
       where c.produto_kit_id = v_item.produto_id
     ) then
    return query
    select
      c.produto_componente_id,
      v_item.quantidade * c.quantidade
    from public.produto_kit_componentes c
    where c.produto_kit_id = v_item.produto_id;
    return;
  end if;

  produto_id := v_item.produto_id;
  quantidade := v_item.quantidade;
  return next;
end;
$$;

create or replace function public.liberar_reserva_item_expedicao(
  p_item_id uuid,
  p_usuario_id uuid default null,
  p_motivo text default 'Alteracao do item do pedido'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
  v_count integer := 0;
  v_marker text := 'reserva-criacao:item:' || p_item_id::text || ':%';
begin
  for v_movement in
    select m.*
    from public.movimentacoes_estoque m
    where m.referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and m.tipo = 'BLOQUEIO'
      and m.observacoes like v_marker
    order by m.created_at, m.id
    for update
  loop
    update public.estoque
    set quantidade_reservada = greatest(quantidade_reservada - v_movement.quantidade, 0)
    where id = v_movement.estoque_id;

    update public.movimentacoes_estoque
    set tipo = 'DESBLOQUEIO',
        referencia_tipo = 'RESERVA_SEPARACAO_ONDA_ESTORNADA',
        observacoes = coalesce(observacoes, '') || ' | estornado: ' || coalesce(p_motivo, 'Alteracao do item')
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  delete from public.bipagens_separacao
  where item_pedido_id = p_item_id;

  return v_count;
end;
$$;

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

  if v_item.status in ('CANCELADO', 'CONFERIDO', 'PRONTO_ROMANEIO', 'EXPEDIDO') then
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

create or replace function public.reservar_estoque_pedido_criado(
  p_pedido_id uuid,
  p_usuario_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_count integer := 0;
begin
  for v_item in
    select i.id
    from public.pedidos_expedicao_itens i
    where i.pedido_expedicao_id = p_pedido_id
    order by i.created_at, i.id
  loop
    v_count := v_count + public.reservar_item_pedido_expedicao(v_item.id, p_usuario_id);
  end loop;

  return v_count;
end;
$$;

create or replace function public.trg_reservar_item_pedido_expedicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reservar_item_pedido_expedicao(new.id, auth.uid());
  return new;
end;
$$;

create or replace function public.trg_liberar_reserva_item_expedicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.liberar_reserva_item_expedicao(
    old.id,
    auth.uid(),
    case when tg_op = 'DELETE' then 'Exclusao do item do pedido' else 'Alteracao do item do pedido' end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reservar_item_pedido_expedicao_insert on public.pedidos_expedicao_itens;
create trigger trg_reservar_item_pedido_expedicao_insert
after insert on public.pedidos_expedicao_itens
for each row
execute function public.trg_reservar_item_pedido_expedicao();

drop trigger if exists trg_liberar_reserva_item_pedido_expedicao_update on public.pedidos_expedicao_itens;
create trigger trg_liberar_reserva_item_pedido_expedicao_update
before update of produto_id, quantidade on public.pedidos_expedicao_itens
for each row
when (old.produto_id is distinct from new.produto_id or old.quantidade is distinct from new.quantidade)
execute function public.trg_liberar_reserva_item_expedicao();

drop trigger if exists trg_reservar_item_pedido_expedicao_update on public.pedidos_expedicao_itens;
create trigger trg_reservar_item_pedido_expedicao_update
after update of produto_id, quantidade on public.pedidos_expedicao_itens
for each row
when (old.produto_id is distinct from new.produto_id or old.quantidade is distinct from new.quantidade)
execute function public.trg_reservar_item_pedido_expedicao();

drop trigger if exists trg_liberar_reserva_item_pedido_expedicao_delete on public.pedidos_expedicao_itens;
create trigger trg_liberar_reserva_item_pedido_expedicao_delete
before delete on public.pedidos_expedicao_itens
for each row
execute function public.trg_liberar_reserva_item_expedicao();

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
  v_item record;
  v_required numeric;
  v_reserved_here numeric;
  v_scanned_here numeric;
  v_next_quantity numeric;
  v_is_simple boolean;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade bipada deve ser maior que zero.';
  end if;

  if exists (select 1 from public.bipagens_separacao where id = p_scan_id) then
    return jsonb_build_object('already_processed', true, 'scan_id', p_scan_id);
  end if;

  select i.id, i.produto_id, i.quantidade, i.quantidade_separada
    into v_item
  from public.pedidos_expedicao_itens i
  where i.id = p_item_id
    and i.pedido_expedicao_id = p_pedido_id
  for update;

  if not found then
    raise exception 'Item do pedido nao encontrado.';
  end if;

  select *
    into v_stock
  from public.estoque
  where id = p_estoque_id
  for update;

  if not found then
    raise exception 'O saldo do endereco selecionado nao foi encontrado.';
  end if;

  if v_stock.bloqueado then
    raise exception 'O endereco selecionado esta bloqueado para operacao.';
  end if;

  select coalesce(sum(r.quantidade), 0)
    into v_required
  from public.requisitos_estoque_item_expedicao(p_item_id) r
  where r.produto_id = v_stock.produto_id;

  if v_required <= 0 then
    raise exception 'O saldo selecionado nao pertence ao produto operacional deste item.';
  end if;

  select coalesce(sum(m.quantidade), 0)
    into v_reserved_here
  from public.movimentacoes_estoque m
  where m.referencia_id = p_pedido_id
    and m.referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
    and m.tipo = 'BLOQUEIO'
    and m.estoque_id = p_estoque_id
    and m.produto_id = v_stock.produto_id
    and m.observacoes like 'reserva-criacao:item:' || p_item_id::text || ':%';

  if v_reserved_here <= 0 then
    raise exception 'Este endereco nao possui saldo reservado para o item deste pedido.';
  end if;

  select coalesce(sum(b.quantidade), 0)
    into v_scanned_here
  from public.bipagens_separacao b
  where b.pedido_expedicao_id = p_pedido_id
    and b.item_pedido_id = p_item_id
    and b.estoque_id = p_estoque_id;

  if v_scanned_here + p_quantidade > v_reserved_here then
    raise exception 'A leitura ultrapassa a quantidade reservada neste endereco.';
  end if;

  insert into public.bipagens_separacao (
    id,
    pedido_expedicao_id,
    item_pedido_id,
    estoque_id,
    produto_id,
    quantidade,
    criado_por
  ) values (
    p_scan_id,
    p_pedido_id,
    p_item_id,
    p_estoque_id,
    v_stock.produto_id,
    p_quantidade,
    p_usuario_id
  );

  select count(*) = 1
         and (array_agg(r.produto_id))[1] = v_item.produto_id
         and max(r.quantidade) = v_item.quantidade
    into v_is_simple
  from public.requisitos_estoque_item_expedicao(p_item_id) r;

  if v_is_simple then
    v_next_quantity := least(
      coalesce(v_item.quantidade, 0),
      coalesce(v_item.quantidade_separada, 0) + p_quantidade
    );

    update public.pedidos_expedicao_itens
    set quantidade_separada = v_next_quantity
    where id = p_item_id;
  else
    v_next_quantity := coalesce(v_item.quantidade_separada, 0);
  end if;

  return jsonb_build_object(
    'already_processed', false,
    'scan_id', p_scan_id,
    'stock_id', v_stock.id,
    'stock_quantity', v_stock.quantidade,
    'item_quantity', v_next_quantity
  );
end;
$$;

-- A true order cancellation releases the allocation. Merely leaving or
-- deleting a picking wave must not call this function anymore.
create or replace function public.estornar_baixas_separacao(
  p_pedido_id uuid,
  p_usuario_id uuid,
  p_motivo text default 'Cancelamento do pedido'
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
    select m.*
    from public.movimentacoes_estoque m
    where m.referencia_id = p_pedido_id
      and m.referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
      and m.tipo = 'BLOQUEIO'
    order by m.created_at, m.id
    for update
  loop
    update public.estoque
    set quantidade_reservada = greatest(quantidade_reservada - v_movement.quantidade, 0)
    where id = v_movement.estoque_id;

    update public.movimentacoes_estoque
    set tipo = 'DESBLOQUEIO',
        referencia_tipo = 'RESERVA_SEPARACAO_ONDA_ESTORNADA',
        observacoes = coalesce(observacoes, '') || ' | estornado: ' || coalesce(p_motivo, 'Cancelamento do pedido')
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  delete from public.bipagens_separacao
  where pedido_expedicao_id = p_pedido_id;

  return v_count;
end;
$$;

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
  v_requirement record;
  v_movement record;
  v_physical numeric;
  v_count integer := 0;
begin
  select p.id
    into v_order
  from public.pedidos_expedicao p
  where p.id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de expedicao nao encontrado.';
  end if;

  if not exists (
    select 1 from public.pedidos_expedicao_itens i where i.pedido_expedicao_id = p_pedido_id
  ) then
    raise exception 'Pedido sem itens nao pode avancar para expedicao.';
  end if;

  perform public.reservar_estoque_pedido_criado(p_pedido_id, p_usuario_id);

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
        referencia_tipo = 'BAIXA_FISICA_CONFERENCIA',
        observacoes = coalesce(observacoes, '') || ' | baixa fisica automatica protegida pelo banco'
    where id = v_movement.id;

    v_count := v_count + 1;
  end loop;

  for v_requirement in
    select r.produto_id, sum(r.quantidade) as quantidade
    from public.pedidos_expedicao_itens i
    cross join lateral public.requisitos_estoque_item_expedicao(i.id) r
    where i.pedido_expedicao_id = p_pedido_id
    group by r.produto_id
  loop
    select coalesce(sum(m.quantidade), 0)
      into v_physical
    from public.movimentacoes_estoque m
    where m.referencia_id = p_pedido_id
      and m.referencia_tipo in ('BAIXA_FISICA_CONFERENCIA', 'BAIXA_FISICA_CONCILIACAO_RETROATIVA')
      and m.tipo = 'SAIDA'
      and m.produto_id = v_requirement.produto_id;

    if v_physical < v_requirement.quantidade then
      raise exception 'A baixa fisica do produto % nao foi concluida.', v_requirement.produto_id;
    end if;
  end loop;

  return v_count;
end;
$$;

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
    perform public.reservar_estoque_pedido_criado(new.id, v_usuario_id);
  elsif v_status in ('CONFERIDO', 'PRONTO_ROMANEIO', 'EXPEDIDO') then
    perform public.garantir_baixa_fisica_pedido(new.id, v_usuario_id);
  elsif v_status = 'CANCELADO' and tg_op = 'UPDATE' then
    perform public.estornar_baixas_separacao(new.id, v_usuario_id, 'Cancelamento do pedido');
  end if;

  return new;
end;
$$;

grant select, insert, delete on public.bipagens_separacao to service_role;
grant execute on function public.requisitos_estoque_item_expedicao(uuid) to service_role;
grant execute on function public.liberar_reserva_item_expedicao(uuid, uuid, text) to service_role;
grant execute on function public.reservar_item_pedido_expedicao(uuid, uuid) to service_role;
grant execute on function public.reservar_estoque_pedido_criado(uuid, uuid) to service_role;
grant execute on function public.registrar_bipagem_separacao(uuid, uuid, uuid, numeric, uuid, uuid) to service_role;
grant execute on function public.garantir_baixa_fisica_pedido(uuid, uuid) to service_role;
grant execute on function public.estornar_baixas_separacao(uuid, uuid, text) to service_role;

-- Convert legacy wave-time reservations and reserve every waiting order. Each
-- order runs in its own subtransaction: if its backfill cannot be completed,
-- its previous reservation is restored and the remaining orders continue.
do $$
declare
  v_order record;
  v_movement record;
begin
  for v_order in
    select p.id
    from public.pedidos_expedicao p
    where p.status in ('NOVO', 'EM_SEPARACAO', 'SEPARADO', 'EM_CONFERENCIA')
    order by p.created_at, p.id
  loop
    begin
      for v_movement in
        select m.*
        from public.movimentacoes_estoque m
        where m.referencia_id = v_order.id
          and m.referencia_tipo = 'RESERVA_SEPARACAO_ONDA'
          and m.tipo = 'BLOQUEIO'
          and coalesce(m.observacoes, '') not like 'reserva-criacao:item:%'
        order by m.created_at, m.id
        for update
      loop
        update public.estoque
        set quantidade_reservada = greatest(quantidade_reservada - v_movement.quantidade, 0)
        where id = v_movement.estoque_id;

        update public.movimentacoes_estoque
        set tipo = 'DESBLOQUEIO',
            referencia_tipo = 'RESERVA_SEPARACAO_ONDA_ESTORNADA',
            observacoes = coalesce(observacoes, '') || ' | migrada para reserva na criacao do pedido'
        where id = v_movement.id;
      end loop;

      perform public.reservar_estoque_pedido_criado(v_order.id, null);
    exception when others then
      raise warning 'Pedido % nao foi reservado durante o backfill: %', v_order.id, sqlerrm;
    end;
  end loop;
end;
$$;
