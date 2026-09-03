-- WMS-1737: nothing in the schema stopped the same pedido_expedicao from
-- being linked into two simultaneously-active picking waves at once -- the
-- unique constraint on ondas_separacao_pedidos only covers the
-- (onda_separacao_id, pedido_expedicao_id) pair, not pedido_expedicao_id
-- alone. Application code (createShippingWaveAction) already guards against
-- this on its own insert path, but that guard is a non-transactional
-- read-then-write sequence and nothing stops a different/future insert path
-- from bypassing it. This trigger makes the invariant hold at the database
-- level regardless of which code path performs the insert, mirroring the
-- centralized status guards already added this week
-- (PICKING_EDITABLE_STATUSES / CONFERENCE_EDITABLE_STATUSES).
--
-- "Active" mirrors the exact status set the application itself already
-- treats as an open/incomplete wave (see listActivePickingWavesAction and
-- the existing wave-creation guard in
-- src/app/(dashboard)/expedicao/separacao/actions.ts): PENDENTE, EM_SEPARACAO.

create or replace function public.prevent_duplicate_active_onda_link()
returns trigger
language plpgsql
as $$
declare
  conflicting_onda_codigo text;
begin
  select onda.codigo
    into conflicting_onda_codigo
    from public.ondas_separacao_pedidos link
    join public.ondas_separacao onda on onda.id = link.onda_separacao_id
   where link.pedido_expedicao_id = new.pedido_expedicao_id
     and onda.status in ('PENDENTE', 'EM_SEPARACAO')
   limit 1;

  if conflicting_onda_codigo is not null then
    raise exception
      'Pedido % já está vinculado à onda ativa % -- não pode entrar em outra onda de separação até essa ser concluída, pausada ou cancelada.',
      new.pedido_expedicao_id, conflicting_onda_codigo
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_active_onda_link on public.ondas_separacao_pedidos;

create trigger trg_prevent_duplicate_active_onda_link
before insert on public.ondas_separacao_pedidos
for each row
execute function public.prevent_duplicate_active_onda_link();
