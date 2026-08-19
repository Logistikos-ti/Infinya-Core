-- Cofre no banco: uma retirada so sai de AGUARDANDO_NF_DEVOLUCAO para NOVO
-- (apos a NF-e de devolucao validada) ou para CANCELADO. Bloqueia qualquer
-- caminho da aplicacao que tente pular direto para separacao/conferencia.
create or replace function public.proteger_retirada_nf_devolucao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'UPDATE'
     and old.status = 'AGUARDANDO_NF_DEVOLUCAO'
     and new.status is distinct from old.status
     and new.status not in ('NOVO', 'CANCELADO') then
    raise exception
      'Retirada bloqueada: anexe a NF-e de devolucao antes de avancar o pedido (tentativa de ir para %).',
      new.status;
  end if;

  -- Um pedido de venda nunca deve cair no status exclusivo de retirada.
  if new.status = 'AGUARDANDO_NF_DEVOLUCAO'
     and coalesce(new.tipo_operacao, 'VENDA') is distinct from 'RETIRADA' then
    raise exception 'Status AGUARDANDO_NF_DEVOLUCAO e exclusivo de pedidos de retirada.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_proteger_retirada_nf_devolucao on public.pedidos_expedicao;
create trigger trg_proteger_retirada_nf_devolucao
before insert or update of status on public.pedidos_expedicao
for each row
execute function public.proteger_retirada_nf_devolucao();
