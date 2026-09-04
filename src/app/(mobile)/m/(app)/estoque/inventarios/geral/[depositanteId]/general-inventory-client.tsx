"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import {
  MobileBackButton,
  MobileButtonSpinner,
  MobileFullScreenLoader,
  MobileIcon,
  MobilePrimaryButton,
  MobileScanConfirmPrompt,
  MobileScanOverlay,
  hexAlpha,
  headingFont,
  mobileColors,
  mobileGradient,
  type ScanConfirmPromptState,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";
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

/** Rascunho ainda não sincronizado com o servidor (ver persistCount). */
type DraftEntry = { quantidade: number; final: boolean };

const FLASH_DURATION_MS = 1300;

async function readResponse(response: Response) {
  const text = await response.text();
  let body: { result?: Detail; summary?: Summary; error?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
  if (!response.ok) throw new Error(body.error ?? "Não foi possivel concluir a operação.");
  return body;
}

const cardStyle = {
  border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
  borderRadius: 18,
  background: hexAlpha("#94A3B8", 0.045),
};

export function GeneralInventoryClient({
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

  // Bipagem contínua: a câmera fica aberta a sessão toda de contagem. Cada
  // bipe roda resolveGeneralInventoryScan (lógica pura, testada em
  // tests/unit/general-inventory-scan.test.ts) para decidir se troca de item
  // ativo, incrementa a contagem local, ou pede confirmação de excedente.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [confirmPrompt, setConfirmPrompt] = useState<ScanConfirmPromptState>(null);
  // Borda verde pulsante no quadro para unidades intermediárias, sem tirar o
  // operador da câmera (igual ao recebimento).
  const [framePulse, setFramePulse] = useState(false);
  // Contagens já enviadas ao servidor mas ainda não confirmadas (falha de
  // rede) ou registradas como rascunho (produto trocado/câmera fechada antes
  // de completar). Bloqueia "Revisar e confirmar" até esvaziar.
  const [drafts, setDrafts] = useState<Map<string, DraftEntry>>(new Map());

  const scanBusyRef = useRef(false);
  const overlayTimerRef = useRef<number | null>(null);
  const framePulseTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const detailRef = useRef<Detail | null>(null);
  const pendingSurplusRef = useRef<{ itemId: string; nextCount: number } | null>(null);
  const flushDraftOnHideRef = useRef<() => void>(() => {});

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const load = async (url: string, init?: RequestInit) => {
    const body = await readResponse(await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }));
    if (body.result) setDetail(body.result);
    return body;
  };

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
      .catch((reason) => alive && setError(reason instanceof Error ? reason.message : "Não foi possivel abrir o inventário."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [depositanteId]);

  // Pausado enquanto a câmera está aberta: sem isso, o poll trocaria o
  // contador exibido em tela por um valor desatualizado no meio de uma
  // sessão de bipagem (a contagem ao vivo mora só no estado local).
  useEffect(() => {
    if (!detail?.id || summary || scannerOpen) return;
    const timer = window.setInterval(() => {
      fetch(`/api/estoque/inventarios-gerais?id=${detail.id}`)
        .then(readResponse)
        .then((body) => body.result && setDetail(body.result))
        .catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [detail?.id, summary, scannerOpen]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return detail?.itens ?? [];
    return (detail?.itens ?? []).filter((item) => [item.nome, item.sku, item.codigoExterno, item.codigoInterno, item.codigoExternoPack].filter(Boolean).join(" ").toLocaleLowerCase().includes(term));
  }, [detail, search]);

  const activeItem = detail?.itens.find((item) => item.id === activeItemId) ?? null;
  const progress = detail?.totalItens ? Math.round((detail.contados / detail.totalItens) * 100) : 0;

  /** Marca um produto como fisicamente inexistente (0 unidades) sem precisar bipar. */
  const markAsZero = async (item: Item) => {
    if (!detail) return;
    if (!window.confirm(`Confirmar que "${item.nome}" não foi encontrado no estoque físico e marcar como 0 unidades?`)) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await load(`/api/estoque/inventarios-gerais/${detail.id}/itens/${item.id}`, { method: "PATCH", body: JSON.stringify({ quantidade: 0, final: true }) });
      if (activeItemId === item.id) {
        setActiveItemId(null);
        setActiveCount(0);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível marcar como zerado.");
    } finally {
      setSaving(false);
    }
  };

  /** Reverte um "assumir" acidental (bipe do produto errado) para o próprio claim. */
  const releaseItem = async (item: Item) => {
    if (!detail) return;
    setError(null);
    setSaving(true);
    try {
      await load(`/api/estoque/inventarios-gerais/${detail.id}`, { method: "POST", body: JSON.stringify({ action: "liberar", itemId: item.id }) });
      if (activeItemId === item.id) {
        setActiveItemId(null);
        setActiveCount(0);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível liberar o produto.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Persiste uma contagem. final=false grava só quantidade_contada (o item
   * continua PENDENTE) -- usado para rascunhos ao trocar de produto ou
   * esconder a aba, nunca fecha o item como divergente por engano. Em
   * qualquer falha o item permanece em `drafts` para retentativa (ver
   * retryDrafts e o banner de sincronização).
   */
  const persistCount = useCallback(async (itemId: string, quantidade: number, isFinal: boolean) => {
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
  }, []);

  async function retryDrafts() {
    for (const [itemId, entry] of Array.from(drafts.entries())) {
      await persistCount(itemId, entry.quantidade, entry.final);
    }
  }

  const confirm = async () => {
    if (!detail || detail.pendentes > 0 || drafts.size > 0) return;
    setSaving(true);
    setError(null);
    try {
      const body = await readResponse(await fetch(`/api/estoque/inventarios-gerais/${detail.id}/confirmar`, { method: "POST" }));
      setSummary(body.summary ?? null);
      setDetail((current) => current ? { ...current, status: "CONCLUIDO" } : current);
      setReview(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possivel concluir o inventário.");
    } finally {
      setSaving(false);
    }
  };

  function unlockAudio() {
    if (typeof window === "undefined") return;
    const AudioContextRef =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextRef();
    if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
  }

  function playFeedback(feedbackType: "ok" | "err") {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(feedbackType === "ok" ? 60 : [70, 60, 70]);
    }
    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    const beep = (freq: number, wave: OscillatorType, startTime: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = freq;
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    const now = context.currentTime;
    if (feedbackType === "ok") {
      beep(880, "sine", now, 0.12);
    } else {
      beep(220, "square", now, 0.1);
      beep(180, "square", now + 0.14, 0.12);
    }
  }

  function flash(next: ScanOverlayState) {
    setOverlay(next);
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), FLASH_DURATION_MS);
    if (next) playFeedback(next.type === "err" ? "err" : "ok");
  }

  /** Confirma uma unidade intermediária: borda verde + beep, câmera não sai da tela. */
  function pulseFrame() {
    playFeedback("ok");
    setFramePulse(true);
    if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
    framePulseTimerRef.current = window.setTimeout(() => setFramePulse(false), 420);
  }

  function openScanner() {
    unlockAudio();
    setError(null);
    setScannerOpen(true);
  }

  function closeScanner() {
    if (activeItem && activeCount > 0 && activeCount < activeItem.quantidadeSistema) {
      void persistCount(activeItem.id, activeCount, false);
    }
    stopCamera(null);
    setScannerOpen(false);
    setActiveItemId(null);
    setActiveCount(0);
    setConfirmPrompt(null);
    pendingSurplusRef.current = null;
  }

  /**
   * Explica ao operador que o produto realmente tem menos do que o
   * esperado -- sem isso, bipagem pura não teria como expressar "contei e é
   * isso mesmo, está divergente" (diferente do recebimento, que fecha essa
   * decisão uma vez por pedido inteiro via "Concluir com divergência"; aqui
   * cada produto pode precisar dessa decisão individualmente).
   */
  function finalizeActiveBelowThreshold() {
    if (!activeItem || activeCount <= 0 || activeCount >= activeItem.quantidadeSistema) return;
    const item = activeItem;
    const count = activeCount;
    void persistCount(item.id, count, true);
    flash({ type: "ok", title: "Contagem registrada", code: item.sku, sub: `${count}/${item.quantidadeSistema} — divergência registrada.` });
    setActiveItemId(null);
    setActiveCount(0);
  }

  /** Reivindica o próximo item (se ainda PENDENTE), persiste o anterior como
   * rascunho se ele não tiver sido finalizado, e troca o foco da câmera. */
  async function switchActiveItem(nextItem: Item, seededCount: number): Promise<boolean> {
    const previousId = activeItemId;
    const previousCount = activeCount;
    const previousItem = previousId ? detailRef.current?.itens.find((entry) => entry.id === previousId) ?? null : null;

    if (nextItem.status === "PENDENTE" && nextItem.atribuidoA !== currentUserId) {
      try {
        await load(`/api/estoque/inventarios-gerais/${detailRef.current?.id}`, {
          method: "POST",
          body: JSON.stringify({ action: "assumir", itemId: nextItem.id }),
        });
      } catch (reason) {
        flash({
          type: "err",
          title: "Não disponível",
          code: nextItem.sku,
          sub: reason instanceof Error ? reason.message : "Este produto já está com outro operador.",
        });
        return false;
      }
    }

    if (previousId && previousId !== nextItem.id && previousItem && previousCount < previousItem.quantidadeSistema) {
      void persistCount(previousId, previousCount, false);
    }

    setActiveItemId(nextItem.id);
    setActiveCount(seededCount);
    return true;
  }

  function applyCount(item: Item, nextCount: number, complete: boolean) {
    setActiveCount(nextCount);
    if (complete) {
      flash({ type: "ok", title: "Produto completo", code: item.sku, sub: `${nextCount}/${item.quantidadeSistema} contado(s).` });
      void persistCount(item.id, nextCount, true);
    } else {
      pulseFrame();
    }
  }

  async function applyScan(rawValue: string) {
    const code = rawValue.trim();
    if (!code || scanBusyRef.current || confirmPrompt) return;
    const currentDetail = detailRef.current;
    if (!currentDetail) return;

    scanBusyRef.current = true;
    try {
      const decision = resolveGeneralInventoryScan(code, {
        items: currentDetail.itens,
        activeItemId,
        activeCount,
        currentUserId,
      });

      if (decision.kind === "not-found") {
        flash({ type: "err", title: "Não encontrado", code, sub: "Produto não pertence a este inventário." });
        return;
      }

      if (decision.kind === "claimed-by-other") {
        flash({ type: "err", title: "Não disponível", code: decision.item.sku, sub: "Este produto já está com outro operador." });
        return;
      }

      if (decision.kind === "surplus-prompt") {
        if (decision.switchingItem) {
          const switched = await switchActiveItem(decision.item, decision.seededCount);
          if (!switched) return;
        }
        pendingSurplusRef.current = { itemId: decision.item.id, nextCount: decision.seededCount + 1 };
        setConfirmPrompt({
          title: "Confirmar unidade extra",
          code: decision.item.sku,
          sub: `Esse produto já tem as ${decision.item.quantidadeSistema} unidades esperadas. Confirma mais 1 unidade (${decision.seededCount + 1} no total)?`,
          confirmLabel: "Confirmar unidade extra",
          dismissLabel: "Foi engano, não contar",
        });
        return;
      }

      if (decision.kind === "switch-item") {
        const switched = await switchActiveItem(decision.item, decision.item.quantidadeContada ?? 0);
        if (!switched) return;
        applyCount(decision.item, decision.nextCount, decision.complete);
        return;
      }

      // decision.kind === "increment"
      applyCount(decision.item, decision.nextCount, decision.complete);
    } finally {
      scanBusyRef.current = false;
    }
  }

  function confirmSurplus() {
    const pending = pendingSurplusRef.current;
    pendingSurplusRef.current = null;
    setConfirmPrompt(null);
    if (!pending) return;
    const item = detailRef.current?.itens.find((entry) => entry.id === pending.itemId);
    setActiveCount(pending.nextCount);
    void persistCount(pending.itemId, pending.nextCount, true);
    if (item) {
      flash({ type: "ok", title: "Unidade extra registrada", code: item.sku, sub: `${pending.nextCount}/${item.quantidadeSistema} contado(s).` });
    }
  }

  function dismissSurplusPrompt() {
    pendingSurplusRef.current = null;
    setConfirmPrompt(null);
  }

  const applyScanRef = useRef<(code: string) => void>(() => {});
  useEffect(() => {
    applyScanRef.current = (code: string) => void applyScan(code);
  });
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const {
    videoRef,
    cameraStarting,
    cameraMessage,
    startCamera,
    stopCamera,
    captureFallbackActive,
    captureBusy,
    captureFromPhoto,
  } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
  });

  useEffect(() => {
    if (scannerOpen) void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  // Persiste o rascunho do item ativo se a aba/tela for escondida no meio de
  // uma contagem -- cobre o operador guardando o celular, que não passa por
  // closeScanner/switchActiveItem.
  useEffect(() => {
    flushDraftOnHideRef.current = () => {
      if (activeItem && activeCount > 0 && activeCount < activeItem.quantidadeSistema) {
        void persistCount(activeItem.id, activeCount, false);
      }
    };
  });

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") flushDraftOnHideRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
      void audioContextRef.current?.close();
    };
  }, []);

  if (loading) {
    return <MobileFullScreenLoader />;
  }

  if (summary && detail) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "18px", display: "flex", alignItems: "center", gap: 12 }}><MobileBackButton onClick={() => router.push("/m/estoque/inventarios/geral")} /><div><div style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário concluído</div><div style={{ fontSize: 12, color: mobileColors.muted }}>{detail.depositante}</div></div></div>
        <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px" }}>
          <div style={{ ...cardStyle, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ width: 68, height: 68, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: hexAlpha(mobileColors.green, 0.16), color: mobileColors.green }}><MobileIcon name="check" size={34} /></div>
            <div style={{ fontSize: 21, fontWeight: 800, ...headingFont }}>Contagem confirmada</div>
            <div style={{ fontSize: 13, color: mobileColors.muted, lineHeight: 1.5 }}>Os saldos divergentes foram ajustados e registrados no histórico do estoque.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[['Ajustes aplicados', summary.ajustesAplicados], ['Divergências', summary.divergentes], ['Aumentos', summary.aumentos], ['Reduções', summary.reducoes]].map(([label, value]) => <div key={String(label)} style={{ ...cardStyle, padding: 13 }}><div style={{ fontSize: 11, color: mobileColors.muted }}>{label}</div><div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, ...headingFont }}>{value}</div></div>)}
            </div>
            <a href={`/api/estoque/inventarios-gerais/${detail.id}/relatorio`} style={{ height: 52, borderRadius: 15, background: mobileGradient, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, textDecoration: "none" }}>Baixar relatório</a>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "18px", display: "flex", alignItems: "center", gap: 12 }}>
          <MobileBackButton onClick={() => router.push("/m/estoque/inventarios/geral")} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário geral</div>
            <div style={{ fontSize: 12, color: mobileColors.muted }}>{depositanteNome}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: "0 18px 18px", display: "flex", alignItems: "center" }}>
          <div style={{ ...cardStyle, width: "100%", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: hexAlpha(mobileColors.red, 0.14), color: mobileColors.redLight }}>
              <MobileIcon name="x" size={28} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, ...headingFont }}>Não foi possível abrir a contagem</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: mobileColors.muted }}>
              {error ?? "O inventário geral não retornou dados para este depositante."}
            </div>
            <MobilePrimaryButton onClick={() => window.location.reload()}>Tentar novamente</MobilePrimaryButton>
            <button
              type="button"
              onClick={() => router.push("/m/estoque/inventarios/geral")}
              style={{
                height: 48,
                borderRadius: 15,
                border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`,
                background: "transparent",
                color: mobileColors.text,
                fontWeight: 800,
              }}
            >
              Voltar para depositantes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: "16px 18px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <MobileBackButton onClick={() => router.push("/m/estoque/inventarios/geral")} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário geral</div><div style={{ fontSize: 12, color: mobileColors.muted }}>{depositanteNome} - somente hoje</div></div>
        <span style={{ padding: "5px 10px", borderRadius: 999, background: hexAlpha(mobileColors.green, 0.14), color: mobileColors.green, fontSize: 10.5, fontWeight: 800 }}>EM CONTAGEM</span>
      </div>
      <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          type="button"
          onClick={openScanner}
          style={{ height: 54, borderRadius: 16, border: "none", background: mobileGradient, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontWeight: 800, fontSize: 15, boxShadow: "0 8px 22px rgba(99,102,241,0.35)" }}
        >
          <MobileIcon name="scan" size={20} strokeWidth={2} />
          Bipar
        </button>
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "end" }}><div><div style={{ fontSize: 12, color: mobileColors.muted }}>Progresso da contagem</div><div style={{ fontSize: 27, fontWeight: 800, ...headingFont }}>{detail.contados}/{detail.totalItens}</div></div><div style={{ fontSize: 19, fontWeight: 800, color: mobileColors.violetLight }}>{progress}%</div></div>
          <div style={{ height: 8, borderRadius: 999, background: hexAlpha("#94A3B8", 0.13), overflow: "hidden", marginTop: 10 }}><div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, background: mobileGradient, transition: "width .25s ease" }} /></div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}><span style={{ padding: "5px 9px", borderRadius: 999, background: hexAlpha(mobileColors.amber, .13), color: mobileColors.amber, fontSize: 11, fontWeight: 700 }}>{detail.pendentes} pendentes</span><span style={{ padding: "5px 9px", borderRadius: 999, background: hexAlpha(mobileColors.red, .13), color: mobileColors.redLight, fontSize: 11, fontWeight: 700 }}>{detail.divergentes} divergencias</span><span style={{ padding: "5px 9px", borderRadius: 999, background: hexAlpha(mobileColors.blue, .13), color: mobileColors.blueLight, fontSize: 11, fontWeight: 700 }}>Sem pausa</span></div>
          {detail.participantes.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${hexAlpha("#94A3B8", .12)}` }}>
              <Users size={13} strokeWidth={2} color={mobileColors.muted} />
              <span style={{ fontSize: 11, color: mobileColors.muted }}>
                {detail.participantes.length === 1 ? "Contando sozinho:" : `Contando junto (${detail.participantes.length}):`}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: mobileColors.text }}>
                {detail.participantes.map((p) => p.nome).join(", ")}
              </span>
            </div>
          ) : null}
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar produto..." style={{ height: 44, borderRadius: 14, border: `1px solid ${hexAlpha("#94A3B8", .16)}`, background: hexAlpha("#94A3B8", .06), color: mobileColors.text, padding: "0 14px", fontSize: 16 }} />
        {error ? <div style={{ borderRadius: 14, padding: 12, background: hexAlpha(mobileColors.red, .12), border: `1px solid ${hexAlpha(mobileColors.red, .3)}`, color: mobileColors.redLight, fontSize: 12.5 }}>{error}</div> : null}
        {drafts.size > 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 14, padding: 12, background: hexAlpha(mobileColors.amber, .1), border: `1px solid ${hexAlpha(mobileColors.amber, .3)}`, color: mobileColors.amber, fontSize: 12.5 }}>
            <span>{drafts.size} produto{drafts.size === 1 ? "" : "s"} com contagem não sincronizada.</span>
            <button type="button" onClick={() => void retryDrafts()} style={{ flexShrink: 0, border: "none", background: "transparent", color: mobileColors.amber, fontWeight: 800, fontSize: 12.5, textDecoration: "underline" }}>
              Tentar novamente
            </button>
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredItems.map((item) => (
            <div key={item.id} style={{ ...cardStyle, width: "100%", padding: 13, display: "flex", alignItems: "center", gap: 10, color: mobileColors.text, borderColor: item.id === activeItemId ? mobileColors.cyan : hexAlpha("#94A3B8", .16) }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: hexAlpha(mobileColors.blue, .13), display: "flex", alignItems: "center", justifyContent: "center" }}>{item.imagemUrl ? <img src={item.imagemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <MobileIcon name="box" size={19} />}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nome}</div>
                <div style={{ color: mobileColors.muted, fontSize: 11 }}>{item.sku} - sistema {item.quantidadeSistema}</div>
                {item.atribuidoNome ? <div style={{ color: item.status === "PENDENTE" ? mobileColors.amber : mobileColors.green, fontSize: 10.5, marginTop: 2 }}>{item.status === "PENDENTE" ? `Com ${item.atribuidoNome}` : `Contado por ${item.contadoPor ?? item.atribuidoNome}`}</div> : null}
              </div>
              {item.status === "PENDENTE" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void markAsZero(item)}
                    style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${hexAlpha(mobileColors.redLight, .35)}`, background: hexAlpha(mobileColors.red, .1), color: mobileColors.redLight, fontSize: 10.5, fontWeight: 800 }}
                  >
                    Marcar zerado
                  </button>
                  {item.atribuidoA === currentUserId ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void releaseItem(item)}
                      style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${hexAlpha("#94A3B8", .3)}`, background: hexAlpha("#94A3B8", .1), color: mobileColors.muted, fontSize: 10.5, fontWeight: 800 }}
                    >
                      Liberar
                    </button>
                  ) : null}
                </div>
              ) : (
                <div style={{ flexShrink: 0, color: item.status === "DIVERGENTE" ? mobileColors.redLight : mobileColors.green, fontSize: 11, fontWeight: 800 }}>{item.divergencia === 0 ? "OK" : `${item.divergencia > 0 ? "+" : ""}${item.divergencia}`}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: "10px 18px 18px", borderTop: `1px solid ${hexAlpha("#94A3B8", .12)}` }}>
        {!review ? (
          <MobilePrimaryButton disabled={detail.pendentes > 0 || saving || drafts.size > 0} onClick={() => setReview(true)}>
            {drafts.size > 0
              ? `Sincronizando ${drafts.size} produto${drafts.size === 1 ? "" : "s"}...`
              : detail.pendentes > 0
                ? `Faltam ${detail.pendentes} produtos`
                : "Revisar e confirmar inventário"}
          </MobilePrimaryButton>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...cardStyle, padding: 12, fontSize: 12, color: mobileColors.muted }}>Ao confirmar: <strong style={{ color: mobileColors.text }}>{detail.divergentes} divergencias</strong>, <strong style={{ color: mobileColors.text }}>{detail.zerados} produtos zerados</strong>. Os saldos serão ajustados e auditados.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setReview(false)} style={{ flex: 1, height: 52, borderRadius: 15, border: `1px solid ${hexAlpha("#94A3B8", .2)}`, background: "transparent", color: mobileColors.text, fontWeight: 800 }}>Voltar</button>
              <MobilePrimaryButton disabled={saving} onClick={() => void confirm()} style={{ flex: 1 }}>{saving ? <MobileButtonSpinner /> : "Confirmar ajustes"}</MobilePrimaryButton>
            </div>
          </div>
        )}
      </div>

      {scannerOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
          <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.65) 100%)" }} />

          <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px", paddingTop: "calc(18px + env(safe-area-inset-top))" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 800, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Bipe qualquer produto do inventário
              </span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, lineHeight: 1.15, ...headingFont }}>
                {activeItem ? activeItem.nome : "Inventário geral"}
              </span>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, ...headingFont }}>
                {activeItem ? activeItem.sku : depositanteNome}
              </span>
            </div>
            <button type="button" onClick={closeScanner} style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MobileIcon name="x" size={18} strokeWidth={2.6} />
            </button>
          </div>

          <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: 250,
                height: 160,
                borderRadius: 22,
                border: `2.5px ${framePulse ? "solid" : "dashed"} ${framePulse ? mobileColors.green : hexAlpha("#ffffff", 0.7)}`,
                boxShadow: framePulse ? `0 0 22px ${hexAlpha(mobileColors.green, 0.65)}` : "none",
                transition: "border-color 0.12s ease, box-shadow 0.12s ease",
              }}
            />
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 9,
              padding: "0 24px calc(36px + env(safe-area-inset-bottom))",
              textAlign: "center",
            }}
          >
            {activeItem ? (
              <>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, ...headingFont }}>
                  {activeCount} de {activeItem.quantidadeSistema} unidades
                </span>
                {activeItem.quantidadeSistema > 0 && activeItem.quantidadeSistema <= 12 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 7, maxWidth: 260 }}>
                    {Array.from({ length: activeItem.quantidadeSistema }).map((_, index) => {
                      const collected = index < activeCount;
                      return (
                        <span
                          key={index}
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            background: collected ? mobileColors.green : "transparent",
                            border: `2px solid ${collected ? mobileColors.green : "rgba(255,255,255,0.45)"}`,
                            transition: "background 0.2s ease",
                          }}
                        />
                      );
                    })}
                  </div>
                ) : activeItem.quantidadeSistema > 0 ? (
                  <div style={{ width: 220, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        background: mobileColors.green,
                        width: `${Math.min(100, Math.round((activeCount / activeItem.quantidadeSistema) * 100))}%`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                ) : null}
                {activeCount < activeItem.quantidadeSistema ? (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5 }}>
                    Faltam {activeItem.quantidadeSistema - activeCount} {activeItem.quantidadeSistema - activeCount === 1 ? "unidade" : "unidades"}
                  </span>
                ) : null}
                {activeCount > 0 && activeCount < activeItem.quantidadeSistema ? (
                  <button
                    type="button"
                    onClick={finalizeActiveBelowThreshold}
                    style={{ marginTop: 2, border: "none", background: "transparent", color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 700, textDecoration: "underline" }}
                  >
                    Registrar como concluído com {activeCount} (produto tem menos)
                  </button>
                ) : null}
              </>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 12.5 }}>
                {cameraStarting ? "Abrindo câmera..." : (cameraMessage ?? "Posicione o código dentro da moldura")}
              </span>
            )}
            {captureFallbackActive ? (
              <button
                type="button"
                disabled={captureBusy}
                onClick={captureFromPhoto}
                style={{
                  height: 52,
                  padding: "0 24px",
                  borderRadius: 15,
                  border: "none",
                  background: mobileGradient,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: captureBusy ? 0.7 : 1,
                }}
              >
                <MobileIcon name="scan" size={18} strokeWidth={2} />
                {captureBusy ? "Lendo foto..." : "Tirar foto do código"}
              </button>
            ) : null}
          </div>

          <MobileScanOverlay overlay={overlay} />
          <MobileScanConfirmPrompt state={confirmPrompt} onConfirm={confirmSurplus} onDismiss={dismissSurplusPrompt} />
        </div>
      ) : null}
    </div>
  );
}
