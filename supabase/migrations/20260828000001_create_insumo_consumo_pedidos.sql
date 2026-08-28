-- Rastreamento real de consumo de insumos por pedido de expedição. Registrado
-- na conferência, logo após o operador bipar todos os itens: ele escolhe se
-- usou insumo do galpão (cobrado pelo valor configurado em insumos_catalogo),
-- insumo do próprio depositante (não cobra nada) ou nenhum insumo. A escolha
-- fica sempre registrada aqui, mesmo "nenhum", para permitir auditoria.

create table if not exists public.insumo_consumo_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_expedicao_id uuid not null references public.pedidos_expedicao(id),
  depositante_id uuid not null references public.depositantes(id),
  origem text not null check (origem in ('GALPAO', 'DEPOSITANTE', 'NENHUM')),
  insumo_catalogo_id uuid references public.insumos_catalogo(id),
  insumo_nome text,
  quantidade numeric(10,2),
  lancamento_id uuid references public.lancamentos(id),
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists insumo_consumo_pedidos_pedido_idx
  on public.insumo_consumo_pedidos(pedido_expedicao_id);

alter table public.insumo_consumo_pedidos enable row level security;

create policy insumo_consumo_pedidos_service_all
  on public.insumo_consumo_pedidos for all to service_role using (true) with check (true);

create policy insumo_consumo_pedidos_access
  on public.insumo_consumo_pedidos for select to authenticated
  using (public.can_access_depositante(depositante_id));
