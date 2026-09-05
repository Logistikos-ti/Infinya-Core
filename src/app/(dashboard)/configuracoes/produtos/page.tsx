import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { ProdutosDashboard } from "@/components/configuracoes/produtos-dashboard";

type ConfiguracoesProdutosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    q?: string;
    depositante?: string;
    status?: string;
    metodo?: string;
    categoria?: string;
    tamanho?: string;
    page?: string;
    perPage?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ConfiguracoesProdutosPage({
  searchParams,
}: ConfiguracoesProdutosPageProps) {
  noStore();
  const currentUser = await requireConfigSectionAccess("produtos");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const searchTerm = params?.q?.trim() ?? "";
  const depositanteFiltro = params?.depositante?.trim() ?? "";
  const statusFiltro = params?.status?.trim() ?? "todos";
  const metodoFiltro = params?.metodo?.trim() ?? "";
  const categoriaFiltro = params?.categoria?.trim() ?? "";
  const tamanhoFiltro = params?.tamanho?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  const startIndex = (page - 1) * perPage;
  const adminSupabase = createSupabaseAdminClient();
  const { data: rawDepositantes } = await adminSupabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  const visibleDepositantes = filterDepositanteOptionsByUser(currentUser, rawDepositantes ?? []);
  const depositanteFiltroEfetivo =
    depositanteFiltro || (visibleDepositantes.length === 1 ? visibleDepositantes[0]?.id ?? "" : "");

  const applyCommonProductFilters = <T extends ReturnType<typeof adminSupabase.from>>(
    query: T,
  ) => {
    let nextQuery = query;

    if (searchTerm) {
      const escapedSearch = escapeSupabaseLike(searchTerm);
      nextQuery = nextQuery.or(
        [
          `nome.ilike.%${escapedSearch}%`,
          `sku.ilike.%${escapedSearch}%`,
          `codigo_interno.ilike.%${escapedSearch}%`,
          `codigo_externo.ilike.%${escapedSearch}%`,
        ].join(","),
      ) as T;
    }

    if (depositanteFiltroEfetivo) {
      nextQuery = nextQuery.eq("depositante_id", depositanteFiltroEfetivo) as T;
    }

    if (metodoFiltro) {
      nextQuery = nextQuery.eq("metodo_retirada", metodoFiltro) as T;
    }

    if (categoriaFiltro) {
      nextQuery = nextQuery.eq("categoria", categoriaFiltro) as T;
    }

    if (tamanhoFiltro) {
      nextQuery = nextQuery.ilike("tamanho", tamanhoFiltro) as T;
    }

    return nextQuery;
  };

  let stockStatusIds: string[] | null = null;
  if (statusFiltro === "ruptura" || statusFiltro === "baixo") {
    let candidateQuery = adminSupabase
      .from("produtos")
      .select("id, qtd_minima")
      .eq("ativo", true);

    candidateQuery = applyCommonProductFilters(candidateQuery);
    const { data: candidateProducts } = await candidateQuery;
    const candidateIds = (candidateProducts ?? []).map((product) => product.id);

    let candidateStock: { produto_id: string; quantidade: number }[] = [];
    if (candidateIds.length) {
      const { data } = await adminSupabase
        .from("estoque")
        .select("produto_id, quantidade")
        .in("produto_id", candidateIds);
      candidateStock = data ?? [];
    }

    const candidateStockMap = candidateStock.reduce((acc, curr) => {
      const qty = Number(curr.quantidade) || 0;
      acc[curr.produto_id] = (acc[curr.produto_id] || 0) + qty;
      return acc;
    }, {} as Record<string, number>);

    stockStatusIds = (candidateProducts ?? [])
      .filter((product) => {
        const stock = candidateStockMap[product.id] || 0;
        const min = Number(product.qtd_minima) || 0;

        if (statusFiltro === "ruptura") return stock === 0;
        return stock > 0 && min > 0 && stock < min;
      })
      .map((product) => product.id);
  }

  const emptyStockStatusFilter = stockStatusIds !== null && stockStatusIds.length === 0;

  let productsQuery = adminSupabase
    .from("produtos")
    .select(
      "id, codigo_interno, codigo_externo, sku, nome, categoria, tamanho, metodo_retirada, unidade_estocagem, exige_lote, exige_validade, ativo, created_at, depositante_id, depositante:depositantes(nome), imagem_principal_url, peso_kg, altura_cm, largura_cm, comprimento_cm, qtd_minima, qtd_maxima",
      { count: "exact" },
    )
    .order("nome")
    .range(startIndex, startIndex + perPage - 1);

  productsQuery = applyCommonProductFilters(productsQuery);

  if (statusFiltro === "ativos") {
    productsQuery = productsQuery.eq("ativo", true);
  } else if (statusFiltro === "inativos") {
    productsQuery = productsQuery.eq("ativo", false);
  } else if (stockStatusIds) {
    productsQuery = productsQuery.eq("ativo", true).in("id", stockStatusIds);
  }

  const [
    { data: products, count },
    { data: categoryRows },
    { data: tamanhoRows },
    { data: allActiveProducts },
    { data: allStock },
  ] = await Promise.all([
    emptyStockStatusFilter ? Promise.resolve({ data: [], count: 0 }) : productsQuery,
    adminSupabase.from("produtos").select("categoria").eq("ativo", true),
    adminSupabase.from("produtos").select("tamanho").eq("ativo", true).eq("categoria", "Vestuário"),
    // Global KPIs for active products (independent of the paginated query above)
    adminSupabase.from("produtos").select("id, qtd_minima").eq("ativo", true),
    adminSupabase.from("estoque").select("produto_id, quantidade"),
  ]);

  const globalStockMap = (allStock || []).reduce((acc, curr) => {
    const qty = Number(curr.quantidade) || 0;
    acc[curr.produto_id] = (acc[curr.produto_id] || 0) + qty;
    return acc;
  }, {} as Record<string, number>);

  let globalBaixos = 0;
  let globalRupturas = 0;

  (allActiveProducts || []).forEach(p => {
    const s = globalStockMap[p.id] || 0;
    const min = p.qtd_minima || 0;
    if (s === 0) globalRupturas++;
    else if (min > 0 && s < min) globalBaixos++;
  });

  const { count: globalTotal } = await adminSupabase
    .from("produtos")
    .select("id", { count: "exact", head: true });
  const globalAtivos = (allActiveProducts || []).length;
  const globalInativos = (globalTotal ?? 0) - globalAtivos;

  const totalProducts = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = products ?? [];
  const currentStartIndex = (currentPage - 1) * perPage;
  const visibleStart = totalProducts ? currentStartIndex + 1 : 0;
  const visibleEnd = Math.min(currentStartIndex + paginatedProducts.length, totalProducts);
  const baseQuery = {
    q: searchTerm,
    depositante: depositanteFiltroEfetivo,
    status: statusFiltro,
    metodo: metodoFiltro,
    categoria: categoriaFiltro,
    tamanho: tamanhoFiltro,
    perPage: String(perPage),
  };

  const productIds = paginatedProducts.map(p => p.id);
  // O Supabase tipa esse embed como array pela heurística padrão do typegen,
  // mas como endereco_id é FK única por linha de estoque, em runtime ele
  // sempre vem como objeto único (confirmado direto no banco).
  let stockData: { produto_id: string; quantidade: number; endereco_id: string | null; enderecos: { codigo: string } | null }[] = [];

  if (productIds.length > 0) {
    const { data: stockRecords } = await adminSupabase
      .from("estoque")
      .select("produto_id, quantidade, endereco_id, enderecos(codigo)")
      .in("produto_id", productIds)
      .gt("quantidade", 0);

    stockData = (stockRecords ?? []) as unknown as typeof stockData;
  }

  const stockByProduct = stockData.reduce((acc, curr) => {
    const qty = Number(curr.quantidade) || 0;
    acc[curr.produto_id] = (acc[curr.produto_id] || 0) + qty;
    return acc;
  }, {} as Record<string, number>);

  const addressesByProduct = stockData.reduce((acc, curr) => {
    if (!curr.endereco_id) return acc;
    const code = curr.enderecos?.codigo ?? "—";
    const list = acc[curr.produto_id] ?? (acc[curr.produto_id] = []);
    const existing = list.find((l) => l.code === code);
    const qty = Number(curr.quantidade) || 0;
    if (existing) existing.qty += qty;
    else list.push({ code, qty });
    return acc;
  }, {} as Record<string, { code: string; qty: number }[]>);

  const mappedProducts = paginatedProducts.map((p) => {
    const addresses = (addressesByProduct[p.id] ?? []).sort((a, b) => b.qty - a.qty);
    return {
      ...p,
      depositante_nome: ((p.depositante as { nome?: string } | null) ?? null)?.nome ?? null,
      estoque: stockByProduct[p.id] ?? 0,
      estoque_minimo: Number(p.qtd_minima) || 0,
      estoque_maximo: Number(p.qtd_maxima) || 0,
      endereco_primario: addresses[0]?.code ?? null,
      endereco_count: addresses.length,
    };
  });

  const categoryOptions = Array.from(
    new Set([
      "Seco / Ambiente",
      "Refrigerado",
      "Congelado",
      "Frágil",
      "Perigoso (DG)",
      "Alto Valor",
      "Volumoso",
      ...(categoryRows ?? []).map((row) => row.categoria).filter(Boolean),
    ]),
  ) as string[];

  const tamanhoByUpperCase = new Map<string, string>();
  for (const row of tamanhoRows ?? []) {
    const value = row.tamanho?.trim();
    if (value) tamanhoByUpperCase.set(value.toUpperCase(), value.toUpperCase());
  }
  const tamanhoOptions = Array.from(tamanhoByUpperCase.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <div className="space-y-6">
      <ProdutosDashboard
        produtos={mappedProducts}
        totalProducts={totalProducts}
        globalTotal={globalTotal ?? 0}
        globalAtivos={globalAtivos}
        globalInativos={globalInativos}
        globalBaixos={globalBaixos}
        globalRupturas={globalRupturas}
        categoryOptions={categoryOptions}
        tamanhoOptions={tamanhoOptions}
        depositantes={visibleDepositantes.map((depositante) => ({
          id: depositante.id,
          nome: depositante.nome,
        }))}
        formSlot={
          <>
            <Link href="/configuracoes/produtos/novo">
              <button className="produtos-novo-btn h-[42px] px-5 border-none rounded-full text-white text-[14px] font-extrabold cursor-pointer">
                + Novo produto
              </button>
            </Link>
            <style>{`
              .produtos-novo-btn {
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
                background-size: 220% 100%;
                background-position: 0% 50%;
                box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
                transition: background-position 0.6s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
              }
              .produtos-novo-btn:hover {
                background-position: 100% 50%;
                transform: translateY(-3px);
                box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
              }
            `}</style>
          </>
        }
        paginationSlot={
          <div className="flex flex-col gap-3 rounded-2xl bg-transparent px-4 py-2 text-sm text-slate-500 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
            <span>
              Mostrando {visibleStart}–{visibleEnd} de {totalProducts} produtos
            </span>
            <div className="flex items-center gap-2">
              <PageLink
                disabled={currentPage <= 1}
                href={`/configuracoes/produtos?${buildQueryString({
                  ...baseQuery,
                  page: String(currentPage - 1),
                })}`}
              >
                ‹
              </PageLink>

              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                
                if (
                  p === 1 || 
                  p === totalPages || 
                  (p >= currentPage - 1 && p <= currentPage + 1)
                ) {
                  return (
                    <PageLink
                      key={p}
                      active={p === currentPage}
                      href={`/configuracoes/produtos?${buildQueryString({
                        ...baseQuery,
                        page: String(p),
                      })}`}
                    >
                      {p}
                    </PageLink>
                  );
                }
                
                if (p === currentPage - 2 || p === currentPage + 2) {
                  return <span key={p} className="text-slate-400 px-1">...</span>;
                }
                
                return null;
              })}

              <PageLink
                disabled={currentPage >= totalPages}
                href={`/configuracoes/produtos?${buildQueryString({
                  ...baseQuery,
                  page: String(currentPage + 1),
                })}`}
              >
                ›
              </PageLink>
            </div>
          </div>
        }
      />
    </div>
  );
}

function escapeSupabaseLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", "\\,");
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePerPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return [10, 12, 50, 60].includes(parsed) ? parsed : 10;
}

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}

function PageLink({
  href,
  disabled,
  active,
  children,
}: {
  href: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600">
        {children}
      </span>
    );
  }

  if (active) {
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold text-sm">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}
