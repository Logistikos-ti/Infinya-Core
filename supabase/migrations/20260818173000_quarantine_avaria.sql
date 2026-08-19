-- Add new columns to estoque_quarentena
alter table public.estoque_quarentena 
add column if not exists foto_url text,
add column if not exists tipo text not null default 'OUTRO';

-- Update the function to accept tipo and foto_url
create or replace function public.criar_quarentena_estoque(
  p_estoque_id uuid,
  p_quantidade numeric,
  p_motivo text,
  p_usuario_id uuid,
  p_tipo text default 'OUTRO',
  p_foto_url text default null
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
    criado_por,
    tipo,
    foto_url
  )
  values (
    v_estoque.depositante_id,
    v_estoque.produto_id,
    v_estoque.id,
    v_estoque.endereco_id,
    v_quantidade,
    v_motivo,
    'EM_QUARENTENA',
    p_usuario_id,
    coalesce(p_tipo, 'OUTRO'),
    p_foto_url
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
    criado_por,
    foto_url
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
    p_usuario_id,
    p_foto_url
  );

  return v_quarentena_id;
end;
$$;
