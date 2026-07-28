"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type ReceivingOrderRow = {
  id: string;
  code: string;
  status: string;
  depositante: string;
  volumeCount: number;
};

type RecebimentoListClientProps = {
  orders: ReceivingOrderRow[];
  totalOrders: number;
};

export function RecebimentoListClient({ orders, totalOrders }: RecebimentoListClientProps) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Fila de Recebimento"
      subtitle="Fila inbound do turno"
      count={String(totalOrders)}
      onBack={() => router.push("/m/inicio")}
      emptyLabel="Nenhum recebimento disponível no momento."
      items={orders.map((order) => ({
        icon: "inbound",
        iconColor: mobileColors.violet,
        title: order.code,
        tag: order.status,
        tagColor: mobileColors.green,
        sub: `${order.depositante} • ${order.volumeCount} volumes`,
        onClick: () => router.push(`/m/recebimento/${order.id}`),
      }))}
    />
  );
}
