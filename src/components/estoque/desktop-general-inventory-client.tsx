"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, ClipboardList, PackageSearch, ScanLine, TriangleAlert, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { useLaserScannerInput } from "@/hooks/use-laser-scanner-input";
import { resolveGeneralInventoryScan } from "@/lib/general-inventory-scan";

type Item = {
  id: string;
  produtoId: string;
  nome: string;
  sku: string;
  codigoExterno: string | null;
  codigoInterno: string | null;
  codigoExternoPack: string | null;
  quantidadePorEmbalagem: number | null;
  imagemUrl: string | null;
  quantidadeSistema: number;
  quantidadeContada: number | null;
  divergencia: number;
  status: "PENDENTE" | "CONTADO" | "DIVERGENTE";
  atribuidoA: string | null;
  atribuidoNome: string | null;
  contadoPor: string | null;
  contadoEm: string | null;
  enderecos: string[];
};

type Participant = {
  userId: string;
  nome: string;
  iniciadoEm: string;
  ativo: boolean;
  itensContados: number;
};

type Detail = {
  id: string;
  depositante: string;
  dataOperacional: string;
  status: string;
  iniciadoEm: string;
  concluidoEm: string | null;
  totalItens: number;
  contados: number;
  pendentes: number;
  divergentes: number;
  zerados: number;
  aumentos: number;
  reducoes: number;
  itens: Item[];
  participantes: Participant[];
};

type Summary = { divergentes: number; zerados: number; aumentos: number; reducoes: number; ajustesAplicados: number };
type DraftEntry = { quantidade: number; final: boolean };
type FlashState = { type: "success" | "error" | "info"; message: string } | null;
type SurplusPromptState = { itemId: string; sku: string; quantidadeSistema: number; nextCount: number } | null;

const POLL_INTERVAL_MS = 10000;

