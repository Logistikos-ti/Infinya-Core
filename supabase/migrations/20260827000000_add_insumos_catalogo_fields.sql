alter table public.insumos_catalogo
  add column if not exists sku text default null,
  add column if not exists categoria text default null,
  add column if not exists estoque_inicial integer not null default 0,
  add column if not exists estoque_minimo integer not null default 0,
  add column if not exists fornecedor text default null;
