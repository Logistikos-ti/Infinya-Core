import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  EyeOff,
  PackageSearch,
  ScanSearch,
  TriangleAlert,
} from "lucide-react";
import { CycleCountCompleteButton } from "@/components/estoque/cycle-count-complete-button";
import { CycleCountStartButton } from "@/components/estoque/cycle-count-start-button";
import { CycleCountItemForm } from "@/components/estoque/cycle-count-item-form";
import { DesktopCycleCountScanClient } from "@/components/estoque/desktop-cycle-count-scan-client";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import {
  getCycleCountDetailFromDb,
  getStockCycleCountAvailability,
  maskCycleCountDetailForBlindCount,
} from "@/lib/stock-cycle-counts";

type EstoqueInventarioDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EstoqueInventarioDetalhePage({
  params,
}: EstoqueInventarioDetalhePageProps) {
  const user = await requireModuleAccess("estoque");

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

  if (detailResult.data.status === "PROGRAMADA") {
    const scheduled = detailResult.data;
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/estoque/inventarios"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para inventário
          </Link>
        </div>

        <ModulePageHeader
          title={scheduled.titulo}
          description={`Contagem do depositante ${scheduled.depositante} programada para ${scheduled.programadoPara ? new Date(scheduled.programadoPara).toLocaleString("pt-BR") : "data a definir"}.`}
          badge="Programada"
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            <p>
              <span className="font-medium text-slate-900 dark:text-white">Área:</span> {scheduled.area}
            </p>
            <p>
              <span className="font-medium text-slate-900 dark:text-white">Responsável:</span>{" "}
              {scheduled.responsavelNome ?? "Não atribuído"}
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            O saldo do estoque é capturado no momento em que a contagem é iniciada, não na hora em
            que foi programada — assim os itens refletem o estoque real do dia da contagem.
          </p>
          <div className="mt-5">
            <CycleCountStartButton cycleCountId={scheduled.id} />
          </div>
        </section>
      </div>
    );
  }

  const showSystemQuantity =
    !detailResult.data.blindCount || detailResult.data.status === "CONCLUIDA" || isAdminUser(user);
  const detail = maskCycleCountDetailForBlindCount(detailResult.data, showSystemQuantity);
  const pendingItems = detail.items.filter((item) => item.status === "PENDENTE");

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
        {detail.blindCount ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
            <EyeOff className="h-3.5 w-3.5" />
            Contagem cega ativa
          </span>
        ) : null}
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
          icon={detail.blindCount ? EyeOff : Boxes}
          label={detail.blindCount ? "Modo da contagem" : "Status"}
          value={detail.blindCount ? "Cega" : detail.status}
          help={
            detail.blindCount
              ? `Início ${detail.startedAt} • conclusão ${detail.completedAt}`
              : `Início ${detail.startedAt} • conclusão ${detail.completedAt}`
          }
        />
      </section>

      {detail.status !== "CONCLUIDA" && pendingItems.length > 0 ? (
        <DesktopCycleCountScanClient
          cycleCountId={detail.id}
          items={pendingItems.map((item) => ({
            id: item.id,
            sku: item.sku,
            productName: item.productName,
            codigoExterno: item.codigoExterno,
            codigoInterno: item.codigoInterno,
            codigoExternoPack: item.codigoExternoPack,
            quantidadePorEmbalagem: item.quantidadePorEmbalagem,
            endereco: item.endereco,
            area: item.area,
            systemQuantityRaw: item.systemQuantityRaw,
            countedQuantityRaw: item.countedQuantityRaw,
            status: item.status,
          }))}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Itens da contagem</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Registre a quantidade contada em cada saldo. Quando houver divergência, o saldo é
          atualizado automaticamente e a ocorrência fica disponível para consulta administrativa.
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
                <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                  {item.adjustmentStatus === "APLICADO_AUTO"
                    ? "Aplicado automaticamente"
                    : item.adjustmentStatus}
                </span>
                {item.secondCountedQuantity !== "-" ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    Segunda contagem registrada
                  </span>
                ) : null}
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
                    {showSystemQuantity ? item.systemQuantity : "Oculto na contagem cega"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    1ª contagem / divergência
                  </p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {item.countedQuantity} / {item.divergence}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.countedBy} • {item.countedAt}
                  </p>
                </div>
              </div>

              {item.secondCountedQuantity !== "-" ? (
                <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-medium">2ª contagem / divergência</p>
                  <p className="mt-1">
                    {item.secondCountedQuantity} / {item.secondDivergence}
                  </p>
                  <p className="mt-1 text-xs">
                    {item.secondCountedBy} • {item.secondCountedAt}
                  </p>
                  {item.secondObservations !== "Sem observações da segunda contagem." ? (
                    <p className="mt-2 text-xs">Observações: {item.secondObservations}</p>
                  ) : null}
                </div>
              ) : null}

              {detail.status !== "CONCLUIDA" ? (
                <div className="mt-4 space-y-4">
                  {item.status === "PENDENTE" ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Use a bipagem contínua no topo da página para contar este item com o coletor.
                    </p>
                  ) : (
                    <CycleCountItemForm
                      itemId={item.id}
                      defaultCountedQuantity={item.countedQuantity}
                      defaultObservations={item.observations}
                    />
                  )}

                  {item.status === "DIVERGENTE" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                        <ScanSearch className="h-4 w-4" />
                        Segunda conferência
                      </div>
                      <CycleCountItemForm
                        itemId={item.id}
                        defaultCountedQuantity={item.secondCountedQuantity}
                        defaultObservations={item.secondObservations}
                        mode="second"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-zinc-950/40 dark:text-slate-300">
                    <p>{item.observations}</p>
                    <div className="mt-2 grid gap-2 text-xs text-slate-500 dark:text-slate-400 md:grid-cols-2">
                      <p>Status do ajuste: {item.adjustmentStatus}</p>
                      <p>Autorização manual: não necessária</p>
                      <p>Aplicação automática: {item.adjustmentAppliedAt}</p>
                      <p>Aplicado em: {item.adjustmentAppliedAt}</p>
                    </div>
                    {item.adjustmentNotes !== "Sem observações de ajuste." ? (
                      <p className="mt-2 text-xs">Observação do ajuste: {item.adjustmentNotes}</p>
                    ) : null}
                  </div>

                  {item.status === "DIVERGENTE" ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                      Ajuste aplicado automaticamente após a contagem. Esta tela é somente para consulta.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