async function readResponse(response: Response) {
  const text = await response.text();
  let body: { result?: Detail; summary?: Summary; error?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
  if (!response.ok) throw new Error(body.error ?? "Não foi possível concluir a operação.");
  return body;
}

/**
 * Equivalente desktop de GeneralInventoryClient (mobile), trocando a
 * câmera por um coletor a laser (useLaserScannerInput) e o overlay
 * full-screen por uma página normal -- reaproveita literalmente a mesma
 * API e a mesma lógica pura de decisão (resolveGeneralInventoryScan),
 * já que inventário geral é 1 linha por produto, sem a ambiguidade de
 * posição da contagem cíclica.
 */
export function DesktopGeneralInventoryClient({
  depositanteId,
  depositanteNome,
  currentUserId,
}: {
  depositanteId: string;
  depositanteNome: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [flash, setFlash] = useState<FlashState>(null);
  const [surplusPrompt, setSurplusPrompt] = useState<SurplusPromptState>(null);
  const [drafts, setDrafts] = useState<Map<string, DraftEntry>>(new Map());

  const scanBusyRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);
  const detailRef = useRef<Detail | null>(null);
  const activeRef = useRef({ activeItemId, activeCount });

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);
  useEffect(() => {
    activeRef.current = { activeItemId, activeCount };
  }, [activeItemId, activeCount]);
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  function showFlash(next: FlashState) {
    setFlash(next);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    if (next) flashTimerRef.current = window.setTimeout(() => setFlash(null), 3200);
  }

  const load = useCallback(async (url: string, init?: RequestInit) => {
    const body = await readResponse(
      await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }),
    );
    if (body.result) setDetail(body.result);
    return body;
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/estoque/inventarios-gerais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depositanteId }),
    })
      .then(readResponse)
      .then((body) => {
        if (alive && body.result) setDetail(body.result);
      })
      .catch((reason) => alive && setError(reason instanceof Error ? reason.message : "Não foi possível abrir o inventário."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [depositanteId]);

  // Pausado enquanto há um item ativo sendo contado -- sem isso, o poll
  // sobrescreveria o contador em tela por um valor desatualizado no meio
  // de uma bipagem (a contagem ao vivo mora só no estado local).
  useEffect(() => {
    if (!detail?.id || summary) return;
    const timer = window.setInterval(() => {
      if (activeRef.current.activeItemId) return;
      fetch(`/api/estoque/inventarios-gerais?id=${detail.id}`)
        .then(readResponse)
        .then((body) => body.result && setDetail(body.result))
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [detail?.id, summary]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return detail?.itens ?? [];
    return (detail?.itens ?? []).filter((item) =>
      [item.nome, item.sku, item.codigoExterno, item.codigoInterno, item.codigoExternoPack]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(term),
    );
  }, [detail, search]);

  const activeItem = detail?.itens.find((item) => item.id === activeItemId) ?? null;
  const progress = detail?.totalItens ? Math.round((detail.contados / detail.totalItens) * 100) : 0;

  const persistCount = useCallback(
    async (itemId: string, quantidade: number, isFinal: boolean) => {
      setDrafts((current) => new Map(current).set(itemId, { quantidade, final: isFinal }));
      try {
        await load(`/api/estoque/inventarios-gerais/${detailRef.current?.id}/itens/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantidade, final: isFinal }),
        });
        setDrafts((current) => {
          if (!current.has(itemId)) return current;
          const next = new Map(current);
          next.delete(itemId);
          return next;
        });
      } catch {
        // permanece em `drafts` -- ver retryDrafts().
      }
    },
    [load],
  );

  async function retryDrafts() {
    for (const [itemId, entry] of Array.from(drafts.entries())) {
      await persistCount(itemId, entry.quantidade, entry.final);
    }
  }

  async function markAsZero(item: Item) {
    if (!detail) return;
    if (!window.confirm(`Confirmar que "${item.nome}" não foi encontrado no estoque físico e marcar como 0 unidades?`)) return;
    setError(null);
    setSaving(true);
    try {
      await load(`/api/estoque/inventarios-gerais/${detail.id}/itens/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantidade: 0, final: true }),
      });
      if (activeItemId === item.id) {
        setActiveItemId(null);
        setActiveCount(0);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível marcar como zerado.");
    } finally {
      setSaving(false);
    }
  }

  async function releaseItem(item: Item) {
    if (!detail) return;
    setError(null);
    setSaving(true);
    try {
      await load(`/api/estoque/inventarios-gerais/${detail.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "liberar", itemId: item.id }),
      });
      if (activeItemId === item.id) {
        setActiveItemId(null);
        setActiveCount(0);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível liberar o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmInventory() {
    if (!detail || detail.pendentes > 0 || drafts.size > 0) return;
    setSaving(true);
    setError(null);
    try {
      const body = await readResponse(await fetch(`/api/estoque/inventarios-gerais/${detail.id}/confirmar`, { method: "POST" }));
      setSummary(body.summary ?? null);
      setDetail((current) => (current ? { ...current, status: "CONCLUIDO" } : current));
      setReview(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir o inventário.");
    } finally {
      setSaving(false);
    }
  }

  function finalizeActiveBelowThreshold() {
    if (!activeItem || activeCount <= 0 || activeCount >= activeItem.quantidadeSistema) return;
    const item = activeItem;
    const count = activeCount;
    void persistCount(item.id, count, true);
    showFlash({
      type: "success",
      message: `${item.sku}: contagem registrada (${count}/${item.quantidadeSistema}) — divergência registrada.`,
    });
    setActiveItemId(null);
    setActiveCount(0);
  }

  async function switchActiveItem(nextItem: Item, seededCount: number): Promise<boolean> {
    const previousId = activeRef.current.activeItemId;
    const previousCount = activeRef.current.activeCount;
    const previousItem = previousId ? detailRef.current?.itens.find((entry) => entry.id === previousId) ?? null : null;

    if (nextItem.status === "PENDENTE" && nextItem.atribuidoA !== currentUserId) {
      try {
        await load(`/api/estoque/inventarios-gerais/${detailRef.current?.id}`, {
          method: "POST",
          body: JSON.stringify({ action: "assumir", itemId: nextItem.id }),
        });
      } catch (reason) {
        showFlash({
          type: "error",
          message: reason instanceof Error ? reason.message : `${nextItem.sku}: este produto já está com outro operador.`,
        });
        return false;
      }
    }

    if (previousId && previousId !== nextItem.id && previousItem && previousCount > 0 && previousCount < previousItem.quantidadeSistema) {
      void persistCount(previousId, previousCount, false);
    }

    setActiveItemId(nextItem.id);
    setActiveCount(seededCount);
    return true;
  }

  function applyCount(item: Item, nextCount: number, complete: boolean) {
    setActiveCount(nextCount);
    if (complete) {
      showFlash({ type: "success", message: `${item.sku}: produto completo (${nextCount}/${item.quantidadeSistema}).` });
      void persistCount(item.id, nextCount, true);
    }
  }

  async function applyScan(rawValue: string) {
    const code = rawValue.trim();
    if (!code || scanBusyRef.current || surplusPrompt) return;
    const currentDetail = detailRef.current;
    if (!currentDetail) return;

    scanBusyRef.current = true;
    try {
      const decision = resolveGeneralInventoryScan(code, {
        items: currentDetail.itens,
        activeItemId: activeRef.current.activeItemId,
        activeCount: activeRef.current.activeCount,
        currentUserId,
      });

      if (decision.kind === "not-found") {
        playFeedbackTone("error");
        showFlash({ type: "error", message: `Código "${code}" não encontrado neste inventário.` });
        return;
      }

      if (decision.kind === "claimed-by-other") {
        playFeedbackTone("error");
        showFlash({ type: "error", message: `${decision.item.sku}: este produto já está com outro operador.` });
        return;
      }

      if (decision.kind === "surplus-prompt") {
        if (decision.switchingItem) {
          const switched = await switchActiveItem(decision.item, decision.seededCount);
          if (!switched) return;
        }
        playFeedbackTone("error");
        setSurplusPrompt({
          itemId: decision.item.id,
          sku: decision.item.sku,
          quantidadeSistema: decision.item.quantidadeSistema,
          nextCount: decision.seededCount + 1,
        });
        return;
      }

      playFeedbackTone("success");

      if (decision.kind === "switch-item") {
        const switched = await switchActiveItem(decision.item, decision.item.quantidadeContada ?? 0);
        if (!switched) return;
        applyCount(decision.item, decision.nextCount, decision.complete);
        return;
      }

      applyCount(decision.item, decision.nextCount, decision.complete);
    } finally {
      scanBusyRef.current = false;
    }
  }

  const { inputRef, value, setValue, handleKeyDown, focusInput, playFeedbackTone } = useLaserScannerInput({
    onScan: (code) => void applyScan(code),
    enabled: !surplusPrompt,
  });

  function confirmSurplus() {
    if (!surplusPrompt) return;
    const { itemId, sku, quantidadeSistema, nextCount } = surplusPrompt;
    setSurplusPrompt(null);
    setActiveCount(nextCount);
    void persistCount(itemId, nextCount, true);
    playFeedbackTone("success");
    showFlash({ type: "success", message: `${sku}: unidade extra registrada (${nextCount}/${quantidadeSistema}).` });
    focusInput();
  }

  function dismissSurplus() {
    setSurplusPrompt(null);
    playFeedbackTone("error");
    focusInput();
  }

  // Rascunho ao esconder a aba ou desmontar (troca de rota SPA não dispara
  // visibilitychange) -- nunca perder um tally parcial que só existia no
  // estado local do React.
  useEffect(() => {
    function flushActiveDraft() {
      const { activeItemId: id, activeCount: count } = activeRef.current;
      if (!id || count <= 0) return;
      const item = detailRef.current?.itens.find((entry) => entry.id === id);
      if (!item || item.status !== "PENDENTE" || count >= item.quantidadeSistema) return;
      void fetch(`/api/estoque/inventarios-gerais/${detailRef.current?.id}/itens/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade: count, final: false }),
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

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Abrindo inventário geral...
      </div>
    );
  }

  if (summary && detail) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CircleCheck className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Inventário concluído</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Os saldos divergentes foram ajustados e registrados no histórico do estoque.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={ClipboardList} label="Ajustes aplicados" value={String(summary.ajustesAplicados)} help="" />
          <StatCard icon={TriangleAlert} label="Divergências" value={String(summary.divergentes)} help="" />
          <StatCard icon={PackageSearch} label="Aumentos" value={String(summary.aumentos)} help="" />
          <StatCard icon={PackageSearch} label="Reduções" value={String(summary.reducoes)} help="" />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`/api/estoque/inventarios-gerais/${detail.id}/relatorio`}
            className="inline-flex h-[46px] items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            Baixar relatório
          </a>
          <Button type="button" variant="outline" onClick={() => router.push("/estoque/inventarios/geral")} className="h-[46px]">
            Voltar para depositantes
          </Button>
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        {error ?? "O inventário geral não retornou dados para este depositante."}
      </section>
    );
  }

  return (
    <div className="space-y-6" onClick={focusInput}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-950 dark:text-white">Inventário geral</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {depositanteNome} • somente hoje ({detail.dataOperacional})
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          EM CONTAGEM
        </span>
      </div>

      {detail.participantes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-white/[0.03]">
          <Users className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {detail.participantes.length === 1 ? "Contando sozinho:" : `Contando junto (${detail.participantes.length}):`}
          </span>
          {detail.participantes.map((p) => (
            <span
              key={p.userId}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 shadow-sm dark:bg-white/5 dark:text-slate-300"
              title={`${p.itensContados} produto(s) contado(s) por ${p.nome}`}
            >
              {p.nome}
              {p.itensContados > 0 && <span className="text-slate-400 dark:text-slate-500">· {p.itensContados}</span>}
            </span>
          ))}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Progresso" value={`${detail.contados}/${detail.totalItens}`} help={`${progress}% concluído`} />
        <StatCard icon={PackageSearch} label="Pendentes" value={String(detail.pendentes)} help="" />
        <StatCard icon={TriangleAlert} label="Divergências" value={String(detail.divergentes)} help="" />
        <StatCard icon={PackageSearch} label="Zerados" value={String(detail.zerados)} help="" />
      </section>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Bipagem contínua (coletor)</h2>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Bipe o SKU/código de barras de qualquer produto do inventário.
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

        {surplusPrompt ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
              <TriangleAlert className="h-4 w-4" />
              Confirmar unidade extra
            </div>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {surplusPrompt.sku}: esse produto já tem as {surplusPrompt.quantidadeSistema} unidades esperadas.
              Confirma mais 1 unidade ({surplusPrompt.nextCount} no total)?
            </p>
            <div className="mt-3 flex gap-3">
              <Button type="button" onClick={confirmSurplus} className="h-[42px]">
                <CircleCheck className="h-4 w-4" />
                Confirmar unidade extra
              </Button>
              <Button type="button" variant="outline" onClick={dismissSurplus} className="h-[42px]">
                <X className="h-4 w-4" />
                Foi engano, não contar
              </Button>
            </div>
          </div>
        ) : null}

        {activeItem ? (
          <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">Contando agora</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">
              {activeItem.sku} • {activeItem.nome}
            </p>
            <p className="mt-2 text-2xl font-bold text-violet-700 dark:text-violet-300">
              {activeCount} / {activeItem.quantidadeSistema}
            </p>
            {activeCount > 0 && activeCount < activeItem.quantidadeSistema ? (
              <div className="mt-3">
                <Button type="button" variant="outline" onClick={finalizeActiveBelowThreshold} className="h-[42px]">
                  Registrar como concluído com {activeCount} (produto tem menos)
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {drafts.size > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>
            {drafts.size} produto{drafts.size === 1 ? "" : "s"} com contagem não sincronizada.
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void retryDrafts();
            }}
            className="font-semibold underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Produtos ({filteredItems.length})</h2>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar produto..."
            className="h-[42px] w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </div>

        <div className="mt-4 space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-sm dark:bg-zinc-950/30 ${
                item.id === activeItemId ? "border-violet-300 dark:border-violet-500/40" : "border-slate-200 dark:border-zinc-800"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-white">
                  {item.sku} • {item.nome}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  sistema {item.quantidadeSistema}
                  {item.atribuidoNome
                    ? item.status === "PENDENTE"
                      ? ` • com ${item.atribuidoNome}`
                      : ` • contado por ${item.contadoPor ?? item.atribuidoNome}`
                    : ""}
                </p>
              </div>

              {item.status === "PENDENTE" ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(event) => {
                      event.stopPropagation();
                      void markAsZero(item);
                    }}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    Marcar zerado
                  </button>
                  {item.atribuidoA === currentUserId ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={(event) => {
                        event.stopPropagation();
                        void releaseItem(item);
                      }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      Liberar
                    </button>
                  ) : null}
                </div>
              ) : (
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    item.status === "DIVERGENTE" ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"
                  }`}
                >
                  {item.divergencia === 0 ? "OK" : `${item.divergencia > 0 ? "+" : ""}${item.divergencia}`}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
        onClick={(event) => event.stopPropagation()}
      >
        {!review ? (
          <Button
            type="button"
            disabled={detail.pendentes > 0 || saving || drafts.size > 0}
            onClick={() => setReview(true)}
            className="h-[46px] w-full"
          >
            {drafts.size > 0
              ? `Sincronizando ${drafts.size} produto${drafts.size === 1 ? "" : "s"}...`
              : detail.pendentes > 0
                ? `Faltam ${detail.pendentes} produtos`
                : "Revisar e confirmar inventário"}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ao confirmar: <strong className="text-slate-900 dark:text-white">{detail.divergentes} divergências</strong>,{" "}
              <strong className="text-slate-900 dark:text-white">{detail.zerados} produtos zerados</strong>. Os saldos serão
              ajustados e auditados.
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setReview(false)} className="h-[46px] flex-1">
                Voltar
              </Button>
              <Button type="button" disabled={saving} onClick={() => void confirmInventory()} className="h-[46px] flex-1">
                {saving ? "Confirmando..." : "Confirmar ajustes"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
