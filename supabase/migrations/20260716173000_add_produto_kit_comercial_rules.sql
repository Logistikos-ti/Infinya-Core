create table if not exists public.produto_kit_comercial_regras (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  produto_base_id uuid not null references public.produtos (id) on delete cascade,
  texto_gatilho text not null,
  quantidade_operacional numeric(12, 3) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint produto_kit_comercial_regras_texto_gatilho_not_blank
    check (char_length(btrim(texto_gatilho)) > 0),
  constraint produto_kit_comercial_regras_quantidade_positive
    check (quantidade_operacional > 0)
);

create unique index if not exists idx_produto_kit_comercial_regras_unique
  on public.produto_kit_comercial_regras (produto_base_id, lower(btrim(texto_gatilho)));

create index if not exists idx_produto_kit_comercial_regras_depositante
  on public.produto_kit_comercial_regras (depositante_id, ativo);

drop trigger if exists produto_kit_comercial_regras_set_updated_at
  on public.produto_kit_comercial_regras;
create trigger produto_kit_comercial_regras_set_updated_at
before update on public.produto_kit_comercial_regras
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.produto_kit_comercial_regras enable row level security;

drop policy if exists "produto_kit_comercial_regras_access" on public.produto_kit_comercial_regras;
create policy "produto_kit_comercial_regras_access"
on public.produto_kit_comercial_regras
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));
