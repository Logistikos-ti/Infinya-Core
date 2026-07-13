do $$
begin
  create type public.status_romaneio_carga as enum (
    'ABERTO',
    'LIBERADO',
    'CANCELADO'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.romaneios_carga (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  status public.status_romaneio_carga not null default 'ABERTO',
  transportadora_id uuid references public.transportadoras (id) on delete set null,
  transportadora_nome text not null,
  transportadora_cnpj text,
  motorista_nome text,
  motorista_documento text,
  veiculo_modelo text,
  veiculo_placa text,
  observacoes text,
  criado_por uuid references public.usuarios (id) on delete set null,
  liberado_por uuid references public.usuarios (id) on delete set null,
  cancelado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now()),
  liberado_em timestamptz,
  cancelado_em timestamptz
);

create table if not exists public.romaneios_carga_pedidos (
  id uuid primary key default gen_random_uuid(),
  romaneio_id uuid not null references public.romaneios_carga (id) on delete cascade,
  pedido_expedicao_id uuid not null references public.pedidos_expedicao (id) on delete restrict,
  sequencia integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  unique (romaneio_id, pedido_expedicao_id)
);

create index if not exists idx_romaneios_carga_status
  on public.romaneios_carga (status);

create index if not exists idx_romaneios_carga_transportadora_nome
  on public.romaneios_carga (transportadora_nome);

create index if not exists idx_romaneios_carga_criado_em
  on public.romaneios_carga (criado_em desc);

create index if not exists idx_romaneios_carga_pedidos_romaneio_id
  on public.romaneios_carga_pedidos (romaneio_id);

create index if not exists idx_romaneios_carga_pedidos_pedido_id
  on public.romaneios_carga_pedidos (pedido_expedicao_id);

drop trigger if exists romaneios_carga_set_updated_at on public.romaneios_carga;
create trigger romaneios_carga_set_updated_at
before update on public.romaneios_carga
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.romaneios_carga enable row level security;
alter table public.romaneios_carga_pedidos enable row level security;

create or replace function public.can_access_romaneio_carga(target_romaneio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR')
    or exists (
      select 1
      from public.romaneios_carga_pedidos romaneio_pedido
      join public.pedidos_expedicao pedido on pedido.id = romaneio_pedido.pedido_expedicao_id
      where romaneio_pedido.romaneio_id = target_romaneio_id
        and public.can_access_depositante(pedido.depositante_id)
    ),
    false
  );
$$;

grant execute on function public.can_access_romaneio_carga(uuid) to anon, authenticated, service_role;

drop policy if exists "romaneios_carga_select" on public.romaneios_carga;
create policy "romaneios_carga_select"
on public.romaneios_carga
for select
to authenticated
using (public.can_access_romaneio_carga(id));

drop policy if exists "romaneios_carga_manage" on public.romaneios_carga;
create policy "romaneios_carga_manage"
on public.romaneios_carga
for all
to authenticated
using (public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR'))
with check (public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR'));

drop policy if exists "romaneios_carga_pedidos_select" on public.romaneios_carga_pedidos;
create policy "romaneios_carga_pedidos_select"
on public.romaneios_carga_pedidos
for select
to authenticated
using (public.can_access_romaneio_carga(romaneio_id));

drop policy if exists "romaneios_carga_pedidos_manage" on public.romaneios_carga_pedidos;
create policy "romaneios_carga_pedidos_manage"
on public.romaneios_carga_pedidos
for all
to authenticated
using (public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR'))
with check (public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR'));
