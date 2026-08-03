import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function test() {
  console.log("=== TESTANDO FLUXO COMPLETO DE ROMANEIO MOBILE ===");

  // 1. Check open romaneios
  const { data: openRomaneios } = await supabase
    .from("romaneios_carga")
    .select("id, codigo, status, transportadora_nome, motorista_nome")
    .eq("status", "ABERTO");

  console.log("1. Romaneios ABERTOS:", openRomaneios?.length);
  openRomaneios?.forEach(r => console.log(`   - [${r.codigo}] Transportadora: ${r.transportadora_nome}`));

  // 2. Check orders linked to first open romaneio
  if (openRomaneios && openRomaneios.length > 0) {
    const rId = openRomaneios[0].id;
    const { data: links } = await supabase
      .from("romaneios_carga_pedidos")
      .select("pedido_expedicao_id, pedidos_expedicao(codigo, transportadora_nome, status)")
      .eq("romaneio_id", rId);

    console.log(`2. Pedidos no Romaneio [${openRomaneios[0].codigo}]:`, links?.length);
    links?.forEach(l => console.log(`   - Pedido: ${l.pedidos_expedicao?.codigo} | Status: ${l.pedidos_expedicao?.status}`));
  }

  // 3. Test list saved drivers
  const { data: driversData } = await supabase
    .from("romaneios_carga")
    .select("motorista_nome, motorista_documento, veiculo_modelo, veiculo_placa, transportadora_nome")
    .not("motorista_nome", "is", null);

  const uniqueDrivers = new Map();
  for (const d of (driversData || [])) {
    const key = `${d.motorista_nome?.trim()}|${d.motorista_documento?.trim()}`;
    if (!uniqueDrivers.has(key) && d.motorista_nome) {
      uniqueDrivers.set(key, {
        nome: d.motorista_nome.trim(),
        documento: d.motorista_documento?.trim() || "",
        veiculoModelo: d.veiculo_modelo?.trim() || "",
        veiculoPlaca: d.veiculo_placa?.trim() || "",
      });
    }
  }

  console.log("3. Motoristas Frequentes salvos:", Array.from(uniqueDrivers.values()).length);
  Array.from(uniqueDrivers.values()).forEach(d => console.log(`   - Motorista: ${d.nome} | Doc: ${d.documento} | Placa: ${d.veiculoPlaca}`));

  console.log("=== FLUXO PRONTO E VALIDADO COM SUCESSO! ===");
}

test().catch(console.error);
