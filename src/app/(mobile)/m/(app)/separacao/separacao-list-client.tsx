"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MobileListShell,
  mobileColors,
  hexAlpha,
} from "@/components/mobile/mobile-kit";

type PickingOrder = {
  id: string;
  status: string;
  displayNumber: string;
  statusLabel: string;
  customer: string;
  totalItems: number;
  completionPercent: number;
};

type SeparacaoListClientProps = {
  orders: PickingOrder[];
  totalOrders: number;
  pendingUnits: number;
  currentPage: number;
  totalPages: number;
  perPage: number;
  feedback: string;
};

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function getMobileShippingOrderHref(status: string, orderId: string) {
  if (["SEPARADO", "EM_CONFERENCIA", "CONFERIDO", "PRONTO_ROMANEIO"].includes(status)) {
    return `/m/conferencia/${orderId}`;
  }
  return `/m/separacao/${orderId}`;
}

export function SeparacaoListClient({
  orders,
  totalOrders,
  currentPage,
  totalPages,
  perPage,
  feedback,
}: SeparacaoListClientProps) {
  const router = useRouter();

  return (
    <div className="relative flex h-full flex-col">
      {feedback ? (
        <div className="shrink-0 px-[18px] pt-[18px] pb-0">
          <div
            className="rounded-[15px] px-4 py-3 text-sm font-semibold"
            style={{
              background: hexAlpha(feedback === "concluido" ? mobileColors.green : mobileColors.amber, 0.1),
              border: `1px solid ${hexAlpha(feedback === "concluido" ? mobileColors.green : mobileColors.amber, 0.2)}`,
              color: feedback === "concluido" ? mobileColors.green : mobileColors.amber,
            }}
          >
            {feedback === "inatividade" && "Pedido devolvido por inatividade."}
            {feedback === "incompleto" && "Pedido voltou para a fila para nova separação."}
            {feedback === "concluido" && "Separação concluída com sucesso."}
          </div>
        </div>
      ) : null}

      <MobileListShell
        title="Fila de Separação"
        subtitle="Pedidos aguardando coleta"
        count={String(totalOrders)}
        onBack={() => router.push("/m/inicio")}
        emptyLabel="Nenhum pedido disponível no momento."
        items={orders.map((order) => ({
          icon: "pick",
          iconColor: mobileColors.blue,
          title: order.displayNumber,
          tag: order.statusLabel,
          tagColor: mobileColors.amber,
          sub: `${order.customer} • ${order.totalItems} itens (${order.completionPercent}%)`,
          onClick: () => router.push(getMobileShippingOrderHref(order.status, order.id)),
        }))}
      />

      {totalPages > 1 ? (
        <div
          className="mx-[18px] mb-4 flex items-center justify-between gap-2 rounded-[16px] p-2"
          style={{ background: hexAlpha("#94A3B8", 0.05), border: `1px solid ${hexAlpha("#94A3B8", 0.1)}` }}
        >
          <Link
            href={`/m/separacao?${buildQueryString({
              feedback,
              perPage: String(perPage),
              page: String(Math.max(1, currentPage - 1)),
            })}`}
            className="flex h-10 w-10 items-center justify-center rounded-[12px]"
            style={{
              background: hexAlpha("#94A3B8", 0.1),
              color: mobileColors.text,
              opacity: currentPage <= 1 ? 0.5 : 1,
              pointerEvents: currentPage <= 1 ? "none" : "auto",
              fontSize: 18,
            }}
          >
            &#8249;
          </Link>
          <span className="text-[12px] font-bold" style={{ color: mobileColors.muted }}>
            Página {currentPage} de {totalPages}
          </span>
          <Link
            href={`/m/separacao?${buildQueryString({
              feedback,
              perPage: String(perPage),
              page: String(Math.min(totalPages, currentPage + 1)),
            })}`}
            className="flex h-10 w-10 items-center justify-center rounded-[12px]"
            style={{
              background: hexAlpha("#94A3B8", 0.1),
              color: mobileColors.text,
              opacity: currentPage >= totalPages ? 0.5 : 1,
              pointerEvents: currentPage >= totalPages ? "none" : "auto",
              fontSize: 18,
            }}
          >
            &#8250;
          </Link>
        </div>
      ) : null}
    </div>
  );
}
