import Link from "next/link";
import { ArrowLeft, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ProductImportPanel } from "@/components/configuracoes/product-import-panel";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  }>;
};

export default async function ConfiguracoesProdutosPage({
  searchParams,
}: ConfiguracoesProdutosPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const searchTerm = params?.q?.trim() ?? "";
  const depositanteFiltro = params?.depositante?.trim() ?? "";
  const statusFiltro = params?.status?.trim() ?? "ativos";
  const metodoFiltro = params?.metodo?.trim() ?? "";
  const unidadeFiltro = params?.unidade?.trim() ?? "";
  const supabase = await createSupabaseServerClient();

  let productsQuery = supabase
    .from("produtos")
    .select(
      "id, codigo_interno, codigo_externo, sku, nome, categoria, metodo_retirada, unidade_estocagem, exige_lote, exige_validade, ativo, created_at, depositante_id, depositante:depositantes(nome)",
    )
    .order("nome");

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

  if (depositanteFiltro) {
    productsQuery = productsQuery.eq("depositante_id", depositanteFiltro);
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

  const [{ data: products }, { data: depositantes }] = await Promise.all([
    productsQuery,
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para configurações
      </Link>

      <ModulePageHeader
        title="Produtos"
        description="Cadastro mestre de SKU com EAN/GTIN, categoria, método FEFO/FIFO e unidade de estocagem."
        badge="Cadastro mestre"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "criado" || feedback === "salvo" || feedback === "excluido"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {feedback === "criado"
            ? "Produto criado com sucesso."
            : feedback === "salvo"
              ? "Produto atualizado com sucesso."
              : feedback === "excluido"
                ? "Produto excluído com sucesso."
                : feedback === "vinculos"
                  ? "Não foi possível excluir este produto porque ele já possui vínculos operacionais. Nesse caso, use desativar."
                  : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.3fr]">
        <ProductImportPanel depositantes={depositantes ?? []} />

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Padrão de importação</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              O sistema usa o <strong>código interno</strong> como chave principal do upsert por
              depositante.
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              Quando a planilha não traz SKU separado, o sistema usa o próprio código interno como
              SKU operacional.
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              EAN/GTIN é salvo no campo externo do produto, pronto para refinarmos depois com
              modelagem dedicada.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Produtos cadastrados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Base ativa para recebimento, estoque, expedição e rastreabilidade por depositante.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {products?.length ?? 0} registros
            </span>
            <Link href="/configuracoes/produtos/novo">
              <Button className="bg-slate-950 text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Busca
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={searchTerm}
                  placeholder="Nome, SKU, código interno ou EAN"
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Depositante
              </span>
              <select
                name="depositante"
                defaultValue={depositanteFiltro}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todos</option>
                {(depositantes ?? []).map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </span>
              <select
                name="status"
                defaultValue={statusFiltro}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
                <option value="todos">Todos</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Método
              </span>
              <select
                name="metodo"
                defaultValue={metodoFiltro}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todos</option>
                <option value="FEFO">FEFO</option>
                <option value="FIFO">FIFO</option>
                <option value="LIFO">LIFO</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Unidade
              </span>
              <select
                name="unidade"
                defaultValue={unidadeFiltro}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todas</option>
                <option value="UNIDADE">Unidade</option>
                <option value="CAIXA">Caixa</option>
                <option value="PALLET">Pallet</option>
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
                Filtrar
              </Button>
              <Link
                href="/configuracoes/produtos"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 space-y-4">
          {products?.length ? (
            products.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{item.nome}</p>
                      <p className="text-sm text-slate-500">
                        {item.sku} • {item.codigo_interno}
                      </p>
                    </div>

                    <div className="space-y-1 text-sm text-slate-600">
                      <p>
                        Depositante:{" "}
                        {((item.depositante as { nome?: string } | null) ?? null)?.nome ?? "-"}
                      </p>
                      <p>EAN/GTIN: {item.codigo_externo || "-"}</p>
                      <p>Categoria: {item.categoria || "-"}</p>
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
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Criado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link
                        href={`/configuracoes/produtos/${item.id}/editar`}
                        className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-slate-300 px-2.5 text-[0.8rem] font-medium text-slate-700 transition hover:bg-slate-50"
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
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
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
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
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
    case "PALLET":
      return "Pallet";
    default:
      return value;
  }
}

function escapeSupabaseLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", "\\,");
}
