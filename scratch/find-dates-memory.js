const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findDates() {
  const { data, error } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_wms, data_pedido, previsao_envio_em, payload_origem');

  if (error) {
    console.error(error);
    return;
  }

  const targets = data.filter(o => {
    return (o.data_pedido && (o.data_pedido.includes('2024-10-25') || o.data_pedido.includes('2026-04-30') || o.data_pedido.includes('2026-06-15'))) ||
           (o.previsao_envio_em && (o.previsao_envio_em.includes('2024-10-25') || o.previsao_envio_em.includes('2026-04-30') || o.previsao_envio_em.includes('2026-06-15')));
  });

  console.log(`Found ${targets.length} orders with weird dates.`);

  for (const t of targets) {
    console.log(`\nOrder WMS-${t.numero_wms} (codigo: ${t.codigo}):`);
    console.log(`  data_pedido: ${t.data_pedido}`);
    console.log(`  previsao_envio_em: ${t.previsao_envio_em}`);
    
    if (t.payload_origem) {
      console.log(`  Payload data_pedido: ${t.payload_origem.data_pedido || t.payload_origem.data || t.payload_origem.dataCriacao || 'NOT FOUND'}`);
      console.log(`  Payload previsao: ${t.payload_origem.previsao_envio_em || t.payload_origem.dataPrevista || t.payload_origem.previsao || 'NOT FOUND'}`);
    }
  }
}

findDates();
