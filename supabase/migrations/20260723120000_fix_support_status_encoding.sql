begin;

update public.suporte_chamados
set status = 'Em análise'
where status like 'Em an%' and status <> 'Em análise';

alter table public.suporte_chamados
  drop constraint if exists suporte_chamados_status_check;

alter table public.suporte_chamados
  add constraint suporte_chamados_status_check
  check (status in ('Aberto', 'Em análise', 'Resolvido'));

commit;
