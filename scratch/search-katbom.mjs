import { createClient } from '@supabase/supabase-js';

const databases = [
  {
    name: "Production (brevhcwdhqyjqseduwpb)",
    url: "https://brevhcwdhqyjqseduwpb.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
  },
  {
    name: "Staging (etlylcdcxrwdmnqulxtu)",
    url: "https://etlylcdcxrwdmnqulxtu.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM"
  }
];

async function searchInDb(db) {
  console.log(`\n========================================`);
  console.log(`DATABASE: ${db.name}`);
  console.log(`========================================`);

  const supabase = createClient(db.url, db.key, { auth: { persistSession: false } });

  // 1. Search in produtos
  const { data: produtos, error: prodErr } = await supabase
    .from('produtos')
    .select('id, nome, sku, codigo_interno, codigo_externo, depositante_id, depositantes(nome)')
    .or('nome.ilike.%katbom%,sku.ilike.%katbom%,nome.ilike.%kat%bom%');

  console.log(`\nProdutos encontrados no catálogo (${produtos?.length ?? 0}):`);
  console.log(produtos);

  // 2. Search in pedidos_expedicao_itens by nome or sku
  const { data: expedicaoItens, error: expErr } = await supabase
    .from('pedidos_expedicao_itens')
    .select(`
      id,
      pedido_expedicao_id,
      codigo_produto,
      sku,
      nome,
      quantidade,
      pedido:pedidos_expedicao(
        id,
        codigo,
        numero_wms,
        numero_pedido,
        status,
        cliente_nome,
        created_at,
        data_pedido,
        depositante:depositantes(nome)
      )
    `)
    .or('nome.ilike.%katbom%,sku.ilike.%katbom%,nome.ilike.%kat%bom%');

  console.log(`\nItens em pedidos de expedição (${expedicaoItens?.length ?? 0}):`);
  
  const distinctExpOrders = new Map();
  for (const item of expedicaoItens || []) {
    const p = item.pedido;
    if (p) {
      if (!distinctExpOrders.has(p.id)) {
        distinctExpOrders.set(p.id, {
          order: p,
          items: []
        });
      }
      distinctExpOrders.get(p.id).items.push(item);
    }
  }

  console.log(`Total de pedidos de expedição distintos: ${distinctExpOrders.size}`);
  for (const [orderId, info] of distinctExpOrders.entries()) {
    const o = info.order;
    const depName = Array.isArray(o.depositante) ? o.depositante[0]?.nome : o.depositante?.nome;
    console.log(`- Pedido: ${o.codigo} | WMS: ${o.numero_wms} | NF/Nº: ${o.numero_pedido} | Status: ${o.status} | Cliente: ${o.cliente_nome} | Dep: ${depName}`);
    for (const it of info.items) {
      console.log(`    Item: "${it.nome}" | SKU: ${it.sku} | Qtd: ${it.quantidade}`);
    }
  }

  // Also check by searching "Areia" in case the name is slightly different
  const { data: areiaItens } = await supabase
    .from('pedidos_expedicao_itens')
    .select('id, nome, sku, quantidade, pedido_expedicao_id')
    .ilike('nome', '%areia%');

  console.log(`\nTodos os itens com "areia" no nome (${areiaItens?.length ?? 0}):`);
  const areiaNames = [...new Set(areiaItens?.map(i => i.nome))];
  console.log(areiaNames);
}

async function main() {
  for (const db of databases) {
    await searchInDb(db);
  }
}

main().catch(console.error);
