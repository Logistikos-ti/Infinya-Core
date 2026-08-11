"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type Row = { id: string; nome: string; codigo: string; logoUrl: string | null };

export function GeneralInventoryDepositantListClient({ depositantes }: { depositantes: Row[] }) {
  const router = useRouter();
  return (
    <MobileListShell
      title="Inventário geral"
      subtitle="Escolha o depositante para iniciar a contagem de hoje"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque/inventários")}
      emptyLabel="Nenhum depositante disponível."
      items={depositantes.map((dep) => ({
        icon: "user",
        iconColor: mobileColors.violetLight,
        imageUrl: dep.logoUrl,
        title: dep.nome,
        tag: dep.codigo,
        tagColor: mobileColors.violetLight,
        sub: "Iniciar inventário geral diário",
        onClick: () => router.push(`/m/estoque/inventários/geral/${dep.id}`),
      }))}
    />
  );
}
