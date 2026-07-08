import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule, canManageMultipleTenants } from "@/lib/permissions";
import { listCycleCountsFromDb } from "@/lib/stock-cycle-counts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { listStockBalancesFromDb } from "@/lib/stock";

export async function getMobileStockPageData() {
  const user = await getCurrentUserContext();

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositantes } = await adminSupabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const [{ data: produtosAtivos }, { data: enderecosAtivos }] = await Promise.all([
    adminSupabase
      .from("produtos")
      .select("id, depositante_id, nome, sku, codigo_interno, codigo_externo, exige_lote, exige_validade")
      .eq("ativo", true)
      .order("nome"),
    adminSupabase
      .from("enderecos")
      .select("id, codigo, area")
      .eq("ativo", true)
      .order("codigo"),
  ]);

  const visibleDepositanteIds = new Set(depositanteOptions.map((item) => item.id));
  const produtosInventario = (produtosAtivos ?? [])
    .filter((item) => visibleDepositanteIds.has(item.depositante_id))
    .map((item) => ({
      id: item.id,
      depositanteId: item.depositante_id,
      nome: item.nome,
      sku: item.sku,
      codigoInterno: item.codigo_interno,
      codigoExterno: item.codigo_externo,
      exigeLote: item.exige_lote,
      exigeValidade: item.exige_validade,
    }));
  const enderecosInventario = (enderecosAtivos ?? []).map((item) => ({
    id: item.id,
    codigo: item.codigo,
    area: item.area,
  }));

  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteOptions[0]?.id ?? "";
  const stockBalances = await listStockBalancesFromDb({
    depositanteId: effectiveDepositanteFilter || undefined,
  });
  const stockTransferSources = stockBalances
    .filter(
      (item) =>
        item.status === "Disponível" &&
        Number(item.saldo.replace(/\./g, "").replace(",", ".")) > 0,
    )
    .map((item) => ({
      value: item.id,
      depositanteId: item.depositanteId,
      enderecoId:
        enderecosInventario.find((endereco) => endereco.codigo === item.endereco)?.id ?? "",
      label: `${item.protocol} • ${item.sku} • ${item.productName} • ${item.endereco} • saldo ${item.saldo}`,
    }))
    .filter((item) => item.enderecoId);

  const cycleCountsResult = await listCycleCountsFromDb(effectiveDepositanteFilter || undefined);

  return {
    user,
    cycleCountsResult,
    depositanteOptions,
    produtosInventario,
    enderecosInventario,
    stockTransferSources,
    defaultDepositanteId: effectiveDepositanteFilter,
    canSelectDepositante: canManageMultipleTenants(user),
  };
}
