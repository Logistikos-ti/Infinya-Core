"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

type ProdutoRow = {
  produtoId: string;
  nome: string;
  sku: string;
  imagemUrl: string | null;
  exigeLote: boolean;
  exigeValidade: boolean;
};

function requirementTag(exigeLote: boolean, exigeValidade: boolean) {
  if (exigeLote && exigeValidade) return "Lote + validade";
  if (exigeLote) return "Exige lote";
  if (exigeValidade) return "Exige validade";
  return undefined;
}

export function SaldoInicialProdutoListClient({
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
      subtitle="Selecione o produto"
      count={`${produtos.length} produto${produtos.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque/saldo-inicial")}
      emptyLabel="Nenhum produto ativo para este depositante."
      items={produtos.map((p) => ({
        icon: "box",
        iconColor: mobileColors.cyan,
        imageUrl: p.imagemUrl,
        title: p.nome,
        tag: requirementTag(p.exigeLote, p.exigeValidade),
        tagColor: mobileColors.amber,
        sub: p.sku,
        onClick: () => router.push(`/m/estoque/saldo-inicial/${depositanteId}/${p.produtoId}`),
      }))}
    />
  );
}
