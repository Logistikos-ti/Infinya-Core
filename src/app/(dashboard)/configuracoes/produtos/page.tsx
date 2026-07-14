import Link from "next/link";
import { ArrowLeft, PencilLine, Plus, Trash2 } from "lucide-react";
import { ProductFiltersForm } from "@/components/configuracoes/product-filters-form";
import { ProductImportPanel } from "@/components/configuracoes/product-import-panel";
import { Button } from "@/components/ui/button";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isAdminUser, isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { ProdutosDashboard } from "@/components/configuracoes/produtos-dashboard";
import {
  deleteProdutoAction,
  toggleProdutoStatusAction,
} from "@/app/(dashboard)/configuracoes/produtos/actions";

type ConfiguracoesProdutosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    q?: string;
    depositante?: string;
    status?: string;
    metodo?: string;
    unidade?: string;
    page?: string;
    perPage?: string;
  }>;
};

export default async function ConfiguracoesProdutosPage({
  searchParams,
}: ConfiguracoesProdutosPageProps) {
  const currentUser = await requireConfigSectionAccess("produtos");
  const compactMode = isProductCatalogOnlyUser(currentUser);
  const showAdvancedPanels = isAdminUser(currentUser);
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const searchTerm = params?.q?.trim() ?? "";
  const depositanteFiltro = params?.depositante?.trim() ?? "";
  const statusFiltro = params?.status?.trim() ?? "ativos";
  const metodoFiltro = params?.metodo?.trim() ?? "";
  const unidadeFiltro = params?.unidade?.trim() ?? "";
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

  let productsQuery = adminSupabase
    .from("produtos")
    .select(
      "id, codigo_interno, codigo_externo, sku, nome, categoria, metodo_retirada, unidade_estocagem, exige_lote, exige_validade, ativo, created_at, depositante_id, depositante:depositantes(nome), imagem_principal_url",
      { count: "exact" },
    )
    .order("nome")
    .range(startIndex, startIndex + perPage - 1);

  if (searchTerm) {
    const escapedSearch = escapeSupabaseLike(searchTerm);
    productsQuery = productsQuery.or(
      [
        `nome.ilike.%${escapedSearch}%`,
        `sku.ilike.%${escapedSearch}%`,
        `codigo_interno.ilike.%${escapedSearch}%`,
        `codigo_externo.ilike.%${escapedSearch}%`,
      ].join(","),
    );
  }

  if (depositanteFiltroEfetivo) {
    productsQuery = productsQuery.eq("depositante_id", depositanteFiltroEfetivo);
  }

  if (statusFiltro === "ativos") {
    productsQuery = productsQuery.eq("ativo", true);
  } else if (statusFiltro === "inativos") {
    productsQuery = productsQuery.eq("ativo", false);
  }

  if (metodoFiltro) {
    productsQuery = productsQuery.eq("metodo_retirada", metodoFiltro);
  }

  if (unidadeFiltro) {
    productsQuery = productsQuery.eq("unidade_estocagem", unidadeFiltro);
  }

  const [{ data: products, count }] = await Promise.all([productsQuery]);

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
    unidade: unidadeFiltro,
    perPage: String(perPage),
  };

  const mappedProducts = paginatedProducts.map((p) => ({
    ...p,
    depositante_nome: ((p.depositante as { nome?: string } | null) ?? null)?.nome ?? null,
  }));

  return (
    <div className="space-y-6">
      <Link
        href={compactMode ? "/m/inicio" : "/configuracoes"}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {compactMode ? "Voltar ao inicio" : "Voltar para configurações"}
      </Link>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "criado" || feedback === "salvo" || feedback === "excluido"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          {feedback === "criado"
            ? "Produto criado com sucesso."
            : feedback === "salvo"
              ? "Produto atualizado com sucesso."
              : feedback === "excluido"
                ? "Produto excluído com sucesso."
                : feedback === "vinculos"
                  ? "Não foi possível excluir este produto porque ele já possui estoque, movimentações ou vínculos operacionais."
                  : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      {!showAdvancedPanels && (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
          Este acesso foi simplificado para cadastro de produtos. Campos técnicos e operações mais
          sensíveis ficam automatizados para evitar erros.
        </section>
      )}

      <ProdutosDashboard
        produtos={mappedProducts as unknown as React.ComponentProps<typeof ProdutosDashboard>["produtos"]}
        totalProducts={totalProducts}
        formSlot={
          <Link href="/configuracoes/produtos/novo">
            <button className="h-11 px-5 border-none rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold cursor-pointer shadow-[0_8px_22px_rgba(99,102,241,0.32)] flex items-center gap-2 transition-transform hover:-translate-y-[1px]">
              <Plus className="h-4 w-4" /> Novo produto
            </button>
          </Link>
        }
        filtersSlot={
          <div className="bg-white dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <ProductFiltersForm
              searchTerm={searchTerm}
              depositante={depositanteFiltroEfetivo}
              status={statusFiltro}
              metodo={metodoFiltro}
              unidade={unidadeFiltro}
              perPage={String(perPage)}
              depositantes={visibleDepositantes.map((depositante) => ({
                value: depositante.id,
                label: depositante.nome,
              }))}
            />
          </div>
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
              <span className="flex items-center justify-center h-8 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold">
                {currentPage}
              </span>
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
        importSlot={
          showAdvancedPanels ? (
            <>
              <ProductImportPanel depositantes={visibleDepositantes} />
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Padrão de importação
                </h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    O sistema usa o <strong>código interno</strong> como chave principal do upsert
                    por depositante.
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    Quando a planilha não traz SKU separado, o sistema usa o próprio código interno
                    como SKU operacional.
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    EAN/GTIN é salvo no campo externo do produto. Pack e quantidade por embalagem
                    podem ser refinados manualmente após a importação.
                  </div>
                </div>
              </div>
            </>
          ) : null
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
  return [10, 20, 50].includes(parsed) ? parsed : 10;
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
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600">
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
