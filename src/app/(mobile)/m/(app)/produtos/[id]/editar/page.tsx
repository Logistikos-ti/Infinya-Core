import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ProdutoForm } from "@/components/configuracoes/produto-form";
import { Button } from "@/components/ui/button";
import { deleteProdutoAction } from "@/app/(dashboard)/configuracoes/produtos/actions";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type MobileEditarProdutoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MobileEditarProdutoPage({ params }: MobileEditarProdutoPageProps) {
  const user = await requireConfigSectionAccess("produtos");
  const compactMode = isProductCatalogOnlyUser(user);
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const [{ data: product }, { data: depositantes }, { data: componentOptions }, { data: kitComponents }] = await Promise.all([
    supabase
      .from("produtos")
      .select(
        "id, depositante_id, codigo_interno, codigo_externo, sku, nome, categoria, tipo_produto, metodo_retirada, unidade_estocagem, quantidade_por_embalagem, exige_lote, exige_validade, ativo",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("produtos")
      .select("id, depositante_id, nome, sku, codigo_interno, codigo_externo")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("produto_kit_componentes")
      .select("produto_componente_id, quantidade")
      .eq("produto_kit_id", id),
  ]);

  if (!product) {
    notFound();
  }

  const visibleDepositantes = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const formKey = [
    product.id,
    product.depositante_id,
    product.codigo_interno ?? "",
    product.codigo_externo ?? "",
    product.sku ?? "",
    product.nome ?? "",
    product.categoria ?? "",
    product.metodo_retirada ?? "",
    product.unidade_estocagem ?? "",
    String(product.quantidade_por_embalagem ?? ""),
    String(product.exige_lote),
    String(product.exige_validade),
    String(product.ativo),
  ].join("|");

  return (
    <div className="space-y-4">
      <Link
        href="/m/produtos"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para produtos
      </Link>

      <section className="mobile-glass-card rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Edição móvel</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{product.nome}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Revise código de barras, regras de retirada, unidade de estocagem e situação operacional.
        </p>
      </section>

      <ProdutoForm
        key={formKey}
        depositantes={visibleDepositantes}
        compactMode={compactMode}
        returnPath="/m/produtos"
        defaultValues={{
          id: product.id,
          depositanteId: product.depositante_id,
          codigoInterno: product.codigo_interno,
          sku: product.sku ?? "",
          nome: product.nome,
          eanGtin: product.codigo_externo ?? "",
          categoria: product.categoria ?? "",
          tipoProduto: product.tipo_produto,
          metodoRetirada: product.metodo_retirada,
          unidadeEstocagem: product.unidade_estocagem,
          quantidadePorEmbalagem: product.quantidade_por_embalagem ?? null,
          exigeLote: product.exige_lote,
          exigeValidade: product.exige_validade,
          ativo: product.ativo,
          kitComponents: (kitComponents ?? []).map((item) => ({
            componentProductId: item.produto_componente_id,
            quantity: Number(item.quantidade ?? 0),
          })),
        }}
        productOptions={(componentOptions ?? []).map((item) => ({
          id: item.id,
          depositanteId: item.depositante_id,
          nome: item.nome,
          sku: item.sku,
          codigoInterno: item.codigo_interno,
          codigoExterno: item.codigo_externo,
        }))}
      />

      <section className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-5">
        <h2 className="text-lg font-semibold text-white">Excluir produto</h2>
        <p className="mt-2 text-sm leading-6 text-rose-100/85">
          A exclusão só será concluída quando o produto não possuir estoque, movimentações ou vínculos
          operacionais.
        </p>

        <form action={deleteProdutoAction} className="mt-4">
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="redirectTo" value="/m/produtos" />
          <Button
            type="submit"
            variant="outline"
            className="h-11 rounded-2xl border-rose-300/40 bg-transparent text-rose-100 hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Excluir produto
          </Button>
        </form>
      </section>
    </div>
  );
}
