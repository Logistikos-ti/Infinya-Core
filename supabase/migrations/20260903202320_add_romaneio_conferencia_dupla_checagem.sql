-- Bug real: o fechamento com dupla checagem no mobile
-- (completeRomaneioWithDoubleCheck) grava um JSON (fotos + conferido_por/em)
-- na coluna `observacoes` -- a MESMA coluna que o desktop usa pra texto
-- livre (criação e edição). Sem coordenação entre as duas escritas, o
-- fechamento no mobile sobrescreve (sem merge) qualquer observação humana
-- digitada no desktop, e vice-versa. Coluna nova e dedicada só pra esse
-- payload de auditoria -- observacoes volta a ser só texto livre, nunca
-- mais tocado pelo fluxo de fechamento.
alter table public.romaneios_carga
  add column if not exists conferencia_dupla_checagem jsonb;
