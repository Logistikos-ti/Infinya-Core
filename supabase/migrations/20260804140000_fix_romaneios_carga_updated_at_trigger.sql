-- Same bug as ondas_separacao (see 20260728130000_fix_ondas_separacao_updated_at_trigger.sql):
-- the shared set_current_timestamp_updated_at() trigger writes to NEW.updated_at,
-- but public.romaneios_carga has no such column (it uses atualizado_em instead).
-- Every UPDATE on this table has therefore been failing with
-- 'record "new" has no field "updated_at"' since the table was created --
-- including liberar/cancelar romaneio and the mobile "Finalizar Romaneio" flow.

drop trigger if exists romaneios_carga_set_updated_at on public.romaneios_carga;

-- Re-declared here (idempotent, same body as the ondas_separacao fix) so this
-- migration is self-contained regardless of whether that one already ran.
create or replace function public.set_current_timestamp_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = timezone('utc', now());
  return new;
end;
$$;

create trigger romaneios_carga_set_atualizado_em
before update on public.romaneios_carga
for each row
execute function public.set_current_timestamp_atualizado_em();
