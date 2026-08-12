"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import {
  MobileBackButton,
  MobileButtonSpinner,
  MobileFullScreenLoader,
  MobileIcon,
  MobilePrimaryButton,
  MobileScanOverlay,
  hexAlpha,
  headingFont,
  mobileColors,
  mobileGradient,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

type Item = {
  id: string;
  produtoId: string;
  nome: string;
  sku: string;
  codigoExterno: string | null;
  codigoInterno: string | null;
  codigoExternoPack: string | null;
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
};

type Summary = { divergentes: number; zerados: number; aumentos: number; reducoes: number; ajustesAplicados: number };

type ScanPhase = "produto" | "endereco";

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

function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

const cardStyle = {
  border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
  borderRadius: 18,
  background: hexAlpha("#94A3B8", 0.045),
};

export function GeneralInventoryClient({ depositanteId, depositanteNome }: { depositanteId: string; depositanteNome: string }) {
  const router = useRouter();
  const quantityRef = useRef<HTMLInputElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Camera scan flow: "Bipar" opens the camera and walks the operator
  // through produto -> endereço (same two-step pattern as the cyclic
  // inventory), landing on the quantity card once both scans match.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("produto");
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const scanBusyRef = useRef(false);
  const overlayTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const detailRef = useRef<Detail | null>(null);
  const scanPhaseRef = useRef<ScanPhase>("produto");
  const [scanItem, setScanItem] = useState<Item | null>(null);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);
  useEffect(() => {
    scanPhaseRef.current = scanPhase;
  }, [scanPhase]);

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

  useEffect(() => {
    if (!detail?.id || summary) return;
    const timer = window.setInterval(() => {
      fetch(`/api/estoque/inventarios-gerais?id=${detail.id}`)
        .then(readResponse)
        .then((body) => body.result && setDetail(body.result))
        .catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [detail?.id, summary]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return detail?.itens ?? [];
    return (detail?.itens ?? []).filter((item) => [item.nome, item.sku, item.codigoExterno, item.codigoInterno, item.codigoExternoPack].filter(Boolean).join(" ").toLocaleLowerCase().includes(term));
  }, [detail, search]);

  const activeItem = detail?.itens.find((item) => item.id === activeItemId) ?? null;
  const progress = detail?.totalItens ? Math.round((detail.contados / detail.totalItens) * 100) : 0;

  const chooseItem = async (item: Item) => {
    setError(null);
    if (item.status !== "PENDENTE") {
      setActiveItemId(item.id);
      setQuantity(String(item.quantidadeContada ?? ""));
      return item;
    }
    setSaving(true);
    try {
      const body = await load(`/api/estoque/inventarios-gerais/${detail?.id}`, { method: "POST", body: JSON.stringify({ action: "assumir", itemId: item.id }) });
      const next = body.result?.itens.find((entry) => entry.id === item.id);
      setActiveItemId(item.id);
      setQuantity(next?.quantidadeContada === null || next?.quantidadeContada === undefined ? "" : String(next.quantidadeContada));
      return next ?? item;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Este produto ja foi assumido por outro operador.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  /** Used by the list tap and "assumir próximo" -- unlike the camera flow,
   * there's no address step here, so the quantity field can be focused
   * immediately. */
  const selectItemFromList = async (item: Item) => {
    const chosen = await chooseItem(item);
    if (chosen) window.setTimeout(() => quantityRef.current?.focus(), 40);
  };

  const saveCount = async () => {
    if (!detail || !activeItem) return;
    const value = Number(quantity);
    if (!Number.isFinite(value) || value < 0) {
      setError("Informe uma quantidade válida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await load(`/api/estoque/inventarios-gerais/${detail.id}/itens/${activeItem.id}`, { method: "PATCH", body: JSON.stringify({ quantidade: value }) });
      setActiveItemId(null);
      setQuantity("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possivel salvar a contagem.");
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!detail || detail.pendentes > 0) return;
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

  function openScanner() {
    unlockAudio();
    setError(null);
    setScanItem(null);
    setScanPhase("produto");
    setScannerOpen(true);
  }

  function closeScanner() {
    stopCamera(null);
    setScannerOpen(false);
    setScanItem(null);
  }

  async function applyScan(rawValue: string) {
    const code = rawValue.trim();
    if (!code || scanBusyRef.current) return;
    const currentDetail = detailRef.current;
    if (!currentDetail) return;

    scanBusyRef.current = true;
    try {
      if (scanPhaseRef.current === "produto") {
        const normalized = normalizeScan(code);
        const item = currentDetail.itens.find((entry) =>
          [entry.sku, entry.codigoExterno, entry.codigoInterno, entry.codigoExternoPack]
            .filter(Boolean)
            .some((value) => normalizeScan(String(value)) === normalized),
        );

        if (!item) {
          flash({ type: "err", title: "Não encontrado", code, sub: "Produto não pertence a este inventário." });
          return;
        }

        const claimed = await chooseItem(item);
        if (!claimed) {
          flash({ type: "err", title: "Não disponível", code: item.sku, sub: "Este produto já está com outro operador." });
          return;
        }

        setScanItem(claimed);
        flash({ type: "ok", title: "Produto OK", code: claimed.sku, sub: "Bipe agora o endereço" });
        setScanPhase("endereco");
        return;
      }

      // scanPhase === "endereco"
      const item = scanItem;
      if (!item) {
        setScanPhase("produto");
        return;
      }

      const normalized = normalizeScan(code);
      const matches = item.enderecos.some((endereco) => normalizeScan(endereco) === normalized);

      if (!matches) {
        flash({
          type: "err",
          title: "Endereço incorreto",
          code,
          sub: item.enderecos.length ? `Este produto está em ${item.enderecos.join(", ")}.` : "Nenhum endereço de estoque encontrado para este produto.",
        });
        return;
      }

      flash({ type: "ok", title: "Endereço OK", code, sub: "Informe a quantidade contada" });
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        closeScanner();
        window.setTimeout(() => quantityRef.current?.focus(), 60);
      }, FLASH_DURATION_MS);
    } finally {
      scanBusyRef.current = false;
    }
  }

  const applyScanRef = useRef<(code: string) => void>(() => {});
  useEffect(() => {
    applyScanRef.current = (code: string) => void applyScan(code);
  });
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const { videoRef, cameraStarting, cameraMessage, startCamera, stopCamera } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
  });

  useEffect(() => {
    if (scannerOpen) void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
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
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar produto..." style={{ height: 44, borderRadius: 14, border: `1px solid ${hexAlpha("#94A3B8", .16)}`, background: hexAlpha("#94A3B8", .06), color: mobileColors.text, padding: "0 14px", fontSize: 13 }} />
        {error ? <div style={{ borderRadius: 14, padding: 12, background: hexAlpha(mobileColors.red, .12), border: `1px solid ${hexAlpha(mobileColors.red, .3)}`, color: mobileColors.redLight, fontSize: 12.5 }}>{error}</div> : null}
        {activeItem ? <div style={{ ...cardStyle, padding: 16, border: `1px solid ${mobileColors.cyan}` }}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><div style={{ width: 58, height: 58, borderRadius: 15, overflow: "hidden", background: hexAlpha(mobileColors.blue, .14), display: "flex", alignItems: "center", justifyContent: "center" }}>{activeItem.imagemUrl ? <img src={activeItem.imagemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <MobileIcon name="box" size={25} />}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800, ...headingFont }}>{activeItem.nome}</div><div style={{ color: mobileColors.muted, fontSize: 11.5 }}>{activeItem.sku} - sistema: {activeItem.quantidadeSistema}</div></div></div><div style={{ display: "flex", gap: 8, marginTop: 14 }}><input ref={quantityRef} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Quantidade contada" style={{ flex: 1, height: 48, borderRadius: 14, border: `1px solid ${mobileColors.cyan}`, background: hexAlpha("#94A3B8", .07), color: mobileColors.text, padding: "0 14px", fontSize: 16, fontWeight: 800 }} /><button type="button" disabled={saving} onClick={() => void saveCount()} style={{ minWidth: 112, border: "none", borderRadius: 14, background: mobileGradient, color: "#fff", fontWeight: 800 }}>{saving ? <MobileButtonSpinner /> : "Salvar"}</button></div></div> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredItems.map((item) => <button type="button" key={item.id} onClick={() => void selectItemFromList(item)} style={{ ...cardStyle, width: "100%", padding: 13, display: "flex", alignItems: "center", gap: 10, textAlign: "left", color: mobileColors.text, borderColor: item.id === activeItemId ? mobileColors.cyan : hexAlpha("#94A3B8", .16) }}><div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: hexAlpha(mobileColors.blue, .13), display: "flex", alignItems: "center", justifyContent: "center" }}>{item.imagemUrl ? <img src={item.imagemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <MobileIcon name="box" size={19} />}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nome}</div><div style={{ color: mobileColors.muted, fontSize: 11 }}>{item.sku} - sistema {item.quantidadeSistema}</div>{item.atribuidoNome ? <div style={{ color: item.status === "PENDENTE" ? mobileColors.amber : mobileColors.green, fontSize: 10.5, marginTop: 2 }}>{item.status === "PENDENTE" ? `Com ${item.atribuidoNome}` : `Contado por ${item.contadoPor ?? item.atribuidoNome}`}</div> : null}</div><div style={{ flexShrink: 0, color: item.status === "PENDENTE" ? mobileColors.amber : item.status === "DIVERGENTE" ? mobileColors.redLight : mobileColors.green, fontSize: 11, fontWeight: 800 }}>{item.status === "PENDENTE" ? "Pendente" : item.divergencia === 0 ? "OK" : `${item.divergencia > 0 ? "+" : ""}${item.divergencia}`}</div></button>)}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: "10px 18px 18px", borderTop: `1px solid ${hexAlpha("#94A3B8", .12)}` }}>
        {!review ? <MobilePrimaryButton disabled={detail.pendentes > 0 || saving} onClick={() => setReview(true)}>{detail.pendentes > 0 ? `Faltam ${detail.pendentes} produtos` : "Revisar e confirmar inventário"}</MobilePrimaryButton> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><div style={{ ...cardStyle, padding: 12, fontSize: 12, color: mobileColors.muted }}>Ao confirmar: <strong style={{ color: mobileColors.text }}>{detail.divergentes} divergencias</strong>, <strong style={{ color: mobileColors.text }}>{detail.zerados} produtos zerados</strong>. Os saldos serão ajustados e auditados.</div><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setReview(false)} style={{ flex: 1, height: 52, borderRadius: 15, border: `1px solid ${hexAlpha("#94A3B8", .2)}`, background: "transparent", color: mobileColors.text, fontWeight: 800 }}>Voltar</button><MobilePrimaryButton disabled={saving} onClick={() => void confirm()} style={{ flex: 1 }}>{saving ? <MobileButtonSpinner /> : "Confirmar ajustes"}</MobilePrimaryButton></div></div>}
      </div>

      {scannerOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
          <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.65) 100%)" }} />

          <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px", paddingTop: "calc(18px + env(safe-area-inset-top))" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 800, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {scanPhase === "produto" ? "Bipe o produto" : "Bipe o endereço"}
              </span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, lineHeight: 1.15, ...headingFont }}>
                {scanPhase === "produto" ? "Inventário geral" : scanItem?.nome ?? ""}
              </span>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, ...headingFont }}>
                {scanPhase === "produto" ? depositanteNome : scanItem?.sku ?? ""}
              </span>
            </div>
            <button type="button" onClick={closeScanner} style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MobileIcon name="x" size={18} strokeWidth={2.6} />
            </button>
          </div>

          <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 250, height: 160, borderRadius: 22, border: `2.5px dashed ${hexAlpha("#ffffff", 0.7)}` }} />
          </div>

          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 24px calc(36px + env(safe-area-inset-bottom))", textAlign: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 12.5 }}>
              {cameraStarting ? "Abrindo câmera..." : (cameraMessage ?? "Posicione o código dentro da moldura")}
            </span>
          </div>

          <MobileScanOverlay overlay={overlay} />
        </div>
      ) : null}
    </div>
  );
}
