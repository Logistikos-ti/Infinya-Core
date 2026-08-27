-- ============================================================================
-- Módulo Financeiro — Contas a Pagar (despesas da Infinoos a fornecedores)
-- ============================================================================

create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),

  fornecedor text not null,
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null,
  vencimento date not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'PAGO', 'VENCIDO')),
  pago_em timestamptz,
  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contas_pagar_vencimento
  on public.contas_pagar (vencimento);
create index if not exists idx_contas_pagar_status
  on public.contas_pagar (status);

alter table public.contas_pagar enable row level security;

create policy contas_pagar_service_all
  on public.contas_pagar for all to service_role using (true) with check (true);

-- Não é vinculado a depositante — dado interno da operação, visível só a admin/TI.
create policy contas_pagar_admin_access
  on public.contas_pagar for select to authenticated
  using (public.is_admin());

create or replace function public.set_contas_pagar_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_contas_pagar_updated_at
  before update on public.contas_pagar
  for each row execute function public.set_contas_pagar_updated_at();
