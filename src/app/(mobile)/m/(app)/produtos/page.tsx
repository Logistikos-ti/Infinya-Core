import type { ReactNode } from "react";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { formatDatePtBr } from "@/lib/utils";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobileIcon,
} from "@/components/mobile/mobile-kit-tokens";

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
  const searchTerm = params?.q?.trim() ?? "";
  const depositanteFiltro = params?.depositante?.trim() ?? "";
  const statusFiltro = params?.status?.trim() ?? "ativos";
  const supabase = createSupabaseAdminClient();

  const searchParamsEntries = new URLSearchParams();
  if (searchTerm) searchParamsEntries.set("q", searchTerm);
  if (depositanteFiltro) searchParamsEntries.set("depositante", depositanteFiltro);
  if (statusFiltro && statusFiltro !== "ativos") searchParamsEntries.set("status", statusFiltro);

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

  const cardStyle = { border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) };
  const chipStyle = { border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05) };

  return (
    <div className="space-y-4 p-[18px]">
      <section className="rounded-[24px] p-5" style={cardStyle}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.blueLight }}>
              Catálogo móvel
            </p>
            <h1 className="mt-2 text-2xl font-semibold" style={{ color: mobileColors.text, ...headingFont }}>Produtos</h1>
            <p className="mt-2 text-sm leading-6" style={{ color: mobileColors.muted }}>
              Lista operacional para cadastrar, localizar e revisar SKUs pelo celular.
            </p>
          </div>

          <div className="rounded-2xl p-3" style={{ background: hexAlpha(mobileColors.blue, 0.15), color: mobileColors.blueLight }}>
            <MobileIcon name="box" size={20} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3" style={chipStyle}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: mobileColors.muted }}>
              Produtos
            </p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: mobileColors.text, ...headingFont }}>{totalProdutos}</p>
          </div>
          <div className="rounded-2xl p-3" style={chipStyle}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: mobileColors.muted }}>
              Depositantes
            </p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: mobileColors.text, ...headingFont }}>{visibleDepositantes.length}</p>
          </div>
        </div>

        <div className="mt-4">
          <Link
            href="/m/produtos/novo"
            prefetch={false}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white"
            style={{ background: mobileGradient }}
          >
            + Novo produto
          </Link>
        </div>
      </section>

      {!compactMode ? (
        <form method="get" action="/m/produtos" className="rounded-[24px] p-4" style={cardStyle}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: mobileColors.muted }}>
              Buscar produto
            </span>
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#0B1424" }}>
              <Search className="h-4 w-4" style={{ color: mobileColors.muted }} />
              <input
                type="text"
                name="q"
                defaultValue={searchTerm}
                placeholder="Nome, SKU, código interno ou EAN"
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: mobileColors.text }}
              />
            </div>
          </label>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              { label: "Ativos", value: "ativos" },
              { label: "Inativos", value: "inativos" },
              { label: "Todos", value: "todos" },
            ].map((item) => {
              const active = statusFiltro === item.value;
              return (
                <Link
                  key={item.value}
                  href={buildMobileProductsHref({
                    q: searchTerm,
                    depositante: depositanteEfetivo,
                    status: item.value,
                  })}
                  className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition"
                  style={active ? { background: mobileGradient, color: "#fff" } : { ...chipStyle, color: mobileColors.muted }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {visibleDepositantes.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <Link
                href={buildMobileProductsHref({ q: searchTerm, status: statusFiltro })}
                className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition"
                style={!depositanteEfetivo ? { background: hexAlpha(mobileColors.blue, 0.2), color: mobileColors.blueLight } : { ...chipStyle, color: mobileColors.muted }}
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
                  className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition"
                  style={depositanteEfetivo === depositante.id ? { background: hexAlpha(mobileColors.blue, 0.2), color: mobileColors.blueLight } : { ...chipStyle, color: mobileColors.muted }}
                >
                  {depositante.nome}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <button
              type="submit"
              className="h-11 w-full rounded-2xl text-sm font-bold"
              style={{ background: mobileColors.text, color: "#0A1120" }}
            >
              Aplicar busca
            </button>
          </div>
        </form>
      ) : null}

      <section className="space-y-3">
        {produtos?.length ? (
          produtos.map((produto) => (
            <Link
              key={produto.id}
              href={`/m/produtos/${produto.id}/editar?returnPath=${encodeURIComponent("/m/produtos" + (searchParamsEntries.toString() ? "?" + searchParamsEntries.toString() : ""))}`}
              prefetch={false}
              className="block rounded-[24px] p-4 transition hover:-translate-y-0.5"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold" style={{ color: mobileColors.text }}>{produto.nome}</p>
                  <p className="mt-1 text-sm" style={{ color: mobileColors.muted }}>
                    {(produto.sku || "-") + " • " + (produto.codigo_interno || "-")}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: hexAlpha(produto.ativo ? mobileColors.green : "#94A3B8", produto.ativo ? 0.16 : 0.14),
                    color: produto.ativo ? mobileColors.green : mobileColors.muted,
                  }}
                >
                  {produto.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm" style={{ color: mobileColors.muted }}>
                <p>Depositante: {extractDepositanteName(produto.depositante) ?? "-"}</p>
                <p>EAN/GTIN: {produto.codigo_externo || "-"}</p>
                <p>Categoria: {produto.categoria || "-"}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{produto.metodo_retirada}</Badge>
                <Badge>{getUnidadeLabel(produto.unidade_estocagem)}</Badge>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs" style={{ color: mobileColors.dim }}>
                <span>Criado em {formatDatePtBr(produto.created_at)}</span>
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: mobileColors.blueLight }}>
                  Abrir &#8250;
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div
            className="rounded-[24px] px-4 py-8 text-center text-sm"
            style={{ border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
          >
            Nenhum produto encontrado com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-medium"
      style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05), color: mobileColors.muted }}
    >
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
