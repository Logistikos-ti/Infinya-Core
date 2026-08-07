-- Define como a remessa Full chegará ao centro de distribuição.
alter table public.remessas_full
  add column if not exists modalidade_envio text not null default 'COLETA';

update public.remessas_full
set modalidade_envio = 'COLETA'
where modalidade_envio is null or btrim(modalidade_envio) = '';

alter table public.remessas_full
  drop constraint if exists remessas_full_modalidade_envio_check;

alter table public.remessas_full
  add constraint remessas_full_modalidade_envio_check
  check (modalidade_envio in ('COLETA', 'TRANSPORTADORA'));
