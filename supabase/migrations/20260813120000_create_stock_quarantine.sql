create table if not exists public.estoque_quarentena (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  estoque_id uuid references public.estoque(id) on delete set null,
  endereco_id uuid references public.enderecos(id) on delete set null,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  motivo text not null,
  status text not null default 'EM_QUARENTENA' check (status in ('EM_QUARENTENA', 'LIBERADO', 'DESCARTADO')),
  resolucao_observacoes text,
  criado_por uuid constraint estoque_quarentena_criado_por_fkey references public.usuarios(id),
  resolvido_por uuid constraint estoque_quarentena_resolvido_por_fkey references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_estoque_quarentena_depositante_status
  on public.estoque_quarentena (depositante_id, status, created_at desc);

create index if not exists idx_estoque_quarentena_produto_status
  on public.estoque_quarentena (produto_id, status);

create index if not exists idx_estoque_quarentena_estoque_status
  on public.estoque_quarentena (estoque_id, status);

alter table public.estoque_quarentena enable row level security;

drop policy if exists estoque_quarentena_service_all on public.estoque_quarentena;
create policy estoque_quarentena_service_all
  on public.estoque_quarentena
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.set_estoque_quarentena_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_estoque_quarentena_updated_at on public.estoque_quarentena;
create trigger trg_estoque_quarentena_updated_at
before update on public.estoque_quarentena
for each row
execute function public.set_estoque_quarentena_updated_at();

create or replace function public.criar_quarentena_estoque(
  p_estoque_id uuid,
  p_quantidade numeric,
  p_motivo text,
  p_usuario_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estoque record;
  v_quarentena_id uuid;
  v_quantidade numeric := coalesce(p_quantidade, 0);
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_disponivel numeric;
begin
  if v_quantidade <= 0 then
    raise exception 'Informe uma quantidade maior que zero para quarentena.';
  end if;

  if v_motivo = '' then
    raise exception 'Informe o motivo da quarentena.';
  end if;

  select
    id,
    depositante_id,
    produto_id,
    endereco_id,
    quantidade,
    quantidade_reservada,
    bloqueado
  into v_estoque
  from public.estoque
  where id = p_estoque_id
  for update;

  if not found then
    raise exception 'Saldo de estoque nao encontrado.';
  end if;

  if coalesce(v_estoque.bloqueado, false) then
    raise exception 'Este saldo esta bloqueado e nao pode ser enviado para quarentena.';
  end if;

  v_disponivel := greatest(
    0,
    coalesce(v_estoque.quantidade, 0) - coalesce(v_estoque.quantidade_reservada, 0)
  );

  if v_quantidade > v_disponivel then
    raise exception 'Quantidade de quarentena maior que o saldo disponivel.';
  end if;

  update public.estoque
  set quantidade = coalesce(quantidade, 0) - v_quantidade
  where id = v_estoque.id;

  insert into public.estoque_quarentena (
    depositante_id,
    produto_id,
    estoque_id,
    endereco_id,
    quantidade,
    motivo,
    status,
    criado_por
  )
  values (
    v_estoque.depositante_id,
    v_estoque.produto_id,
    v_estoque.id,
    v_estoque.endereco_id,
    v_quantidade,
    v_motivo,
    'EM_QUARENTENA',
    p_usuario_id
  )
  returning id into v_quarentena_id;

  insert into public.movimentacoes_estoque (
    depositante_id,
    estoque_id,
    produto_id,
    endereco_origem_id,
    endereco_destino_id,
    tipo,
    quantidade,
    referencia_tipo,
    referencia_id,
    observacoes,
    criado_por
  )
  values (
    v_estoque.depositante_id,
    v_estoque.id,
    v_estoque.produto_id,
    v_estoque.endereco_id,
    null,
    'BLOQUEIO',
    v_quantidade,
    'QUARENTENA_ESTOQUE',
    v_quarentena_id,
    v_motivo,
    p_usuario_id
  );

  return v_quarentena_id;
end;
$$;

create or replace function public.resolver_quarentena_estoque(
  p_quarentena_id uuid,
  p_acao text,
  p_usuario_id uuid,
  p_observacoes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quarentena record;
  v_acao text := upper(btrim(coalesce(p_acao, '')));
  v_status_final text;
  v_tipo public.tipo_movimentacao_estoque;
  v_ref_tipo text;
begin
  select *
  into v_quarentena
  from public.estoque_quarentena
  where id = p_quarentena_id
  for update;

  if not found then
    raise exception 'Registro de quarentena nao encontrado.';
  end if;

  if v_quarentena.status <> 'EM_QUARENTENA' then
    raise exception 'Esta quarentena ja foi resolvida.';
  end if;

  if v_acao in ('LIBERAR', 'LIBERADO', 'RELEASE') then
    if v_quarentena.estoque_id is null then
      raise exception 'Nao foi possivel devolver a quantidade ao estoque original.';
    end if;

    update public.estoque
    set quantidade = coalesce(quantidade, 0) + v_quarentena.quantidade
    where id = v_quarentena.estoque_id;

    v_status_final := 'LIBERADO';
    v_tipo := 'DESBLOQUEIO';
    v_ref_tipo := 'LIBERACAO_QUARENTENA';
  elsif v_acao in ('DESCARTAR', 'DESCARTADO', 'DISCARD') then
    v_status_final := 'DESCARTADO';
    v_tipo := 'AJUSTE_NEGATIVO';
    v_ref_tipo := 'DESCARTE_QUARENTENA';
  else
    raise exception 'Acao de quarentena invalida.';
  end if;

  update public.estoque_quarentena
  set
    status = v_status_final,
    resolvido_por = p_usuario_id,
    resolucao_observacoes = nullif(btrim(coalesce(p_observacoes, '')), ''),
    resolved_at = now()
  where id = v_quarentena.id;

  insert into public.movimentacoes_estoque (
    depositante_id,
    estoque_id,
    produto_id,
    endereco_origem_id,
    endereco_destino_id,
    tipo,
    quantidade,
    referencia_tipo,
    referencia_id,
    observacoes,
    criado_por
  )
  values (
    v_quarentena.depositante_id,
    v_quarentena.estoque_id,
    v_quarentena.produto_id,
    v_quarentena.endereco_id,
    case when v_status_final = 'LIBERADO' then v_quarentena.endereco_id else null end,
    v_tipo,
    v_quarentena.quantidade,
    v_ref_tipo,
    v_quarentena.id,
    coalesce(nullif(btrim(coalesce(p_observacoes, '')), ''), v_quarentena.motivo),
    p_usuario_id
  );
end;
$$;

revoke all on function public.criar_quarentena_estoque(uuid, numeric, text, uuid) from anon, authenticated;
revoke all on function public.resolver_quarentena_estoque(uuid, text, uuid, text) from anon, authenticated;
grant execute on function public.criar_quarentena_estoque(uuid, numeric, text, uuid) to service_role;
grant execute on function public.resolver_quarentena_estoque(uuid, text, uuid, text) to service_role;
