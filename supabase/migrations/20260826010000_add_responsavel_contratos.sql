-- Nome da pessoa responsável pelo contrato (contato interno/comercial)
ALTER TABLE contratos_cobranca
  ADD COLUMN IF NOT EXISTS responsavel TEXT DEFAULT NULL;
