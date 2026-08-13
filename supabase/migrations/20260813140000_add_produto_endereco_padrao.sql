-- Adds a "default/registered address" per product, so that finishing a
-- receiving order can drop each item straight into the product's own
-- storage address instead of a single shared receiving/staging bin.
-- Products without this set yet keep the previous behaviour: they land in
-- the receiving/staging address chosen for the order, and a pending
-- "endereçamento" task is still opened as a safety net.

alter table public.produtos
  add column if not exists endereco_padrao_id uuid references public.enderecos (id) on delete set null;

create index if not exists produtos_endereco_padrao_id_idx
  on public.produtos (endereco_padrao_id);
