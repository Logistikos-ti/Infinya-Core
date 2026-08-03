import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function testAttachments() {
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';

  const { data, error } = await supabase
    .from("documentos_armazenados")
    .select("id, tipo, nome_arquivo, mime_type, created_at")
    .eq("pedido_expedicao_id", orderId)
    .order("created_at", { ascending: false });

  console.log("Error documentos_armazenados:", error);
  console.log("Data:", data);
}

testAttachments().catch(console.error);
