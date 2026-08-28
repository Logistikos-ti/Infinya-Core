alter table public.contratos_cobranca
  add column if not exists valor_cancelamento numeric(10,2) not null default 0;
