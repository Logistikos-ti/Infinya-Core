insert into public.depositantes (codigo, nome, cnpj, ativo, observacoes)
values
  ('EVOLVEG', 'Evolveg', '23.430.909/0001-10', true, 'Operação principal de fulfillment.'),
  ('BEHOLD', 'Behold', '10.111.111/0001-01', true, 'Seed inicial para ambiente de desenvolvimento.'),
  ('ELGSCREEN', 'ELGScreen', '10.111.111/0001-02', true, 'Seed inicial para ambiente de desenvolvimento.'),
  ('FESTCOLOR', 'Festcolor', '10.111.111/0001-03', true, 'Seed inicial para ambiente de desenvolvimento.'),
  ('MOCX', 'MOCX', '10.111.111/0001-04', true, 'Seed inicial para ambiente de desenvolvimento.'),
  ('NOBRAND', 'NoBrand', '10.111.111/0001-05', true, 'Seed inicial para ambiente de desenvolvimento.'),
  ('RENNOVA', 'Rennova', '10.111.111/0001-06', true, 'Seed inicial para ambiente de desenvolvimento.'),
  ('SUAALIADA', 'Sua Aliada', '10.111.111/0001-07', true, 'Seed inicial para ambiente de desenvolvimento.')
on conflict (codigo) do nothing;
