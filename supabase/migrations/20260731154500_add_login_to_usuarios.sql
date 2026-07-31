alter table public.usuarios 
add column if not exists login text unique;
