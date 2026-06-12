-- Script opcional para ambiente de desenvolvimento.
-- Requer que os depositantes-base e enderecos ja existam.

with depositantes_base as (
  select id, codigo
  from public.depositantes
  where codigo in ('EVOLVEG', 'FESTCOLOR', 'RENNOVA', 'SUAALIADA')
),
produtos_seed as (
  insert into public.produtos (
    depositante_id,
    codigo_interno,
    codigo_externo,
    sku,
    nome,
    categoria,
    metodo_retirada,
    unidade_estocagem,
    exige_lote,
    exige_validade,
    qtd_minima,
    qtd_maxima,
    ativo
  )
  values
    ((select id from depositantes_base where codigo = 'EVOLVEG'), 'EVG-001', 'ERP-EVG-001', 'EVG-SERUM-30', 'Serum facial 30ml', 'Skincare', 'FEFO', 'UNIDADE', true, true, 12, 240, true),
    ((select id from depositantes_base where codigo = 'EVOLVEG'), 'EVG-002', 'ERP-EVG-002', 'EVG-CREAM-50', 'Creme hidratante 50g', 'Skincare', 'FEFO', 'UNIDADE', true, true, 12, 240, true),
    ((select id from depositantes_base where codigo = 'FESTCOLOR'), 'FES-001', 'ERP-FES-001', 'FES-PAPER-09', 'Papel decorativo premium', 'Papelaria', 'FIFO', 'CAIXA', false, false, 10, 320, true),
    ((select id from depositantes_base where codigo = 'RENNOVA'), 'REN-001', 'ERP-REN-001', 'REN-COLAG-01', 'Colageno hidrolisado', 'Suplementos', 'FEFO', 'UNIDADE', true, true, 8, 180, true),
    ((select id from depositantes_base where codigo = 'SUAALIADA'), 'SUA-001', 'ERP-SUA-001', 'SUA-VIT-C', 'Vitamina C 60 caps', 'Vitaminas', 'FEFO', 'UNIDADE', true, true, 8, 180, true)
  on conflict (depositante_id, codigo_interno) do update
  set
    codigo_externo = excluded.codigo_externo,
    sku = excluded.sku,
    nome = excluded.nome,
    categoria = excluded.categoria,
    metodo_retirada = excluded.metodo_retirada,
    unidade_estocagem = excluded.unidade_estocagem,
    exige_lote = excluded.exige_lote,
    exige_validade = excluded.exige_validade,
    qtd_minima = excluded.qtd_minima,
    qtd_maxima = excluded.qtd_maxima,
    ativo = excluded.ativo,
    updated_at = timezone('utc', now())
  returning id, depositante_id, sku
)
insert into public.pedidos_recebimento (
  depositante_id,
  codigo,
  referencia_externa,
  status,
  previsto_para,
  nota_fiscal_numero,
  fornecedor_nome,
  observacoes
)
values
  ((select id from depositantes_base where codigo = 'EVOLVEG'), 'REC-240610-001', 'NF-81273', 'AGUARDANDO', current_date, '81273', 'Industria Prisma', 'Pedido de demonstracao para o fluxo inicial de recebimento.'),
  ((select id from depositantes_base where codigo = 'FESTCOLOR'), 'REC-240610-002', 'NF-81274', 'EM_RECEBIMENTO', current_date, '81274', 'PaperCraft Brasil', 'Pedido em conferencia fisica.'),
  ((select id from depositantes_base where codigo = 'SUAALIADA'), 'REC-240610-003', 'NF-81275', 'DIVERGENCIA', current_date, '81275', 'Vida Farma', 'Pedido com ocorrencia de validade critica.')
on conflict (codigo) do update
set
  referencia_externa = excluded.referencia_externa,
  status = excluded.status,
  previsto_para = excluded.previsto_para,
  nota_fiscal_numero = excluded.nota_fiscal_numero,
  fornecedor_nome = excluded.fornecedor_nome,
  observacoes = excluded.observacoes,
  updated_at = timezone('utc', now());
