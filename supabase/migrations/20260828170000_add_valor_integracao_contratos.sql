-- Manutenção mensal de integrações homologadas (planilha: "Manutenção das
-- integrações" — R$70–90/mês por integração). Cobra por integração ativa e
-- não-pausada do depositante, no fechamento mensal.
alter table public.contratos_cobranca
  add column if not exists valor_integracao_manutencao numeric(10,2) not null default 0;
