-- Adiciona cidade, UF e tipo (modal principal de transporte) ao cadastro de
-- transportadoras. O "tipo" guarda um código canônico (RODOVIARIO / AEREO /
-- MARITIMO); a validação dos valores aceitos é feita na camada de aplicação,
-- espelhando o padrão já usado em "modalidades".
alter table public.transportadoras
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists tipo text;
