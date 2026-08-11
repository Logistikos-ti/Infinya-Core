import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function createDivergentTestOrder() {
  console.log("=== CRIANDO PEDIDO DE TESTE COM DIVERGÊNCIA EM STAGING ===");

  // 1. Get depositante
  const { data: depositantes, error: depError } = await supabase
    .from('depositantes')
    .select('id, nome')
    .limit(1);

  if (depError || !depositantes?.length) {
    throw new Error(`Depositante não encontrado: ${depError?.message}`);
  }

  const depositante = depositantes[0];
  console.log(`Depositante: ${depositante.nome} (${depositante.id})`);

  // 2. Ensure test products exist
  const prod1Sku = "SKU-TESTE-001";
  const prod2Sku = "SKU-TESTE-002";

  let { data: p1 } = await supabase
    .from('produtos')
    .select('id, sku, nome, codigo_externo, codigo_interno')
    .eq('sku', prod1Sku)
    .maybeSingle();

  let { data: p2 } = await supabase
    .from('produtos')
    .select('id, sku, nome, codigo_externo, codigo_interno')
    .eq('sku', prod2Sku)
    .maybeSingle();

  if (!p1 || !p2) {
    const { data: prods } = await supabase
      .from('produtos')
      .select('id, sku, nome, codigo_externo, codigo_interno')
      .eq('depositante_id', depositante.id)
      .limit(2);

    if (prods && prods.length >= 2) {
      p1 = prods[0];
      p2 = prods[1];
    }
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const orderCode = `PED-DIV-${randomNum}`;
  const now = new Date().toISOString();

  const payloadOrigem = {
    tipo_criacao: "teste_manual",
    transportadora: "Mercado Envios",
    transportadora_nome: "Mercado Envios",
    codigo_rastreio: `ME${randomNum}993BR`,
    volumes: 1,
    cliente: {
      nome: "Mariana Silva Costa (Teste Divergência)",
      cidade: "São Paulo",
      uf: "SP",
      documento: "341.890.123-45",
    },
    conferencia: {
      marcadoComoDivergenteEm: now,
      motivoDivergencia: "Quantidade física de itens não confere com o pedido (falta de 1 unidade)",
      produtoErradoCount: 1,
      operadorNome: "Operador Conferência 1",
    },
    divergencia: {
      registradoPorNome: "Operador Conferência 1",
      motivo: "Falta física de 1 unidade durante a conferência",
      tipo: "Divergência",
      registradoEm: now,
    },
    separacao: {
      motivoCancelamento: "Falta física de 1 unidade durante a conferência",
      canceladoPorNome: "Operador Conferência 1",
    },
  };

  const { data: order, error: orderError } = await supabase
    .from('pedidos_expedicao')
    .insert({
      codigo: orderCode,
      referencia_externa: orderCode,
      numero_pedido: `PED-DIV-${randomNum}`,
      numero_wms: randomNum,
      depositante_id: depositante.id,
      status: 'CANCELADO',
      cliente_nome: 'Mariana Silva Costa (Teste Divergência)',
      cliente_cidade: 'São Paulo',
      cliente_uf: 'SP',
      quantidade_itens: 2,
      quantidade_unidades: 3,
      valor_total: 249.90,
      payload_origem: payloadOrigem,
    })
    .select('id, codigo, numero_pedido, status')
    .single();

  if (orderError || !order) {
    throw new Error(`Erro ao criar pedido com divergência: ${orderError?.message}`);
  }

  // 4. Insert items into pedidos_expedicao_itens
  const { error: itemsError } = await supabase.from('pedidos_expedicao_itens').insert([
    {
      pedido_expedicao_id: order.id,
      depositante_id: depositante.id,
      produto_id: p1 ? p1.id : null,
      sku: p1 ? p1.sku : 'SKU-TESTE-001',
      codigo_produto: p1 ? p1.codigo_interno || '7891000100018' : '7891000100018',
      nome: p1 ? p1.nome : 'Produto Teste A',
      unidade: 'UNIDADE',
      quantidade: 2,
      quantidade_separada: 2,
      payload_origem: {
        manual: true,
        conferencia: {
          quantidadeConferida: 1,
          divergente: true,
          motivo: "Falta de 1 unidade física",
        },
      },
    },
    {
      pedido_expedicao_id: order.id,
      depositante_id: depositante.id,
      produto_id: p2 ? p2.id : null,
      sku: p2 ? p2.sku : 'SKU-TESTE-002',
      codigo_produto: p2 ? p2.codigo_interno || '7891000200025' : '7891000200025',
      nome: p2 ? p2.nome : 'Produto Teste B',
      unidade: 'UNIDADE',
      quantidade: 1,
      quantidade_separada: 1,
      payload_origem: {
        manual: true,
        conferencia: {
          quantidadeConferida: 1,
          divergente: false,
        },
      },
    },
  ]);

  if (itemsError) {
    throw new Error(`Erro ao criar itens: ${itemsError.message}`);
  }

  console.log("\n=================================================================");
  console.log("🎉 PEDIDO COM DIVERGÊNCIA CRIADO COM SUCESSO EM STAGING!");
  console.log(`🆔 ID do Pedido: ${order.id}`);
  console.log(`📦 Código do Pedido: ${order.codigo}`);
  console.log(`⚠️ Status: ${order.status}`);
  console.log(`👤 Cliente: Mariana Silva Costa (Teste Divergência)`);
  console.log("-----------------------------------------------------------------");
  console.log("🌐 ONDE VISUALIZAR:");
  console.log(`1. Painel Desktop Expedição (Aba Divergências): https://testing.infinoos.com.br/expedicao`);
  console.log(`2. Detalhes do Pedido: https://testing.infinoos.com.br/expedicao/${order.id}`);
  console.log(`3. Conferência Desktop: https://testing.infinoos.com.br/expedicao/conferencia/${order.id}`);
  console.log("=================================================================\n");
}

createDivergentTestOrder().catch(console.error);
