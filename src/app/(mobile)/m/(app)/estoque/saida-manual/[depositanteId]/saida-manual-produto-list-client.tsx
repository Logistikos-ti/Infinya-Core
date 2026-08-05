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

export function SaidaManualProdutoListClient({
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
      subtitle="Selecione o saldo para dar saída"
      count={`${produtos.length} SKU${produtos.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque/saida-manual")}
      emptyLabel="Nenhum saldo disponível para saída neste depositante."
      items={produtos.map((p) => ({
        icon: "box",
        iconColor: mobileColors.red,
        imageUrl: p.imagemUrl,
        title: p.nome,
        tag: `${p.disponivel} un`,
        tagColor: mobileColors.red,
        sub: `${p.sku} · ${p.endereco}`,
        onClick: () => router.push(`/m/estoque/saida-manual/${depositanteId}/${p.estoqueId}`),
      }))}
    />
  );
}
