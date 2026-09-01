-- Código legível de fatura (ex: FAT-2608-VEG), no formato
-- FAT-{ano+mês}-{3 primeiras letras do depositante}, mesmo padrão de prefixo
-- já usado em formatWmsOrderNumber (WMS-{prefixo}-{numero}). Sem constraint
-- de unicidade: é um rótulo de exibição, não o identificador real (esse
-- continua sendo o id + a combinação depositante_id/mes_ano, já única) — uma
-- colisão de prefixo entre dois depositantes no mesmo mês não pode quebrar a
-- criação de fatura.
alter table public.faturas
  add column if not exists codigo text;

update public.faturas f
set codigo = 'FAT-' || right(replace(f.mes_ano, '-', ''), 4) || '-' || upper(left(trim(d.nome), 3))
from public.depositantes d
where d.id = f.depositante_id
  and f.codigo is null;

create or replace function public.garantir_ou_criar_fatura(
  p_depositante_id uuid,
  p_mes_ano text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fatura_id uuid;
  v_dep_nome text;
  v_codigo text;
begin
  select id into v_fatura_id
  from public.faturas
  where depositante_id = p_depositante_id
    and mes_ano = p_mes_ano;

  if found then
    return v_fatura_id;
  end if;

  select nome into v_dep_nome from public.depositantes where id = p_depositante_id;
  v_codigo := 'FAT-' || right(replace(p_mes_ano, '-', ''), 4) || '-' || upper(left(trim(coalesce(v_dep_nome, 'DEP')), 3));

  insert into public.faturas (depositante_id, mes_ano, status, codigo)
  values (p_depositante_id, p_mes_ano, 'ABERTA', v_codigo)
  on conflict (depositante_id, mes_ano) do nothing
  returning id into v_fatura_id;

  if v_fatura_id is null then
    select id into v_fatura_id
    from public.faturas
    where depositante_id = p_depositante_id
      and mes_ano = p_mes_ano;
  end if;

  return v_fatura_id;
end;
$$;

revoke all on function public.garantir_ou_criar_fatura(uuid, text) from anon, authenticated;
grant execute on function public.garantir_ou_criar_fatura(uuid, text) to service_role;
