create table if not exists public.inventários_gerais (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes(id) on delete cascade,
  data_operacional date not null default (timezone('America/Sao_Paulo', now()))::date,
  status text not null default 'EM_CONTAGEM' check (status in ('EM_CONTAGEM', 'CONCLUIDO', 'CANCELADO')),
  criado_por uuid references public.usuarios(id) on delete set null,
  iniciado_em timestamptz not null default timezone('utc', now()),
  concluido_em timestamptz,
  observacoes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists inventários_gerais_um_aberto_por_dia
  on public.inventários_gerais (depositante_id, data_operacional)
  where status = 'EM_CONTAGEM';

create index if not exists inventários_gerais_depositante_data_idx
  on public.inventários_gerais (depositante_id, data_operacional desc);

create table if not exists public.inventários_gerais_itens (
  id uuid primary key default gen_random_uuid(),
  inventário_id uuid not null references public.inventários_gerais(id) on delete cascade,
  depositante_id uuid not null references public.depositantes(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  nome_produto text not null,
  sku text,
  codigo_externo text,
  codigo_interno text,
  codigo_externo_pack text,
  imagem_url text,
  quantidade_sistema numeric(12, 3) not null default 0,
  quantidade_contada numeric(12, 3),
  divergencia numeric(12, 3) not null default 0,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'CONTADO', 'DIVERGENTE')),
  estoque_snapshot jsonb not null default '[]'::jsonb,
  atribuido_a uuid references public.usuarios(id) on delete set null,
  atribuido_em timestamptz,
  contado_por uuid references public.usuarios(id) on delete set null,
  contado_em timestamptz,
  observacoes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (inventário_id, produto_id)
);

create index if not exists inventários_gerais_itens_inventário_idx
  on public.inventários_gerais_itens (inventário_id, status);

create table if not exists public.inventários_gerais_participantes (
  id uuid primary key default gen_random_uuid(),
  inventário_id uuid not null references public.inventários_gerais(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  iniciado_em timestamptz not null default timezone('utc', now()),
  finalizado_em timestamptz,
  unique (inventário_id, usuario_id)
);

create or replace function public.inventários_gerais_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists inventários_gerais_set_updated_at on public.inventários_gerais;
create trigger inventários_gerais_set_updated_at
before update on public.inventários_gerais
for each row execute function public.inventários_gerais_set_updated_at();

drop trigger if exists inventários_gerais_itens_set_updated_at on public.inventários_gerais_itens;
create trigger inventários_gerais_itens_set_updated_at
before update on public.inventários_gerais_itens
for each row execute function public.inventários_gerais_set_updated_at();

alter table public.inventários_gerais enable row level security;
alter table public.inventários_gerais_itens enable row level security;
alter table public.inventários_gerais_participantes enable row level security;

drop policy if exists inventários_gerais_access on public.inventários_gerais;
create policy inventários_gerais_access
on public.inventários_gerais
for all to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

drop policy if exists inventários_gerais_itens_access on public.inventários_gerais_itens;
create policy inventários_gerais_itens_access
on public.inventários_gerais_itens
for all to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

drop policy if exists inventários_gerais_participantes_access on public.inventários_gerais_participantes;
create policy inventários_gerais_participantes_access
on public.inventários_gerais_participantes
for all to authenticated
using (exists (
  select 1 from public.inventários_gerais i
  where i.id = inventário_id and public.can_access_depositante(i.depositante_id)
))
with check (exists (
  select 1 from public.inventários_gerais i
  where i.id = inventário_id and public.can_access_depositante(i.depositante_id)
));

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
  v_inventory public.inventários_gerais%rowtype;
  v_item record;
  v_snapshot record;
  v_stock record;
  v_delta numeric;
  v_new_quantity numeric;
  v_divergent integer := 0;
  v_zeroed integer := 0;
  v_increased integer := 0;
  v_decreased integer := 0;
  v_adjusted integer := 0;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_movement_type public.tipo_movimentacao_estoque;
begin
  select * into v_inventory
  from public.inventários_gerais
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
    select 1 from public.inventários_gerais_itens
    where inventário_id = p_inventory_id and status = 'PENDENTE'
  ) then
    raise exception 'Ainda existem produtos sem contagem.';
  end if;

  for v_item in
    select * from public.inventários_gerais_itens
    where inventário_id = p_inventory_id
    for update
  loop
    if v_item.status = 'DIVERGENTE' then
      v_divergent := v_divergent + 1;
    end if;

    v_delta := coalesce(v_item.quantidade_contada, 0) - coalesce(v_item.quantidade_sistema, 0);

    if v_delta <> 0 then
      select x.id, x.quantidade, x.endereco_id
      into v_snapshot
      from jsonb_to_recordset(v_item.estoque_snapshot) as x(id uuid, quantidade numeric, endereco_id uuid)
      order by x.quantidade desc nulls last
      limit 1;

      if not found then
        if coalesce(v_item.quantidade_contada, 0) > 0 then
          raise exception 'O produto % foi contado com saldo, mas não possui endereço de estoque para receber o ajuste.', v_item.nome_produto;
        end if;
      else
        select id, quantidade, quantidade_reservada
        into v_stock
        from public.estoque
        where id = v_snapshot.id
        for update;

        if not found then
          raise exception 'O saldo de estoque do produto % não está mais disponível.', v_item.nome_produto;
        end if;

        v_new_quantity := coalesce(v_stock.quantidade, 0) + v_delta;
        if v_new_quantity < coalesce(v_stock.quantidade_reservada, 0) then
          raise exception 'A contagem do produto % ficou abaixo do saldo reservado.', v_item.nome_produto;
        end if;

        update public.estoque
        set quantidade = v_new_quantity
        where id = v_stock.id;

        v_movement_type := case when v_delta > 0 then 'AJUSTE_POSITIVO' else 'AJUSTE_NEGATIVO' end;
        insert into public.movimentacoes_estoque (
          depositante_id, estoque_id, produto_id, endereco_origem_id, endereco_destino_id,
          tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
        )
        values (
          v_item.depositante_id, v_stock.id, v_item.produto_id,
          case when v_delta < 0 then v_snapshot.endereco_id else null end,
          case when v_delta > 0 then v_snapshot.endereco_id else null end,
          v_movement_type, abs(v_delta), 'INVENTARIO_GERAL', p_inventory_id,
          'Ajuste consolidado pelo inventário geral diário.', p_user_id
        );

        v_adjusted := v_adjusted + 1;
        if v_delta > 0 then v_increased := v_increased + 1; else v_decreased := v_decreased + 1; end if;
      end if;
    end if;

    if coalesce(v_item.quantidade_contada, 0) = 0 then
      v_zeroed := v_zeroed + 1;
    end if;

    update public.inventários_gerais_itens
    set observacoes = coalesce(observacoes, '') || case when observacoes is null then '' else ' ' end || 'Fechado pelo inventário geral.',
        updated_at = timezone('utc', now())
    where id = v_item.id;
  end loop;

  update public.inventários_gerais
  set status = 'CONCLUIDO', concluido_em = timezone('utc', now()), observacoes = coalesce(observacoes, '')
  where id = p_inventory_id;

  update public.inventários_gerais_participantes
  set finalizado_em = timezone('utc', now())
  where inventário_id = p_inventory_id and usuario_id = p_user_id;

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
