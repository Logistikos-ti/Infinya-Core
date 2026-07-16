import type { ReactNode } from "react";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ArrowRight, Package2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type MobileProdutosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    q?: string;
    depositante?: string;
    status?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function MobileProdutosPage({ searchParams }: MobileProdutosPageProps) {
  noStore();
  const user = await requireConfigSectionAccess("produtos");
  const compactMode = isProductCatalogOnlyUser(user);
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";
  const searchTerm = params?.q?.trim() ?? "";
  const depositanteFiltro = params?.depositante?.trim() ?? "";
  const statusFiltro = params?.status?.trim() ?? "ativos";
  const supabase = createSupabaseAdminClient();

  const { data: rawDepositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const visibleDepositantes = filterDepositanteOptionsByUser(user, rawDepositantes ?? []);
  const depositanteEfetivo =
    depositanteFiltro || (visibleDepositantes.length === 1 ? visibleDepositantes[0]?.id ?? "" : "");

  let produtosQuery = supabase
    .from("produtos")
    .select(
      "id, nome, sku, codigo_interno, codigo_externo, categoria, metodo_retirada, unidade_estocagem, ativo, created_at, depositante:depositantes(nome)",
      { count: "exact" },
    )
    .order("nome")
    .limit(50);

  if (searchTerm) {
    const escapedSearch = escapeSupabaseLike(searchTerm);
    produtosQuery = produtosQuery.or(
      [
        `nome.ilike.%${escapedSearch}%`,
        `sku.ilike.%${escapedSearch}%`,
        `codigo_interno.ilike.%${escapedSearch}%`,
        `codigo_externo.ilike.%${escapedSearch}%`,
      ].join(","),
    );
  }

  if (depositanteEfetivo) {
    produtosQuery = produtosQuery.eq("depositante_id", depositanteEfetivo);
  }

  if (statusFiltro === "ativos") {
    produtosQuery = produtosQuery.eq("ativo", true);
  } else if (statusFiltro === "inativos") {
    produtosQuery = produtosQuery.eq("ativo", false);
  }

  const { data: produtos, count } = await produtosQuery;
  const totalProdutos = count ?? produtos?.length ?? 0;

  return (
    <div className="space-y-4">
      <section className="mobile-glass-card rounded-[28px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Catálogo móvel
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Produtos</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Lista operacional para cadastrar, localizar e revisar SKUs pelo celular.
            </p>
          </div>

          <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
            <Package2 className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="mobile-soft-chip rounded-2xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Produtos
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{totalProdutos}</p>
          </div>
          <div className="mobile-soft-chip rounded-2xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Depositantes
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{visibleDepositantes.length}</p>
          </div>
        </div>

        <div className="mt-4">
          <Link href="/m/produtos/novo" prefetch={false}>
            <Button className="h-12 w-full rounded-2xl bg-infinya-gradient text-slate-950 hover:opacity-95">
              <Plus className="h-4 w-4" />
              Novo produto
            </Button>
          </Link>
        </div>
      </section>


      {!compactMode ? (
        <form method="get" action="/m/produtos" className="mobile-glass-card rounded-[28px] p-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Buscar produto
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#071224] px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                name="q"
                defaultValue={searchTerm}
                placeholder="Nome, SKU, código interno ou EAN"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </label>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              { label: "Ativos", value: "ativos" },
              { label: "Inativos", value: "inativos" },
              { label: "Todos", value: "todos" },
            ].map((item) => (
              <Link
                key={item.value}
                href={buildMobileProductsHref({
                  q: searchTerm,
                  depositante: depositanteEfetivo,
                  status: item.value,
                })}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                  statusFiltro === item.value
                    ? "bg-infinya-gradient text-slate-950"
                    : "mobile-soft-chip text-slate-300"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {visibleDepositantes.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <Link
                href={buildMobileProductsHref({ q: searchTerm, status: statusFiltro })}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                  !depositanteEfetivo
                    ? "bg-cyan-500/20 text-cyan-200"
                    : "mobile-soft-chip text-slate-300"
                }`}
              >
                Todos os depositantes
              </Link>
              {visibleDepositantes.map((depositante) => (
                <Link
                  key={depositante.id}
                  href={buildMobileProductsHref({
                    q: searchTerm,
                    status: statusFiltro,
                    depositante: depositante.id,
                  })}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                    depositanteEfetivo === depositante.id
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "mobile-soft-chip text-slate-300"
                  }`}
                >
                  {depositante.nome}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <Button type="submit" className="h-11 w-full rounded-2xl bg-white text-slate-950 hover:bg-slate-100">
              Aplicar busca
            </Button>
          </div>
        </form>
      ) : null}

      <section className="space-y-3">
        {produtos?.length ? (
          produtos.map((produto) => (
            <Link
              key={produto.id}
              href={`/m/produtos/${produto.id}/editar`}
              prefetch={false}
              className="mobile-action-card block rounded-[28px] p-4 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{produto.nome}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {(produto.sku || "-") + " • " + (produto.codigo_interno || "-")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    produto.ativo
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-slate-700/70 text-slate-200"
                  }`}
                >
                  {produto.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                <p>Depositante: {extractDepositanteName(produto.depositante) ?? "-"}</p>
                <p>EAN/GTIN: {produto.codigo_externo || "-"}</p>
                <p>Categoria: {produto.categoria || "-"}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{produto.metodo_retirada}</Badge>
                <Badge>{getUnidadeLabel(produto.unidade_estocagem)}</Badge>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>Criado em {new Date(produto.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-cyan-200">
                  Abrir
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="mobile-glass-card rounded-[28px] border-dashed px-4 py-8 text-center text-sm text-slate-400">
            Nenhum produto encontrado com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="mobile-soft-chip rounded-full px-3 py-1 text-xs font-medium text-slate-200">
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

function extractDepositanteName(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.nome === "string" ? first.nome : null;
  }

  if (value && typeof value === "object" && "nome" in value) {
    const nome = (value as { nome?: unknown }).nome;
    return typeof nome === "string" ? nome : null;
  }

  return null;
}

function escapeSupabaseLike(value: string) {
  return value.replace(/[%_,]/g, (character) => `\\${character}`);
}

function buildMobileProductsHref(params: {
  q?: string;
  status?: string;
  depositante?: string;
}) {
  const search = new URLSearchParams();

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.status) {
    search.set("status", params.status);
  }

  if (params.depositante) {
    search.set("depositante", params.depositante);
  }

  const query = search.toString();
  return query ? `/m/produtos?${query}` : "/m/produtos";
}
