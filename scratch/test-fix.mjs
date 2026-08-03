import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function resolveValidUserId(supabaseClient, userId) {
  if (!userId) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return null;
  const { data } = await supabaseClient.from("usuarios").select("id").eq("id", userId).maybeSingle();
  return data?.id ?? null;
}

async function testFullFlow() {
  console.log("=== TESTANDO FLUXO COMPLETO CORRIGIDO ===");
  const user = { id: '00000000-0000-0000-0000-000000000000', nome: 'Administrador Teste', email: 'admin@test.com' };
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';
  const carrierName = 'Shopee';

  const validUserId = await resolveValidUserId(supabase, user.id);
  console.log("Valid user ID from database:", validUserId);

  // 1. Check open romaneio for Shopee
  const { data: romaneios } = await supabase
    .from("romaneios_carga")
    .select("id, codigo")
    .eq("status", "ABERTO")
    .ilike("transportadora_nome", carrierName)
    .order("criado_em", { ascending: false })
    .limit(1);

  let romaneioId;
  let romaneioCodigo;

  if (!romaneios || romaneios.length === 0) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const codigo = `ROM-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${randomNum}`;
    const { data: newRomaneio, error: createError } = await supabase
      .from("romaneios_carga")
      .insert({
        codigo,
        status: "ABERTO",
        transportadora_nome: carrierName,
        criado_por: validUserId,
      })
      .select("id, codigo")
      .single();

    if (createError) throw createError;
    romaneioId = newRomaneio.id;
    romaneioCodigo = newRomaneio.codigo;
  } else {
    romaneioId = romaneios[0].id;
    romaneioCodigo = romaneios[0].codigo;
  }

  console.log("Romaneio ID:", romaneioId, "Codigo:", romaneioCodigo);

  // 2. Link order
  const { data: link, error: linkErr } = await supabase
    .from("romaneios_carga_pedidos")
    .upsert(
      {
        romaneio_id: romaneioId,
        pedido_expedicao_id: orderId,
        sequencia: 1,
      },
      { onConflict: "romaneio_id,pedido_expedicao_id" }
    )
    .select('*');

  console.log("Link error:", linkErr);
  console.log("Link success:", link);

  // Clean up
  await supabase.from("romaneios_carga_pedidos").delete().eq("romaneio_id", romaneioId);
  await supabase.from("romaneios_carga").delete().eq("id", romaneioId);
  console.log("Cleanup OK!");
}

testFullFlow().catch(console.error);
