drop trigger if exists romaneios_carga_set_updated_at on public.romaneios_carga;

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

notify pgrst, 'reload schema';
