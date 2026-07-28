import Link from "next/link";
import { ProdutoForm } from "@/components/configuracoes/produto-form";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";

export default async function MobileNovoProdutoPage() {
  const user = await requireConfigSectionAccess("produtos");
  const compactMode = isProductCatalogOnlyUser(user);
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

  const visibleDepositantes = filterDepositanteOptionsByUser(user, depositantes ?? []);

  return (
    <div className="space-y-4 p-[18px]">
      <Link
        href="/m/produtos"
        className="inline-flex items-center gap-2 text-sm font-medium transition"
        style={{ color: mobileColors.muted }}
      >
        &#8249; Voltar para produtos
      </Link>

      <section className="rounded-[24px] p-5" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.blueLight }}>Cadastro móvel</p>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: mobileColors.text, ...headingFont }}>Novo produto</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: mobileColors.muted }}>
          {compactMode
            ? "Cadastre o produto com o essencial e deixe os campos técnicos sob controle do sistema."
            : "Cadastre o SKU com identificação, código de barras e regras operacionais."}
        </p>
      </section>

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
        returnPath="/m/produtos"
      />
    </div>
  );
}
