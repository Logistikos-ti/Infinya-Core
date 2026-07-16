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
      {/* Header and Back button are now inside ProdutoForm */}

      <ProdutoForm
        depositantes={visibleDepositantes}
        productKitEnabled={false}
        commercialKitEnabled
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
