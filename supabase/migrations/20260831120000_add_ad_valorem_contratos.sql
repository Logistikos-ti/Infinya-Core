-- Ad valorem / seguro operacional (planilha: "% sobre valor declarado do
-- estoque", 0,1%–0,3%). Cobrado mensalmente: valor_declarado_estoque × taxa.
-- O valor declarado é definido por depositante (o custo por produto não é
-- confiável no catálogo, então não se calcula do estoque real).
alter table public.contratos_cobranca
  add column if not exists taxa_ad_valorem numeric(6,5) not null default 0,
  add column if not exists valor_declarado_estoque numeric(15,2) not null default 0;
