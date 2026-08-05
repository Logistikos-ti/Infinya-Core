alter table public.movimentacoes_estoque
  add column if not exists foto_url text;

notify pgrst, 'reload schema';
