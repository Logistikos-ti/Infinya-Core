import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ProdutoForm } from "@/components/configuracoes/produto-form";
import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

export default async function NovoProdutoPage() {
  const currentUser = await requireConfigSectionAccess("produtos");
  const supabase = createSupabaseAdminClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
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
        description="Cadastre um novo SKU com identificação, categoria, EAN/GTIN, método de retirada e unidade."
        badge="Cadastro"
      />

      <ProdutoForm depositantes={visibleDepositantes} />
    </div>
  );
}
