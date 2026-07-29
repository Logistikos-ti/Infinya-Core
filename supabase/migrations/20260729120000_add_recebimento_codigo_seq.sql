-- Backs the new RC-{DEPOSITANTE}-{sequencial} receiving order code format.
-- A real sequence (instead of the old random 3-digit suffix) guarantees
-- codes never collide, and grows forever regardless of date.
create sequence if not exists public.recebimento_codigo_seq start with 2607200;

create or replace function public.next_recebimento_codigo_seq()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.recebimento_codigo_seq');
$$;

grant execute on function public.next_recebimento_codigo_seq() to authenticated, service_role;
