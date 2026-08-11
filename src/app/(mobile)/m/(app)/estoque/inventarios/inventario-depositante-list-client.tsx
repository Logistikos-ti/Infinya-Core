"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MobileCard, MobileIcon, MobileListShell, mobileColors, mobileGradient, headingFont, hexAlpha } from "@/components/mobile/mobile-kit";

type DepositanteRow = {
  id: string;
  nome: string;
  codigo: string;
  logoUrl: string | null;
  produtosEmEstoque: number;
};

export function InventarioDepositanteListClient({ depositantes }: { depositantes: DepositanteRow[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "cycle">("choose");

  if (mode === "choose") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flexShrink: 0, padding: "18px 18px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => router.push("/m/estoque")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
              background: "transparent",
              color: mobileColors.text,
              fontSize: 20,
            }}
          >
            &#8249;
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário</div>
            <div style={{ fontSize: 12, color: mobileColors.muted }}>Escolha o tipo de inventário</div>
          </div>
        </div>

        <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <MobileCard as="button" onClick={() => setMode("cycle")} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
            <span style={{ width: 50, height: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: mobileGradient, color: "#fff" }}>
              <MobileIcon name="scan" size={24} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário cíclico</span>
              <span style={{ fontSize: 12, color: mobileColors.muted }}>Conte um endereço ou produto específico.</span>
            </span>
            <span style={{ color: mobileColors.dim, fontSize: 20 }}>&#8250;</span>
          </MobileCard>

          <MobileCard as="button" onClick={() => router.push("/m/estoque/inventarios/geral")} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
            <span style={{ width: 50, height: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: hexAlpha(mobileColors.violetLight, 0.14), color: mobileColors.violetLight }}>
              <MobileIcon name="clip" size={24} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário geral</span>
              <span style={{ fontSize: 12, color: mobileColors.muted }}>Conte todos os produtos do depositante hoje.</span>
            </span>
            <span style={{ color: mobileColors.dim, fontSize: 20 }}>&#8250;</span>
          </MobileCard>
        </div>
      </div>
    );
  }

  return (
    <MobileListShell
      title="Inventário cíclico"
      subtitle="Selecione o depositante"
      count={`${depositantes.length} depositante${depositantes.length === 1 ? "" : "s"}`}
      onBack={() => setMode("choose")}
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
