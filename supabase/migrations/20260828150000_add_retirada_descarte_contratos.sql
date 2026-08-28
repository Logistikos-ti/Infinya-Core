-- Tarifas do fluxo de produtos vencidos em quarentena: retirada pelo
-- depositante (planilha: "Retirada agendada pelo cliente", por unidade) e
-- descarte (planilha: "Descarte" = Consultar, valor definido por depositante).
alter table public.contratos_cobranca
  add column if not exists valor_retirada numeric(10,2) not null default 0,
  add column if not exists valor_descarte numeric(10,2) not null default 0;
