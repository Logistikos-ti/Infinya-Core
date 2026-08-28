-- Distinct movement disposition for "retirada" vs "doação" when resolving a
-- quarantine. Expired lots (tipo = 'VENCIMENTO') resolved through the DOAR
-- decision are the depositante taking the goods back, not a donation, so the
-- stock movement is recorded as 'RETIRADA_QUARENTENA' instead of
-- 'DOACAO_QUARENTENA'. The decision value (DOAR) and the app path are
-- unchanged -- only the referencia_tipo written to movimentacoes_estoque
-- differs, so reporting can tell the two apart.
--
-- Same body as 20260824170000_quarantine_depositor_decision.sql, with the one
-- v_ref_tipo line in the DOAR branch made tipo-aware.
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
    v_ref_tipo := case
      when upper(btrim(coalesce(v_quarentena.tipo, ''))) = 'VENCIMENTO'
        then 'RETIRADA_QUARENTENA'
      else 'DOACAO_QUARENTENA'
    end;
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

-- Close the PUBLIC/anon execute hole documented for these two quarantine RPCs
-- (revoke from anon,authenticated alone never removed PUBLIC's inherited
-- execute). Use the full form here now that we're touching resolver anyway.
revoke all on function public.resolver_quarentena_estoque(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.resolver_quarentena_estoque(uuid, text, uuid, text) to service_role;

revoke all on function public.registrar_decisao_quarentena(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_decisao_quarentena(uuid, text, uuid, text) to service_role;
