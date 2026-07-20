import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants } from "@/lib/permissions";
import {
  listStockBalancesFromDb,
  listStockExpiryAlertsFromDb,
  listStockMovementsFromDb,
  listStockStatsFromDb,
  listStockTraceabilityProtocolsFromDb,
} from "@/lib/stock";
import { listCycleCountsFromDb } from "@/lib/stock-cycle-counts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type StockSearchParams = {
  depositante?: string;
  produto?: string;
  area?: string;
  lote?: string;
};

export async function getDesktopStockPageData(params?: StockSearchParams) {
  const user = await requireModuleAccess("estoque");
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const productFilter = params?.produto?.trim() ?? "";
  const areaFilter = params?.area?.trim() ?? "";
  const lotFilter = params?.lote?.trim() ?? "";
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

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

  const filters = {
    depositanteId: effectiveDepositanteFilter || undefined,
    productTerm: productFilter || undefined,
    area: areaFilter || undefined,
    lot: lotFilter || undefined,
  };

  const [stockBalances, stockMovements] = await Promise.all([
    listStockBalancesFromDb(filters),
    listStockMovementsFromDb(filters, 250),
  ]);
  const [stockExpiryAlerts, traceabilityProtocols, stockStatsCards] = await Promise.all([
    listStockExpiryAlertsFromDb(filters, 30, stockBalances),
    listStockTraceabilityProtocolsFromDb(filters, stockBalances),
    listStockStatsFromDb(user, filters, stockBalances),
  ]);
  const cycleCountsResult = await listCycleCountsFromDb(filters.depositanteId);
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

  return {
    user,
    depositanteFilter,
    productFilter,
    areaFilter,
    lotFilter,
    effectiveDepositanteFilter,
    depositanteOptions,
    produtosInventario,
    enderecosInventario,
    stockBalances,
    stockMovements,
    stockExpiryAlerts,
    traceabilityProtocols,
    stockStatsCards,
    cycleCountsResult,
    stockTransferSources,
    canSelectDepositante: canManageMultipleTenants(user),
  };
}
