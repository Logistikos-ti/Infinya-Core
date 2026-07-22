do $$
begin
  create type public.status_onda_separacao as enum (
    'PENDENTE',
    'EM_SEPARACAO',
    'PAUSADA',
    'CONCLUIDA',
    'CANCELADA'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.ondas_separacao (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  status public.status_onda_separacao not null default 'PENDENTE',
  criado_por uuid references public.usuarios (id) on delete set null,
  operador_id uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now()),
  iniciado_em timestamptz,
  finalizado_em timestamptz
);

create table if not exists public.ondas_separacao_pedidos (
  id uuid primary key default gen_random_uuid(),
  onda_separacao_id uuid not null references public.ondas_separacao (id) on delete cascade,
  pedido_expedicao_id uuid not null references public.pedidos_expedicao (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (onda_separacao_id, pedido_expedicao_id)
);

create index if not exists idx_ondas_separacao_status on public.ondas_separacao (status);
create index if not exists idx_ondas_separacao_operador_id on public.ondas_separacao (operador_id);
create index if not exists idx_ondas_separacao_pedidos_onda_id on public.ondas_separacao_pedidos (onda_separacao_id);
create index if not exists idx_ondas_separacao_pedidos_pedido_id on public.ondas_separacao_pedidos (pedido_expedicao_id);

create trigger ondas_separacao_set_updated_at
before update on public.ondas_separacao
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.ondas_separacao enable row level security;
alter table public.ondas_separacao_pedidos enable row level security;

-- For now, allow authenticated users full access to these tables (tenant filtering applied implicitly via orders if needed).
create policy "ondas_separacao_access"
on public.ondas_separacao
for all
to authenticated
using (true)
with check (true);

create policy "ondas_separacao_pedidos_access"
on public.ondas_separacao_pedidos
for all
to authenticated
using (true)
with check (true);

create sequence if not exists public.ondas_separacao_numero_seq;
