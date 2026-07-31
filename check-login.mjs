import { createClient } from '@supabase/supabase-js';

const url = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const serviceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data, error } = await supabase.from('usuarios').select('id, login').limit(1);
  if (error) {
    console.error('Error selecting login:', error.message);
  } else {
    console.log('Success:', data);
  }
}

run().catch(console.error);
