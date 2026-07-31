const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:RDP1yIVzsBHnxCyG@db.brevhcwdhqyjqseduwpb.supabase.co:5432/postgres',
});

async function getTableInfo() {
  await client.connect();
  const res = await client.query(`
    SELECT DISTINCT papel FROM usuarios;
  `);
  console.log(res.rows);
  await client.end();
}

getTableInfo().catch(console.error);
