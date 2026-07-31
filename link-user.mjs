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
  console.log("Fetching auth users...");
  const { data: users, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  if (!users || users.users.length === 0) {
    console.log("No users found in auth.users.");
    return;
  }
  
  for (const user of users.users) {
    console.log(`Checking user: ${user.email} (${user.id})`);
    
    // Check if exists in public.usuarios
    const { data: profile } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
      
    if (!profile) {
      console.log(`Creating profile for ${user.email}...`);
      const { error: insertError } = await supabase
        .from('usuarios')
        .insert({
          id: user.id,
          email: user.email,
          nome: user.email.split('@')[0],
          papel: 'ADMIN',
          ativo: true
        });
        
      if (insertError) {
        console.error(`Failed to insert profile for ${user.email}:`, insertError);
      } else {
        console.log(`Profile created successfully for ${user.email}!`);
      }
    } else {
      console.log(`Profile already exists for ${user.email}.`);
    }
  }
}

run().catch(console.error);
