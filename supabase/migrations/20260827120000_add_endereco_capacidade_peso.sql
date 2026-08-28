-- Capacidade de peso suportada por endereço (kg).
-- Usada, junto com capacidade_maxima (quantidade), para o cálculo aproximado
-- de ocupação: o sistema tira a média das razões disponíveis (quantidade e peso).
alter table public.enderecos
  add column if not exists capacidade_peso_kg numeric(12,3);

comment on column public.enderecos.capacidade_peso_kg is
  'Peso máximo suportado pela posição, em kg. Opcional. Quando preenchido, entra na média de ocupação junto com capacidade_maxima.';
