alter table public.lancamentos
  drop constraint if exists lancamentos_tipo_servico_check,
  add constraint lancamentos_tipo_servico_check check (tipo_servico in (
    'FULFILLMENT', 'PONTO_COLETA', 'IMPRESSAO_NF', 'CARTA_CORRECAO', 'OUTRO_DOCUMENTO', 'GESTAO_FRETE',
    'RECEBIMENTO', 'ARMAZENAMENTO', 'INSUMO', 'LOGISTICA_REVERSA', 'CANCELAMENTO',
    'SOFTWARE', 'REFRIGERADOR', 'DESCONTO', 'COBRANCA_EXTRA'
  ));
