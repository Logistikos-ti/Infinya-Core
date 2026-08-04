alter table public.produtos
  add column if not exists codigo_externo_pack text;

comment on column public.produtos.codigo_externo_pack is
  'EAN/GTIN da apresentação em pack; para a operação Dêvi, cada leitura representa 12 unidades.';

create or replace function public.validar_gtins_produto()
returns trigger
language plpgsql
as $$
begin
  new.codigo_externo := nullif(btrim(coalesce(new.codigo_externo, '')), '');
  new.codigo_externo_pack := nullif(btrim(coalesce(new.codigo_externo_pack, '')), '');

  if new.codigo_externo is not null and new.codigo_externo = new.codigo_externo_pack then
    raise exception 'O GTIN unitário e o GTIN do pack devem ser diferentes.';
  end if;

  if exists (
    select 1
    from public.produtos produto
    where produto.id <> new.id
      and (
        produto.codigo_externo = new.codigo_externo
        or produto.codigo_externo_pack = new.codigo_externo
        or produto.codigo_externo = new.codigo_externo_pack
        or produto.codigo_externo_pack = new.codigo_externo_pack
      )
  ) then
    raise exception 'Este EAN/GTIN já está cadastrado em outro produto.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_gtins_produto on public.produtos;
create trigger trg_validar_gtins_produto
before insert or update of codigo_externo, codigo_externo_pack on public.produtos
for each row execute function public.validar_gtins_produto();
