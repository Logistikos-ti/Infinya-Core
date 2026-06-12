import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ReceivingOrderForm } from "@/components/receiving/receiving-order-form";

export default function NovoRecebimentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/recebimento"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para recebimento
        </Link>
      </div>

      <ModulePageHeader
        title="Novo recebimento"
        description="Primeira tela de abertura de pedido inbound para o WMS próprio."
        badge="Fluxo operacional"
      />

      <ReceivingOrderForm />
    </div>
  );
}
