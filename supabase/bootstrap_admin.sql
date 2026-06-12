-- Execute este script apos:
-- 1. aplicar a migration inicial
-- 2. criar manualmente o usuario no Auth do Supabase
--
-- Antes de rodar, substitua:
--   {{AUTH_USER_ID}}
--   {{ADMIN_EMAIL}}
--   {{ADMIN_NOME}}

insert into public.usuarios (
  id,
  email,
  nome,
  papel,
  depositante_id,
  ativo
)
values (
  '{{AUTH_USER_ID}}',
  '{{ADMIN_EMAIL}}',
  '{{ADMIN_NOME}}',
  'ADMIN',
  null,
  true
)
on conflict (id) do update
set
  email = excluded.email,
  nome = excluded.nome,
  papel = excluded.papel,
  depositante_id = excluded.depositante_id,
  ativo = excluded.ativo,
  updated_at = timezone('utc', now());
