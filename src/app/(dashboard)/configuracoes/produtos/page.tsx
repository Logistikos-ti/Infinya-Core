import Link from "next/link";
import { ArrowLeft, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ProductImportPanel } from "@/components/configuracoes/product-import-panel";
import { Button } from "@/components/ui/button";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isAdminUser, isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
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
      "id, codigo_interno, codigo_externo, sku, nome, categoria, metodo_retirada, unidade_estocagem, exige_lote, exige_validade, ativo, created_at, depositante_id, depositante:depositantes(nome)",
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

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para configuracoes
      </Link>

      <ModulePageHeader
        title="Produtos"
        description={
          compactMode
            ? "Ambiente de cadastro operacional para criar, revisar e manter o catalogo de produtos."
            : "Cadastro mestre de SKU com EAN/GTIN, metodo FEFO/FIFO, unidade de estocagem e regra de embalagem."
        }
        badge={compactMode ? "Catalogo operacional" : "Cadastro mestre"}
      />

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
                ? "Produto excluido com sucesso."
                : feedback === "vinculos"
                  ? "Nao foi possivel excluir este produto porque ele ja possui estoque, movimentacoes ou vinculos operacionais."
                  : "Nao foi possivel concluir a operacao solicitada."}
        </div>
      ) : null}

      {showAdvancedPanels ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_1.3fr]">
          <ProductImportPanel depositantes={visibleDepositantes} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Padrao de importacao
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                O sistema usa o <strong>codigo interno</strong> como chave principal do upsert por
                depositante.
              </div>
              <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                Quando a planilha nao traz SKU separado, o sistema usa o proprio codigo interno como
                SKU operacional.
              </div>
              <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                EAN/GTIN e salvo no campo externo do produto. Pack e quantidade por embalagem podem
                ser refinados manualmente apos a importacao.
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
          Este acesso foi simplificado para cadastro de produtos. Campos tecnicos e operacoes mais
          sensiveis ficam automatizados para evitar erros.
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Produtos cadastrados
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Base ativa para recebimento, estoque, expedicao e rastreabilidade por depositante.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {totalProducts} registros
            </span>
            <Link href="/configuracoes/produtos/novo">
              <Button className="bg-slate-950 text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Busca
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  name="q"
                  defaultValue={searchTerm}
                  placeholder="Nome, SKU, codigo interno ou EAN"
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Depositante
              </span>
              <select
                name="depositante"
                defaultValue={depositanteFiltroEfetivo}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Todos</option>
                {visibleDepositantes.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Status
              </span>
              <select
                name="status"
                defaultValue={statusFiltro}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
                <option value="todos">Todos</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Metodo
              </span>
              <select
                name="metodo"
                defaultValue={metodoFiltro}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Todos</option>
                <option value="FEFO">FEFO</option>
                <option value="FIFO">FIFO</option>
                <option value="LIFO">LIFO</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Unidade
              </span>
              <select
                name="unidade"
                defaultValue={unidadeFiltro}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Todas</option>
                <option value="UNIDADE">Unidade</option>
                <option value="CAIXA">Caixa</option>
                <option value="PACK">Pack</option>
                <option value="PALLET">Pallet</option>
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
                Filtrar
              </Button>
              <select
                name="perPage"
                defaultValue={String(perPage)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="10">10 / pagina</option>
                <option value="20">20 / pagina</option>
                <option value="50">50 / pagina</option>
              </select>
              <Link
                href="/configuracoes/produtos"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 space-y-4">
          {paginatedProducts.length ? (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
                <span>
                  Exibindo {visibleStart}-{visibleEnd} de {totalProducts} produto(s)
                </span>
                <div className="flex items-center gap-2">
                  <PageLink
                    disabled={currentPage <= 1}
                    href={`/configuracoes/produtos?${buildQueryString({
                      ...baseQuery,
                      page: String(currentPage - 1),
                    })}`}
                  >
                    Anterior
                  </PageLink>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <PageLink
                    disabled={currentPage >= totalPages}
                    href={`/configuracoes/produtos?${buildQueryString({
                      ...baseQuery,
                      page: String(currentPage + 1),
                    })}`}
                  >
                    Proxima
                  </PageLink>
                </div>
              </div>

              {paginatedProducts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950 dark:text-white">
                          {item.nome}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {(item.sku || "-") + " • " + (item.codigo_interno || "-")}
                        </p>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                        <p>
                          Depositante:{" "}
                          {((item.depositante as { nome?: string } | null) ?? null)?.nome ?? "-"}
                        </p>
                        <p>EAN/GTIN: {item.codigo_externo || "-"}</p>
                        {!compactMode ? <p>Categoria: {item.categoria || "-"}</p> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge>{item.metodo_retirada}</Badge>
                        <Badge>{getUnidadeLabel(item.unidade_estocagem)}</Badge>
                        <Badge>{item.exige_lote ? "Com lote" : "Sem lote"}</Badge>
                        <Badge>{item.exige_validade ? "Com validade" : "Sem validade"}</Badge>
                      </div>
                    </div>

                    <div className="space-y-3 lg:text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.ativo
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Criado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/configuracoes/produtos/${item.id}/editar`}
                          className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-slate-300 px-2.5 text-[0.8rem] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          <PencilLine className="h-4 w-4" />
                          Editar
                        </Link>
                        <form action={toggleProdutoStatusAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="nextActive"
                            value={item.ativo ? "false" : "true"}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {item.ativo ? "Desativar" : "Ativar"}
                          </Button>
                        </form>
                        <form action={deleteProdutoAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Nenhum produto encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}

function getUnidadeLabel(value: string) {
  switch (value) {
    case "UNIDADE":
      return "Unidade";
    case "CAIXA":
      return "Caixa";
    case "PACK":
      return "Pack";
    case "PALLET":
      return "Pallet";
    default:
      return value;
  }
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
      <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-400 dark:border-slate-800 dark:text-slate-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
    >
      {children}
    </Link>
  );
}
