"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type ProdutoRow = {
  estoqueId: string;
  nome: string;
  sku: string;
  endereco: string;
  area: string;
  atual: number;
  imagemUrl: string | null;
};

export function EntradaManualProdutoListClient({
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
      subtitle="Selecione o saldo para dar entrada"
      count={`${produtos.length} SKU${produtos.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque/entrada-manual")}
      emptyLabel="Nenhum saldo disponível para entrada neste depositante."
      items={produtos.map((p) => ({
        icon: "box",
        iconColor: mobileColors.green,
        imageUrl: p.imagemUrl,
        title: p.nome,
        tag: `${p.atual} un`,
        tagColor: mobileColors.green,
        sub: `${p.sku} · ${p.endereco}`,
        onClick: () => router.push(`/m/estoque/entrada-manual/${depositanteId}/${p.estoqueId}`),
      }))}
    />
  );
}
