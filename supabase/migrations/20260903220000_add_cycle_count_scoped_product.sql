-- O modal de programar contagem cíclica ganhou um seletor de "Produto"
-- (escopa a contagem a um único SKU), mas contagens_estoque não tinha onde
-- guardar essa escolha para uma contagem PROGRAMADA -- só era usada quando a
-- contagem começava na hora (createCycleCount), nunca persistida pra ser lida
-- de volta em startScheduledCycleCount. Resultado: o campo era aceito pela
-- rota, mas silenciosamente ignorado pra qualquer contagem agendada.
alter table public.contagens_estoque
  add column if not exists produto_id uuid references public.produtos (id) on delete set null;
