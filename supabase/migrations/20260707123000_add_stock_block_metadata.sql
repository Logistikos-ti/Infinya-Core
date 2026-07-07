alter table public.estoque
add column if not exists bloqueio_motivo text,
add column if not exists bloqueado_em timestamptz;
