"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type ProdutoRow = {
  estoqueId: string;
  nome: string;
  sku: string;
  endereco: string;
  area: string;
  disponivel: number;
  imagemUrl: string | null;
};

export function MovimentacaoProdutoListClient({
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
      subtitle="Selecione o saldo a mover"
      count={`${produtos.length} SKU${produtos.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque/movimentacao-interna")}
      emptyLabel="Nenhum saldo disponível para mover neste depositante."
      items={produtos.map((p) => ({
        icon: "box",
        iconColor: mobileColors.violet,
        imageUrl: p.imagemUrl,
        title: p.nome,
        tag: `${p.disponivel} un`,
        tagColor: mobileColors.violet,
        sub: `${p.sku} · ${p.endereco}`,
        onClick: () => router.push(`/m/estoque/movimentacao-interna/${depositanteId}/${p.estoqueId}`),
      }))}
    />
  );
}
