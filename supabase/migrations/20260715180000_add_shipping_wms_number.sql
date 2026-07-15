create sequence if not exists public.pedidos_expedicao_numero_wms_seq;

alter table public.pedidos_expedicao
add column if not exists numero_wms bigint;

alter sequence public.pedidos_expedicao_numero_wms_seq
owned by public.pedidos_expedicao.numero_wms;

alter table public.pedidos_expedicao
alter column numero_wms set default nextval('public.pedidos_expedicao_numero_wms_seq');

with current_max as (
  select coalesce(max(numero_wms), 0) as max_numero
  from public.pedidos_expedicao
),
ranked as (
  select
    pedido.id,
    row_number() over (order by pedido.created_at asc, pedido.id asc) as rn
  from public.pedidos_expedicao pedido
  where pedido.numero_wms is null
)
update public.pedidos_expedicao pedido
set numero_wms = current_max.max_numero + ranked.rn
from ranked, current_max
where pedido.id = ranked.id;

select setval(
  'public.pedidos_expedicao_numero_wms_seq',
  coalesce((select max(numero_wms) from public.pedidos_expedicao), 1),
  true
);

create unique index if not exists idx_pedidos_expedicao_numero_wms
on public.pedidos_expedicao (numero_wms);
