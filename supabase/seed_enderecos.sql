insert into public.enderecos (
  codigo,
  descricao,
  area,
  rua,
  modulo,
  nivel,
  posicao,
  capacidade_maxima,
  unidade_padrao,
  ativo
)
values
  ('DOCA-01', 'Doca principal de recebimento', 'RECEBIMENTO', 'R01', 'M01', 'N01', 'P01', 120, 'CAIXA', true),
  ('DOCA-02', 'Doca secundaria de recebimento', 'RECEBIMENTO', 'R01', 'M02', 'N01', 'P01', 100, 'CAIXA', true),
  ('DOCA-03', 'Doca para tratativas e cargas mistas', 'RECEBIMENTO', 'R01', 'M03', 'N01', 'P01', 80, 'CAIXA', true),
  ('PUL-02-A', 'Pulmao rua 02 modulo A', 'PULMAO', 'R02', 'M01', 'N02', 'P01', 18, 'PALLET', true),
  ('PUL-02-B', 'Pulmao rua 02 modulo B', 'PULMAO', 'R02', 'M02', 'N02', 'P01', 18, 'PALLET', true),
  ('PICK-01-C', 'Picking rua 01 modulo C', 'PICKING', 'R03', 'M01', 'N01', 'P03', 240, 'UNIDADE', true),
  ('PICK-03-B', 'Picking rua 03 modulo B', 'PICKING', 'R03', 'M03', 'N01', 'P02', 240, 'UNIDADE', true),
  ('BLQ-01', 'Area de bloqueio operacional', 'BLOQUEADO', 'R04', 'M01', 'N01', 'P01', 8, 'PALLET', true),
  ('EXP-01', 'Consolidacao de expedicao 01', 'EXPEDICAO', 'R05', 'M01', 'N01', 'P01', 150, 'CAIXA', true)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  area = excluded.area,
  rua = excluded.rua,
  modulo = excluded.modulo,
  nivel = excluded.nivel,
  posicao = excluded.posicao,
  capacidade_maxima = excluded.capacidade_maxima,
  unidade_padrao = excluded.unidade_padrao,
  ativo = excluded.ativo,
  updated_at = timezone('utc', now());
