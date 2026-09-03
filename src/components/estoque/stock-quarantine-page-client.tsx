"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  LoaderCircle,
  PackageOpen,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import type { StockQuarantineItem } from "@/lib/stock-quarantine";
import { quarantineDonatedLabel } from "@/lib/quarantine-labels";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

type DepositanteOption = {
  id: string;
  nome: string;
};

type StockQuarantinePageClientProps = {
  depositantes: DepositanteOption[];
  items: StockQuarantineItem[];
  allItems: StockQuarantineItem[];
  initialDepositanteId: string;
  initialStatus: string;
  initialQuery: string;
  canSelectDepositante: boolean;
  canConfirm: boolean;
};

// "status" usa o item.status (server-filtered); os demais são recortes
// client-side sobre allItems, no mesmo espírito do "pending-addressing" que já
// existia — nenhum deles depende de round-trip ao servidor.
type TableMode = "status" | "pending-addressing" | "awaiting-decision" | "discarded-this-month";

function formatQuarantineType(tipo: string) {
  const normalizedType = tipo.trim().toUpperCase();

  if (normalizedType === "AVARIA") return "Avaria";
  if (normalizedType === "VENCIMENTO") return "Vencimento";
  if (normalizedType === "RECEBIMENTO") return "Recebimento";

  return "Outro";
}

// Cor do badge de Motivo na tabela (igual ao mock, que colore por tipo).
function motivoColor(tipo: string, C: Tokens) {
  const normalizedType = tipo.trim().toUpperCase();

  if (normalizedType === "AVARIA") return C.rose;
  if (normalizedType === "VENCIMENTO") return C.amber;
  if (normalizedType === "RECEBIMENTO") return C.blue;

  return C.violetInk;
}

// Código curto só de exibição (derivado do id real) — não é um novo campo de
// negócio, é puramente uma facilidade visual pra referenciar o item.
function shortCode(id: string) {
  const clean = id.replace(/^(pending-addressing|missing-default-address):/, "").replace(/[^a-zA-Z0-9]/g, "");
  return `QR-${clean.slice(0, 6).toUpperCase()}`;
}

