import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ShippingPickingWavePanel } from "@/components/shipping/shipping-picking-wave-panel";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersByIdsFromDb } from "@/lib/shipping-picking";

type PickingWavePageProps = {
  searchParams?: Promise<{
    ids?: string;
    feedback?: string;
  }>;
};

export default async function PickingWavePage({ searchParams }: PickingWavePageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const selectedIds = (params?.ids ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const feedback = params?.feedback?.trim() ?? "";

  if (!selectedIds.length) {
    notFound();
  }

  const orders = await listShippingPickingOrdersByIdsFromDb(user, selectedIds, {
    includeRouteData: true,
  });

  if (!orders.length) {
    notFound();
  }

  const returnTo = `/expedicao/separacao/lote?ids=${encodeURIComponent(selectedIds.join(","))}`;

  return (
    <div className="relative space-y-6 opacity-95">
      <Link
        href="/expedicao/separacao"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para fila de separacao
      </Link>

      <ModulePageHeader
        title="Separacao consolidada"
        description="Execucao de uma onda unica com varios pedidos selecionados na fila."
        badge={`${orders.length} pedidos`}
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "concluido"
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {feedback === "concluido"
            ? "Separacao da onda concluida com sucesso."
            : feedback === "incompleto"
              ? "Ainda existem itens pendentes nesta onda. Revise as quantidades antes de concluir."
              : feedback === "inatividade"
                ? "A onda foi devolvida para a fila por inatividade do operador."
                : "Nao foi possivel concluir a operacao solicitada."}
        </div>
      ) : null}

      <ShippingPickingWavePanel
        orders={orders}
        currentUserId={user.id}
        currentUserName={user.nome}
        returnTo={returnTo}
        expireRedirectTo="/expedicao/separacao"
        completeRedirectTo="/expedicao/conferencia"
      />
    </div>
  );
}
