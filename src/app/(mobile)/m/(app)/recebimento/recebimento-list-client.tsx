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

function statusMeta(status: string): { label: string; color: string } {
  switch (status) {
    case "EM_RECEBIMENTO":
      return { label: "Em recebimento", color: mobileColors.blue };
    case "RECEBIDO_PARCIAL":
      return { label: "Parcial", color: mobileColors.amber };
    case "RECEBIDO":
      return { label: "Recebido", color: mobileColors.green };
    case "DIVERGENCIA":
      return { label: "Divergência", color: mobileColors.red };
    case "CANCELADO":
      return { label: "Cancelado", color: mobileColors.dim };
    default:
      // RASCUNHO / AGUARDANDO
      return { label: "Agendado", color: mobileColors.amber };
  }
}

export function RecebimentoListClient({ orders, totalOrders }: RecebimentoListClientProps) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Fila de Recebimento"
      subtitle="Fila inbound do turno"
      count={String(totalOrders)}
      onBack={() => router.push("/m/inicio")}
      emptyLabel="Nenhum recebimento disponível no momento."
      items={orders.map((order) => {
        const meta = statusMeta(order.status);
        return {
          icon: "inbound",
          iconColor: mobileColors.violet,
          title: order.code,
          tag: meta.label,
          tagColor: meta.color,
          sub: `${order.depositante} • ${order.volumeCount} volumes`,
          onClick: () => router.push(`/m/recebimento/${order.id}`),
        };
      })}
    />
  );
}
