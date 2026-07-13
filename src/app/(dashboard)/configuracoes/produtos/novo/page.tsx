import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ProdutoForm } from "@/components/configuracoes/produto-form";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

export default async function NovoProdutoPage() {
  const currentUser = await requireConfigSectionAccess("produtos");
  const compactMode = isProductCatalogOnlyUser(currentUser);
  const supabase = createSupabaseAdminClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  const { data: productOptions } = await supabase
    .from("produtos")
    .select("id, depositante_id, nome, sku, codigo_interno, codigo_externo")
    .eq("ativo", true)
    .order("nome");
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
        title="Novo produto"
        description={
          compactMode
            ? "Cadastre um novo produto com depositante, nome, código de barras e regras operacionais."
            : "Cadastre um novo SKU com identificação, categoria, EAN/GTIN, método de retirada e unidade."
        }
        badge="Cadastro"
      />

      <ProdutoForm
        depositantes={visibleDepositantes}
        productOptions={(productOptions ?? []).map((item) => ({
          id: item.id,
          depositanteId: item.depositante_id,
          nome: item.nome,
          sku: item.sku,
          codigoInterno: item.codigo_interno,
          codigoExterno: item.codigo_externo,
        }))}
        compactMode={compactMode}
      />
    </div>
  );
}
