import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersByIdsFromDb } from "@/lib/shipping-picking";
import {
  listActivePickingWavesAction,
  startShippingWaveAction,
} from "@/app/(dashboard)/expedicao/separacao/actions";
import { MobileWavePickingPanel } from "@/components/mobile/mobile-wave-picking-panel";

type MobilePickingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MobilePickingDetailPage({ params }: MobilePickingDetailPageProps) {
  const user = await requireModuleAccess("expedicao");
  const { id: waveId } = await params;

  const waves = await listActivePickingWavesAction();
  const wave = waves.find((item) => item.id === waveId);

  if (!wave) {
    notFound();
  }

  const pedidoIds = (wave.pedidos ?? []).map(
    (item: { pedido_expedicao_id: string }) => item.pedido_expedicao_id,
  );

  if (!pedidoIds.length) {
    notFound();
  }

  if (wave.status === "PENDENTE" && !wave.iniciado_em) {
    await startShippingWaveAction(waveId);
  }

  const orders = await listShippingPickingOrdersByIdsFromDb(user, pedidoIds, {
    includeRouteData: true,
  });

  if (!orders.length) {
    notFound();
  }

  return (
    <MobileWavePickingPanel
      orders={orders}
      waveId={waveId}
      waveCode={wave.codigo}
      currentUserId={user.id}
    />
  );
}
