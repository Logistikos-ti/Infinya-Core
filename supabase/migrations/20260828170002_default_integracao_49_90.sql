-- R$49,90 é o valor padrão de manutenção por integração. Passa a ser o
-- default da coluna e é aplicado aos contratos existentes que ainda estavam
-- em 0 (a coluna acabou de ser criada). Contratos com valor já customizado
-- não são tocados.
alter table public.contratos_cobranca
  alter column valor_integracao_manutencao set default 49.90;

update public.contratos_cobranca
  set valor_integracao_manutencao = 49.90
  where valor_integracao_manutencao = 0;
