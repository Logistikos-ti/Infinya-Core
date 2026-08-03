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

export function MovimentacaoDepositanteListClient({ depositantes }: { depositantes: DepositanteRow[] }) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Movimentação"
      subtitle="Selecione o depositante"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque")}
      emptyLabel="Nenhum depositante com saldo disponível para mover."
      items={depositantes.map((dep) => ({
        icon: "user",
        iconColor: mobileColors.violet,
        imageUrl: dep.logoUrl,
        title: dep.nome,
        tag: dep.codigo,
        tagColor: mobileColors.violetLight,
        sub: `${dep.produtosDisponiveis} produto${dep.produtosDisponiveis === 1 ? "" : "s"} disponíve${dep.produtosDisponiveis === 1 ? "l" : "is"} para mover`,
        onClick: () => router.push(`/m/estoque/movimentacao-interna/${dep.id}`),
      }))}
    />
  );
}
