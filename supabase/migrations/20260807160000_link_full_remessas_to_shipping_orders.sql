-- Coloca remessas Full na mesma fila operacional da expedicao.
-- A remessa continua sendo a fonte dos documentos, mas o pedido WMS
-- passa a ser o registro usado por separacao, conferencia e romaneio.

alter table public.pedidos_expedicao
  add column if not exists remessa_full_id uuid
  references public.remessas_full(id) on delete set null;

alter table public.remessas_full
  add column if not exists pedido_expedicao_id uuid
  references public.pedidos_expedicao(id) on delete set null;

create unique index if not exists uq_pedidos_expedicao_remessa_full_id
  on public.pedidos_expedicao(remessa_full_id)
  where remessa_full_id is not null;

create unique index if not exists uq_remessas_full_pedido_expedicao_id
  on public.remessas_full(pedido_expedicao_id)
  where pedido_expedicao_id is not null;

create index if not exists idx_pedidos_expedicao_origem
  on public.pedidos_expedicao(origem);

create index if not exists idx_remessas_full_pedido_expedicao_id
  on public.remessas_full(pedido_expedicao_id);
