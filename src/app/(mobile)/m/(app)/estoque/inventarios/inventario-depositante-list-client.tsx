"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type DepositanteRow = {
  id: string;
  nome: string;
  codigo: string;
  logoUrl: string | null;
  produtosEmEstoque: number;
};

export function InventarioDepositanteListClient({ depositantes }: { depositantes: DepositanteRow[] }) {
  const router = useRouter();

  return (
    <MobileListShell
      title="Inventário"
      subtitle="Selecione o depositante"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque")}
      emptyLabel="Nenhum depositante com estoque para contar."
      items={depositantes.map((dep) => ({
        icon: "user",
        iconColor: mobileColors.amber,
        imageUrl: dep.logoUrl,
        title: dep.nome,
        tag: dep.codigo,
        tagColor: mobileColors.violetLight,
        sub: `${dep.produtosEmEstoque} produto${dep.produtosEmEstoque === 1 ? "" : "s"} em estoque`,
        onClick: () => router.push(`/m/estoque/inventarios/${dep.id}`),
      }))}
    />
  );
}
