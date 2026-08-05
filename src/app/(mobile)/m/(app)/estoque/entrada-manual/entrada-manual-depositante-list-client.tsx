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

export function EntradaManualDepositanteListClient({ depositantes }: { depositantes: DepositanteRow[] }) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Entrada manual"
      subtitle="Selecione o depositante"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque")}
      emptyLabel="Nenhum depositante com saldo cadastrado."
      items={depositantes.map((dep) => ({
        icon: "user",
        iconColor: mobileColors.green,
        imageUrl: dep.logoUrl,
        title: dep.nome,
        tag: dep.codigo,
        tagColor: mobileColors.green,
        sub: `${dep.produtosDisponiveis} produto${dep.produtosDisponiveis === 1 ? "" : "s"} disponíve${dep.produtosDisponiveis === 1 ? "l" : "is"}`,
        onClick: () => router.push(`/m/estoque/entrada-manual/${dep.id}`),
      }))}
    />
  );
}
