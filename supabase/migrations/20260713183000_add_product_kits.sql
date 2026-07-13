do $$
begin
  create type public.tipo_produto as enum ('SIMPLES', 'KIT');
exception
  when duplicate_object then null;
end $$;

alter table public.produtos
add column if not exists tipo_produto public.tipo_produto not null default 'SIMPLES';

create table if not exists public.produto_kit_componentes (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  produto_kit_id uuid not null references public.produtos (id) on delete cascade,
  produto_componente_id uuid not null references public.produtos (id) on delete restrict,
  quantidade numeric(12, 3) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (produto_kit_id, produto_componente_id),
  constraint produto_kit_componentes_quantidade_positive check (quantidade > 0),
  constraint produto_kit_componentes_self_reference check (produto_kit_id <> produto_componente_id)
);

create index if not exists idx_produto_kit_componentes_kit_id
  on public.produto_kit_componentes (produto_kit_id);

create index if not exists idx_produto_kit_componentes_componente_id
  on public.produto_kit_componentes (produto_componente_id);

drop trigger if exists produto_kit_componentes_set_updated_at on public.produto_kit_componentes;
create trigger produto_kit_componentes_set_updated_at
before update on public.produto_kit_componentes
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.produto_kit_componentes enable row level security;

drop policy if exists "produto_kit_componentes_access" on public.produto_kit_componentes;
create policy "produto_kit_componentes_access"
on public.produto_kit_componentes
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));
