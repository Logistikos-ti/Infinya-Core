import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { CycleCountPendingAdjustments } from "@/components/estoque/cycle-count-pending-adjustments";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireModuleAccess } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import { listPendingCycleCountAdjustments } from "@/lib/stock-cycle-counts";

export default async function EstoqueInventarioPendenciasPage() {
  const user = await requireModuleAccess("estoque");
  if (!isAdminUser(user)) redirect("/estoque");

  const result = await listPendingCycleCountAdjustments();

  return (
    <div className="space-y-6">
      <Link href="/estoque" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar para estoque
      </Link>

      <ModulePageHeader
        title="Pendências de ajuste"
        description="Contagens cíclicas com divergência aguardando sua aprovação."
        badge={`${result.data.length} pendente${result.data.length === 1 ? "" : "s"}`}
      />

      {!result.available ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Execute a nova migração de inventário cíclico no Supabase para liberar esta área.
        </div>
      ) : result.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
          <ClipboardCheck className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Nenhuma pendência no momento</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">Toda contagem com divergência registrada aparece aqui até ser aprovada ou rejeitada.</p>
        </div>
      ) : (
        <CycleCountPendingAdjustments items={result.data} />
      )}
    </div>
  );
}
