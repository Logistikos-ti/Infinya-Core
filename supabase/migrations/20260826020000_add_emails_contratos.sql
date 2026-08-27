-- E-mails de cobrança/contato do contrato (pode ter mais de um)
ALTER TABLE contratos_cobranca
  ADD COLUMN IF NOT EXISTS emails_cobranca TEXT[] DEFAULT NULL;
