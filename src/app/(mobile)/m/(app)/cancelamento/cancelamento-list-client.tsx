"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type CancelamentoRow = {
  id: string;
  orderNumber: string;
  depositante: string;
  cliente: string;
};

type CancelamentoListClientProps = {
  rows: CancelamentoRow[];
};

export function CancelamentoListClient({ rows }: CancelamentoListClientProps) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Cancelamentos pendentes"
      subtitle="Aguardando bipagem de devolução"
      count={String(rows.length)}
      onBack={() => router.push("/m/inicio")}
      emptyLabel="Nenhum cancelamento aguardando bipagem no momento."
      items={rows.map((row) => ({
        icon: "clip",
        iconColor: mobileColors.amber,
        title: row.orderNumber,
        tag: "Bipar devolução",
        tagColor: mobileColors.amber,
        sub: `${row.depositante} • ${row.cliente}`,
        onClick: () => router.push(`/m/cancelamento/${row.id}`),
      }))}
    />
  );
}
