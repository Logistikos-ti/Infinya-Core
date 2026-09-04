"use client";

import Link from "next/link";
import { Package, X, History, Loader2 } from "lucide-react";
import { useState } from "react";

import { StockTransferQuickModal } from "./stock-transfer-quick-modal";
import { StockAdjustmentModal } from "./stock-adjustment-modal";
import { StockManualExitModal } from "./stock-manual-exit-modal";
import type { GroupedProduct } from "./inventory-grid";
import { formatDateTimePtBr } from "@/lib/utils";

const CAT_DEFS: Record<string, string> = {
  "Seco / Ambiente": "#3B82F6",
  "Refrigerado": "#06B6D4",
  "Congelado": "#6366F1",
  "Frágil": "#EC4899",
  "Perigoso (DG)": "#EF4444",
  "Alto Valor": "#F59E0B",
  "Volumoso": "#10B981",
  "Vestuário": "#8B5CF6",
  "Geral": "#64748b",
};

const FAIXA_COLOR: Record<string, string> = { critico: "#EF4444", baixo: "#F59E0B", ideal: "#10B981" };
const FAIXA_LABEL: Record<string, string> = { critico: "Ruptura crítica", baixo: "Abaixo do mínimo", ideal: "Dentro da faixa ideal" };

export function InventoryDetailDrawer({
  t,
  sku,
  allBalances = [],
  allAddresses = [],
  onClose,
}: {
  t: any;
  sku: GroupedProduct;
  allBalances?: any[];
  allAddresses?: any[];
  onClose: () => void;
}) {
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [showManualExit, setShowManualExit] = useState(false);
  const [showMovementHistory, setShowMovementHistory] = useState(false);
  const [movementHistory, setMovementHistory] = useState<any[]>([]);
  const [movementHistoryLoading, setMovementHistoryLoading] = useState(false);
  const [movementHistoryError, setMovementHistoryError] = useState("");

  const color = CAT_DEFS[sku.categoria] || "#64748b";
  const faixaColor = FAIXA_COLOR[sku.faixa];
  const pct = sku.max > 0 ? Math.min(100, Math.round((sku.qtd / sku.max) * 100)) : 0;
  const minPct = sku.max > 0 ? Math.min(100, (sku.min / sku.max) * 100) : 0;

  const enderecoLabel = sku.enderecos.length
    ? sku.enderecos.length > 1
      ? `${sku.enderecos[0].code} +${sku.enderecos.length - 1}`
      : sku.enderecos[0].code
    : "—";

  const getColors = (type: string) => {
    if (type.includes("SAIDA") || type.includes("AJUSTE_NEGATIVO") || type.includes("BLOQUEIO")) {
      return { dot: "#EF4444", halo: "rgba(239,68,68,0.2)", qtyColor: "#EF4444", sign: "-" };
    }
    if (type.includes("RESERVA")) return { dot: "#F59E0B", halo: "rgba(245,158,11,0.2)", qtyColor: "#F59E0B", sign: "-" };
    if (type.includes("TRANSFERENCIA")) return { dot: "#3B82F6", halo: "rgba(59,130,246,0.2)", qtyColor: "#3B82F6", sign: "" };
    if (type.includes("AJUSTE_POSITIVO")) return { dot: "#8B5CF6", halo: "rgba(139,92,246,0.2)", qtyColor: "#8B5CF6", sign: "+" };
    return { dot: "#10B981", halo: "rgba(16,185,129,0.2)", qtyColor: "#10B981", sign: "+" };
  };

  const movementLabel = (type: string) => {
    if (type.includes("ENTRADA")) return "Entrada de estoque";
    if (type.includes("SAIDA")) return "Saída de estoque";
    if (type.includes("RESERVA")) return "Reserva de estoque";
    if (type.includes("AJUSTE_NEGATIVO")) return "Ajuste negativo";
    if (type.includes("AJUSTE_POSITIVO")) return "Ajuste positivo";
    if (type.includes("AJUSTE") || type.includes("INVENTARIO")) return "Ajuste de inventário";
    if (type.includes("TRANSFERENCIA")) return "Movimentação interna";
    return type;
  };

  const formatMovementDateTime = (value: string) => formatDateTimePtBr(value, "Data não informada");

  const loadMovementHistory = async () => {
    setMovementHistoryLoading(true);
    setMovementHistoryError("");

    try {
      const response = await fetch(`/api/estoque/movimentacoes?produtoId=${encodeURIComponent(sku.productId)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar o histórico do produto.");
      }

      setMovementHistory(Array.isArray(payload?.movements) ? payload.movements : []);
    } catch (error) {
      setMovementHistoryError(error instanceof Error ? error.message : "Não foi possível carregar o histórico do produto.");
    } finally {
      setMovementHistoryLoading(false);
    }
  };

  const openMovementHistory = () => {
    setShowMovementHistory(true);
    void loadMovementHistory();
  };

  const specs: { label: string; value: string; mono?: boolean }[] = [
    { label: "Depositante", value: sku.depositante || "—" },
    { label: "EAN / GTIN", value: sku.ean, mono: true },
    { label: "Categoria", value: sku.tamanho ? `${sku.categoria} · Tam. ${sku.tamanho}` : sku.categoria },
    { label: "Endereço", value: enderecoLabel, mono: true },
    { label: "Método de saída", value: sku.metodoRetirada || "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div onClick={onClose} className="absolute inset-0 overlay-anim" style={{ background: "rgba(6,10,20,0.55)", backdropFilter: "blur(3px)" }} />
      <div
        className="relative w-[460px] max-w-[92vw] h-full flex flex-col drawer-anim overflow-hidden shadow-[-24px_0_60px_rgba(0,0,0,0.35)]"
        style={{ background: t.drawerBg, borderLeft: `1px solid ${t.border}` }}
      >
        <div className="flex items-start gap-3.5 p-[20px_24px_16px] border-b" style={{ borderColor: t.border }}>
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
            style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}
          >
            {sku.imageUrl ? <img src={sku.imageUrl} alt={sku.productName} className="h-full w-full object-cover" /> : <Package className="h-7 w-7" style={{ color }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-[9px] py-0.5 text-[10.5px] font-extrabold"
                style={{ background: `${sku.ativo ? "#10B981" : "#94A3B8"}1a`, color: sku.ativo ? "#10B981" : "#94A3B8" }}
              >
                {sku.ativo ? "Ativo" : "Inativo"}
              </span>
              {sku.bloqueado && (
                <span className="inline-flex items-center rounded-full px-[9px] py-0.5 text-[10.5px] font-extrabold" style={{ background: "rgba(239,68,68,.14)", color: "#EF4444" }}>
                  Bloqueado
                </span>
              )}
            </div>
            <div className="mt-1.5 text-[16px] font-extrabold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: t.text }}>
              {sku.productName}
            </div>
            <div className="mt-[3px] font-[family-name:var(--font-jetbrains-mono)] text-[11.5px]" style={{ color: t.textSub }}>
              {sku.sku}
            </div>
          </div>
          <button onClick={onClose} className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border text-[15px]" style={{ borderColor: t.border, color: t.textSub, background: "transparent" }}>
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              ["Em estoque", sku.qtd, t.text],
              ["Reservado", sku.reservado, "#F59E0B"],
              ["Disponível", sku.disponivel, "#10B981"],
            ].map(([label, value, color2], bi) => (
              <div key={bi} className="rounded-xl border px-[10px] py-3 text-center" style={{ borderColor: t.border, background: t.inputBg }}>
                <div className="text-[22px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: color2 as string }}>
                  {(value as number).toLocaleString("pt-BR")}
                </div>
                <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: t.textSub }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border px-4 py-3.5 mb-4" style={{ borderColor: t.border, background: t.inputBg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12.5px] font-extrabold" style={{ color: faixaColor }}>
                {FAIXA_LABEL[sku.faixa]}
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px]" style={{ color: t.textSub }}>
                Min {sku.min} · Máx {sku.max}
              </span>
            </div>
            <div className="relative h-2">
              <div className="h-2 overflow-hidden rounded" style={{ background: t.barTrack }}>
                <div className="h-full" style={{ width: `${pct}%`, background: sku.faixa === "ideal" ? "linear-gradient(90deg,#3B82F6,#8B5CF6)" : faixaColor }} />
              </div>
              {sku.max > 0 && (
                <div className="absolute rounded" style={{ left: `calc(${minPct}% - 1.5px)`, top: -3, bottom: -3, width: 3, background: "#F59E0B", boxShadow: `0 0 0 2px ${t.inputBg}` }} />
              )}
            </div>
          </div>

          <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase mb-1" style={{ color: "#8B5CF6" }}>
            Ficha do produto
          </div>
          {specs.map((s, i) => (
            <div key={i} className="flex justify-between gap-3 py-[9px] border-b text-[13.5px]" style={{ borderColor: t.border }}>
              <span style={{ color: t.textSub }}>{s.label}</span>
              <span className={`font-semibold text-right ${s.mono ? "font-[family-name:var(--font-jetbrains-mono)]" : ""}`} style={{ color: t.text }}>
                {s.value}
              </span>
            </div>
          ))}

          {sku.enderecos.length > 0 && (
            <div className="mt-5">
              <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase mb-2.5" style={{ color: "#8B5CF6" }}>
                Distribuição por endereço ({sku.enderecos.length})
              </div>
              <div className="flex flex-col gap-2">
                {sku.enderecos.map((e, i) => {
                  const percentage = sku.qtd > 0 ? (e.qty / sku.qtd) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl border px-[14px] py-[11px]" style={{ borderColor: t.border, background: t.inputBg }}>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] max-w-[140px] truncate text-[13.5px] font-extrabold" style={{ color: t.text }} title={e.code}>
                        {e.code}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: t.barTrack }}>
                        <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: "linear-gradient(90deg,#3B82F6,#8B5CF6)" }} />
                      </div>
                      <span className="w-[60px] text-right text-[13px] font-extrabold" style={{ color: t.text }}>
                        {e.qty.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5">
            <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase mb-2.5" style={{ color: "#8B5CF6" }}>
              Lotes ({sku.lotes.length})
            </div>
            {sku.lotes.length > 0 ? (
              <div className="flex flex-col gap-2">
                {sku.lotes.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border px-[14px] py-[11px]" style={{ borderColor: t.border, background: t.inputBg }}>
                    <div className="min-w-0 flex-1">
                      <div className="font-[family-name:var(--font-jetbrains-mono)] text-[13.5px] font-extrabold" style={{ color: t.text }}>
                        {l.lote}
                      </div>
                      <div className="mt-0.5 text-[11.5px]" style={{ color: t.textSub }}>
                        {l.qtd.toLocaleString("pt-BR")} un
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: t.textSub }}>
                        Validade
                      </div>
                      <div className="font-[family-name:var(--font-jetbrains-mono)] mt-px text-[13.5px] font-extrabold" style={{ color: t.text }}>
                        {l.validade}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[12.5px] italic" style={{ color: t.textSub }}>
                Sem lote registrado.
              </div>
            )}
            <Link href="/configuracoes/produtos" className="mt-3.5 inline-block text-[12px]" style={{ color: "#A78BFA" }}>
              Ver produto no catálogo
            </Link>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={openMovementHistory}
              className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-bold cursor-pointer transition"
              style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6366F1")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
            >
              <History size={14} /> Ver movimentações
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="grid grid-cols-3 gap-2 border-t px-6 py-3.5" style={{ borderColor: t.border, background: t.drawerBg }}>
          <button
            onClick={() => setShowAdjustment(true)}
            className="flex h-[46px] items-center justify-center rounded-xl border text-[14px] font-bold cursor-pointer transition"
            style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            Ajustar
          </button>
          <button
            onClick={() => setShowTransfer(true)}
            className="flex h-[46px] items-center justify-center rounded-xl border text-[14px] font-bold cursor-pointer transition"
            style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            Transferir
          </button>
          <button
            onClick={() => setShowManualExit(true)}
            className="flex h-[46px] items-center justify-center rounded-xl border text-[14px] font-bold cursor-pointer"
            style={{ borderColor: "rgba(239,68,68,.45)", background: "rgba(239,68,68,.08)", color: "#EF4444" }}
          >
            Saída manual
          </button>
        </div>
      </div>

      {showMovementHistory && (
        <div
          onClick={() => setShowMovementHistory(false)}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 overlay-anim"
          style={{ background: "rgba(5,9,20,.68)", backdropFilter: "blur(5px)" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="movement-history-title"
            onClick={(event) => event.stopPropagation()}
            className="drawer-anim flex w-[min(760px,100%)] flex-col overflow-hidden rounded-[20px] border"
            style={{ maxHeight: "min(780px, calc(100vh - 32px))", borderColor: t.border, background: t.drawerBg, color: t.text, boxShadow: "0 28px 80px rgba(0,0,0,.38)" }}
          >
            <div className="flex items-center justify-between gap-4 border-b px-[22px] py-5" style={{ borderColor: t.border }}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px]" style={{ color: "#6366F1", background: "rgba(99,102,241,.12)" }}>
                  <History size={21} />
                </div>
                <div className="min-w-0">
                  <h2 id="movement-history-title" className="m-0 text-[18px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: t.text }}>
                    Histórico de movimentações
                  </h2>
                  <p className="mt-1 truncate text-[12px]" style={{ color: t.textSub }}>
                    {sku.productName} · SKU {sku.sku}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {!movementHistoryLoading && !movementHistoryError && (
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: "rgba(99,102,241,.12)", color: "#6366F1" }}>
                    {movementHistory.length} {movementHistory.length === 1 ? "registro" : "registros"}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Fechar histórico"
                  onClick={() => setShowMovementHistory(false)}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border cursor-pointer"
                  style={{ borderColor: t.border, background: t.cardBg, color: t.textSub }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-[22px] py-5">
              {movementHistoryLoading ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3" style={{ color: t.textSub }}>
                  <Loader2 size={30} className="animate-spin" style={{ color: "#6366F1" }} />
                  <span className="text-[13px] font-semibold">Carregando todas as movimentações...</span>
                </div>
              ) : movementHistoryError ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3.5 text-center">
                  <div className="max-w-[480px] rounded-xl border px-4 py-3.5 text-[13px] leading-relaxed" style={{ borderColor: "rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", color: "#EF4444" }}>
                    {movementHistoryError}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadMovementHistory()}
                    className="min-h-[40px] cursor-pointer rounded-[11px] border-none px-[17px] text-[13px] font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : movementHistory.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-2.5 text-center" style={{ color: t.textSub }}>
                  <History size={34} style={{ opacity: 0.55 }} />
                  <strong style={{ color: t.text }}>Nenhuma movimentação encontrada</strong>
                  <span className="text-[12px]">Este produto ainda não possui movimentações registradas.</span>
                </div>
              ) : (
                <div className="flex flex-col">
                  {movementHistory.map((movement, index) => {
                    const colors = getColors(movement.type);
                    return (
                      <div key={movement.id || `${movement.createdAt}-${index}`} className="grid gap-x-3" style={{ gridTemplateColumns: "24px minmax(0,1fr) auto", minHeight: 76 }}>
                        <div className="relative flex justify-center">
                          {index < movementHistory.length - 1 && <span className="absolute" style={{ top: 14, bottom: -7, width: 2, background: t.border }} />}
                          <span className="relative z-10 mt-[5px] h-3 w-3 rounded-full" style={{ background: colors.dot, boxShadow: `0 0 0 4px ${colors.halo}` }} />
                        </div>
                        <div className="flex min-w-0 flex-col gap-1 pb-[18px]">
                          <span className="text-[13.5px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: t.text }}>
                            {movementLabel(movement.type)}
                          </span>
                          <span className="text-[12px] leading-relaxed" style={{ color: t.textSub }}>
                            {formatMovementDateTime(movement.createdAt)} · {movement.observation || movement.reference || "Sem observação"}
                          </span>
                          <span className="text-[11.5px]" style={{ color: t.textSub }}>
                            Operador: {movement.operatorName || "Sistema"}
                          </span>
                        </div>
                        <span className="whitespace-nowrap pt-0.5 text-[13px] font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: colors.qtyColor }}>
                          {movement.type.includes("TRANSFERENCIA") ? "" : colors.sign}
                          {Number(movement.quantity || 0).toLocaleString("pt-BR")} un
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTransfer && (
        <StockTransferQuickModal
          sku={sku}
          allBalances={allBalances}
          allAddresses={allAddresses}
          t={t}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => {
            setShowTransfer(false);
            window.location.reload();
          }}
        />
      )}

      {showAdjustment && (
        <StockAdjustmentModal
          sku={sku}
          allBalances={allBalances}
          t={t}
          onClose={() => setShowAdjustment(false)}
          onSuccess={() => {
            setShowAdjustment(false);
            window.location.reload();
          }}
        />
      )}

      {showManualExit && (
        <StockManualExitModal
          sku={sku}
          allBalances={allBalances}
          t={t}
          onClose={() => setShowManualExit(false)}
          onSuccess={() => {
            setShowManualExit(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
