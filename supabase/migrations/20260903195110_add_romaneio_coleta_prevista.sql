-- O mockup do rebranding do romaneio tem um campo "Coleta prevista" no
-- modal de criação (texto livre, ex. "03/09/2026 09:00") sem equivalente
-- na tabela real -- mesmo padrão simples do campo "doca" já adicionado em
-- 20260903143100_add_romaneio_doca.sql: texto livre, opcional, editável
-- depois da criação. Deliberadamente independente de criado_em (audit
-- timestamp real, não editável) -- é uma previsão informada pelo
-- operador, não a data de criação do registro.
alter table public.romaneios_carga
  add column if not exists coleta_prevista text;
