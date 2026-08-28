-- Cancelamento passa a seguir a planilha de precificação: cobra por item
-- (a coluna valor_cancelamento existente vira o "valor por item") respeitando
-- um valor mínimo por pedido cancelado.
alter table public.contratos_cobranca
  add column if not exists valor_cancelamento_minimo numeric(10,2) not null default 0;
