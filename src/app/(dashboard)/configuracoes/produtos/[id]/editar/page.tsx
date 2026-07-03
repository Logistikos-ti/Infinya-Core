import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ProdutoForm } from "@/components/configuracoes/produto-form";
import { Button } from "@/components/ui/button";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { deleteProdutoAction } from "@/app/(dashboard)/configuracoes/produtos/actions";

type EditarProdutoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarProdutoPage({ params }: EditarProdutoPageProps) {
  const currentUser = await requireConfigSectionAccess("produtos");
  const compactMode = isProductCatalogOnlyUser(currentUser);
  const { id } = await params;
  const adminSupabase = createSupabaseAdminClient();

  const [{ data: product }, { data: depositantes }] = await Promise.all([
    adminSupabase
      .from("produtos")
      .select(
        "id, depositante_id, codigo_interno, codigo_externo, sku, nome, categoria, metodo_retirada, unidade_estocagem, quantidade_por_embalagem, exige_lote, exige_validade, ativo",
      )
      .eq("id", id)
      .maybeSingle(),
    adminSupabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  if (!product) {
    notFound();
  }

  const visibleDepositantes = filterDepositanteOptionsByUser(currentUser, depositantes ?? []);

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes/produtos"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para produtos
      </Link>

      <ModulePageHeader
        title={`Editar ${product.nome}`}
        description={
          compactMode
            ? "Atualize nome, código de barras, depositante e regras operacionais do produto."
            : "Atualize identificação, categoria, método de retirada, embalagem e status operacional do SKU."
        }
        badge="Cadastro"
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ProdutoForm
          depositantes={visibleDepositantes}
          compactMode={compactMode}
          defaultValues={{
            id: product.id,
            depositanteId: product.depositante_id,
            codigoInterno: product.codigo_interno,
            sku: product.sku ?? "",
            nome: product.nome,
            eanGtin: product.codigo_externo ?? "",
            categoria: product.categoria ?? "",
            metodoRetirada: product.metodo_retirada,
            unidadeEstocagem: product.unidade_estocagem,
            quantidadePorEmbalagem: product.quantidade_por_embalagem ?? null,
            exigeLote: product.exige_lote,
            exigeValidade: product.exige_validade,
            ativo: product.ativo,
          }}
        />

        <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-500/30 dark:bg-slate-950/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Zona de exclusão</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            A exclusão fica liberada somente para produtos sem estoque, sem movimentações e sem uso
            em recebimento ou expedição.
          </p>
          <form action={deleteProdutoAction} className="mt-4">
            <input type="hidden" name="id" value={product.id} />
            <Button
              type="submit"
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Excluir produto
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
