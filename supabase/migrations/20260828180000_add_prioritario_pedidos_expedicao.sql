-- Marcação de pedido prioritário/urgente (serviço premium): quando ligada,
-- o pedido cobra a sobretaxa de urgência configurada no contrato, somada à
-- expedição. Marcado manualmente pelo operador/depositante.
alter table public.pedidos_expedicao
  add column if not exists prioritario boolean not null default false;
