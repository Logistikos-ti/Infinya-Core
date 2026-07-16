import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ProdutoForm } from "@/components/configuracoes/produto-form";
import { Button } from "@/components/ui/button";
import { requireConfigSectionAccess } from "@/lib/auth";
import type { ProductCommercialKitRuleOption } from "@/lib/commercial-kit-rules";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { deleteProdutoAction } from "@/app/(dashboard)/configuracoes/produtos/actions";

type EditarProdutoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({ params }: EditarProdutoPageProps) {
  noStore();
  const currentUser = await requireConfigSectionAccess("produtos");
  const compactMode = isProductCatalogOnlyUser(currentUser);
  const { id } = await params;
  const adminSupabase = createSupabaseAdminClient();

  const [
    { data: product },
    { data: productImageMeta },
    { data: depositantes },
    { data: componentOptions },
    { data: commercialRules },
  ] = await Promise.all([
    adminSupabase
      .from("produtos")
      .select(
        "id, depositante_id, codigo_interno, codigo_externo, sku, nome, fornecedor, descricao, peso_kg, altura_cm, largura_cm, comprimento_cm, qtd_minima, qtd_maxima, ponto_reposicao, custo_reposicao, categoria, metodo_retirada, unidade_estocagem, quantidade_por_embalagem, exige_lote, exige_validade, ativo",
      )
      .eq("id", id)
      .maybeSingle(),
    adminSupabase
      .from("produtos")
      .select("imagem_principal_url, imagem_principal_storage_path")
      .eq("id", id)
      .maybeSingle(),
    adminSupabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
    adminSupabase
      .from("produtos")
      .select("id, depositante_id, nome, sku, codigo_interno, codigo_externo")
      .eq("ativo", true)
      .order("nome"),
    adminSupabase
      .from("produto_kit_comercial_regras")
      .select("id, texto_gatilho, quantidade_operacional")
      .eq("produto_base_id", id)
      .eq("ativo", true)
      .order("created_at"),
  ]);

  if (!product) {
    notFound();
  }

  const visibleDepositantes = filterDepositanteOptionsByUser(currentUser, depositantes ?? []);
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
    <div className="space-y-6">
      <section className="flex flex-col gap-6 w-full">
        <ProdutoForm
          key={formKey}
          depositantes={visibleDepositantes}
          productKitEnabled={false}
          compactMode={compactMode}
          defaultValues={{
            id: product.id,
            depositanteId: product.depositante_id,
            codigoInterno: product.codigo_interno,
            sku: product.sku ?? "",
            nome: product.nome,
            eanGtin: product.codigo_externo ?? "",
            categoria: product.categoria ?? "",
            fornecedor: product.fornecedor ?? "",
            descricao: product.descricao ?? "",
            pesoKg: product.peso_kg ?? null,
            alturaCm: product.altura_cm ?? null,
            larguraCm: product.largura_cm ?? null,
            comprimentoCm: product.comprimento_cm ?? null,
            qtdMinima: product.qtd_minima ?? null,
            qtdMaxima: product.qtd_maxima ?? null,
            pontoReposicao: product.ponto_reposicao ?? null,
            custoReposicao: product.custo_reposicao ?? null,
            tipoProduto: "SIMPLES",
            metodoRetirada: product.metodo_retirada,
            unidadeEstocagem: product.unidade_estocagem,
            quantidadePorEmbalagem: product.quantidade_por_embalagem ?? null,
            imagemPrincipalUrl: productImageMeta?.imagem_principal_url ?? null,
            imagemPrincipalStoragePath: productImageMeta?.imagem_principal_storage_path ?? null,
            exigeLote: product.exige_lote,
            exigeValidade: product.exige_validade,
            ativo: product.ativo,
            commercialKitRules: ((commercialRules ?? []) as Array<{
              id: string;
              texto_gatilho: string;
              quantidade_operacional: number | string;
            }>).map(
              (rule) =>
                ({
                  id: rule.id,
                  matchText: rule.texto_gatilho,
                  operationalQuantity: Number(rule.quantidade_operacional ?? 0),
                }) satisfies ProductCommercialKitRuleOption,
            ),
          }}
          productOptions={(componentOptions ?? []).map((item) => ({
            id: item.id,
            depositanteId: item.depositante_id,
            nome: item.nome,
            sku: item.sku,
            codigoInterno: item.codigo_interno,
            codigoExterno: item.codigo_externo,
          }))}
          commercialKitEnabled
        />
      </section>
    </div>
  );
}
