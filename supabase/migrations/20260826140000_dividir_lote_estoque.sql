-- Divide um saldo de estoque existente em dois lotes distintos (mesmo
-- produto e mesmo endereco), permitindo diferenciar por lote/validade um
-- saldo que hoje esta cadastrado como uma unica linha em public.estoque.
--
-- Segue a mesma convencao de RPC transacional das demais funcoes de estoque
-- (criar_quarentena_estoque, resolver_quarentena_estoque): trava a linha de
-- origem com "for update", recalcula o disponivel no banco (nunca confia no
-- client) e roda dentro da transacao implicita da funcao -- qualquer
-- "raise exception" desfaz tudo automaticamente.
create or replace function public.dividir_lote_estoque(
  p_estoque_id uuid,
  p_quantidade numeric,
  p_novo_lote text,
  p_nova_validade date,
  p_usuario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estoque record;
  v_target record;
  v_target_found boolean := false;
  v_disponivel numeric;
  v_novo_lote text := nullif(btrim(coalesce(p_novo_lote, '')), '');
  v_novo_estoque_id uuid;
  v_novo_quantidade numeric;
  v_merged boolean := false;
  v_transferencia_id uuid := gen_random_uuid();
  v_mesmo_lote boolean;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade maior que zero para o novo lote.';
  end if;

  if v_novo_lote is null then
    raise exception 'Informe o codigo do novo lote.';
  end if;

  select id, depositante_id, produto_id, endereco_id, quantidade, quantidade_reservada,
         bloqueado, lote, validade_em
    into v_estoque
    from public.estoque
   where id = p_estoque_id
   for update;

  if not found then
    raise exception 'Saldo de estoque nao encontrado.';
  end if;

  if coalesce(v_estoque.bloqueado, false) then
    raise exception 'Este saldo esta bloqueado e nao pode ser dividido.';
  end if;

  v_mesmo_lote :=
    coalesce(v_estoque.lote, '') = coalesce(v_novo_lote, '')
    and v_estoque.validade_em is not distinct from p_nova_validade;

  if v_mesmo_lote then
    raise exception 'Informe um lote ou validade diferente do lote de origem.';
  end if;

  v_disponivel := greatest(0, coalesce(v_estoque.quantidade, 0) - coalesce(v_estoque.quantidade_reservada, 0));

  if p_quantidade > v_disponivel then
    raise exception 'A quantidade informada (%) e maior que o saldo disponivel (%) para dividir.', p_quantidade, v_disponivel;
  end if;

  -- Ja existe uma linha com esse lote/validade no mesmo produto/endereco?
  -- (mesma chave da unique constraint da tabela estoque, exceto o proprio id
  -- de origem). "for update" trava essa linha tambem, se existir, para
  -- evitar corrida entre duas divisoes concorrentes mirando o mesmo destino.
  select id, quantidade, bloqueado
    into v_target
    from public.estoque
   where depositante_id = v_estoque.depositante_id
     and produto_id = v_estoque.produto_id
     and endereco_id = v_estoque.endereco_id
     and lote is not distinct from v_novo_lote
     and validade_em is not distinct from p_nova_validade
     and id <> v_estoque.id
   for update;

  v_target_found := found;

  if v_target_found and coalesce(v_target.bloqueado, false) then
    raise exception 'Ja existe um saldo bloqueado com esse lote/validade neste endereco. Libere-o antes de dividir para ele.';
  end if;

  -- Debita a origem.
  update public.estoque
     set quantidade = quantidade - p_quantidade
   where id = v_estoque.id;

  if v_target_found then
    update public.estoque
       set quantidade = quantidade + p_quantidade
     where id = v_target.id;
    v_novo_estoque_id := v_target.id;
    v_novo_quantidade := v_target.quantidade + p_quantidade;
    v_merged := true;
  else
    insert into public.estoque (
      depositante_id, produto_id, endereco_id, quantidade, quantidade_reservada,
      bloqueado, lote, validade_em
    ) values (
      v_estoque.depositante_id, v_estoque.produto_id, v_estoque.endereco_id, p_quantidade, 0,
      false, v_novo_lote, p_nova_validade
    )
    returning id into v_novo_estoque_id;
    v_novo_quantidade := p_quantidade;
  end if;

  insert into public.movimentacoes_estoque (
    depositante_id, estoque_id, produto_id, endereco_origem_id, endereco_destino_id,
    tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
  ) values (
    v_estoque.depositante_id, v_estoque.id, v_estoque.produto_id, v_estoque.endereco_id, null,
    'TRANSFERENCIA', p_quantidade, 'DIVISAO_LOTE', v_transferencia_id,
    format(
      'Divisao de lote: saiu do lote %s (validade %s) para o lote %s (validade %s).',
      coalesce(v_estoque.lote, 'sem lote'), coalesce(v_estoque.validade_em::text, 'sem validade'),
      v_novo_lote, coalesce(p_nova_validade::text, 'sem validade')
    ),
    p_usuario_id
  );

  insert into public.movimentacoes_estoque (
    depositante_id, estoque_id, produto_id, endereco_origem_id, endereco_destino_id,
    tipo, quantidade, referencia_tipo, referencia_id, observacoes, criado_por
  ) values (
    v_estoque.depositante_id, v_novo_estoque_id, v_estoque.produto_id, null, v_estoque.endereco_id,
    'TRANSFERENCIA', p_quantidade, 'DIVISAO_LOTE', v_transferencia_id,
    format(
      'Divisao de lote: entrou no lote %s (validade %s), originado do lote %s (validade %s).',
      v_novo_lote, coalesce(p_nova_validade::text, 'sem validade'),
      coalesce(v_estoque.lote, 'sem lote'), coalesce(v_estoque.validade_em::text, 'sem validade')
    ),
    p_usuario_id
  );

  return jsonb_build_object(
    'novoEstoqueId', v_novo_estoque_id,
    'novoLote', v_novo_lote,
    'novaValidade', p_nova_validade,
    'quantidadeNovoLote', v_novo_quantidade,
    'quantidadeOrigemRestante', v_estoque.quantidade - p_quantidade,
    'merged', v_merged
  );
end;
$$;

revoke all on function public.dividir_lote_estoque(uuid, numeric, text, date, uuid) from anon, authenticated;
grant execute on function public.dividir_lote_estoque(uuid, numeric, text, date, uuid) to service_role;
