"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type DepositanteRow = {
  id: string;
  nome: string;
  codigo: string;
  logoUrl: string | null;
  produtosDisponiveis: number;
};

export function QuarentenaDepositanteListClient({ depositantes }: { depositantes: DepositanteRow[] }) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Quarentena"
      subtitle="Selecione o depositante"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque")}
      emptyLabel="Nenhum depositante com saldo disponível para quarentena."
      items={depositantes.map((dep) => ({
        icon: "shield",
        iconColor: mobileColors.amber,
        imageUrl: dep.logoUrl,
        title: dep.nome,
        tag: dep.codigo,
        tagColor: mobileColors.amber,
        sub: `${dep.produtosDisponiveis} produto${dep.produtosDisponiveis === 1 ? "" : "s"} disponível${dep.produtosDisponiveis === 1 ? "" : "is"}`,
        onClick: () => router.push(`/m/estoque/quarentena/${dep.id}`),
      }))}
    />
  );
}
