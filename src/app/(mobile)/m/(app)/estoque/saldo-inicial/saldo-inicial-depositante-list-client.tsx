"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type DepositanteRow = {
  id: string;
  nome: string;
  codigo: string;
  logoUrl: string | null;
  produtosAtivos: number;
};

export function SaldoInicialDepositanteListClient({ depositantes }: { depositantes: DepositanteRow[] }) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Lançar estoque"
      subtitle="Selecione o depositante"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque")}
      emptyLabel="Nenhum depositante com produtos ativos."
      items={depositantes.map((dep) => ({
        icon: "user",
        iconColor: mobileColors.cyan,
        imageUrl: dep.logoUrl,
        title: dep.nome,
        tag: dep.codigo,
        tagColor: mobileColors.cyanLight,
        sub: `${dep.produtosAtivos} produto${dep.produtosAtivos === 1 ? "" : "s"} cadastrado${dep.produtosAtivos === 1 ? "" : "s"}`,
        onClick: () => router.push(`/m/estoque/saldo-inicial/${dep.id}`),
      }))}
    />
  );
}
