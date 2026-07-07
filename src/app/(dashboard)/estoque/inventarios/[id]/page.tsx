import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, ClipboardList, PackageSearch, TriangleAlert } from "lucide-react";
import { CycleCountCompleteButton } from "@/components/estoque/cycle-count-complete-button";
import { CycleCountItemForm } from "@/components/estoque/cycle-count-item-form";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import { getStockCycleCountAvailability, getCycleCountDetailFromDb } from "@/lib/stock-cycle-counts";

type EstoqueInventarioDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EstoqueInventarioDetalhePage({
  params,
}: EstoqueInventarioDetalhePageProps) {
  await requireModuleAccess("estoque");

  const { id } = await params;
  const availability = await getStockCycleCountAvailability();

  if (!availability) {
    return (
      <div className="space-y-6">
        <ModulePageHeader
          title="Inventário cíclico"
          description="A estrutura deste módulo ainda precisa ser ativada no banco atual."
          badge="Cycle count"
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Execute a nova migração de inventário cíclico no Supabase para liberar a contagem.
        </div>
      </div>
    );
  }

  const detailResult = await getCycleCountDetailFromDb(id);

  if (!detailResult.data) {
    notFound();
  }

  const detail = detailResult.data;

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
        title={detail.titulo}
        description={`Contagem do depositante ${detail.depositante} na área ${detail.area}.`}
        badge={detail.status}
      />

      <div className="flex flex-wrap gap-2">
        {detail.status !== "CONCLUIDA" ? <CycleCountCompleteButton cycleCountId={detail.id} /> : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Itens da contagem"
          value={String(detail.totalItems)}
          help={`Criada em ${detail.createdAt}`}
        />
        <StatCard
          icon={PackageSearch}
          label="Já contados"
          value={String(detail.countedItems)}
          help={`Área ${detail.area}`}
        />
        <StatCard
          icon={TriangleAlert}
          label="Com divergência"
          value={String(detail.divergentItems)}
          help="Itens em que a quantidade contada difere do saldo esperado."
        />
        <StatCard
          icon={Boxes}
          label="Status"
          value={detail.status}
          help={`Início ${detail.startedAt} • conclusão ${detail.completedAt}`}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          Itens da contagem
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Registre a quantidade contada em cada saldo e acompanhe a divergência diretamente pelo
          protocolo.
        </p>

        <div className="mt-5 space-y-4">
          {detail.items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/estoque/protocolos/${item.stockId}`}
                  className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                >
                  {item.protocol}
                </Link>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {item.status}
                </span>
              </div>

              <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-[1.4fr_1fr_1fr]">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {item.sku} • {item.productName}
                  </p>
                  <p className="mt-1">
                    {item.endereco} • {item.area} • lote {item.lote} • validade {item.validade}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Sistema
                  </p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {item.systemQuantity}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Contado / divergência
                  </p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {item.countedQuantity} / {item.divergence}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.countedBy} • {item.countedAt}
                  </p>
                </div>
              </div>

              {detail.status !== "CONCLUIDA" ? (
                <div className="mt-4">
                  <CycleCountItemForm
                    itemId={item.id}
                    defaultCountedQuantity={item.countedQuantity}
                    defaultObservations={item.observations}
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-zinc-950/40 dark:text-slate-300">
                  {item.observations}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
