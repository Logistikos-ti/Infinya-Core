-- The shared set_current_timestamp_updated_at() trigger writes to NEW.updated_at,
-- but public.ondas_separacao has no such column (it uses atualizado_em instead).
-- Every UPDATE on this table has therefore been failing with
-- 'record "new" has no field "updated_at"' since the table was created.
drop trigger if exists ondas_separacao_set_updated_at on public.ondas_separacao;

create or replace function public.set_current_timestamp_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = timezone('utc', now());
  return new;
end;
$$;

create trigger ondas_separacao_set_atualizado_em
before update on public.ondas_separacao
for each row
execute function public.set_current_timestamp_atualizado_em();
