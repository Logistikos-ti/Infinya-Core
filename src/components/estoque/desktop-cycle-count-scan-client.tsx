"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, ScanLine, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLaserScannerInput } from "@/hooks/use-laser-scanner-input";
import {
  resolveCycleCountDesktopScan,
  type CycleCountDesktopScanItem,
  type CycleCountDesktopScanState,
} from "@/lib/cycle-count-desktop-scan";

export type DesktopCycleCountScanSourceItem = {
  id: string;
  sku: string;
  productName: string;
  codigoExterno: string | null;
  codigoInterno: string | null;
  codigoExternoPack: string | null;
  quantidadePorEmbalagem: number | null;
  endereco: string;
  area: string;
  systemQuantityRaw: number | null;
  countedQuantityRaw: number | null;
  status: string;
};

type Props = {
  cycleCountId: string;
  items: DesktopCycleCountScanSourceItem[];
};

type FlashState = { type: "success" | "error" | "info"; message: string } | null;
type SurplusPromptState = {
  item: CycleCountDesktopScanItem;
  switchingItem: boolean;
  seededCount: number;
} | null;

const POLL_INTERVAL_MS = 8000;

function toScanItem(item: DesktopCycleCountScanSourceItem): CycleCountDesktopScanItem {
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
  };
}

/**
 * Bipagem contínua para a primeira contagem da contagem cíclica desktop
 * (coletor a laser). Acumula localmente por item ativo -- zero rede por
 * bipe -- e só fala com o servidor ao completar um item, ao trocar de item
 * ativo com contagem parcial, ou ao esconder/desmontar a página (rascunho).
 * A segunda conferência (itens DIVERGENTE) continua manual via
 * CycleCountItemForm, fora deste componente.
 */
