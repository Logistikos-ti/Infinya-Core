-- Item adicional no pedido (por unidade além das inclusas na expedição base)
-- e conferência unitária no recebimento (cobrança por unidade, separada do
-- recebimento) — conforme planilha de precificação.
alter table public.contratos_cobranca
  add column if not exists itens_inclusos integer not null default 3,
  add column if not exists valor_item_adicional numeric(10,2) not null default 0,
  add column if not exists tarifa_conferencia numeric(10,2) not null default 0;
