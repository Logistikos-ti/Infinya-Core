alter type public.unidade_estocagem add value if not exists 'PACK';

alter table public.produtos
add column if not exists quantidade_por_embalagem integer;

comment on column public.produtos.quantidade_por_embalagem is
'Quantidade de unidades contidas em cada embalagem quando a unidade de estocagem for CAIXA ou PACK.';
