import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ReceivingOrderForm } from "@/components/receiving/receiving-order-form";
import { ReceivingXmlImportPanel } from "@/components/receiving/receiving-xml-import-panel";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

export default async function NovoRecebimentoPage() {
  const user = await requireModuleAccess("recebimento");
  const supabase = await createSupabaseServerClient();
  const [{ data: depositantes }, { data: produtos }] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    supabase
      .from("produtos")
      .select("id, nome, sku, codigo_interno, unidade_estocagem, depositante_id")
      .eq("ativo", true)
      .order("nome"),
  ]);
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const productOptions = (produtos ?? []).filter((produto) =>
    depositanteOptions.some((depositante) => depositante.id === produto.depositante_id),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/recebimento"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para recebimento
        </Link>
      </div>

      <ModulePageHeader
        title="Novo recebimento"
        description="Abertura manual ou por importação de XML da NF-e para o fluxo inbound do WMS."
        badge="Fluxo operacional"
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <ReceivingXmlImportPanel
          defaultDepositanteId={depositanteOptions[0]?.id ?? null}
          depositantes={depositanteOptions}
          lockDepositante={user.papel === "DEPOSITANTE"}
        />

        <ReceivingOrderForm
          depositantes={depositanteOptions}
          produtos={productOptions.map((produto) => ({
            id: produto.id,
            nome: produto.nome,
            sku: produto.sku,
            codigoInterno: produto.codigo_interno,
            unidadeEstocagem: produto.unidade_estocagem,
            depositanteId: produto.depositante_id,
          }))}
          lockDepositante={user.papel === "DEPOSITANTE"}
        />
      </section>
    </div>
  );
}
