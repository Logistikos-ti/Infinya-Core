alter table public.lancamentos
  drop constraint if exists lancamentos_referencia_tipo_check,
  add constraint lancamentos_referencia_tipo_check check (referencia_tipo in (
    'PEDIDO_EXPEDICAO', 'PEDIDO_RECEBIMENTO', 'ROMANEIO', 'SNAPSHOT_ARMAZENAMENTO',
    'DOCUMENTO_ARMAZENADO', 'INSUMO_CONSUMO'
  ));