export function DesktopCycleCountScanClient({ cycleCountId, items: sourceItems }: Props) {
  const router = useRouter();
  const displayById = useMemo(
    () => new Map(sourceItems.map((item) => [item.id, item])),
    [sourceItems],
  );

  const [items, setItems] = useState<CycleCountDesktopScanItem[]>(() => sourceItems.map(toScanItem));
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingDisambiguation, setPendingDisambiguation] = useState<CycleCountDesktopScanItem[] | null>(null);
  const [surplusPrompt, setSurplusPrompt] = useState<SurplusPromptState>(null);
  const [flash, setFlash] = useState<FlashState>(null);
  const [pendingSaves, setPendingSaves] = useState(0);

  const scanBusyRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);
  const stateRef = useRef({ items, activeItemId, activeCount });

  useEffect(() => {
    stateRef.current = { items, activeItemId, activeCount };
  }, [items, activeItemId, activeCount]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  function showFlash(next: FlashState) {
    setFlash(next);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    if (next) {
      flashTimerRef.current = window.setTimeout(() => setFlash(null), 3200);
    }
  }

  async function persistCount(itemId: string, countedQuantity: number, options: { final: boolean }) {
    setPendingSaves((n) => n + 1);
    try {
      const response = await fetch(`/api/estoque/inventarios/itens/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countedQuantity,
          expectedStatus: "PENDENTE",
          final: options.final,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: { status: string };
      };

      if (!response.ok) {
        if (response.status === 409) {
          setItems((prev) =>
            prev.map((item) => (item.id === itemId ? { ...item, status: "CONTADO" } : item)),
          );
          if (stateRef.current.activeItemId === itemId) {
            setActiveItemId(null);
            setActiveCount(0);
          }
        }
        showFlash({
          type: "error",
          message: payload.error ?? "Não foi possível salvar a contagem deste item.",
        });
        return;
      }

      if (options.final && payload.result) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: payload.result!.status as CycleCountDesktopScanItem["status"],
                  quantidadeContada: countedQuantity,
                }
              : item,
          ),
        );
        router.refresh();
      } else {
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, quantidadeContada: countedQuantity } : item)),
        );
      }
    } catch {
      showFlash({ type: "error", message: "Falha de comunicação ao salvar a contagem." });
    } finally {
      setPendingSaves((n) => Math.max(0, n - 1));
    }
  }

  function applyScan(rawCode: string) {
    if (scanBusyRef.current || surplusPrompt) return;
    scanBusyRef.current = true;
    try {
      const state: CycleCountDesktopScanState = {
        items: stateRef.current.items,
        activeItemId: stateRef.current.activeItemId,
        activeCount: stateRef.current.activeCount,
        pendingDisambiguation,
      };
      const decision = resolveCycleCountDesktopScan(rawCode, state);

      if (decision.kind === "not-found") {
        playFeedbackTone("error");
        showFlash({ type: "error", message: `Código "${rawCode}" não encontrado ou já contado nesta contagem.` });
        return;
      }

      if (decision.kind === "disambiguation-no-match") {
        playFeedbackTone("error");
        showFlash({ type: "error", message: "Endereço não corresponde a nenhuma das posições pendentes." });
        return;
      }

      if (decision.kind === "disambiguate") {
        playFeedbackTone("success");
        setPendingDisambiguation(decision.candidates);
        showFlash({
          type: "info",
          message: `${decision.candidates.length} posições encontradas para este produto. Bipe o endereço para escolher.`,
        });
        return;
      }

      if (decision.kind === "surplus-prompt") {
        playFeedbackTone("error");
        setSurplusPrompt({ item: decision.item, switchingItem: decision.switchingItem, seededCount: decision.seededCount });
        return;
      }

      // decision.kind === "switch-item" | "increment"
      playFeedbackTone("success");
      setPendingDisambiguation(null);

      if (decision.kind === "switch-item") {
        const previousActiveId = stateRef.current.activeItemId;
        const previousActiveCount = stateRef.current.activeCount;
        if (previousActiveId && previousActiveId !== decision.item.id && previousActiveCount > 0) {
          void persistCount(previousActiveId, previousActiveCount, { final: false });
        }
      }

      setActiveItemId(decision.item.id);
      setActiveCount(decision.nextCount);

      if (decision.complete) {
        showFlash({ type: "success", message: `${decision.item.sku}: contagem completa (${decision.nextCount}).` });
        void persistCount(decision.item.id, decision.nextCount, { final: true });
      }
    } finally {
      scanBusyRef.current = false;
    }
  }

  const { inputRef, value, setValue, handleKeyDown, focusInput, playFeedbackTone } = useLaserScannerInput({
    onScan: applyScan,
    enabled: !surplusPrompt,
  });

  // Rascunho ao esconder a aba ou ao desmontar (troca de rota SPA não
  // dispara visibilitychange) -- nunca perder um tally parcial que só
  // existia no estado local do React.
  useEffect(() => {
    function flushActiveDraft() {
      const { activeItemId: id, activeCount: count, items: currentItems } = stateRef.current;
      if (!id || count <= 0) return;
      const item = currentItems.find((i) => i.id === id);
      if (!item || item.status !== "PENDENTE") return;
      void fetch(`/api/estoque/inventarios/itens/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQuantity: count, expectedStatus: "PENDENTE", final: false }),
        keepalive: true,
      }).catch(() => {});
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushActiveDraft();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushActiveDraft();
    };
  }, []);

  // Poll curto: outros operadores desktop na mesma contagem aparecem com
  // pouco atraso. Nunca sobrescreve o item que EU estou contando agora --
  // meu tally local é a fonte de verdade até eu persistir.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/estoque/inventarios/${cycleCountId}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { result?: { items: DesktopCycleCountScanSourceItem[] } };
        if (cancelled || !payload.result) return;

        const fresh = new Map(payload.result.items.map((item) => [item.id, toScanItem(item)]));
        const myActiveId = stateRef.current.activeItemId;

        setItems((prev) =>
          prev.map((item) => {
            const remote = fresh.get(item.id);
            if (!remote) return item;
            if (item.id === myActiveId) return { ...item, status: remote.status };
            return remote;
          }),
        );

        if (myActiveId) {
          const remoteActive = fresh.get(myActiveId);
          if (remoteActive && remoteActive.status !== "PENDENTE") {
            setActiveItemId(null);
            setActiveCount(0);
            showFlash({ type: "error", message: "O item que você estava contando foi fechado por outro operador." });
          }
        }
      } catch {
        // Best-effort: o próximo bipe continua funcionando com o estado local.
      }
    }

    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cycleCountId]);

  function confirmSurplus() {
    if (!surplusPrompt) return;
    const { item, seededCount, switchingItem } = surplusPrompt;
    const nextCount = seededCount + 1;

    if (switchingItem) {
      const previousActiveId = stateRef.current.activeItemId;
      const previousActiveCount = stateRef.current.activeCount;
      if (previousActiveId && previousActiveId !== item.id && previousActiveCount > 0) {
        void persistCount(previousActiveId, previousActiveCount, { final: false });
      }
    }

    setSurplusPrompt(null);
    setPendingDisambiguation(null);
    setActiveItemId(item.id);
    setActiveCount(nextCount);
    playFeedbackTone("success");
    showFlash({ type: "success", message: `Unidade extra registrada (${nextCount} no total).` });
    void persistCount(item.id, nextCount, { final: false });
    focusInput();
  }

  function dismissSurplus() {
    setSurplusPrompt(null);
    playFeedbackTone("error");
    focusInput();
  }

  function concludeActiveItem() {
    if (!activeItemId) return;
    const itemId = activeItemId;
    const count = activeCount;
    setActiveItemId(null);
    setActiveCount(0);
    void persistCount(itemId, count, { final: true });
    focusInput();
  }

  const activeItem = activeItemId ? items.find((item) => item.id === activeItemId) ?? null : null;
  const activeDisplay = activeItem ? displayById.get(activeItem.id) : null;
  const pendingCount = items.filter((item) => item.status === "PENDENTE").length;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
      onClick={focusInput}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Bipagem contínua (coletor)</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          {pendingCount} {pendingCount === 1 ? "item pendente" : "itens pendentes"}
          {pendingSaves > 0 ? " • salvando..." : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Bipe o SKU/código de barras do produto. Se o mesmo produto ocupar mais de uma posição, bipe o código do
        endereço em seguida para escolher qual está sendo contada.
      </p>

      <div className="mt-4">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Aguardando leitura do coletor..."
          className="h-[54px] w-full rounded-2xl border border-slate-200 bg-white px-4 font-mono text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] focus:border-violet-400 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.14)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </div>

      {flash ? (
        <div
          className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
            flash.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : flash.type === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                : "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
          }`}
        >
          {flash.message}
        </div>
      ) : null}

      {pendingDisambiguation ? (
        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
            Este produto está em {pendingDisambiguation.length} posições. Bipe o endereço ou escolha abaixo:
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {pendingDisambiguation.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  applyScan(candidate.enderecoCodigo);
                }}
                className="flex items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-sky-400 dark:border-sky-500/20 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <span className="font-mono">{candidate.enderecoCodigo}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {displayById.get(candidate.id)?.area ?? ""}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPendingDisambiguation(null);
            }}
            className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {surplusPrompt ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <TriangleAlert className="h-4 w-4" />
            Confirmar unidade extra
          </div>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {surplusPrompt.item.sku}: esse produto já tem as {surplusPrompt.item.quantidadeSistema} unidades
            esperadas. Confirma mais 1 unidade ({surplusPrompt.seededCount + 1} no total)?
          </p>
          <div className="mt-3 flex gap-3">
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                confirmSurplus();
              }}
              className="h-[42px]"
            >
              <CircleCheck className="h-4 w-4" />
              Confirmar unidade extra
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                dismissSurplus();
              }}
              className="h-[42px]"
            >
              <X className="h-4 w-4" />
              Foi engano, não contar
            </Button>
          </div>
        </div>
      ) : null}

      {activeItem && activeDisplay ? (
        <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Contando agora
          </p>
          <p className="mt-1 font-semibold text-slate-950 dark:text-white">
            {activeDisplay.sku} • {activeDisplay.productName}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {activeDisplay.endereco} • {activeDisplay.area}
          </p>
          <p className="mt-2 text-2xl font-bold text-violet-700 dark:text-violet-300">
            {activeCount}
            {activeItem.quantidadeSistema !== null ? ` / ${activeItem.quantidadeSistema}` : ""}
          </p>
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={(event) => { event.stopPropagation(); concludeActiveItem(); }} className="h-[42px]">
              Concluir contagem deste item
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
