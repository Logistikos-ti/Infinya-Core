import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ShippingPickingPanel } from "@/components/shipping/shipping-picking-panel";
import { requireModuleAccess } from "@/lib/auth";
import { getShippingPickingOrderFromDb, listPickingOperatorsFromDb } from "@/lib/shipping-picking";

type PickingOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PickingOrderDetailPage({ params }: PickingOrderDetailPageProps) {
  const user = await requireModuleAccess("expedicao");
  const { id } = await params;

  const [order, operators] = await Promise.all([
    getShippingPickingOrderFromDb(user, id),
    listPickingOperatorsFromDb(user),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <div className="relative space-y-6 opacity-95">
      <Link
        href="/expedicao/separacao"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para fila de separação
      </Link>

      <ModulePageHeader
        title={`Separação do pedido ${order.externalNumber}`}
        description="Execução operacional completa da separação, com leitura, rota sugerida e apontamento item a item."
        badge={order.depositante}
      />

      <ShippingPickingPanel order={order} operators={operators} currentUserId={user.id} />
    </div>
  );
}
