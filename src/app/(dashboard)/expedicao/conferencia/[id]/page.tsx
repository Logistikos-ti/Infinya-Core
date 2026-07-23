import { notFound } from "next/navigation";
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
    <ShippingConferencePanel
      order={order}
      operators={operators}
      currentUserId={user.id}
      currentUserName={user.nome}
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
  );
}
