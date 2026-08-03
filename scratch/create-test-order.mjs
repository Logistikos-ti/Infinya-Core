import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function createTestOrder() {
  console.log("=== CRIANDO PRODUTOS E PEDIDO DE TESTE ===");

  // 1. Get depositante
  const { data: depositantes } = await supabase
    .from('depositantes')
    .select('id, nome')
    .limit(1);

  const depositante = depositantes[0];
  console.log(`Depositante: ${depositante.nome} (${depositante.id})`);

  // 2. Ensure test products exist
  const prod1Sku = "SKU-TESTE-001";
  const prod1Barcode = "7891000100018";
  const prod2Sku = "SKU-TESTE-002";
  const prod2Barcode = "7891000200025";

  let { data: p1 } = await supabase
    .from('produtos')
    .select('id, sku, nome, codigo_externo, codigo_interno')
    .eq('sku', prod1Sku)
    .single();

  let { data: p2 } = await supabase
    .from('produtos')
    .select('id, sku, nome, codigo_externo, codigo_interno')
    .eq('sku', prod2Sku)
    .single();

  // 3. Generate test order
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const orderCode = `PED-TESTE-${randomNum}`;
  // 44 digits simulated DANFE Key
  const danfeCode = `352608039999990001005500100000${randomNum}10000${randomNum}9`;

  const payloadOrigem = {
    tipo_criacao: "teste_manual",
    transportadora: "Correios",
    transportadora_nome: "Correios",
    codigo_rastreio: `BR${randomNum}88992BR`,
    danfe_simplificada: danfeCode,
    volumes: 1,
    cliente: {
      nome: "Cliente Teste Romaneio Mobile",
      cidade: "São Paulo",
      uf: "SP",
      documento: "123.456.789-00",
    },
  };

  const { data: order, error: orderError } = await supabase
    .from('pedidos_expedicao')
    .insert({
      codigo: orderCode,
      referencia_externa: orderCode,
      numero_pedido: `PED-${randomNum}`,
      numero_wms: randomNum,
      depositante_id: depositante.id,
      status: 'EM_CONFERENCIA',
      cliente_nome: 'Cliente Teste Romaneio Mobile',
      cliente_cidade: 'São Paulo',
      cliente_uf: 'SP',
      quantidade_itens: 2,
      quantidade_unidades: 2,
      valor_total: 189.90,
      payload_origem: payloadOrigem,
    })
    .select('id, codigo, numero_pedido, status')
    .single();

  if (orderError || !order) {
    throw new Error(`Erro ao criar pedido: ${orderError?.message}`);
  }

  // 4. Insert items into pedidos_expedicao_itens
  const { error: itemsError } = await supabase.from('pedidos_expedicao_itens').insert([
    {
      pedido_expedicao_id: order.id,
      depositante_id: depositante.id,
      produto_id: p1.id,
      sku: p1.sku,
      codigo_produto: prod1Barcode,
      nome: p1.nome,
      unidade: 'UNIDADE',
      quantidade: 1,
      quantidade_separada: 1,
      payload_origem: { manual: true },
    },
    {
      pedido_expedicao_id: order.id,
      depositante_id: depositante.id,
      produto_id: p2.id,
      sku: p2.sku,
      codigo_produto: prod2Barcode,
      nome: p2.nome,
      unidade: 'UNIDADE',
      quantidade: 1,
      quantidade_separada: 1,
      payload_origem: { manual: true },
    },
  ]);

  if (itemsError) {
    throw new Error(`Erro ao criar itens: ${itemsError.message}`);
  }

  console.log("\n=================================================================");
  console.log("🎉 PEDIDO DE TESTE GERADO COM SUCESSO!");
  console.log(`🆔 ID do Pedido: ${order.id}`);
  console.log(`📦 Código do Pedido: ${order.codigo}`);
  console.log(`🚚 Transportadora: Correios`);
  console.log(`📄 Chave DANFE Simplificada:`);
  console.log(`👉 ${danfeCode}`);
  console.log("-----------------------------------------------------------------");
  console.log("📱 LINK DIRETO PARA CONFERÊNCIA MOBILE:");
  console.log(`🔗 https://testing.infinoos.com.br/m/conferencia/${order.id}`);
  console.log("-----------------------------------------------------------------");
  console.log("ITENS PARA BIPAR NA CONFERÊNCIA:");
  console.log(` 1. [Qtd: 1] ${p1.nome}`);
  console.log(`    👉 Código de Barras: ${prod1Barcode}`);
  console.log(`    👉 SKU: ${p1.sku}`);
  console.log(` 2. [Qtd: 1] ${p2.nome}`);
  console.log(`    👉 Código de Barras: ${prod2Barcode}`);
  console.log(`    👉 SKU: ${p2.sku}`);
  console.log("=================================================================\n");
}

createTestOrder().catch(console.error);
