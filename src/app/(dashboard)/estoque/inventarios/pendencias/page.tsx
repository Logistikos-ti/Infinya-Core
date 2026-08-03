import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck, TriangleAlert } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireModuleAccess } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import { listPendingCycleCountAdjustments } from "@/lib/stock-cycle-counts";

export default async function EstoqueInventarioPendenciasPage() {
  const user = await requireModuleAccess("estoque");

  if (!isAdminUser(user)) {
    redirect("/estoque");
  }

  const result = await listPendingCycleCountAdjustments();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/estoque"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para estoque
        </Link>
      </div>

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
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Toda contagem com divergência registrada aparece aqui até ser aprovada ou rejeitada.
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="space-y-3">
            {result.data.map((item) => (
              <Link
                key={item.itemId}
                href={`/estoque/inventarios/${item.cycleCountId}`}
                className="block rounded-2xl border border-amber-200 bg-amber-50/60 p-4 transition hover:-translate-y-px hover:border-amber-300 dark:border-amber-500/25 dark:bg-amber-500/5 dark:hover:border-amber-400/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Divergência
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {item.depositante}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {item.titulo}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-[1.4fr_1fr_1fr]">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {item.sku} • {item.productName}
                    </p>
                    <p className="mt-1">
                      {item.endereco} • {item.area}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Sistema / contado
                    </p>
                    <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                      {item.systemQuantity} / {item.countedQuantity}
                      <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">
                        ({item.divergence})
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Contado por
                    </p>
                    <p className="mt-1 font-semibold text-slate-950 dark:text-white">{item.countedBy}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.countedAt}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
