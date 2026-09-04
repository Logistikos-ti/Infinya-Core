-- Índices compostos pras combinações de filtro/ordenação mais usadas nas
-- telas de maior tráfego, achadas na investigação de performance
-- (2026-09-04). Puramente aditivo -- não muda nenhuma query, nenhum
-- comportamento, só dá ao Postgres um caminho de índice pras consultas que
-- hoje só têm índice de coluna única e precisam combinar 2-3 filtros.

-- Expedição: toda consulta da lista filtra depositante_id + status e ordena
-- por data_pedido (src/lib/shipping.ts) -- hoje só há índice de uma coluna
-- em cada um desses campos separadamente.
create index if not exists idx_pedidos_expedicao_depositante_status_data
  on public.pedidos_expedicao (depositante_id, status, data_pedido desc);

-- Separação/ondas: a query de alocação de estoque por onda filtra
-- referencia_id (.in) + referencia_tipo + tipo simultaneamente
-- (src/lib/shipping-picking.ts) -- só havia índice em depositante_id.
create index if not exists idx_movimentacoes_estoque_referencia_tipo
  on public.movimentacoes_estoque (referencia_tipo, tipo, referencia_id);
