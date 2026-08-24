alter table public.estoque_quarentena
  add column if not exists decisao_depositante text,
  add column if not exists decisao_por uuid,
  add column if not exists decisao_em timestamptz,
  add column if not exists decisao_observacoes text;

alter table public.estoque_quarentena
  drop constraint if exists estoque_quarentena_decisao_depositante_check;

alter table public.estoque_quarentena
  add constraint estoque_quarentena_decisao_depositante_check
  check (decisao_depositante is null or decisao_depositante in ('DOAR', 'DESCARTAR'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'estoque_quarentena_decisao_por_fkey'
  ) then
    alter table public.estoque_quarentena
      add constraint estoque_quarentena_decisao_por_fkey
      foreign key (decisao_por) references public.usuarios(id);
  end if;
end;
$$;

create index if not exists idx_estoque_quarentena_decisao_pendente
  on public.estoque_quarentena (decisao_depositante, decisao_em desc)
  where status = 'EM_QUARENTENA';

create or replace function public.registrar_decisao_quarentena(
  p_quarentena_id uuid,
  p_decisao text,
  p_usuario_id uuid,
  p_observacoes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decisao text := upper(btrim(coalesce(p_decisao, '')));
begin
  if v_decisao not in ('DOAR', 'DESCARTAR') then
    raise exception 'Decisao de quarentena invalida.';
  end if;

  update public.estoque_quarentena
  set
    decisao_depositante = v_decisao,
    decisao_por = p_usuario_id,
    decisao_em = now(),
    decisao_observacoes = nullif(btrim(coalesce(p_observacoes, '')), '')
  where id = p_quarentena_id
    and status = 'EM_QUARENTENA';

  if not found then
    raise exception 'Quarentena nao encontrada ou ja finalizada.';
  end if;
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
  select * into v_quarentena
  from public.estoque_quarentena
  where id = p_quarentena_id
  for update;

  if not found then
    raise exception 'Registro de quarentena nao encontrado.';
  end if;

  if v_quarentena.status <> 'EM_QUARENTENA' then
    raise exception 'Esta quarentena ja foi resolvida.';
  end if;

  if v_acao in ('DOAR', 'DOADO', 'DONATE') then
    if v_quarentena.decisao_depositante <> 'DOAR' then
      raise exception 'A doacao ainda nao foi autorizada pelo depositante.';
    end if;

    v_status_final := 'LIBERADO';
    v_tipo := 'AJUSTE_NEGATIVO';
    v_ref_tipo := 'DOACAO_QUARENTENA';
  elsif v_acao in ('DESCARTAR', 'DESCARTADO', 'DISCARD') then
    if v_quarentena.decisao_depositante <> 'DESCARTAR' then
      raise exception 'O descarte ainda nao foi autorizado pelo depositante.';
    end if;

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
    depositante_id, estoque_id, produto_id, endereco_origem_id,
    endereco_destino_id, tipo, quantidade, referencia_tipo,
    referencia_id, observacoes, criado_por
  )
  values (
    v_quarentena.depositante_id,
    v_quarentena.estoque_id,
    v_quarentena.produto_id,
    v_quarentena.endereco_id,
    null,
    v_tipo,
    v_quarentena.quantidade,
    v_ref_tipo,
    v_quarentena.id,
    coalesce(nullif(btrim(coalesce(p_observacoes, '')), ''), v_quarentena.motivo),
    p_usuario_id
  );
end;
$$;

revoke all on function public.registrar_decisao_quarentena(uuid, text, uuid, text) from anon, authenticated;
grant execute on function public.registrar_decisao_quarentena(uuid, text, uuid, text) to service_role;

revoke all on function public.resolver_quarentena_estoque(uuid, text, uuid, text) from anon, authenticated;
grant execute on function public.resolver_quarentena_estoque(uuid, text, uuid, text) to service_role;
