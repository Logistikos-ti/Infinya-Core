import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, sku, codigo_interno, codigo_externo, imagem_principal_url')
    .or('sku.eq.AL0216,codigo_interno.eq.AL0216,codigo_externo.eq.AL0216')
    .limit(5);
    
  console.log(JSON.stringify(data, null, 2));
}

check().catch(console.error);
