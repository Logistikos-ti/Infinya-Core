const { createClient } = require('@supabase/supabase-js');

async function testQuery() {
  require('dotenv').config({ path: '.env.local' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, documentos:documentos_armazenados(tipo)')
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

testQuery();