function isSameMonth(iso: string | null | undefined, now: Date) {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

// Fontes EXATAS do design Infinoos: corpo em Manrope, valores de KPI em Space
// Grotesk, dados tabulares (código, qtd.) em JetBrains Mono.
const SPACE = "font-[family-name:var(--font-space-grotesk)]";
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

export function StockQuarantinePageClient({
  depositantes,
  items,
  allItems,
  initialDepositanteId,
  initialStatus,
  canSelectDepositante,
  canConfirm,
}: StockQuarantinePageClientProps) {
  const router = useRouter();
  const { theme } = useTheme();
  // Guarda de montagem: o layout raiz usa defaultTheme="dark", então o SSR
  // sempre renderiza como se fosse escuro. Sem essa guarda, useTheme()
  // devolve o tema real já na primeira renderização do cliente — se o
  // usuário estiver no modo claro, o React troca os estilos logo após
  // montar e o React acusa mismatch de hidratação. Assume escuro até montar
  // (igual ao SSR) e só depois reflete o tema real.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? theme === "dark" : true;
  const [isPending, startTransition] = useTransition();
  const [depositanteId, setDepositanteId] = useState(initialDepositanteId);
  const [status, setStatus] = useState(initialStatus);
  const [tableMode, setTableMode] = useState<TableMode>("status");
  const [selectedItem, setSelectedItem] = useState<StockQuarantineItem | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Paleta Infinoos (mesmos tokens da NF-e) — clara/escura via useTheme, sem
  // depender de classes dark: (mantém o padrão já em uso nesta tela).
  const C = {
    panel: isDark ? "#101B30" : "#FFFFFF",
    panelSoft: isDark ? "#0D1526" : "#F6F8FC",
    border: isDark ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.10)",
    borderSoft: isDark ? "rgba(148,163,184,0.09)" : "rgba(15,23,42,0.06)",
    text: isDark ? "#F1F5F9" : "#0F172A",
    muted: isDark ? "#8695AD" : "#64748B",
    faint: isDark ? "#64748B" : "#94A3B8",
    violet: "#8B5CF6",
    violetInk: isDark ? "#C4B5FD" : "#7C3AED",
    blue: isDark ? "#3B82F6" : "#2563EB",
    emerald: isDark ? "#10B981" : "#059669",
    amber: isDark ? "#F59E0B" : "#B45309",
    rose: isDark ? "#F43F5E" : "#E11D48",
    rowHover: isDark ? "rgba(148,163,184,0.05)" : "rgba(15,23,42,0.035)",
    active: "rgba(139,92,246,0.10)",
    scrim: isDark ? "rgba(4,8,18,0.62)" : "rgba(15,23,42,0.45)",
  };

  const depositanteOptions = useMemo(
    () => [{ id: "", nome: "Todos depositantes" }, ...depositantes],
    [depositantes],
  );

  const now = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    const emQuarentena = allItems.filter((item) => item.status === "EM_QUARENTENA");
    const awaitingDecision = emQuarentena.filter(
      (item) => !item.isSystemHold && !item.isMissingDefaultAddress && !item.depositanteDecision,
    );
    const discardedThisMonth = allItems.filter(
      (item) => item.status === "DESCARTADO" && isSameMonth(item.resolvedAt ?? item.createdAt, now),
    );
    const pendingAddressing = allItems.filter((item) => item.isMissingDefaultAddress);

    return [
      {
        label: "Total em quarentena",
        shortLabel: "Total",
        value: emQuarentena.length,
        // Número fica neutro (igual ao mock), mas o destaque de "ativo" usa
        // azul em vez da cor do texto — senão, como este é o filtro padrão
        // já ativo ao abrir a página, a borda/sombra saía quase preta no
        // tema claro (cor do texto = quase preto).
        color: C.text,
        accent: C.blue,
        mode: "status" as TableMode,
      },
      {
        label: "Aguardando decisão",
        shortLabel: "Aguardando",
        value: awaitingDecision.length,
        color: C.amber,
        accent: C.amber,
        mode: "awaiting-decision" as TableMode,
      },
      {
        label: "Descartados no mês",
        shortLabel: "Descartados",
        value: discardedThisMonth.length,
        color: C.rose,
        accent: C.rose,
        mode: "discarded-this-month" as TableMode,
      },
      {
        label: "Sem endereço padrão",
        shortLabel: "Sem endereço",
        value: pendingAddressing.length,
        color: C.violetInk,
        accent: C.violetInk,
        mode: "pending-addressing" as TableMode,
      },
    ];
  }, [allItems, now, C.text, C.blue, C.amber, C.rose, C.violetInk]);

  const displayItems = useMemo(() => {
    let base: StockQuarantineItem[];
    if (tableMode === "pending-addressing") {
      base = allItems.filter((item) => item.isMissingDefaultAddress);
    } else if (tableMode === "awaiting-decision") {
      base = allItems.filter(
        (item) =>
          item.status === "EM_QUARENTENA" &&
          !item.isSystemHold &&
          !item.isMissingDefaultAddress &&
          !item.depositanteDecision,
      );
    } else if (tableMode === "discarded-this-month") {
      base = allItems.filter(
        (item) => item.status === "DESCARTADO" && isSameMonth(item.resolvedAt ?? item.createdAt, now),
      );
    } else {
      base = items;
    }

    return base;
  }, [allItems, items, tableMode, now]);

  function handleStatClick(mode: TableMode) {
    setTableMode(mode);
    if (mode === "status" && status !== "EM_QUARENTENA") {
      setStatus("EM_QUARENTENA");
      updateRoute({ status: "EM_QUARENTENA" });
    }
  }

  function updateRoute(next: { depositanteId?: string; status?: string }) {
    const params = new URLSearchParams();
    const nextDepositanteId = next.depositanteId ?? depositanteId;
    const nextStatus = next.status ?? status;

    if (nextDepositanteId) params.set("depositante", nextDepositanteId);
    if (nextStatus && nextStatus !== "EM_QUARENTENA") params.set("status", nextStatus);

    startTransition(() => {
      router.replace(`/estoque/quarentena${params.toString() ? `?${params.toString()}` : ""}`);
    });
  }

  async function confirmQuarantine(item: StockQuarantineItem) {
    if (isConfirming) return;

    setFeedback(null);
    setIsConfirming(true);

    try {
      const response = await fetch(`/api/estoque/quarentena/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível confirmar a execução.");
      }

      setFeedback({
        type: "success",
        message: payload.message || "Execução física confirmada.",
      });
      setSelectedItem(null);
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível confirmar a execução.",
      });
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col" style={{ color: C.text, fontFamily: "var(--font-manrope), var(--font-sans), sans-serif" }}>
      {isPending ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: C.scrim, backdropFilter: "blur(2px)" }}>
          <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: C.panel, border: `0.8px solid ${C.border}`, color: C.text }}>
            <LoaderCircle size={20} className="animate-spin" style={{ color: C.violet }} />
            <span className="text-sm font-semibold">Carregando quarentena…</span>
          </div>
        </div>
      ) : null}

      {/* Cabeçalho (padrão rebranding: título + sino + som + tema) */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span className="rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100">
          Quarentena
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-24 pt-6 sm:px-8 lg:pb-12">
        <p className="text-sm" style={{ color: C.muted }}>
          Produtos retidos por avaria, vencimento ou falta de endereço padrão, aguardando decisão do
          depositante ou confirmação operacional.
        </p>

        {/* Stat cards */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {stats.map((stat) => {
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => handleStatClick(stat.mode)}
                className="flex flex-col gap-3 rounded-2xl p-5 text-left"
                style={{
                  background: C.panel,
                  border: `0.8px solid ${C.border}`,
                }}
              >
                <span className="flex h-[34px] items-center text-[13px] font-semibold" style={{ color: C.muted }}>
                  {stat.label}
                </span>
                <span className={`${SPACE} text-[30px] font-bold`} style={{ color: stat.color }}>
                  {stat.value.toLocaleString("pt-BR")}
                </span>
              </button>
            );
          })}
        </section>

        {/* Filter bar: abas segmentadas (padrão do app) + depositante */}
        <section className="flex flex-wrap items-center justify-center gap-2.5">
          <div
            className="flex flex-wrap items-center gap-1 rounded-xl p-1"
            style={{ background: C.panel, border: `0.8px solid ${C.border}` }}
          >
            {stats.map((stat) => (
              <QuarantineFilterTab
                key={stat.mode}
                active={tableMode === stat.mode}
                count={stat.value}
                onClick={() => handleStatClick(stat.mode)}
                C={C}
              >
                {stat.shortLabel}
              </QuarantineFilterTab>
            ))}
          </div>

          {canSelectDepositante ? (
            <SelectPill
              value={depositanteId}
              onChange={(value) => {
                setTableMode("status");
                setDepositanteId(value);
                updateRoute({ depositanteId: value });
              }}
              style={{ background: C.panel, color: C.text, border: `0.8px solid ${C.border}` }}
            >
              {depositanteOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nome}
                </option>
              ))}
            </SelectPill>
          ) : null}
        </section>

        {feedback ? (
          <div
            className="rounded-2xl border px-4 py-3 text-sm font-semibold"
            style={
              feedback.type === "success"
                ? { background: `${C.emerald}14`, borderColor: `${C.emerald}55`, color: C.emerald }
                : { background: `${C.rose}14`, borderColor: `${C.rose}55`, color: C.rose }
            }
          >
            {feedback.message}
          </div>
        ) : null}

        {/* Table */}
        <section className="overflow-hidden rounded-2xl" style={{ background: C.panel, border: `0.8px solid ${C.border}` }}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr style={{ borderBottom: `0.8px solid ${C.border}` }}>
                  {["ID", "Produto", "Qtd.", "Depositante", "Endereço", "Motivo", "Registro", "Status", ""].map(
                    (header, i) => (
                      <th
                        key={header || `sp-${i}`}
                        className="whitespace-nowrap px-4 py-3 text-[10.5px] font-bold uppercase tracking-wider"
                        style={{ color: C.muted }}
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {displayItems.length ? (
                  displayItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: `0.8px solid ${C.borderSoft}` }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = C.rowHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 text-xs`} style={{ color: C.muted }}>
                        {shortCode(item.id)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="grid h-[42px] w-[42px] shrink-0 place-items-center overflow-hidden rounded-[14px]"
                            style={{ background: C.panelSoft, color: C.violetInk }}
                          >
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                            ) : (
                              <PackageOpen size={18} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="max-w-[240px] truncate text-[13.5px] font-bold"
                              style={{ color: C.text }}
                              title={item.productName}
                            >
                              {item.productName}
                            </p>
                            <p className={`${MONO} text-[11.5px]`} style={{ color: C.muted }}>
                              {item.sku}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 text-[13px] font-bold`} style={{ color: C.text }}>
                        {item.quantityLabel}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12.5px]" style={{ color: C.muted }}>
                        {item.depositante}
                      </td>
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 text-xs font-bold`} style={{ color: C.text }}>
                        {item.endereco}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge color={motivoColor(item.tipo, C)} label={formatQuarantineType(item.tipo)} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px]" style={{ color: C.muted }}>
                        <p className="font-semibold" style={{ color: C.text }}>
                          {item.createdBy}
                        </p>
                        <p className={`${MONO} text-[11.5px]`} style={{ color: C.muted }}>
                          {item.createdAtLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={item.status} label={item.statusLabel} C={C} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span style={{ color: C.faint }}>›</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: C.muted }}>
                      {tableMode === "pending-addressing"
                        ? "Nenhum produto sem endereço padrão para recebimento."
                        : "Nenhum item encontrado para os filtros atuais."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedItem ? (
        <QuarantineDrawer
          item={selectedItem}
          C={C}
          canConfirm={canConfirm}
          isConfirming={isConfirming}
          onClose={() => setSelectedItem(null)}
          onConfirm={confirmQuarantine}
          onViewPhoto={setSelectedPhoto}
          onEditProduct={(productId) => router.push(`/configuracoes/produtos/${productId}/editar`)}
        />
      ) : null}

      {selectedPhoto ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center p-4"
          style={{ background: "rgba(4,8,18,0.8)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl"
            style={{ background: C.panel, border: `0.8px solid ${C.border}` }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4" style={{ borderBottom: `0.8px solid ${C.border}` }}>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: C.rose }}>
                  Evidência operacional
                </p>
                <h2 className={`${SPACE} mt-1 text-lg font-bold`} style={{ color: C.text }}>
                  Foto da avaria
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="grid h-10 w-10 place-items-center rounded-2xl transition hover:brightness-125"
                style={{ border: `0.8px solid ${C.border}`, color: C.muted }}
                aria-label="Fechar foto da avaria"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4" style={{ background: C.panelSoft }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto}
                alt="Foto ampliada da avaria"
                className="max-h-[76vh] max-w-full rounded-2xl object-contain shadow-xl"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Tokens = {
  panel: string;
  panelSoft: string;
  border: string;
  borderSoft: string;
  text: string;
  muted: string;
  faint: string;
  violet: string;
  violetInk: string;
  blue: string;
  emerald: string;
  amber: string;
  rose: string;
  rowHover: string;
  active: string;
  scrim: string;
};

function QuarantineDrawer({
  item,
  C,
  canConfirm,
  isConfirming,
  onClose,
  onConfirm,
  onViewPhoto,
  onEditProduct,
}: {
  item: StockQuarantineItem;
  C: Tokens;
  canConfirm: boolean;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: (item: StockQuarantineItem) => void;
  onViewPhoto: (url: string) => void;
  onEditProduct: (productId: string) => void;
}) {
  // Registros de recebimento com divergência geram um `reason` detalhado
  // (pedido, previsto x recebido, endereço); registros mais simples às vezes
  // só repetem o próprio motivo (ex.: "Avaria") — nesse caso a caixa abaixo
  // fica redundante com o campo "Motivo" da lista e não deve aparecer.
  const hasDistinctReason = item.reason.trim().toLowerCase() !== formatQuarantineType(item.tipo).trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ animation: "overlayFade .2s ease" }}>
      <button
        type="button"
        aria-label="Fechar detalhe da quarentena"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: C.scrim }}
      />
      <aside
        className="relative flex h-full w-full max-w-[460px] flex-col overflow-y-auto"
        style={{
          background: C.panel,
          borderLeft: `0.8px solid ${C.border}`,
          boxShadow: "-24px 0 60px rgba(3,7,18,0.35)",
          animation: "drawerIn .28s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div className="sticky top-0 z-10 px-6 pb-4 pt-[22px]" style={{ background: C.panel, backdropFilter: "blur(8px)", borderBottom: `0.8px solid ${C.borderSoft}` }}>
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 10 }}>
            <Badge color={motivoColor(item.tipo, C)} label={formatQuarantineType(item.tipo)} />
            <StatusPill status={item.status} label={item.statusLabel} C={C} />
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="grid h-[30px] w-[30px] place-items-center rounded-lg transition hover:brightness-125"
              style={{ color: C.muted, border: `0.8px solid ${C.borderSoft}` }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className={`${MONO} mb-1 text-[16px] font-bold`} style={{ color: C.muted }}>
            {shortCode(item.id)}
          </p>
          <h3 className="text-[17px] font-bold leading-tight" style={{ color: C.text }} title={item.productName}>
            {item.productName}
          </h3>
          <p className={`${MONO} mt-0.5 text-xs`} style={{ color: C.muted }}>
            {item.sku}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <FieldRow label="Motivo" value={formatQuarantineType(item.tipo)} C={C} />
            <FieldRow label="Depositante" value={item.depositante} C={C} />
            <FieldRow label="Quantidade retida" value={`${item.quantityLabel} un`} C={C} />
            <FieldRow label="Endereço" value={item.endereco} C={C} mono />
            <FieldRow label="Área" value={item.area} C={C} />
            <FieldRow label="Data de entrada" value={item.createdAtLabel} C={C} mono />
            <FieldRow label="Responsável" value={item.createdBy} C={C} />
          </div>

          {hasDistinctReason || item.resolutionHint ? (
            <section className="rounded-2xl p-4" style={{ background: C.panelSoft, border: `0.8px solid ${C.borderSoft}` }}>
              {hasDistinctReason ? (
                <>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.faint }}>
                    {item.isMissingDefaultAddress ? "Pendência operacional" : "Motivo da quarentena"}
                  </p>
                  <p className="text-sm leading-6" style={{ color: C.text }}>
                    {item.reason}
                  </p>
                </>
              ) : null}
              {item.resolutionHint ? (
                <div className={`rounded-xl p-3 text-sm ${hasDistinctReason ? "mt-3" : ""}`} style={{ background: `${C.amber}14`, color: C.amber }}>
                  <strong>Dica:</strong> {item.resolutionHint}
                </div>
              ) : null}
            </section>
          ) : null}

          {item.resolvedAtLabel || item.resolutionNotes ? (
            <section className="rounded-2xl p-4" style={{ background: C.panelSoft, border: `0.8px solid ${C.borderSoft}` }}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.faint }}>
                Registro
              </p>
              <div className="grid gap-2 text-sm" style={{ color: C.muted }}>
                {item.resolvedAtLabel ? (
                  <p>
                    Resolvido por <strong style={{ color: C.text }}>{item.resolvedBy || "Sistema"}</strong> em{" "}
                    <strong style={{ color: C.text }}>{item.resolvedAtLabel}</strong>
                  </p>
                ) : null}
                {item.resolutionNotes ? <p>Observação: {item.resolutionNotes}</p> : null}
              </div>
            </section>
          ) : null}

          {!item.isMissingDefaultAddress ? (
            <section className="rounded-2xl p-4" style={{ background: C.panelSoft, border: `0.8px solid ${C.borderSoft}` }}>
              <p className="mb-3 text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: C.violetInk }}>
                Foto da avaria
              </p>
              {item.fotoUrl ? (
                <button
                  type="button"
                  onClick={() => onViewPhoto(item.fotoUrl!)}
                  className="group relative block w-full overflow-hidden rounded-2xl text-left transition hover:-translate-y-0.5"
                  style={{ background: C.panel, border: `0.8px solid ${C.border}` }}
                  aria-label="Ampliar foto da avaria"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.fotoUrl} alt={`Foto da avaria de ${item.productName}`} className="h-52 w-full object-contain" />
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/35 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-950 shadow-xl">
                      <Eye size={16} />
                      Ampliar foto
                    </span>
                  </span>
                </button>
              ) : (
                <div
                  className="grid min-h-32 place-items-center rounded-2xl border border-dashed px-5 text-center text-sm font-semibold"
                  style={{ borderColor: C.border, color: C.muted }}
                >
                  Nenhuma foto de avaria registrada.
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-0 mt-auto px-6 py-4" style={{ background: C.panel, backdropFilter: "blur(8px)", borderTop: `0.8px solid ${C.borderSoft}` }}>
          {item.isMissingDefaultAddress ? (
            <button
              type="button"
              onClick={() => onEditProduct(item.productId)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[13px] font-extrabold text-white transition hover:brightness-110"
              style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
            >
              Editar produto
            </button>
          ) : item.status === "EM_QUARENTENA" && item.depositanteDecision ? (
            <div className="space-y-3">
              <div
                className="rounded-2xl p-4"
                style={
                  item.depositanteDecision === "DOAR"
                    ? { background: `${C.emerald}14`, border: `0.8px solid ${C.emerald}55` }
                    : { background: `${C.rose}14`, border: `0.8px solid ${C.rose}55` }
                }
              >
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
                  Decisão do depositante
                </p>
                <p className="mt-1 text-base font-extrabold" style={{ color: C.text }}>
                  {item.depositanteDecisionLabel}
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: C.muted }}>
                  {item.depositanteDecisionBy || "Depositante"}
                  {item.depositanteDecisionAtLabel ? ` em ${item.depositanteDecisionAtLabel}` : ""}
                </p>
                {item.depositanteDecisionNotes ? (
                  <p className="mt-2 text-sm" style={{ color: C.text }}>
                    {item.depositanteDecisionNotes}
                  </p>
                ) : null}
              </div>

              {canConfirm ? (
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => onConfirm(item)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[13px] font-extrabold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: item.depositanteDecision === "DOAR" ? C.emerald : C.rose }}
                >
                  {isConfirming ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                  {item.depositanteDecision === "DOAR"
                    ? `Confirmar que foi ${quarantineDonatedLabel(item.tipo).toLowerCase()}`
                    : "Confirmar que foi descartado"}
                </button>
              ) : null}
            </div>
          ) : item.status === "EM_QUARENTENA" ? (
            <p className="rounded-2xl px-4 py-3 text-sm font-semibold leading-6" style={{ background: `${C.amber}14`, color: C.amber }}>
              {item.tipo === "VENCIMENTO"
                ? "Aguardando o depositante decidir entre retirar ou descartar. O operador não pode definir este destino."
                : "Aguardando o depositante decidir entre doar/liberar ou descartar. O operador não pode definir este destino."}
            </p>
          ) : (
            <p className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: C.panelSoft, color: C.muted }}>
              Sem ação pendente para este item.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function FieldRow({ label, value, C, mono }: { label: string; value: string; C: Tokens; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[9px] text-[13.5px]" style={{ borderBottom: `0.8px solid ${C.borderSoft}` }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span className={`break-words text-right font-semibold ${mono ? MONO : ""}`} style={{ color: C.text }}>
        {value}
      </span>
    </div>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function StatusPill({ status, label, C }: { status: string; label: string; C: Tokens }) {
  const color =
    status === "LIBERADO" ? C.emerald : status === "DESCARTADO" ? C.rose : status === "SEM_ENDERECO_PADRAO" ? C.violetInk : C.amber;

  return <Badge color={color} label={label} />;
}

// Aba do filtro padrão (mesmo estilo das abas Entrada/Saída da NF-e): pílula
// com gradiente quando ativa, e um contador embutido ao lado do label.
function QuarantineFilterTab({
  active,
  count,
  onClick,
  C,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  C: Tokens;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-[9px] px-3.5 py-[7px] text-[13px] font-bold transition"
      style={{
        background: active ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent",
        color: active ? "#fff" : C.muted,
      }}
    >
      {children}
      <span
        className={`${MONO} rounded-full px-1.5 py-px text-[11px] font-bold`}
        style={{
          background: active ? "rgba(255,255,255,0.22)" : C.panelSoft,
          color: active ? "#fff" : C.faint,
        }}
      >
        {count.toLocaleString("pt-BR")}
      </span>
    </button>
  );
}

function SelectPill({
  value,
  onChange,
  style,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[42px] rounded-[11px] px-3 text-[13.5px] font-semibold outline-none"
      style={style}
    >
      {children}
    </select>
  );
}
