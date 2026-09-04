"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Shield } from "lucide-react";
import { useTheme } from "next-themes";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { InventoryKpis } from "./inventory-kpis";
import { InventoryToolbar } from "./inventory-toolbar";
import { InventoryGrid, type GroupedProduct } from "./inventory-grid";
import { InventoryAlerts } from "./inventory-alerts";
import { InventoryDetailDrawer } from "./inventory-detail-drawer";
import { ExportStockModal } from "./export-stock-modal";

const manrope = Manrope({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

const INVENTORY_VIEW_STATE_KEY = "infinoos-wms:inventory-view";

type InventoryViewState = {
  q?: string;
  owner?: string;
  cat?: string;
  faixaSel?: string;
};

function readInventoryViewState(): InventoryViewState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(INVENTORY_VIEW_STATE_KEY) ?? "{}") as InventoryViewState;
  } catch {
    return {};
  }
}

export function faixaStatus(qtd: number, min: number): "critico" | "baixo" | "ideal" {
  if (qtd < min / 2) return "critico";
  if (qtd < min) return "baixo";
  return "ideal";
}

function groupBalancesByProduct(balances: any[]): GroupedProduct[] {
  const byProduct = new Map<string, any[]>();
  for (const b of balances) {
    const key = b.productId || b.sku;
    const list = byProduct.get(key) ?? [];
    list.push(b);
    byProduct.set(key, list);
  }

  return Array.from(byProduct.entries()).map(([productId, rows]) => {
    const first = rows[0];
    let qtd = 0;
    let reservado = 0;

    const enderecosMap = new Map<string, number>();
    const lotesMap = new Map<string, { lote: string; qtd: number; validade: string }>();
    let anyBloqueado = false;

    for (const r of rows) {
      qtd += r.rawQuantidade || 0;
      reservado += r.rawReserved || 0;
      if (r.status === "Bloqueado") anyBloqueado = true;

      if (r.endereco && r.endereco !== "Sem endereço") {
        enderecosMap.set(r.endereco, (enderecosMap.get(r.endereco) || 0) + (r.rawQuantidade || 0));
      }

      const loteKey = `${r.lote || "__sem_lote__"}::${r.validade || ""}`;
      const existing = lotesMap.get(loteKey);
      if (existing) {
        existing.qtd += r.rawQuantidade || 0;
      } else {
        lotesMap.set(loteKey, { lote: r.lote && r.lote !== "-" ? r.lote : "Sem lote", qtd: r.rawQuantidade || 0, validade: r.validade || "-" });
      }
    }

    const min = first.minQuantity || 0;
    const max = first.maxQuantity || 0;
    const enderecos = Array.from(enderecosMap.entries())
      .map(([code, qty]) => ({ code, qty }))
      .sort((a, b) => b.qty - a.qty);
    const lotes = Array.from(lotesMap.values()).sort((a, b) => b.qtd - a.qtd);

    return {
      productId,
      sku: first.sku,
      productName: first.productName,
      categoria: first.categoria || "Geral",
      tamanho: first.tamanho || null,
      depositanteId: first.depositanteId,
      depositante: first.depositante,
      ean: first.ean || "—",
      metodoRetirada: first.withdrawalMethod,
      ativo: first.ativo ?? true,
      imageUrl: first.imageUrl || null,
      qtd,
      reservado,
      disponivel: qtd - reservado,
      min,
      max,
      pesoKg: first.pesoKg ?? null,
      alturaCm: first.alturaCm ?? null,
      larguraCm: first.larguraCm ?? null,
      comprimentoCm: first.comprimentoCm ?? null,
      bloqueado: anyBloqueado,
      enderecos,
      lotes,
      faixa: faixaStatus(qtd, min),
    } satisfies GroupedProduct;
  });
}

