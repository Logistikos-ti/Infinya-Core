create type public.status_contagem_estoque as enum ('ABERTA', 'EM_CONTAGEM', 'CONCLUIDA', 'CANCELADA');
create type public.status_item_contagem_estoque as enum ('PENDENTE', 'CONTADO', 'DIVERGENTE');

create table public.contagens_estoque (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  titulo text not null,
  area public.area_endereco,
  status public.status_contagem_estoque not null default 'ABERTA',
  observacoes text,
  criado_por uuid references public.usuarios (id) on delete set null,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.contagens_estoque_itens (
  id uuid primary key default gen_random_uuid(),
  contagem_id uuid not null references public.contagens_estoque (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  estoque_id uuid not null references public.estoque (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  endereco_id uuid not null references public.enderecos (id) on delete cascade,
  quantidade_sistema numeric(12, 3) not null default 0,
  quantidade_contada numeric(12, 3),
  divergencia numeric(12, 3) not null default 0,
  status public.status_item_contagem_estoque not null default 'PENDENTE',
  observacoes text,
  contado_por uuid references public.usuarios (id) on delete set null,
  contado_em timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (contagem_id, estoque_id)
);

create index idx_contagens_estoque_depositante_id on public.contagens_estoque (depositante_id);
create index idx_contagens_estoque_status on public.contagens_estoque (status);
create index idx_contagens_estoque_itens_contagem_id on public.contagens_estoque_itens (contagem_id);
create index idx_contagens_estoque_itens_status on public.contagens_estoque_itens (status);

create trigger contagens_estoque_set_updated_at
before update on public.contagens_estoque
for each row
execute function public.set_current_timestamp_updated_at();

create trigger contagens_estoque_itens_set_updated_at
before update on public.contagens_estoque_itens
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.contagens_estoque enable row level security;
alter table public.contagens_estoque_itens enable row level security;

create policy "contagens_estoque_access"
on public.contagens_estoque
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "contagens_estoque_itens_access"
on public.contagens_estoque_itens
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));
