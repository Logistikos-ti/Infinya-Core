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

const targetSku = "JS200TAZ00G";

async function searchSku(db) {
  console.log(`\n======================================================`);
  console.log(`DATABASE: ${db.name}`);
  console.log(`SEARCHING SKU: "${targetSku}"`);
  console.log(`======================================================`);

  const supabase = createClient(db.url, db.key, { auth: { persistSession: false } });

  // 1. Check in produtos
  const { data: produtos, error: prodErr } = await supabase
    .from('produtos')
    .select('id, nome, sku, codigo_interno, codigo_externo, depositante_id, depositantes(nome)')
    .or(`sku.ilike.%${targetSku}%,codigo_interno.ilike.%${targetSku}%,codigo_externo.ilike.%${targetSku}%`);

  console.log(`\n[1] Produtos no Catálogo (${produtos?.length ?? 0}):`);
  if (produtos && produtos.length > 0) {
    produtos.forEach(p => {
      console.log(` - ID: ${p.id} | SKU: ${p.sku} | Código Interno: ${p.codigo_interno} | Nome: ${p.nome} | Depositante: ${p.depositantes?.nome}`);
    });
  } else {
    console.log(" Nenhum produto encontrado no catálogo de produtos.");
  }

  // 1b. Check if this SKU is part of any Kit (produtos_kit)
  const prodIds = (produtos || []).map(p => p.id);
  if (prodIds.length > 0) {
    const { data: kitComponents } = await supabase
      .from('produtos_kit')
      .select('kit_id, produto_componente_id, quantidade, produto_kit:produtos!kit_id(sku, nome), produto_componente:produtos!produto_componente_id(sku, nome)')
      .in('produto_componente_id', prodIds);

    console.log(`\n[1b] Kits que contêm este produto (${kitComponents?.length ?? 0}):`);
    if (kitComponents && kitComponents.length > 0) {
      kitComponents.forEach(k => {
        console.log(` - Componente de Kit SKU: ${k.produto_kit?.sku} (${k.produto_kit?.nome}) | Quantidade: ${k.quantidade}`);
      });
    }
  }

  // 2. Check in pedidos_expedicao_itens
  const { data: itensExp, error: expErr } = await supabase
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
    .or(`sku.ilike.%${targetSku}%,codigo_produto.ilike.%${targetSku}%`);

  if (expErr) {
    console.error("Erro ao buscar itens de expedicao:", expErr);
  }

  console.log(`\n[2] Itens diretos em pedidos de expedição (${itensExp?.length ?? 0}):`);

  const distinctOrders = new Map();
  let totalQty = 0;

  for (const item of (itensExp || [])) {
    const p = item.pedido;
    if (!p) continue;
    const orderKey = p.id || p.numero_wms || p.codigo;
    totalQty += Number(item.quantidade || 0);

    if (!distinctOrders.has(orderKey)) {
      distinctOrders.set(orderKey, {
        codigo: p.numero_wms || p.codigo || p.numero_pedido || p.id,
        numero_pedido: p.numero_pedido,
        status: p.status,
        cliente: p.cliente_nome,
        depositante: p.depositante?.nome,
        data: p.data_pedido || p.created_at,
        itens: []
      });
    }

    distinctOrders.get(orderKey).itens.push({
      sku: item.sku,
      nome: item.nome,
      quantidade: item.quantidade
    });
  }

  console.log(`Total de pedidos únicos encontrados: ${distinctOrders.size}`);
  console.log(`Quantidade total de unidades do SKU: ${totalQty}`);
  
  if (distinctOrders.size > 0) {
    console.log(`\nDetalhes dos Pedidos:`);
    for (const [key, order] of distinctOrders.entries()) {
      console.log(`--------------------------------------------------`);
      console.log(` Pedido: ${order.codigo} (Ref/Origem: ${order.numero_pedido})`);
      console.log(` Status: ${order.status} | Depositante: ${order.depositante}`);
      console.log(` Destinatário: ${order.cliente} | Data: ${order.data}`);
      order.itens.forEach(i => {
        console.log(`   - Item: [${i.sku}] ${i.nome} | Qtd: ${i.quantidade}`);
      });
    }
  }

  // 3. Also check if orders contain kits where this SKU is a component
  // Search in pedidos_expedicao payload_origem or similar if needed
}

async function main() {
  for (const db of databases) {
    await searchSku(db);
  }
}

main().catch(console.error);
