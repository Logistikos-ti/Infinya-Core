-- Sobretaxa de urgência/prioridade por pedido (planilha: "Pedido de Urgência /
-- Prioridade — valor da expedição + R$7,90"). Valor fixo somado à expedição
-- quando o pedido é marcado como prioritário.
alter table public.contratos_cobranca
  add column if not exists valor_urgencia numeric(10,2) not null default 0;
