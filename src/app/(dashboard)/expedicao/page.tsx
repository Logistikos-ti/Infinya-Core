import { requireModuleAccess } from "@/lib/auth";
import {
  listShippingOrdersFromDb,
  listShippingQueuesFromDb,
  listShippingStatsFromDb,
} from "@/lib/shipping";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpedicaoClient } from "@/components/expedicao/expedicao-client";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ExpedicaoPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    dataInicial?: string;
    dataFinal?: string;
    transportadora?: string;
    cliente?: string;
    pedido?: string;
    marketplace?: string;
    page?: string;
    perPage?: string;
  }>;
};

function normalizePositiveNumber(val: string | undefined, defaultVal: number = 1): number {
  if (!val) return defaultVal;
  const num = parseInt(val, 10);
  return isNaN(num) || num < 1 ? defaultVal : num;
}

function normalizePerPage(val: string | undefined): number {
  const num = normalizePositiveNumber(val, 20);
  if (![10, 20, 50, 100].includes(num)) return 20;
  return num;
}

export default async function ExpedicaoPage({ searchParams }: ExpedicaoPageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const carrierFilter = params?.transportadora?.trim() ?? "";
  const customerFilter = params?.cliente?.trim() ?? "";
  const orderSearchFilter = params?.pedido?.trim() ?? "";
  const marketplaceFilter = params?.marketplace?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  
  const supabase = await createSupabaseServerClient();
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

  const [{ data: depositantes }, { data: produtos }, shippingOverviewOrders, shippingOrders] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    supabase
      .from("produtos")
      .select("id, nome, sku, codigo_interno, codigo_externo, imagem_principal_url, depositante_id")
      .order("nome")
      .limit(1000),
    listShippingOrdersFromDb({
      depositanteId: effectiveDepositanteFilter || undefined,
    }),
    listShippingOrdersFromDb({
      status: statusFilter || undefined,
      depositanteId: effectiveDepositanteFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      carrier: carrierFilter || undefined,
      customer: customerFilter || undefined,
      orderSearch: orderSearchFilter || undefined,
      marketplace: marketplaceFilter || undefined,
    }),
  ]);

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const [shippingStats, shippingQueues] = await Promise.all([
    listShippingStatsFromDb(user, shippingOverviewOrders),
    listShippingQueuesFromDb(shippingOverviewOrders),
  ]);

  const totalOrders = shippingOrders.length;
  
  const baseQuery = {
    status: statusFilter,
    depositante: effectiveDepositanteFilter,
    dataInicial: dateFrom,
    dataFinal: dateTo,
    transportadora: carrierFilter,
    cliente: customerFilter,
    pedido: orderSearchFilter,
    marketplace: marketplaceFilter,
    perPage: String(perPage),
  };

  const productOptions = (produtos ?? []).filter((produto) =>
    depositanteOptions.some((depositante) => depositante.id === produto.depositante_id),
  );

  const productIds = productOptions.map((produto) => produto.id);
  const { data: estoqueRows } = productIds.length
    ? await supabase.from("estoque").select("produto_id, quantidade, quantidade_reservada").in("produto_id", productIds)
    : { data: [] };
  const stockByProduct = new Map<string, number>();
  for (const row of estoqueRows ?? []) {
    const disponivel = Math.max(Number(row.quantidade ?? 0) - Number(row.quantidade_reservada ?? 0), 0);
    stockByProduct.set(row.produto_id, (stockByProduct.get(row.produto_id) ?? 0) + disponivel);
  }
  const productOptionsWithStock = productOptions.map((produto) => ({
    ...produto,
    estoque_disponivel: stockByProduct.get(produto.id) ?? 0,
  }));

  return <ExpedicaoClient data={{ stats: shippingStats, queues: shippingQueues, orders: shippingOrders, totalOrders, depositanteOptions, productOptions: productOptionsWithStock, baseQuery }} />;
}
