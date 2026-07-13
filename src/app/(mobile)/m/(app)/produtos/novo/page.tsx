import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProdutoForm } from "@/components/configuracoes/produto-form";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isProductCatalogOnlyUser } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

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
    <div className="space-y-4">
      <Link
        href="/m/produtos"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para produtos
      </Link>

      <section className="mobile-glass-card rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Cadastro móvel</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Novo produto</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {compactMode
            ? "Cadastre o produto com o essencial e deixe os campos técnicos sob controle do sistema."
            : "Cadastre o SKU com identificação, código de barras e regras operacionais."}
        </p>
      </section>

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
        returnPath="/m/produtos"
      />
    </div>
  );
}
