const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

async function testSql() {
  const res = await fetch(`${stgUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': stgKey,
      'Authorization': `Bearer ${stgKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: "ALTER TYPE status_pedido_expedicao ADD VALUE IF NOT EXISTS 'DIVERGENCIA';" })
  });

  console.log("Status:", res.status, "body:", await res.text());
}

testSql();
