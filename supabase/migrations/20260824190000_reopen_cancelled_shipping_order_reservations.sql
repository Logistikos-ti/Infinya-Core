-- Reopening a stockout-cancelled order must rebuild its allocation before it
-- can return to picking. The AFTER trigger keeps the status change and every
-- stock reservation in the same database transaction.
create or replace function public.trg_reabrir_reserva_pedido_cancelado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'CANCELADO'
     or new.status not in ('NOVO', 'EM_SEPARACAO', 'SEPARADO', 'EM_CONFERENCIA') then
    return new;
  end if;

  -- A reopened order starts a fresh picking attempt. Old wave links and scans
  -- cannot be reused because the previous reservation was already released.
  delete from public.ondas_separacao_pedidos
  where pedido_expedicao_id = new.id;

  delete from public.bipagens_separacao
  where pedido_expedicao_id = new.id;

  update public.pedidos_expedicao_itens
  set quantidade_separada = 0
  where pedido_expedicao_id = new.id;

  -- Any shortage raises an exception and rolls back the status change too.
  perform public.reservar_estoque_pedido_criado(new.id, auth.uid());

  return new;
end;
$$;

drop trigger if exists trg_reabrir_reserva_pedido_cancelado on public.pedidos_expedicao;
create trigger trg_reabrir_reserva_pedido_cancelado
after update of status on public.pedidos_expedicao
for each row
when (
  old.status = 'CANCELADO'
  and new.status in ('NOVO', 'EM_SEPARACAO', 'SEPARADO', 'EM_CONFERENCIA')
)
execute function public.trg_reabrir_reserva_pedido_cancelado();

