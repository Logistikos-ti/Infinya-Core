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

export function DivisaoLoteDepositanteListClient({ depositantes }: { depositantes: DepositanteRow[] }) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Dividir lote"
      subtitle="Selecione o depositante"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque")}
      emptyLabel="Nenhum depositante com saldo disponível para dividir."
      items={depositantes.map((dep) => ({
        icon: "code",
        iconColor: mobileColors.cyan,
        imageUrl: dep.logoUrl,
        title: dep.nome,
        tag: dep.codigo,
        tagColor: mobileColors.cyan,
        sub: `${dep.produtosDisponiveis} produto${dep.produtosDisponiveis === 1 ? "" : "s"} disponível${dep.produtosDisponiveis === 1 ? "" : "is"}`,
        onClick: () => router.push(`/m/estoque/divisao-lote/${dep.id}`),
      }))}
    />
  );
}
