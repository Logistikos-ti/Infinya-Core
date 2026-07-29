const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findDates() {
  const { data, error } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_wms, data_pedido, previsao_envio_em, payload_origem')
    .in('codigo', ['BLG-26210086884', 'BLG-26227221589', 'BLG-26231362799', 'BLG-26306607627', 'BLG-26233405797', 'BLG-26227189182', 'BLG-26212579124']); // I will just get all weird ones

  // Wait, I don't know their codes. I will query by the weird dates!
  const { data: weird, error: err2 } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_wms, data_pedido, previsao_envio_em, payload_origem');

  if (err2) {
    console.error(err2);
    return;
  }

  const targets = weird.filter(o => {
    const d = o.data_pedido ? o.data_pedido.split('T')[0] : '';
    return d === '2024-10-25' || d === '2026-04-30' || d === '2026-06-15' || d === '2025-06-15';
  });

  for (const t of targets) {
    console.log(`Order ${t.numero_wms} (codigo: ${t.codigo}) - data_pedido atual: ${t.data_pedido}`);
    
    // Check payload
    let realDate = null;
    if (t.payload_origem) {
      if (t.payload_origem.data) realDate = t.payload_origem.data;
      if (t.payload_origem.dataCriacao) realDate = t.payload_origem.dataCriacao;
      if (t.payload_origem.data_pedido) realDate = t.payload_origem.data_pedido;
      
      console.log('  Payload data:', t.payload_origem.data, 'dataCriacao:', t.payload_origem.dataCriacao, 'data_pedido:', t.payload_origem.data_pedido);
    }
  }
}

findDates();
