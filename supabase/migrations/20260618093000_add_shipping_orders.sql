create type public.status_pedido_expedicao as enum (
  'NOVO',
  'EM_SEPARACAO',
  'SEPARADO',
  'EM_CONFERENCIA',
  'CONFERIDO',
  'PRONTO_ROMANEIO',
  'EXPEDIDO',
  'CANCELADO'
);

create table public.pedidos_expedicao (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  codigo text not null unique,
  referencia_externa text not null,
  origem text not null default 'BLING',
  canal text not null default 'BLING',
  status public.status_pedido_expedicao not null default 'NOVO',
  status_origem text,
  numero_pedido text,
  numero_loja text,
  cliente_nome text,
  cliente_documento text,
  cliente_cidade text,
  cliente_uf text,
  valor_total numeric(12, 2),
  quantidade_itens integer not null default 0,
  quantidade_unidades numeric(12, 3) not null default 0,
  data_pedido timestamptz,
  previsao_envio_em date,
  sincronizado_em timestamptz,
  payload_origem jsonb not null default '{}'::jsonb,
  observacoes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (depositante_id, referencia_externa)
);

create table public.pedidos_expedicao_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_expedicao_id uuid not null references public.pedidos_expedicao (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  referencia_externa text,
  produto_id uuid references public.produtos (id) on delete set null,
  codigo_produto text,
  sku text,
  nome text not null,
  unidade text,
  quantidade numeric(12, 3) not null default 0,
  quantidade_separada numeric(12, 3) not null default 0,
  payload_origem jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_pedidos_expedicao_depositante_id on public.pedidos_expedicao (depositante_id);
create index idx_pedidos_expedicao_status on public.pedidos_expedicao (status);
create index idx_pedidos_expedicao_canal on public.pedidos_expedicao (canal);
create index idx_pedidos_expedicao_data_pedido on public.pedidos_expedicao (data_pedido desc);
create index idx_pedidos_expedicao_itens_pedido_id on public.pedidos_expedicao_itens (pedido_expedicao_id);
create index idx_pedidos_expedicao_itens_depositante_id on public.pedidos_expedicao_itens (depositante_id);

create trigger pedidos_expedicao_set_updated_at
before update on public.pedidos_expedicao
for each row
execute function public.set_current_timestamp_updated_at();

create trigger pedidos_expedicao_itens_set_updated_at
before update on public.pedidos_expedicao_itens
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.pedidos_expedicao enable row level security;
alter table public.pedidos_expedicao_itens enable row level security;

create policy "pedidos_expedicao_access"
on public.pedidos_expedicao
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "pedidos_expedicao_itens_access"
on public.pedidos_expedicao_itens
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));
