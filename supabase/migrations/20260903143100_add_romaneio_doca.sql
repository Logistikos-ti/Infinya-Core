-- Rebranding do romaneio desktop passou a expor "doca" (criação + drawer),
-- espelhando o mesmo padrão simples já usado em pedidos_recebimento
-- (20260903120000_add_receiving_dock_carrier_handler.sql): texto livre,
-- atribuído manualmente, editável a qualquer momento, nulo até ser
-- atribuída.
alter table public.romaneios_carga
  add column if not exists doca text;
