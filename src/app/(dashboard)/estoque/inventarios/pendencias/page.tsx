import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck, History, ListTodo } from "lucide-react";
import { CycleCountPendingAdjustments } from "@/components/estoque/cycle-count-pending-adjustments";
import { CycleCountHistory } from "@/components/estoque/cycle-count-history";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireModuleAccess } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import { listPendingCycleCountAdjustments, listCycleCountsFromDb } from "@/lib/stock-cycle-counts";

type PageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export default async function EstoqueInventarioPendenciasPage({ searchParams }: PageProps) {
  const user = await requireModuleAccess("estoque");
  if (!isAdminUser(user)) redirect("/estoque");

  const params = searchParams ? await searchParams : undefined;
  const tab = params?.tab === "historico" ? "historico" : "pendentes";

  const result = await listPendingCycleCountAdjustments();
  const historyResult = tab === "historico" ? await listCycleCountsFromDb(undefined, 50, "CONCLUIDA") : null;

  return (
    <div className="space-y-6">
      <Link href="/estoque" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar para estoque
      </Link>

      <ModulePageHeader
        title={tab === "pendentes" ? "Pendências de ajuste" : "Histórico de inventários"}
        description={
          tab === "pendentes"
            ? "Contagens cíclicas com divergência aguardando sua aprovação."
            : "Registro de todas as contagens cíclicas já concluídas."
        }
        badge={tab === "pendentes" ? `${result.data.length} pendente${result.data.length === 1 ? "" : "s"}` : "Concluídos"}
      />

      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-zinc-800">
        <Link
          href="?tab=pendentes"
          className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
            tab === "pendentes"
              ? "border-cyan-500 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <ListTodo className="h-4 w-4" />
          Pendências
          {result.data.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400">
              {result.data.length}
            </span>
          )}
        </Link>
        <Link
          href="?tab=historico"
          className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
            tab === "historico"
              ? "border-cyan-500 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <History className="h-4 w-4" />
          Histórico
        </Link>
      </div>

      {tab === "pendentes" && (
        <>
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
        </>
      )}

      {tab === "historico" && historyResult && (
        <CycleCountHistory items={historyResult.data} />
      )}
    </div>
  );
}
