-- Amplia os tipos de notificação (sino no cabeçalho, ver
-- 20260905120000_add_notificacoes.sql) com mais 4 eventos pedidos pelo
-- usuário em 2026-09-05: recebimento concluído, recebimento com
-- divergência, cancelamento de expedição aberto, e pedido marcado
-- divergente na conferência.

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'ROMANEIO_LIBERADO',
    'QUARENTENA_CRIADA',
    'INVENTARIO_DIVERGENTE',
    'RECEBIMENTO_CONCLUIDO',
    'RECEBIMENTO_DIVERGENTE',
    'EXPEDICAO_CANCELAMENTO_ABERTO',
    'EXPEDICAO_DIVERGENTE'
  ));
