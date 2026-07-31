import { createClient } from '@supabase/supabase-js';

const url = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const serviceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(url, serviceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const { data: users, error } = await supabase.from('usuarios').select('*');
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Profiles in public.usuarios:', users);
  }
}

run().catch(console.error);
