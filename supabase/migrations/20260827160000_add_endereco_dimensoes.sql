-- Metragem/volume do endereço, para o cálculo de ocupação por volume.
-- volume_modo indica como o volume da posição é definido:
--   'DIMENSOES' -> volume = altura_cm * largura_cm * comprimento_cm (a própria posição)
--   'PALLET'    -> volume = (altura_cm * largura_cm * comprimento_cm de 1 pallet) * capacidade_maxima
-- Quando preenchido, o volume entra na MÉDIA de ocupação junto com quantidade e peso.
alter table public.enderecos
  add column if not exists volume_modo text
    check (volume_modo is null or volume_modo in ('DIMENSOES', 'PALLET')),
  add column if not exists altura_cm numeric(10,2),
  add column if not exists largura_cm numeric(10,2),
  add column if not exists comprimento_cm numeric(10,2);

comment on column public.enderecos.volume_modo is
  'Como o volume da posição é definido: DIMENSOES (dimensões da posição) ou PALLET (dimensões de 1 pallet × capacidade_maxima).';
