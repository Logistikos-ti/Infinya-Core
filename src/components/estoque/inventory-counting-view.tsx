"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import type { InventoryRun } from "@/lib/inventory-runs";
import type { CycleCountDetail } from "@/lib/stock-cycle-counts";
import type { GeneralInventoryDetail, GeneralInventoryItem } from "@/lib/general-inventories";
import {
  resolveCycleCountDesktopScan,
  type CycleCountDesktopScanItem,
  type CycleCountDesktopScanState,
} from "@/lib/cycle-count-desktop-scan";
import { resolveGeneralInventoryScan, type GeneralInventoryScanState } from "@/lib/general-inventory-scan";
import { useLaserScannerInput } from "@/hooks/use-laser-scanner-input";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const manropeStyle: React.CSSProperties = { fontFamily: "var(--font-manrope), Manrope, sans-serif" };
const groteskStyle: React.CSSProperties = { fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" };
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

type BipEntry = { id: number; sku: string; nome: string; ok: boolean; time: string };
type ToastState = { id: number; msg: string; tone: "success" | "error" } | null;

function nowLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// CycleCountDesktopScanItem (do resolver puro) não carrega nome do produto --
// estende localmente só pra exibição, sem afetar a lógica de bipagem (o
// resolver só lê os campos que já conhece).
type CycleScanItemWithName = CycleCountDesktopScanItem & { productName: string };

function toCycleScanItem(item: CycleCountDetail["items"][number]): CycleScanItemWithName {
  return {
    id: item.id,
    sku: item.sku,
    codigoExterno: item.codigoExterno,
    codigoInterno: item.codigoInterno,
    codigoExternoPack: item.codigoExternoPack,
    quantidadePorEmbalagem: item.quantidadePorEmbalagem,
    enderecoCodigo: item.endereco,
    quantidadeSistema: item.systemQuantityRaw,
    quantidadeContada: item.countedQuantityRaw,
    status: item.status === "CONTADO" || item.status === "DIVERGENTE" ? item.status : "PENDENTE",
    productName: item.productName,
  };
}

// Vista comum pras duas fontes (contagem cíclica x inventário geral) --
// só pra render, nunca usada como fonte de verdade da lógica de bipagem
// (essa continua nos dois tipos originais, cada um com seu resolver puro).
type DisplayItem = {
  id: string;
  sku: string;
  nome: string;
  endereco: string;
  esperado: number | null;
  contado: number;
  status: "PENDENTE" | "CONTADO" | "DIVERGENTE";
};

export function InventoryCountingView({
  run,
  currentUserId,
  onBack,
  onFinished,
}: {
  run: InventoryRun;
  currentUserId: string;
  onBack: () => void;
  onFinished: () => void;
}) {
  const isGeneral = run.type === "GERAL";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cycleItems, setCycleItems] = useState<CycleScanItemWithName[] | null>(null);
  const [generalItems, setGeneralItems] = useState<GeneralInventoryItem[] | null>(null);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingDisambiguation, setPendingDisambiguation] = useState<CycleCountDesktopScanItem[] | null>(null);
  const [surplusPrompt, setSurplusPrompt] = useState<{ itemId: string; switchingItem: boolean; seededCount: number } | null>(null);
  const [bips, setBips] = useState<BipEntry[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmDivergence, setConfirmDivergence] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const toastTimerRef = useRef<number | null>(null);
  const stateRef = useRef({ cycleItems, generalItems, activeItemId, activeCount, pendingDisambiguation });

  useEffect(() => {
    stateRef.current = { cycleItems, generalItems, activeItemId, activeCount, pendingDisambiguation };
  }, [cycleItems, generalItems, activeItemId, activeCount, pendingDisambiguation]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const url = isGeneral ? `/api/estoque/inventarios-gerais/${run.id}` : `/api/estoque/inventarios/${run.id}`;
        const response = await fetch(url, { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as { error?: string; result?: unknown };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar a contagem.");
        if (cancelled) return;
        if (isGeneral) {
          const detail = payload.result as GeneralInventoryDetail;
          setGeneralItems(detail.itens);
        } else {
          const detail = payload.result as CycleCountDetail;
          setCycleItems(detail.items.map(toCycleScanItem));
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Falha ao carregar a contagem.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [run.id, isGeneral]);

  function showToast(msg: string, tone: "success" | "error") {
    setToast({ id: Date.now(), msg, tone });
    window.clearTimeout(toastTimerRef.current ?? undefined);
    toastTimerRef.current = window.setTimeout(() => setToast(null), tone === "success" ? 2200 : 4200);
  }

  async function persistCycle(itemId: string, countedQuantity: number, final: boolean) {
    try {
      const response = await fetch(`/api/estoque/inventarios/itens/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQuantity, expectedStatus: "PENDENTE", final }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; result?: { status: string } };
      if (!response.ok) {
        if (response.status === 409) {
          setCycleItems((prev) => prev?.map((it) => (it.id === itemId ? { ...it, status: "CONTADO" } : it)) ?? prev);
          if (stateRef.current.activeItemId === itemId) {
            setActiveItemId(null);
            setActiveCount(0);
          }
        }
        showToast(payload.error ?? "Não foi possível salvar a contagem deste item.", "error");
        return;
      }
      setCycleItems((prev) =>
        prev?.map((it) =>
          it.id === itemId
            ? { ...it, quantidadeContada: countedQuantity, status: final && payload.result ? (payload.result.status as CycleCountDesktopScanItem["status"]) : it.status }
            : it,
        ) ?? prev,
      );
    } catch {
      showToast("Falha de comunicação ao salvar a contagem.", "error");
    }
  }

  async function persistGeneral(itemId: string, quantidade: number, final: boolean) {
    try {
      const response = await fetch(`/api/estoque/inventarios-gerais/${run.id}/itens/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade, final }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; result?: GeneralInventoryDetail };
      if (!response.ok) {
        showToast(payload.error ?? "Não foi possível salvar a contagem deste item.", "error");
        return;
      }
      if (payload.result) setGeneralItems(payload.result.itens);
    } catch {
      showToast("Falha de comunicação ao salvar a contagem.", "error");
    }
  }

  function applyScan(rawCode: string) {
    if (surplusPrompt) return;
    const raw = rawCode.trim();
    if (!raw) return;

    if (isGeneral) {
      const items = stateRef.current.generalItems ?? [];
      const state: GeneralInventoryScanState<GeneralInventoryItem> = {
        items,
        activeItemId: stateRef.current.activeItemId,
        activeCount: stateRef.current.activeCount,
        currentUserId,
      };
      const decision = resolveGeneralInventoryScan(raw, state);

      if (decision.kind === "not-found") {
        playFeedbackTone("error");
        setBips((prev) => [{ id: Date.now(), sku: raw, nome: "SKU não encontrado neste inventário", ok: false, time: nowLabel() }, ...prev].slice(0, 40));
        showToast(`Código "${raw}" não encontrado.`, "error");
        return;
      }
      if (decision.kind === "claimed-by-other") {
        playFeedbackTone("error");
        showToast(`${decision.item.sku} já está sendo contado por ${decision.item.atribuidoNome ?? "outro operador"}.`, "error");
        return;
      }
      if (decision.kind === "surplus-prompt") {
        playFeedbackTone("error");
        setSurplusPrompt({ itemId: decision.item.id, switchingItem: decision.switchingItem, seededCount: decision.seededCount });
        return;
      }

      playFeedbackTone("success");
      if (decision.kind === "switch-item") {
        const prevId = stateRef.current.activeItemId;
        const prevCount = stateRef.current.activeCount;
        if (prevId && prevId !== decision.item.id && prevCount > 0) void persistGeneral(prevId, prevCount, false);
      }
      setActiveItemId(decision.item.id);
      setActiveCount(decision.nextCount);
      setBips((prev) => [{ id: Date.now(), sku: decision.item.sku, nome: decision.item.nome, ok: true, time: nowLabel() }, ...prev].slice(0, 40));
      if (decision.complete) {
        void persistGeneral(decision.item.id, decision.nextCount, true);
      } else {
        void persistGeneral(decision.item.id, decision.nextCount, false);
      }
      return;
    }

    const items = stateRef.current.cycleItems ?? [];
    const state: CycleCountDesktopScanState = {
      items,
      activeItemId: stateRef.current.activeItemId,
      activeCount: stateRef.current.activeCount,
      pendingDisambiguation: stateRef.current.pendingDisambiguation,
    };
    const decision = resolveCycleCountDesktopScan(raw, state);

    if (decision.kind === "not-found") {
      playFeedbackTone("error");
      setBips((prev) => [{ id: Date.now(), sku: raw, nome: "SKU não encontrado ou já contado", ok: false, time: nowLabel() }, ...prev].slice(0, 40));
      showToast(`Código "${raw}" não encontrado ou já contado nesta contagem.`, "error");
      return;
    }
    if (decision.kind === "disambiguation-no-match") {
      playFeedbackTone("error");
      showToast("Endereço não corresponde a nenhuma das posições pendentes.", "error");
      return;
    }
    if (decision.kind === "disambiguate") {
      playFeedbackTone("success");
      setPendingDisambiguation(decision.candidates);
      showToast(`${decision.candidates.length} posições encontradas. Bipe o endereço para escolher.`, "success");
      return;
    }
    if (decision.kind === "surplus-prompt") {
      playFeedbackTone("error");
      setSurplusPrompt({ itemId: decision.item.id, switchingItem: decision.switchingItem, seededCount: decision.seededCount });
      return;
    }

    playFeedbackTone("success");
    setPendingDisambiguation(null);
    if (decision.kind === "switch-item") {
      const prevId = stateRef.current.activeItemId;
      const prevCount = stateRef.current.activeCount;
      if (prevId && prevId !== decision.item.id && prevCount > 0) void persistCycle(prevId, prevCount, false);
    }
    setActiveItemId(decision.item.id);
    setActiveCount(decision.nextCount);
    const cycleItem = items.find((it) => it.id === decision.item.id);
    setBips((prev) => [{ id: Date.now(), sku: decision.item.sku, nome: cycleItem?.productName ?? decision.item.sku, ok: true, time: nowLabel() }, ...prev].slice(0, 40));
    if (decision.complete) void persistCycle(decision.item.id, decision.nextCount, true);
    else void persistCycle(decision.item.id, decision.nextCount, false);
  }

  function confirmSurplus() {
    if (!surplusPrompt) return;
    const { itemId, seededCount, switchingItem } = surplusPrompt;
    const nextCount = seededCount + 1;
    if (switchingItem) {
      const prevId = stateRef.current.activeItemId;
      const prevCount = stateRef.current.activeCount;
      if (prevId && prevId !== itemId && prevCount > 0) {
        if (isGeneral) void persistGeneral(prevId, prevCount, false);
        else void persistCycle(prevId, prevCount, false);
      }
    }
    setSurplusPrompt(null);
    setPendingDisambiguation(null);
    setActiveItemId(itemId);
    setActiveCount(nextCount);
    playFeedbackTone("success");
    showToast(`Unidade extra registrada (${nextCount} no total).`, "success");
    if (isGeneral) void persistGeneral(itemId, nextCount, false);
    else void persistCycle(itemId, nextCount, false);
    focusInput();
  }

  function dismissSurplus() {
    setSurplusPrompt(null);
    playFeedbackTone("error");
    focusInput();
  }

  const { inputRef, value, setValue, handleKeyDown, focusInput, playFeedbackTone } = useLaserScannerInput({
    onScan: applyScan,
    enabled: !surplusPrompt && !loading,
  });

  // Rascunho ao esconder a aba / desmontar -- nunca perder um tally parcial
  // que só existia no estado local.
  useEffect(() => {
    function flush() {
      const s = stateRef.current;
      if (!s.activeItemId || s.activeCount <= 0) return;
      if (isGeneral) {
        void fetch(`/api/estoque/inventarios-gerais/${run.id}/itens/${s.activeItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantidade: s.activeCount, final: false }),
          keepalive: true,
        }).catch(() => {});
      } else {
        const item = s.cycleItems?.find((i) => i.id === s.activeItemId);
        if (!item || item.status !== "PENDENTE") return;
        void fetch(`/api/estoque/inventarios/itens/${s.activeItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countedQuantity: s.activeCount, expectedStatus: "PENDENTE", final: false }),
          keepalive: true,
        }).catch(() => {});
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [run.id, isGeneral]);

  const displayItems: DisplayItem[] = useMemo(() => {
    if (isGeneral) {
      return (generalItems ?? []).map((i) => ({
        id: i.id,
        sku: i.sku,
        nome: i.nome,
        endereco: i.enderecos.join(", ") || "—",
        esperado: i.quantidadeSistema,
        contado: i.quantidadeContada ?? 0,
        status: i.status,
      }));
    }
    return (cycleItems ?? []).map((i) => ({
      id: i.id,
      sku: i.sku,
      nome: i.productName,
      endereco: i.enderecoCodigo,
      esperado: i.quantidadeSistema,
      contado: i.quantidadeContada ?? 0,
      status: i.status,
    }));
  }, [isGeneral, generalItems, cycleItems]);

  const activeItem = activeItemId ? displayItems.find((i) => i.id === activeItemId) ?? null : null;
  const conferidoTotal = displayItems.reduce((s, i) => s + i.contado, 0);
  const esperadoTotal = displayItems.reduce((s, i) => s + (i.esperado ?? 0), 0);
  const skusCompletos = displayItems.filter((i) => i.status !== "PENDENTE").length;
  const skusTotal = displayItems.length;
  const progressPct = esperadoTotal > 0 ? Math.round((conferidoTotal / esperadoTotal) * 100) : 0;
  const pendentesCount = displayItems.filter((i) => i.status === "PENDENTE").length;

  const label = isGeneral ? `${run.depositante} — Inventário geral` : `${run.depositante} — ${run.area}`;

  async function doFinalizarCiclico() {
    setIsFinishing(true);
    try {
      const response = await fetch("/api/estoque/inventarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "concluir", cycleCountId: run.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Não foi possível concluir a contagem.", "error");
        return;
      }
      showToast("Contagem encerrada.", "success");
      setTimeout(onFinished, 700);
    } catch {
      showToast("Falha de comunicação ao encerrar.", "error");
    } finally {
      setIsFinishing(false);
      setConfirmDivergence(false);
    }
  }

  async function doFinalizarGeral() {
    setIsFinishing(true);
    try {
      const response = await fetch(`/api/estoque/inventarios-gerais/${run.id}/confirmar`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Não foi possível concluir o inventário.", "error");
        return;
      }
      showToast("Inventário geral concluído e ajustes aplicados.", "success");
      setTimeout(onFinished, 700);
    } catch {
      showToast("Falha de comunicação ao encerrar.", "error");
    } finally {
      setIsFinishing(false);
    }
  }

  function onEncerrar() {
    setBlockedMessage(null);
    if (pendentesCount === 0) {
      if (isGeneral) void doFinalizarGeral();
      else void doFinalizarCiclico();
      return;
    }
    if (isGeneral) {
      // O RPC de finalização do inventário geral exige zero itens PENDENTE --
      // diferente do cíclico, aqui não dá pra "forçar" o encerramento.
      setBlockedMessage(`Ainda faltam ${pendentesCount} produto(s) contar antes de encerrar este inventário.`);
      return;
    }
    setConfirmDivergence(true);
  }

  async function doRestart() {
    setIsRestarting(true);
    try {
      const response = await fetch(`/api/estoque/inventarios/${run.id}/reiniciar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: isGeneral ? "GERAL" : "CICLICO" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Não foi possível reiniciar a contagem.", "error");
        return;
      }

      setActiveItemId(null);
      setActiveCount(0);
      setPendingDisambiguation(null);
      setBips([]);
      setConfirmRestart(false);

      // Recarrega os itens do zero em vez de reconstruir o reset em memória --
      // garante que a tela reflita exatamente o que o servidor gravou.
      const detailUrl = isGeneral ? `/api/estoque/inventarios-gerais/${run.id}` : `/api/estoque/inventarios/${run.id}`;
      const detailResponse = await fetch(detailUrl, { cache: "no-store" });
      const detailPayload = (await detailResponse.json().catch(() => ({}))) as { result?: unknown };
      if (detailResponse.ok && detailPayload.result) {
        if (isGeneral) {
          setGeneralItems((detailPayload.result as GeneralInventoryDetail).itens);
        } else {
          setCycleItems((detailPayload.result as CycleCountDetail).items.map(toCycleScanItem));
        }
      }

      showToast("Contagem reiniciada.", "success");
    } catch {
      showToast("Falha de comunicação ao reiniciar.", "error");
    } finally {
      setIsRestarting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={manropeStyle}>
        <MobileButtonSpinner size={28} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3" style={manropeStyle}>
        <p className={`text-sm ${tokenTextSub}`}>{loadError}</p>
        <button type="button" onClick={onBack} className={`text-sm font-bold ${tokenText}`}>
          ‹ Voltar à lista
        </button>
      </div>
    );
  }

  const divergentesParaModal = pendentesCount > 0 ? displayItems.filter((i) => i.status === "PENDENTE") : [];

  return (
    <div className="flex h-full flex-col overflow-hidden" style={manropeStyle}>
      <style>{`@keyframes pulseDot { 0%,100% { opacity:1 } 50% { opacity:.35 } }`}</style>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-4 px-5 pb-4 pt-5 sm:px-8">
        <button
          type="button"
          onClick={onBack}
          title="Voltar à lista"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
        </button>
        <div className={`h-5 w-px ${tokenBorder} border-l`} />
        <div className="flex flex-col">
          <span className={`text-[12px] font-semibold ${tokenTextSub} ${MONO}`}>{run.id.slice(0, 8).toUpperCase()}</span>
          <span className={`text-[14.5px] font-bold ${tokenText}`}>{label}</span>
        </div>
        <div className="flex-1" />
        <div className={`flex h-[42px] items-center gap-2.5 rounded-[11px] border px-[18px] ${tokenBorder} ${tokenInputBg}`}>
          <span className="h-2 w-2 rounded-full bg-[#F59E0B]" style={{ animation: "pulseDot 1.4s ease-in-out infinite" }} />
          <span className={`text-[13.5px] font-bold ${tokenText}`}>Em contagem</span>
        </div>
        <button
          type="button"
          onClick={() => setConfirmRestart(true)}
          className={`flex h-[42px] items-center justify-center rounded-[11px] border px-[18px] text-[13.5px] font-bold transition hover:[filter:brightness(1.06)] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={onEncerrar}
          disabled={isFinishing}
          className="flex h-[42px] items-center gap-2 rounded-[11px] px-[18px] text-[13.5px] font-extrabold disabled:opacity-60"
          style={{ background: "linear-gradient(92deg,#10B981,#059669)", color: "#FFFFFF" }}
        >
          {isFinishing ? <MobileButtonSpinner size={16} /> : null}
          Encerrar contagem
        </button>
      </div>

      {blockedMessage ? (
        <div className="mx-5 mb-3 flex-shrink-0 rounded-xl px-4 py-2.5 text-sm sm:mx-8" style={{ background: "rgba(245,158,11,.14)", color: "#F59E0B" }}>
          {blockedMessage}
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-[18px] overflow-hidden px-5 pb-5 sm:px-8 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col gap-4">
          <div className={`flex flex-col gap-3.5 rounded-2xl border p-5 ${tokenBorder} ${tokenCardBg}`}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M7 8v8M11 8v8M15 8v8M19 8v8" />
                </svg>
              </div>
              <div>
                <div className="text-[18px] font-bold" style={groteskStyle}>
                  Bipar produto
                </div>
                <div className={`text-[12.5px] ${tokenTextSub}`}>
                  {isGeneral ? `${skusTotal} produto(s) neste inventário` : `${skusTotal} posição(ões) nesta contagem`}
                </div>
              </div>
            </div>
            <div
              className={`flex h-14 items-center gap-0 rounded-2xl border-2 pl-5 pr-1 ${tokenInputBg}`}
              style={{ borderColor: "rgba(139,92,246,.35)" }}
            >
              <span className={`mr-3 text-[16px] ${tokenTextSub}`}>⌗</span>
              <input
                ref={inputRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Bipe aqui ou digite o SKU..."
                className={`h-full flex-1 border-none bg-transparent text-[16px] font-semibold outline-none ${tokenText} ${MONO}`}
              />
              <button
                type="button"
                onClick={() => {
                  applyScan(value);
                  setValue("");
                }}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
            </div>

            {pendingDisambiguation ? (
              <div className="rounded-xl border p-3.5" style={{ borderColor: "rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)" }}>
                <p className={`text-[12.5px] font-semibold ${tokenText}`}>
                  Este produto está em {pendingDisambiguation.length} posições. Bipe o endereço ou escolha abaixo:
                </p>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {pendingDisambiguation.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => applyScan(candidate.enderecoCodigo)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[12.5px] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                    >
                      <span className={MONO}>{candidate.enderecoCodigo}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {surplusPrompt ? (
              <div className="rounded-xl border p-3.5" style={{ borderColor: "rgba(245,158,11,.35)", background: "rgba(245,158,11,.1)" }}>
                <p className="text-[12.5px] font-bold" style={{ color: "#F59E0B" }}>
                  Confirmar unidade extra
                </p>
                <p className={`mt-1 text-[12px] ${tokenTextSub}`}>
                  Este produto já bateu a quantidade esperada. Confirma mais 1 unidade ({surplusPrompt.seededCount + 1} no total)?
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmSurplus}
                    className="h-9 rounded-lg px-3.5 text-[12.5px] font-bold text-white"
                    style={{ background: "#F59E0B" }}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={dismissSurplus}
                    className={`h-9 rounded-lg border px-3.5 text-[12.5px] font-bold ${tokenBorder} ${tokenText}`}
                  >
                    Foi engano
                  </button>
                </div>
              </div>
            ) : null}

            {activeItem ? (
              <div className={`rounded-xl border p-3 text-[12.5px] ${tokenBorder} ${tokenInputBg}`}>
                <span className={tokenTextSub}>Contando agora: </span>
                <span className={`font-bold ${tokenText}`}>{activeItem.nome}</span>
                <span className={`ml-2 font-bold ${MONO}`} style={{ color: "#8B5CF6" }}>
                  {activeCount}
                  {activeItem.esperado !== null ? ` / ${activeItem.esperado}` : ""}
                </span>
              </div>
            ) : null}
          </div>

          <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
            <div className={`flex items-center justify-between border-b px-5 py-3.5 ${tokenBorder}`}>
              <span className={`text-[14px] font-bold ${tokenText}`} style={groteskStyle}>
                Histórico de bips
              </span>
              <span className={`text-[12px] ${tokenTextSub} ${MONO}`}>{bips.length} bips</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {bips.length ? (
                bips.slice(0, 20).map((b, i) => (
                  <div key={b.id} className={`flex items-center gap-2.5 px-1.5 py-2.5 ${i === 0 ? "" : `border-t ${tokenBorder}`}`}>
                    <span
                      className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
                      style={{ background: b.ok ? "rgba(16,185,129,.14)" : "rgba(239,68,68,.14)", color: b.ok ? "#10B981" : "#EF4444" }}
                    >
                      {b.ok ? "✓" : "!"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12px] font-bold ${tokenText} ${MONO}`}>{b.sku}</div>
                      <div className={`truncate text-[12px] ${b.ok ? tokenTextSub : ""}`} style={!b.ok ? { color: "#EF4444" } : undefined}>
                        {b.nome}
                      </div>
                    </div>
                    <span className={`text-[11px] ${tokenTextSub} ${MONO}`}>{b.time}</span>
                  </div>
                ))
              ) : (
                <p className={`py-8 text-center text-[13px] italic ${tokenTextSub}`}>Nenhum bip ainda</p>
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <div className={`flex-shrink-0 rounded-2xl border p-5 ${tokenBorder} ${tokenCardBg}`}>
            <div className="mb-3 flex items-baseline justify-between">
              <span className={`text-[12px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`} style={groteskStyle}>
                Progresso
              </span>
              <span className={`text-[32px] font-extrabold ${tokenText}`} style={groteskStyle}>
                {progressPct}
                <span className={`text-[16px] ${tokenTextSub}`}>%</span>
              </span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${tokenInputBg}`}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, progressPct)}%`, background: "linear-gradient(90deg,#3B82F6,#8B5CF6)" }}
              />
            </div>
            <div className="mt-3 flex justify-between text-[12.5px]">
              <span className={tokenTextSub}>
                <b className={tokenText}>{conferidoTotal}</b> / {esperadoTotal} unidades
              </span>
              <span className={tokenTextSub}>
                <b className={tokenText}>{skusCompletos}</b> / {skusTotal} SKUs
              </span>
            </div>
          </div>

          <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
            <div className={`border-b px-5 py-3.5 ${tokenBorder}`}>
              <span className={`text-[14px] font-bold ${tokenText}`} style={groteskStyle}>
                Itens esperados
              </span>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">
              {displayItems.map((item, i) => {
                const complete = item.status !== "PENDENTE";
                const pct = item.esperado ? Math.round((item.contado / item.esperado) * 100) : complete ? 100 : 0;
                const color = complete ? "#10B981" : item.contado > 0 ? "#8B5CF6" : undefined;
                return (
                  <div key={item.id} className={`flex flex-col gap-2 px-5 py-3.5 ${i === 0 ? "" : `border-t ${tokenBorder}`}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-[13.5px] font-bold ${tokenText}`}>{item.nome}</div>
                        <div className={`text-[11px] ${tokenTextSub} ${MONO}`}>
                          {item.sku} · {item.endereco}
                        </div>
                      </div>
                      <span className={`whitespace-nowrap text-[15px] font-extrabold ${MONO}`} style={{ color }}>
                        <span className={color ? "" : tokenText}>{item.contado}</span>
                        {item.esperado !== null ? ` / ${item.esperado}` : ""}
                      </span>
                      {complete ? (
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#10B981] text-[12px] font-extrabold text-white">
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <div className={`h-1.5 overflow-hidden rounded ${tokenInputBg}`}>
                      <div
                        className="h-full transition-all"
                        style={{ width: `${Math.min(100, pct)}%`, background: complete ? "#10B981" : "linear-gradient(90deg,#3B82F6,#8B5CF6)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {confirmDivergence ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
          <div className="absolute inset-0 backdrop-blur-[5px]" style={{ background: "rgba(3,7,20,.55)" }} onClick={() => setConfirmDivergence(false)} />
          <div
            className={`relative flex max-h-[85vh] w-[560px] max-w-[96vw] flex-col rounded-2xl border shadow-[0_30px_60px_rgba(0,0,0,0.35)] ${tokenCardBg}`}
            style={{ borderColor: "rgba(245,158,11,.35)" }}
          >
            <div className={`flex gap-3.5 border-b px-6 pb-3.5 pt-[22px] ${tokenBorder}`}>
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(245,158,11,.14)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 1 21h22L12 2z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[10px] font-bold tracking-[0.28em] text-[#F59E0B]" style={groteskStyle}>
                  ATENÇÃO
                </div>
                <h3 className={`m-0 text-[19px] font-bold ${tokenText}`} style={groteskStyle}>
                  Encerrar com divergência?
                </h3>
                <p className={`mt-1.5 text-[13px] leading-[1.5] ${tokenTextSub}`}>
                  A contagem será fechada com itens faltando. As divergências abaixo serão registradas no histórico.
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3.5">
              <div className={`mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] ${tokenTextSub}`}>
                Divergências ({divergentesParaModal.length} SKUs)
              </div>
              <div className="flex flex-col gap-2">
                {divergentesParaModal.map((item) => (
                  <div key={item.id} className={`flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 ${tokenBorder} ${tokenInputBg}`}>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[13px] font-bold ${tokenText}`}>{item.nome}</div>
                      <div className={`text-[11px] ${tokenTextSub} ${MONO}`}>{item.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[14px] font-extrabold text-[#EF4444] ${MONO}`}>−{(item.esperado ?? 0) - item.contado}</div>
                      <div className={`text-[11px] ${tokenTextSub} ${MONO}`}>
                        {item.contado} / {item.esperado ?? "?"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`flex justify-center gap-2.5 border-t px-6 pb-[18px] pt-3.5 ${tokenBorder}`}>
              <button
                type="button"
                onClick={() => setConfirmDivergence(false)}
                className={`flex h-[42px] items-center justify-center rounded-[10px] border px-5 text-[13.5px] font-bold transition hover:[filter:brightness(1.06)] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Continuar contagem
              </button>
              <button
                type="button"
                onClick={doFinalizarCiclico}
                disabled={isFinishing}
                className="flex h-[42px] items-center justify-center gap-2 rounded-[10px] px-[22px] text-[13.5px] font-extrabold text-white transition enabled:hover:[filter:brightness(1.06)] disabled:opacity-40"
                style={{ background: "linear-gradient(92deg,#F59E0B,#EF4444)", border: 0 }}
              >
                {isFinishing ? <MobileButtonSpinner size={18} /> : "Encerrar com divergência"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRestart ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
          <div className="absolute inset-0 backdrop-blur-[5px]" style={{ background: "rgba(3,7,20,.55)" }} onClick={() => setConfirmRestart(false)} />
          <div
            className={`relative flex w-[460px] max-w-[96vw] flex-col rounded-2xl border shadow-[0_30px_60px_rgba(0,0,0,0.35)] ${tokenCardBg}`}
            style={{ borderColor: "rgba(245,158,11,.35)" }}
          >
            <div className={`flex gap-3.5 border-b px-6 pb-3.5 pt-[22px] ${tokenBorder}`}>
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(245,158,11,.14)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 1 3 6.7" />
                  <path d="M3 16v-4h4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[10px] font-bold tracking-[0.28em] text-[#F59E0B]" style={groteskStyle}>
                  ATENÇÃO
                </div>
                <h3 className={`m-0 text-[19px] font-bold ${tokenText}`} style={groteskStyle}>
                  Reiniciar esta contagem?
                </h3>
                <p className={`mt-1.5 text-[13px] leading-[1.5] ${tokenTextSub}`}>
                  Todos os itens voltam a PENDENTE — contagens e divergências já registradas serão apagadas.
                  {isGeneral
                    ? " Nenhum ajuste de estoque foi aplicado ainda, então nada precisa ser estornado."
                    : " Se algum item já fechou com divergência e ajustou o estoque de verdade, esse ajuste será estornado automaticamente."}
                </p>
              </div>
            </div>
            <div className={`flex justify-center gap-2.5 px-6 pb-[22px] pt-[18px]`}>
              <button
                type="button"
                onClick={() => setConfirmRestart(false)}
                className={`flex h-[42px] items-center justify-center rounded-[10px] border px-5 text-[13.5px] font-bold transition hover:[filter:brightness(1.06)] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doRestart}
                disabled={isRestarting}
                className="flex h-[42px] items-center justify-center gap-2 rounded-[10px] px-[22px] text-[13.5px] font-extrabold text-white transition enabled:hover:[filter:brightness(1.06)] disabled:opacity-40"
                style={{ background: "linear-gradient(92deg,#F59E0B,#EF4444)", border: 0 }}
              >
                {isRestarting ? <MobileButtonSpinner size={18} /> : "Reiniciar contagem"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-[80] flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold shadow-lg ${tokenCardBg} ${tokenText}`}
          style={{ borderColor: toast.tone === "success" ? "rgba(139,92,246,.4)" : "rgba(239,68,68,.4)" }}
        >
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: toast.tone === "success" ? "#8B5CF6" : "#EF4444" }} />
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}
