alter table public.contratos_cobranca
  add column if not exists insumos_depositante text[] not null default '{}';
