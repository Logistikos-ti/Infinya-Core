"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type ProdutoRow = {
  estoqueId: string;
  nome: string;
  sku: string;
  endereco: string;
};

export function InventarioProdutoListClient({
  depositanteId,
  depositanteNome,
  produtos,
}: {
  depositanteId: string;
  depositanteNome: string;
  produtos: ProdutoRow[];
}) {
  const router = useRouter();

  return (
    <MobileListShell
      title={depositanteNome}
      subtitle="Selecione o produto a inventariar"
      count={`${produtos.length} SKU${produtos.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque/inventarios")}
      emptyLabel="Nenhum produto em estoque para este depositante."
      items={produtos.map((p) => ({
        icon: "box",
        iconColor: mobileColors.amber,
        title: p.nome,
        tag: `End. ${p.endereco}`,
        tagColor: mobileColors.amber,
        sub: p.sku,
        onClick: () => router.push(`/m/estoque/inventarios/${depositanteId}/${p.estoqueId}`),
      }))}
    />
  );
}
