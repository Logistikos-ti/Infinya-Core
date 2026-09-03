"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import type { ReceivingOrderDetail } from "@/lib/receiving";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import { ReleaseQuarantineButton } from "@/components/receiving/release-quarantine-button";
import { ThemeToggle } from "@/components/theme-toggle";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

const manropeStyle: React.CSSProperties = { fontFamily: "var(--font-manrope), Manrope, sans-serif" };
const groteskStyle: React.CSSProperties = {
  fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
};
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

type AddressOption = { id: string; codigo: string; area: string };
type IssueSummary = { id: string; title: string; type: string; action: string };
type DepositProtocolSummary = {
  id: string;
  protocol: string;
  sku: string;
  productName: string;
  endereco: string;
  area: string;
  lote: string;
  validade: string;
  saldo: string;
  withdrawalLabel: string;
};

type ConferenceItemState = {
  id: string;
  sku: string;
  description: string;
  barcode: string;
  internalCode: string;
  unitLabel: string;
  expectedQuantity: number;
  receivedQuantity: string;
  lotValue: string;
  expiryValue: string;
  requireLot: boolean;
  requireExpiry: boolean;
};

type BipEntry = { id: number; sku: string; nome: string; ok: boolean; time: string };
type DivergentItem = { sku: string; nome: string; previsto: number; recebido: number };
type ToastState = { id: number; msg: string; tone: "success" | "error" };

function normalizeScanValue(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").trim().toUpperCase();
}

function nowLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function ReceivingConferenceView({
  orderId,
  orderCode,
  supplier,
  status,
  initialItems,
  addresses,
  relatedIssues,
  generatedProtocols,
}: {
  orderId: string;
  orderCode: string;
  supplier: string;
  depositante: string;
  status: string;
  initialItems: ReceivingOrderDetail["items"];
  addresses: AddressOption[];
  relatedIssues: IssueSummary[];
  generatedProtocols: DepositProtocolSummary[];
}) {
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const [items, setItems] = useState<ConferenceItemState[]>(
    initialItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      description: item.description,
      barcode: item.barcode,
      internalCode: item.internalCode,
      unitLabel: item.unitLabel,
      expectedQuantity: item.expectedQuantity,
      receivedQuantity: String(item.receivedQuantity || ""),
      lotValue: item.lotValue,
      expiryValue: item.expiryValue,
      requireLot: item.requireLot,
      requireExpiry: item.requireExpiry,
    })),
  );
  const [enderecoId] = useState(addresses[0]?.id ?? "");
  const [scanValue, setScanValue] = useState("");
  const [bips, setBips] = useState<BipEntry[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [divergentItems, setDivergentItems] = useState<DivergentItem[] | null>(null);
  const [orderStatus, setOrderStatus] = useState(status);

  const conferidoTotal = items.reduce((sum, item) => sum + (Number(item.receivedQuantity) || 0), 0);
  const esperadoTotal = items.reduce((sum, item) => sum + item.expectedQuantity, 0);
  const skusCompletos = items.filter(
    (item) => (Number(item.receivedQuantity) || 0) >= item.expectedQuantity,
  ).length;
  const progressPct = esperadoTotal > 0 ? Math.round((conferidoTotal / esperadoTotal) * 100) : 0;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => scanInputRef.current?.focus(), 120);
    return () => window.clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimerRef.current ?? undefined);
      window.clearTimeout(autoSaveTimerRef.current ?? undefined);
    };
  }, []);

  function showToast(msg: string, tone: "success" | "error") {
    setToast({ id: Date.now(), msg, tone });
    window.clearTimeout(toastTimerRef.current ?? undefined);
    toastTimerRef.current = window.setTimeout(
      () => setToast(null),
      tone === "success" ? 2200 : 5000,
    );
  }

  function playFeedbackTone(tone: "success" | "error") {
    if (typeof window === "undefined") return;
    const AudioContextRef =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;
    const context = new AudioContextRef();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone === "success" ? "sine" : "square";
    oscillator.frequency.value = tone === "success" ? 880 : 220;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (tone === "success" ? 0.08 : 0.16));
    oscillator.onended = () => void context.close();
  }

  // Grava progresso sozinho em segundo plano (sem botão visível — o mock não
  // tem "Salvar", então o app precisa se virar pra não perder o que foi
  // bipado se o operador sair sem clicar em "Encerrar conferência").
  function scheduleAutoSave() {
    window.clearTimeout(autoSaveTimerRef.current ?? undefined);
    autoSaveTimerRef.current = window.setTimeout(() => {
      void submitConference(false);
    }, 1200);
  }

  function updateItem(
    itemId: string,
    field: "receivedQuantity" | "lotValue" | "expiryValue",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    );
    scheduleAutoSave();
  }

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function applyScannedCode(rawValue: string) {
    const normalizedScan = normalizeScanValue(rawValue);
    if (!normalizedScan) return;

    const matchedItem = items.find((item) =>
      [item.barcode, item.internalCode, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScanValue(value) === normalizedScan),
    );

    if (!matchedItem) {
      setBips((current) =>
        [{ id: Date.now(), sku: rawValue.trim(), nome: "SKU não encontrado", ok: false, time: nowLabel() }, ...current].slice(0, 40),
      );
      showToast("Código não encontrado neste recebimento.", "error");
      playFeedbackTone("error");
      setScanValue("");
      return;
    }

    const nextQuantity = Number(matchedItem.receivedQuantity || 0) + 1;
    setItems((current) =>
      current.map((item) =>
        item.id === matchedItem.id ? { ...item, receivedQuantity: String(nextQuantity) } : item,
      ),
    );
    setBips((current) =>
      [{ id: Date.now(), sku: matchedItem.sku, nome: matchedItem.description, ok: true, time: nowLabel() }, ...current].slice(0, 40),
    );
    playFeedbackTone("success");
    setScanValue("");
    scheduleAutoSave();
    focusScanInput();
  }

  function handleScanSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    applyScannedCode(scanValue);
  }

  async function submitConference(finalizar: boolean, confirmarDivergencia = false) {
    window.clearTimeout(autoSaveTimerRef.current ?? undefined);
    setIsSaving(finalizar);
    setDivergentItems(null);
    try {
      const response = await fetch(`/api/recebimento/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmarDivergencia,
          enderecoId,
          finalizar,
          items: items.map((item) => ({
            id: item.id,
            quantidadeRecebida: Number(item.receivedQuantity || 0),
            lote: item.lotValue || undefined,
            validadeEm: item.expiryValue || undefined,
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        if (!finalizar) return; // salvamento silencioso — não incomoda com erro de fundo
        if (result.divergentItems) {
          setDivergentItems(result.divergentItems);
          playFeedbackTone("error");
          return;
        }
        showToast(result.error ?? "Não foi possível salvar a conferência.", "error");
        playFeedbackTone("error");
        return;
      }

      if (result.status) setOrderStatus(result.status);

      if (finalizar) {
        showToast(result.message ?? "Conferência encerrada — enviando ao put-away", "success");
        playFeedbackTone("success");
        setTimeout(() => {
          window.location.href = "/recebimento";
        }, 900);
      }
    } catch {
      if (finalizar) {
        showToast("Falha de comunicação com a API da conferência.", "error");
        playFeedbackTone("error");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function onFinish() {
    const pendente = items.reduce(
      (sum, item) => sum + Math.max(0, item.expectedQuantity - (Number(item.receivedQuantity) || 0)),
      0,
    );
    if (pendente > 0) {
      const divs: DivergentItem[] = items
        .filter((item) => (Number(item.receivedQuantity) || 0) < item.expectedQuantity)
        .map((item) => ({
          sku: item.sku,
          nome: item.description,
          previsto: item.expectedQuantity,
          recebido: Number(item.receivedQuantity) || 0,
        }));
      setDivergentItems(divs);
      return;
    }
    void submitConference(true);
  }

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <style>{`
        @keyframes pulseDot { 0%,100% { opacity:1 } 50% { opacity:.35 } }
        @keyframes confModalIn { from { transform:translateY(10px); opacity:0 } to { transform:none; opacity:1 } }
      `}</style>

      {/* Cabeçalho — igual ao mock (‹ voltar · protocolo · badge · encerrar · tema) */}
      <header
        className={`flex h-[68px] flex-shrink-0 items-center gap-[18px] border-b px-[28px] ${tokenBorder}`}
      >
        <Link
          href="/recebimento"
          title="Voltar para Recebimento"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
        </Link>
        <div className={`h-5 w-px ${tokenBorder} border-l`} />
        <div className="flex flex-col">
          <span className={`text-[12px] font-semibold ${tokenTextSub} ${MONO}`}>{orderCode}</span>
          <span className={`text-[14.5px] font-bold ${tokenText}`}>{supplier}</span>
        </div>
        <div className="flex-1" />
        <div
          className={`flex h-[42px] items-center gap-2.5 rounded-[11px] border px-[18px] ${tokenBorder} ${tokenInputBg}`}
        >
          <span
            className="h-2 w-2 rounded-full bg-[#F59E0B]"
            style={{ animation: "pulseDot 1.4s ease-in-out infinite" }}
          />
          <span className={`text-[13.5px] font-bold ${tokenText}`}>Em conferência</span>
        </div>
        <button
          type="button"
          onClick={onFinish}
          disabled={isSaving}
          className="flex h-[42px] items-center justify-center px-[18px] text-[13.5px] font-extrabold text-white transition-[filter] enabled:hover:[filter:brightness(1.06)] disabled:opacity-40"
          style={{ background: "linear-gradient(92deg,#10B981,#059669)", border: 0, borderRadius: 11 }}
        >
          {isSaving ? <MobileButtonSpinner size={18} /> : "Encerrar conferência"}
        </button>
        <ThemeToggle />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-[28px] pt-[22px] pb-[22px]">
        {orderStatus === "QUARENTENA_CORRIGIDA" ? (
          <div className="mb-4">
            <ReleaseQuarantineButton orderId={orderId} />
          </div>
        ) : null}

        <div className="grid gap-[18px] lg:grid-cols-2">
          {/* SCAN AREA */}
          <section className="flex min-h-0 flex-col gap-4">
            <div
              className={`flex min-h-[200px] flex-col justify-center gap-3.5 rounded-2xl border px-[22px] py-5 ${tokenBorder} ${tokenCardBg}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M7 8v8M11 8v8M15 8v8M19 8v8" />
                  </svg>
                </span>
                <div>
                  <div className={`text-[18px] font-bold ${tokenText}`} style={groteskStyle}>
                    Bipar produto
                  </div>
                  <div className={`text-[12.5px] ${tokenTextSub}`}>
                    Escaneie o código de barras ou digite o SKU
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleScanSubmit}
                className={`flex h-14 items-center rounded-[14px] border-2 py-1 pl-5 pr-1 ${tokenInputBg}`}
                style={{ borderColor: "rgba(139,92,246,.35)" }}
              >
                <span className={`mr-3 text-[16px] ${tokenTextSub}`}>⌗</span>
                <input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onBlur={() => {
                    window.setTimeout(() => scanInputRef.current?.focus(), 40);
                  }}
                  placeholder="Bipe aqui ou digite o SKU..."
                  className={`h-full flex-1 border-none bg-transparent text-[16px] font-semibold outline-none ${tokenText} ${MONO}`}
                />
                <button
                  type="submit"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white transition-[filter] hover:[filter:brightness(1.06)]"
                  style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </form>
            </div>

            <div
              className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}
            >
              <div className={`flex items-center justify-between border-b px-5 py-3.5 ${tokenBorder}`}>
                <span className={`text-[14px] font-bold ${tokenText}`} style={groteskStyle}>
                  Histórico de bips
                </span>
                <span className={`text-[12px] ${tokenTextSub} ${MONO}`}>{bips.length} bips</span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {bips.length ? (
                  bips.map((b, i) => (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2.5 px-2 py-2.5 ${
                        i < bips.length - 1 ? `border-b ${tokenBorder}` : ""
                      }`}
                    >
                      <span
                        className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
                        style={
                          b.ok
                            ? { background: "rgba(16,185,129,.14)", color: "#10B981" }
                            : { background: "rgba(239,68,68,.14)", color: "#EF4444" }
                        }
                      >
                        {b.ok ? "✓" : "!"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[12px] font-bold ${tokenText} ${MONO}`}>{b.sku}</div>
                        <div className={`truncate text-[12px] ${b.ok ? tokenTextSub : "text-[#EF4444]"}`}>
                          {b.nome}
                        </div>
                      </div>
                      <span className={`text-[11px] ${tokenTextSub} ${MONO}`}>{b.time}</span>
                    </div>
                  ))
                ) : (
                  <div className={`px-8 py-8 text-center text-[13px] italic ${tokenTextSub}`}>
                    Nenhum bip ainda
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* PROGRESS */}
          <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <div
              className={`flex min-h-[200px] flex-col justify-center rounded-2xl border px-[22px] py-5 ${tokenBorder} ${tokenCardBg}`}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <span
                  className={`text-[14px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}
                  style={groteskStyle}
                >
                  Progresso
                </span>
                <span className={`text-[32px] font-extrabold ${tokenText}`} style={groteskStyle}>
                  {progressPct}
                  <span className={`text-[16px] ${tokenTextSub}`}>%</span>
                </span>
              </div>
              <div className={`h-2.5 overflow-hidden rounded-md ${tokenInputBg}`}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, progressPct)}%`,
                    background: "linear-gradient(90deg,#3B82F6,#8B5CF6)",
                  }}
                />
              </div>
              <div className={`mt-3 flex justify-between text-[12.5px] ${tokenTextSub}`}>
                <span>
                  <b className={tokenText}>{conferidoTotal}</b> / {esperadoTotal} itens
                </span>
                <span>
                  <b className={tokenText}>{skusCompletos}</b> / {items.length} SKUs
                </span>
              </div>
            </div>

            <div
              className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}
            >
              <div className={`border-b px-5 py-3.5 ${tokenBorder}`}>
                <span className={`text-[14px] font-bold ${tokenText}`} style={groteskStyle}>
                  Produtos esperados
                </span>
              </div>
              <div className="flex flex-1 flex-col overflow-y-auto">
                {items.map((item, i) => {
                  const received = Number(item.receivedQuantity) || 0;
                  const pct = item.expectedQuantity > 0 ? Math.round((received / item.expectedQuantity) * 100) : 0;
                  const complete = received >= item.expectedQuantity;
                  const color = complete ? "#10B981" : received > 0 ? "#8B5CF6" : undefined;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col gap-2 px-5 py-3.5 ${i === 0 ? "" : `border-t ${tokenBorder}`}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-[13.5px] font-bold ${tokenText}`}>{item.description}</div>
                          <div className={`text-[11px] ${tokenTextSub} ${MONO}`}>{item.sku}</div>
                        </div>
                        <span className={`whitespace-nowrap text-[15px] font-extrabold ${MONO}`} style={{ color }}>
                          <span className={color ? "" : tokenText}>{received}</span> / {item.expectedQuantity}
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
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: complete ? "#10B981" : "linear-gradient(90deg,#3B82F6,#8B5CF6)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {generatedProtocols.length || relatedIssues.length ? (
          <div className="mt-[18px] grid gap-[18px] lg:grid-cols-2">
            {generatedProtocols.length ? (
              <div className={`rounded-2xl border p-5 ${tokenBorder} ${tokenCardBg}`}>
                <div className={`mb-3 text-[13px] font-bold ${tokenText}`} style={groteskStyle}>
                  Protocolos de depósito gerados ({generatedProtocols.length})
                </div>
                <div className="flex flex-col gap-2">
                  {generatedProtocols.map((protocol) => (
                    <div key={protocol.id} className={`rounded-xl border px-3.5 py-3 text-[12.5px] ${tokenBorder} ${tokenInputBg}`}>
                      <div className={`font-bold ${tokenText}`}>{protocol.protocol}</div>
                      <div className={tokenTextSub}>
                        {protocol.sku} · {protocol.productName} · {protocol.endereco}
                      </div>
                      <div className={`mt-1 flex gap-3 ${tokenTextSub}`}>
                        <span>Lote: {protocol.lote}</span>
                        <span>Val.: {protocol.validade}</span>
                        <span>Saldo: {protocol.saldo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {relatedIssues.length ? (
              <div className={`rounded-2xl border p-5 ${tokenBorder} ${tokenCardBg}`}>
                <div className={`mb-3 text-[13px] font-bold ${tokenText}`} style={groteskStyle}>
                  Ocorrências relacionadas ({relatedIssues.length})
                </div>
                <div className="flex flex-col gap-2">
                  {relatedIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-xl border px-3.5 py-3 text-[12.5px]"
                      style={{ borderColor: "rgba(239,68,68,.25)", background: "rgba(239,68,68,.06)" }}
                    >
                      <div className="font-bold text-[#EF4444]">{issue.title}</div>
                      <div className="text-[#EF4444] opacity-80">{issue.type}</div>
                      <div className={`mt-1 ${tokenText}`}>{issue.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Modal de divergência — igual ao mock */}
      {divergentItems ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
          <div
            className="absolute inset-0 backdrop-blur-[5px]"
            style={{ background: "rgba(3,7,20,.55)" }}
            onClick={() => setDivergentItems(null)}
          />
          <div
            className={`relative flex max-h-[85vh] w-[560px] max-w-[96vw] flex-col rounded-2xl border shadow-[0_30px_60px_rgba(0,0,0,0.35)] ${tokenCardBg}`}
            style={{ borderColor: "rgba(245,158,11,.35)", animation: "confModalIn .18s ease" }}
          >
            <div className={`flex gap-3.5 border-b px-6 pb-3.5 pt-[22px] ${tokenBorder}`}>
              <span
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(245,158,11,.14)" }}
              >
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
                  O recebimento será fechado com itens faltando. As divergências abaixo serão
                  registradas no histórico e enviadas para análise.
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3.5">
              <div className={`mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] ${tokenTextSub}`}>
                Divergências ({divergentItems.length} SKUs)
              </div>
              <div className="flex flex-col gap-2">
                {divergentItems.map((item, i) => (
                  <div
                    key={`${item.sku}-${i}`}
                    className={`flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 ${tokenBorder} ${tokenInputBg}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[13px] font-bold ${tokenText}`}>{item.nome}</div>
                      <div className={`text-[11px] ${tokenTextSub} ${MONO}`}>{item.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[14px] font-extrabold text-[#EF4444] ${MONO}`}>
                        −{item.previsto - item.recebido}
                      </div>
                      <div className={`text-[11px] ${tokenTextSub} ${MONO}`}>
                        {item.recebido} / {item.previsto}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`flex justify-center gap-2.5 border-t px-6 pb-[18px] pt-3.5 ${tokenBorder}`}>
              <button
                type="button"
                onClick={() => setDivergentItems(null)}
                className={`flex h-[42px] items-center justify-center rounded-[10px] border px-5 text-[13.5px] font-bold transition-[filter] hover:[filter:brightness(1.06)] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Continuar contagem
              </button>
              <button
                type="button"
                onClick={() => submitConference(true, true)}
                disabled={isSaving}
                className="flex h-[42px] items-center justify-center gap-2 rounded-[10px] px-[22px] text-[13.5px] font-extrabold text-white transition-[filter] enabled:hover:[filter:brightness(1.06)] disabled:opacity-40"
                style={{ background: "linear-gradient(92deg,#F59E0B,#EF4444)", border: 0 }}
              >
                {isSaving ? <MobileButtonSpinner size={18} /> : "Fechar com divergência"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-[80] flex items-center gap-2.5 rounded-[10px] border px-4 py-[11px] text-[12.5px] font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.3)] ${tokenCardBg} ${tokenText}`}
          style={{ borderColor: toast.tone === "success" ? "rgba(139,92,246,.4)" : "rgba(239,68,68,.4)" }}
        >
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: toast.tone === "success" ? "#8B5CF6" : "#EF4444" }}
          />
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className={tokenTextSub}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
