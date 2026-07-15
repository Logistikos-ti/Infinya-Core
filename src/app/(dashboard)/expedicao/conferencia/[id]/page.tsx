import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ShippingConferencePanel } from "@/components/shipping/shipping-conference-panel";
import { requireModuleAccess } from "@/lib/auth";
import { getShippingOrderDetailFromDb } from "@/lib/shipping";
import { listPickingOperatorsFromDb } from "@/lib/shipping-picking";
import { getShippingConferenceOrderFromDb } from "@/lib/shipping-conference";
import { canUploadOperationalDocuments } from "@/lib/permissions";

type ShippingConferenceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function ShippingConferenceDetailPage({
  params,
  searchParams,
}: ShippingConferenceDetailPageProps) {
  const user = await requireModuleAccess("expedicao");
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const feedback = resolvedSearchParams?.feedback?.trim() ?? "";

  const [order, operators, orderDetail] = await Promise.all([
    getShippingConferenceOrderFromDb(user, id),
    listPickingOperatorsFromDb(user),
    getShippingOrderDetailFromDb(id, user),
  ]);

  if (!order || !orderDetail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/expedicao/conferencia"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition-all hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para fila de conferência
      </Link>

      <ModulePageHeader
        title={`Conferência do pedido ${order.displayNumber}`}
        description="Validação item a item do pedido já separado, antes da liberação final para expedição."
        badge={order.depositante}
      />

      <ShippingConferencePanel
        order={order}
        operators={operators}
        currentUserId={user.id}
        feedback={feedback}
        documents={{
          orderId: orderDetail.id,
          depositanteId: orderDetail.depositanteId,
          attachments: orderDetail.attachments,
          isBlingOrder: orderDetail.origin === "BLING",
          isMercadoLivreOrder: orderDetail.salesChannelCode === "MERCADO_LIVRE",
          hasTrackingCode: orderDetail.trackingCode !== "Rastreio não informado",
          canUploadAttachments: canUploadOperationalDocuments(user),
        }}
      />
    </div>
  );
}
