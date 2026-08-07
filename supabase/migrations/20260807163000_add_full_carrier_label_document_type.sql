alter table public.remessas_full_documentos
  drop constraint if exists remessas_full_documentos_tipo_check;

alter table public.remessas_full_documentos
  add constraint remessas_full_documentos_tipo_check
  check (tipo in ('XML_NF', 'AUTORIZACAO_ENTRADA', 'ETIQUETA_VOLUME', 'ETIQUETA_ITEM', 'ETIQUETA_TRANSPORTADORA'));