export function InventoryClient({ data }: { data: any }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [viewStateLoaded, setViewStateLoaded] = useState(false);

  const [selectedSku, setSelectedSku] = useState<GroupedProduct | null>(null);
  const [showExport, setShowExport] = useState(false);

  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [cat, setCat] = useState("");
  const [faixaSel, setFaixaSel] = useState("all");

  useEffect(() => {
    const savedViewState = readInventoryViewState();
    setQ(savedViewState.q ?? "");
    setOwner(savedViewState.owner ?? "");
    setCat(savedViewState.cat ?? "");
    setFaixaSel(savedViewState.faixaSel ?? "all");
    setViewStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!viewStateLoaded) {
      return;
    }

    window.sessionStorage.setItem(INVENTORY_VIEW_STATE_KEY, JSON.stringify({ q, owner, cat, faixaSel }));
  }, [q, owner, cat, faixaSel, viewStateLoaded]);

  const t = isDark
    ? {
        appBg: "#0A1120",
        cardBg: "#101B30",
        headBg: "#0E1728",
        inputBg: "#101B30",
        border: "rgba(148,163,184,0.14)",
        rowHover: "rgba(148,163,184,0.05)",
        barTrack: "rgba(148,163,184,0.16)",
        text: "#F1F5F9",
        textSub: "#8695AD",
        textFaint: "#475569",
        drawerBg: "#0C1526",
        hoverBorder: "rgba(139,92,246,0.4)",
        softBg: "rgba(255,255,255,0.05)",
      }
    : {
        appBg: "#F5F7FB",
        cardBg: "#FFFFFF",
        headBg: "#F8FAFC",
        inputBg: "#F8FAFC",
        border: "rgba(100,116,139,0.16)",
        rowHover: "rgba(100,116,139,0.04)",
        barTrack: "rgba(100,116,139,0.14)",
        text: "#0F172A",
        textSub: "#64748B",
        textFaint: "#CBD5E1",
        drawerBg: "#FFFFFF",
        hoverBorder: "rgba(139,92,246,0.4)",
        softBg: "#F1F5F9",
      };

  // owner/área/busca são filtrados a nível de linha (como já era), a faixa é
  // calculada por produto (agregado), então é aplicada depois do agrupamento.
  const rowFilteredBalances = useMemo(() => {
    return (data.stockBalances || []).filter((b: any) => {
      if (owner && b.depositanteId !== owner) return false;
      if (cat && b.area !== cat) return false;
      if (q) {
        const search = q.toLowerCase();
        if (!b.sku?.toLowerCase().includes(search) && !b.productName?.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data.stockBalances, owner, cat, q]);

  const groupedProducts = useMemo(() => groupBalancesByProduct(rowFilteredBalances), [rowFilteredBalances]);

  const faixaCounts = useMemo(() => {
    const all = groupBalancesByProduct(data.stockBalances || []);
    return {
      all: all.length,
      ideal: all.filter((p) => p.faixa === "ideal").length,
      baixo: all.filter((p) => p.faixa === "baixo").length,
      critico: all.filter((p) => p.faixa === "critico").length,
    };
  }, [data.stockBalances]);

  const visibleProducts = useMemo(() => {
    if (faixaSel === "all") return groupedProducts;
    return groupedProducts.filter((p) => p.faixa === faixaSel);
  }, [groupedProducts, faixaSel]);

  return (
    <div className={`${manrope.className} flex h-full flex-col animate-in fade-in duration-500`}>
      <style>{`
        @keyframes drawerIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes overlayFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes modalIn { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
        .drawer-anim { animation: drawerIn 0.32s cubic-bezier(.3,1,.4,1); }
        .overlay-anim { animation: overlayFade 0.25s ease; }
        .card-anim { animation: cardIn 0.4s ease both; }
        .modal-anim { animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      {/* Cabeçalho (padrão rebranding: título + sino + tema) */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span className={`${spaceGrotesk.className} rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100`}>
          Estoque
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-24 pt-1.5 sm:px-8 lg:pb-12" style={{ scrollbarGutter: "stable" }}>
        {/* subtitle + actions */}
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <p className="m-0 text-[14.5px]" style={{ color: t.textSub }}>
            Posição de estoque em tempo real — todos os depositantes.
          </p>
          <div className="flex gap-2.5 items-center flex-wrap">
            {data.isAdmin && (
              <Link
                href="/estoque/conciliacao-pedidos"
                className="flex h-[42px] items-center gap-2 px-[18px] rounded-[11px] border text-[14px] font-bold no-underline"
                style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
              >
                <Shield className="h-4 w-4" strokeWidth={1.7} /> Conciliação
              </Link>
            )}
            <button
              onClick={() => setShowExport(true)}
              className="flex h-[42px] items-center px-[18px] rounded-[11px] border text-[14px] font-bold cursor-pointer"
              style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
            >
              Exportar
            </button>
          </div>
        </div>

        <InventoryKpis t={t} stats={data.stockStatsCards} />

        <InventoryToolbar
          t={t}
          data={data}
          q={q}
          setQ={setQ}
          owner={owner}
          setOwner={setOwner}
          cat={cat}
          setCat={setCat}
          faixaSel={faixaSel}
          setFaixaSel={setFaixaSel}
          faixaCounts={faixaCounts}
        />

        <InventoryGrid t={t} products={visibleProducts} onSelectProduct={setSelectedSku} />

        <InventoryAlerts t={t} alerts={data.stockExpiryAlerts} />
      </div>

      {selectedSku && (
        <InventoryDetailDrawer
          t={t}
          sku={selectedSku}
          allBalances={data.stockBalances}
          allAddresses={data.enderecosInventario}
          onClose={() => setSelectedSku(null)}
        />
      )}

      {showExport && <ExportStockModal t={t} onClose={() => setShowExport(false)} />}
    </div>
  );
}
