"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors, hexAlpha } from "@/components/mobile/mobile-kit";

type ProdutoRow = {
  estoqueId: string;
  nome: string;
  sku: string;
  codigoInterno: string;
  gtin: string;
  gtinPack: string;
  imagemUrl: string | null;
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
  const [busca, setBusca] = useState("");

  const produtosFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return produtos;

    return produtos.filter((produto) =>
      [produto.nome, produto.sku, produto.codigoInterno, produto.gtin, produto.gtinPack].some((valor) =>
        normalizar(valor).includes(termo),
      ),
    );
  }, [busca, produtos]);

  return (
    <MobileListShell
      title={depositanteNome}
      subtitle="Selecione o produto a inventariar"
      count={`${produtosFiltrados.length} SKU${produtosFiltrados.length === 1 ? "" : "s"}`}
      onBack={() => router.push("/m/estoque/inventarios")}
      emptyLabel={busca ? "Nenhum produto encontrado para esta busca." : "Nenhum produto em estoque para este depositante."}
      beforeItems={
        <label style={{ position: "relative", display: "block", marginBottom: 3 }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 15,
              top: "50%",
              transform: "translateY(-50%)",
              color: mobileColors.muted,
              fontSize: 18,
              pointerEvents: "none",
            }}
          >
            &#8981;
          </span>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar produto, SKU ou GTIN"
            autoComplete="off"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 14,
              border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`,
              background: hexAlpha("#94A3B8", 0.06),
              color: mobileColors.text,
              padding: "0 14px 0 43px",
              fontSize: 14,
              outline: "none",
            }}
          />
        </label>
      }
      items={produtosFiltrados.map((p) => ({
        icon: "box",
        iconColor: mobileColors.amber,
        imageUrl: p.imagemUrl,
        title: p.nome,
        sub: p.sku,
        onClick: () => router.push(`/m/estoque/inventarios/${depositanteId}/${p.estoqueId}`),
      }))}
    />
  );
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
