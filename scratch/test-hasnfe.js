const { createClient } = require('@supabase/supabase-js');

async function testQuery() {
  require('dotenv').config({ path: '.env.local' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_wms, documentos:documentos_armazenados(tipo, nome_arquivo, mime_type)')
    .eq('numero_wms', 405)
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Raw from DB:', JSON.stringify(data[0], null, 2));
    const item = data[0];
    const docs = Array.isArray(item.documentos) ? item.documentos : [];
    const hasNfe = docs.some(d => d.tipo === "NF" || (d.mime_type && d.mime_type.includes("xml")));
    console.log('hasNfe:', hasNfe);
  }
}

testQuery();
