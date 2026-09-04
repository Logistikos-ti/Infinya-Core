"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Play, Search, Trash2, X } from "lucide-react";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

import type { InventoryRun, InventoryRunStage } from "@/lib/inventory-runs";
import type { CycleCountDetail } from "@/lib/stock-cycle-counts";
import type { GeneralInventoryDetail } from "@/lib/general-inventories";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { InventoryCountingView } from "@/components/estoque/inventory-counting-view";

type Option = { id: string; nome: string };

type InventoryRunsPageClientProps = {
  depositantes: Option[];
  responsaveis: Option[];
  runs: InventoryRun[];
  initialDepositanteId: string;
  canSelectDepositante: boolean;
  currentUserId: string;
};

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenHeadBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const manropeStyle: React.CSSProperties = { fontFamily: "var(--font-manrope), Manrope, sans-serif" };
const groteskStyle: React.CSSProperties = { fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" };
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

function stageLabel(stage: InventoryRunStage) {
  if (stage === "PROGRAMADO") return "Programado";
  if (stage === "EM_ANDAMENTO") return "Em contagem";
  if (stage === "CONCLUIDO") return "Concluído";
  return "Cancelado";
}

function stageColor(stage: InventoryRunStage) {
  if (stage === "PROGRAMADO") return "#3B82F6";
  if (stage === "EM_ANDAMENTO") return "#F59E0B";
  if (stage === "CONCLUIDO") return "#10B981";
  return "#F43F5E";
}

function typeLabel(type?: "CICLICO" | "GERAL") {
  return type === "GERAL" ? "Geral" : "Cíclico";
}

function typeColor(type: "CICLICO" | "GERAL" | undefined) {
  return type === "GERAL" ? "#EF4444" : "#3B82F6";
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatDateTimeLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function shortCode(id: string) {
  return `INV-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
}

const PAGE_SIZE = 10;

export function InventoryRunsPageClient({
  depositantes,
  responsaveis,
  runs,
  initialDepositanteId,
  canSelectDepositante,
  currentUserId,
}: InventoryRunsPageClientProps) {
  const router = useRouter();

  const [depositanteId, setDepositanteId] = useState(initialDepositanteId);
  const [stage, setStage] = useState<InventoryRunStage>("PROGRAMADO");
  const [tipoFilter, setTipoFilter] = useState<"TODOS" | "CICLICO" | "GERAL">("TODOS");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<InventoryRun | null>(null);
  const [modalMode, setModalMode] = useState<{ kind: "create" } | { kind: "reschedule"; run: InventoryRun } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string; tone: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<"list" | "counting">("list");
  const [countingRun, setCountingRun] = useState<InventoryRun | null>(null);

  const now = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    const programados = runs.filter((run) => run.stage === "PROGRAMADO");
    const emAndamento = runs.filter((run) => run.stage === "EM_ANDAMENTO");
    const concluidosMes = runs.filter(
      (run) =>
        run.stage === "CONCLUIDO" &&
        run.timestamp &&
        new Date(run.timestamp).getMonth() === now.getMonth() &&
        new Date(run.timestamp).getFullYear() === now.getFullYear(),
    );
    const accuracySamples = concluidosMes.filter((run) => run.accuracy !== null);
    const avgAccuracy = accuracySamples.length
      ? accuracySamples.reduce((sum, run) => sum + (run.accuracy ?? 0), 0) / accuracySamples.length
      : null;
    // Quantidade de inventários concluídos no mês que fecharam com alguma
    // divergência (não a soma de itens divergentes) -- mesmo escopo mensal
    // da acurácia média, ao lado.
    const divergencias = concluidosMes.filter((run) => run.divergentItems > 0).length;

    return { programados: programados.length, emAndamento: emAndamento.length, avgAccuracy, divergencias };
  }, [runs, now]);

  const filteredRuns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return runs
      .filter((run) => run.stage === stage)
      .filter((run) => tipoFilter === "TODOS" || run.type === tipoFilter)
      .filter((run) => {
        if (!term) return true;
        return (
          run.id.toLowerCase().includes(term) ||
          run.titulo.toLowerCase().includes(term) ||
          run.depositante.toLowerCase().includes(term) ||
          (run.responsavelNome ?? "").toLowerCase().includes(term)
        );
      });
  }, [runs, stage, tipoFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRuns = filteredRuns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const depositanteOptions = useMemo(() => [{ id: "", nome: "Todos depositantes" }, ...depositantes], [depositantes]);

  function showToast(msg: string, tone: "success" | "error") {
    setToast({ id: Date.now(), msg, tone });
    window.clearTimeout(toastTimerRef.current ?? undefined);
    toastTimerRef.current = window.setTimeout(() => setToast(null), tone === "success" ? 2200 : 4200);
  }

  function handleDepositanteChange(value: string) {
    setDepositanteId(value);
    setPage(1);
    router.push(value ? `/estoque/inventarios?depositante=${value}` : "/estoque/inventarios");
  }

  async function callAction(url: string, body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Não foi possível concluir a ação.", "error");
        return false;
      }
      showToast(successMessage, "success");
      router.refresh();
      return true;
    } catch {
      showToast("Falha de comunicação.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function enterCountingMode(run: InventoryRun) {
    setSelectedRun(null);
    setCountingRun(run);
    setMode("counting");
  }

  if (mode === "counting" && countingRun) {
    return (
      <div className="flex h-full flex-col" style={manropeStyle}>
        <TopHeader />
        <div className="min-h-0 flex-1">
          <InventoryCountingView
            run={countingRun}
            currentUserId={currentUserId}
            onBack={() => {
              setMode("list");
              setCountingRun(null);
              router.refresh();
            }}
            onFinished={() => {
              setMode("list");
              setCountingRun(null);
              router.refresh();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <TopHeader />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-3 sm:px-8 lg:pb-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <p className={`m-0 text-[14.5px] ${tokenTextSub}`}>Contagens cíclicas e gerais — programe, execute e acompanhe.</p>
          <button
            type="button"
            onClick={() => setModalMode({ kind: "create" })}
            className="flex h-[42px] items-center gap-2 rounded-[11px] px-5 text-[14px] font-extrabold transition hover:brightness-105"
            style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#FFFFFF", boxShadow: "0 8px 22px rgba(99,102,241,.32)" }}
          >
            + Programar inventário
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Programados" value={String(stats.programados)} color="#3B82F6" />
          <StatCard label="Em contagem" value={String(stats.emAndamento)} color="#F59E0B" />
          <StatCard label="Acurácia média (mês)" value={formatPercent(stats.avgAccuracy)} color="#10B981" />
          <StatCard label="Divergências (mês)" value={String(stats.divergencias)} color={stats.divergencias > 0 ? "#EF4444" : undefined} />
        </div>

        <div className="mb-3 flex justify-center">
          <div className={`inline-flex gap-0.5 rounded-xl border p-1 ${tokenBorder} ${tokenCardBg}`}>
            {(["PROGRAMADO", "EM_ANDAMENTO", "CONCLUIDO"] as InventoryRunStage[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStage(value);
                  setPage(1);
                }}
                className="h-[34px] whitespace-nowrap rounded-[9px] px-4 text-[13px] font-bold transition"
                style={{ background: stage === value ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent", color: stage === value ? "#fff" : undefined }}
              >
                <span className={stage === value ? "" : tokenTextSub}>{stageLabel(value)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className={`flex h-[42px] flex-1 items-center gap-2.5 rounded-[11px] border px-4 ${tokenBorder} ${tokenCardBg}`} style={{ minWidth: 200 }}>
            <Search className={`h-[15px] w-[15px] flex-shrink-0 ${tokenTextSub}`} />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar ID, depositante, responsável..."
              className={`w-full bg-transparent text-[13px] outline-none ${tokenText}`}
            />
          </div>

          <div className={`flex gap-0.5 rounded-xl border p-1 ${tokenBorder} ${tokenCardBg}`}>
            {(["TODOS", "CICLICO", "GERAL"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTipoFilter(value);
                  setPage(1);
                }}
                className="h-[34px] whitespace-nowrap rounded-[9px] px-3.5 text-[12.5px] font-bold transition"
                style={{ background: tipoFilter === value ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent", color: tipoFilter === value ? "#fff" : undefined }}
              >
                <span className={tipoFilter === value ? "" : tokenTextSub}>{value === "TODOS" ? "Todos" : value === "CICLICO" ? "Cíclico" : "Geral"}</span>
              </button>
            ))}
          </div>

          {canSelectDepositante ? (
            <select
              value={depositanteId}
              onChange={(event) => handleDepositanteChange(event.target.value)}
              className={`h-[42px] rounded-[11px] border px-3 text-[13.5px] font-semibold outline-none ${tokenBorder} ${tokenCardBg} ${tokenText}`}
            >
              {depositanteOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nome}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className={`flex flex-col overflow-hidden rounded-2xl rounded-b-none border border-b-0 ${tokenBorder} ${tokenCardBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr className={tokenHeadBg}>
                  {["ID", "Tipo", "Depositante / Zona", "SKUs", "Responsável", "Data", "Acurácia", "Status", ""].map((label, index) => (
                    <th
                      key={label || index}
                      className={`whitespace-nowrap px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] ${tokenTextSub} ${index === 3 || index === 6 ? "text-center" : ""}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={`px-4 py-12 text-center text-sm ${tokenTextSub}`}>
                      Nenhum inventário nesta etapa.
                    </td>
                  </tr>
                ) : (
                  pageRuns.map((run, i) => (
                    <tr
                      key={`${run.type}-${run.id}`}
                      className={`cursor-pointer transition hover:bg-[rgba(148,163,184,0.05)] ${i === 0 ? "" : `border-t ${tokenBorder}`}`}
                      onClick={() => setSelectedRun(run)}
                    >
                      <td className={`whitespace-nowrap px-4 py-3 text-xs font-bold ${tokenText} ${MONO}`}>{shortCode(run.id)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <TypeBadge color={typeColor(run.type)} label={typeLabel(run.type)} />
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <p className={`truncate text-[13.5px] font-semibold ${tokenText}`} title={run.depositante}>
                          {run.depositante}
                        </p>
                        <p className={`mt-px truncate text-[11.5px] ${tokenTextSub}`} title={run.area}>
                          {run.area}
                        </p>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-center text-xs ${tokenTextSub} ${MONO}`}>{run.totalItems || "—"}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-[12.5px] ${tokenTextSub}`}>{run.responsavelNome ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className={`text-xs ${tokenText} ${MONO}`}>{run.stage === "PROGRAMADO" ? formatDateTimeLabel(run.programadoPara) : run.createdAt}</p>
                        {run.stage === "CONCLUIDO" && run.timestamp ? (
                          <p className={`mt-0.5 text-[11px] ${MONO}`} style={{ color: "#10B981" }}>
                            ✓ {formatDateTimeLabel(new Date(run.timestamp).toISOString())}
                          </p>
                        ) : null}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-center text-[13px] font-extrabold ${MONO}`} style={{ color: run.accuracy === null ? undefined : run.accuracy < 1 ? "#F59E0B" : "#10B981" }}>
                        <span className={run.accuracy === null ? tokenTextSub : ""}>{formatPercent(run.accuracy)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StageBadge stage={run.stage} />
                      </td>
                      <td className={`px-4 py-3 text-right text-[13px] ${tokenTextSub}`}>›</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className={`flex flex-wrap items-center gap-3.5 border-t px-5 py-2.5 text-[12.5px] ${tokenBorder} ${tokenTextSub}`}>
            <span>
              {filteredRuns.length === 0 ? "0" : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredRuns.length)}`} de {filteredRuns.length}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border ${tokenBorder} ${tokenTextSub} disabled:opacity-40`}
            >
              ‹
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border ${tokenBorder} ${tokenTextSub} disabled:opacity-40`}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {selectedRun ? (
        <RunDrawer
          run={selectedRun}
          busy={busy}
          onClose={() => setSelectedRun(null)}
          onStart={async () => {
            const ok = await callAction(`/api/estoque/inventarios/${selectedRun.id}/iniciar`, { tipo: selectedRun.type }, "Inventário iniciado.");
            if (ok) enterCountingMode({ ...selectedRun, stage: "EM_ANDAMENTO" });
          }}
          onContinue={() => enterCountingMode(selectedRun)}
          onCancel={async () => {
            const ok = await callAction(`/api/estoque/inventarios/${selectedRun.id}/cancelar`, { tipo: selectedRun.type }, "Inventário cancelado.");
            if (ok) setSelectedRun(null);
          }}
          onReschedule={() => setModalMode({ kind: "reschedule", run: selectedRun })}
        />
      ) : null}

      {modalMode ? (
        <ScheduleModal
          mode={modalMode}
          depositantes={depositantes}
          responsaveis={responsaveis}
          defaultDepositanteId={depositanteId}
          canSelectDepositante={canSelectDepositante}
          busy={busy}
          onClose={() => setModalMode(null)}
          onSubmit={async (payload) => {
            const isReschedule = modalMode.kind === "reschedule";
            const url = isReschedule
              ? `/api/estoque/inventarios/${(modalMode as { kind: "reschedule"; run: InventoryRun }).run.id}/reagendar`
              : "/api/estoque/inventarios/programar";
            const ok = await callAction(
              url,
              isReschedule
                ? { tipo: (modalMode as { kind: "reschedule"; run: InventoryRun }).run.type, programadoPara: payload.programadoPara, responsavelId: payload.responsavelId }
                : payload,
              isReschedule ? "Inventário reagendado." : "Inventário programado.",
            );
            if (ok) {
              setModalMode(null);
              setSelectedRun(null);
            }
          }}
        />
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

function TopHeader() {
  return (
    <header className={`flex h-[68px] flex-shrink-0 items-center gap-4 border-b px-5 sm:px-8 ${tokenBorder}`}>
      <span
        className="rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100"
        style={groteskStyle}
      >
        Inventário
      </span>
      <div className="flex-1" />
      <NotificationBell />
      <ThemeToggle />
    </header>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-5 ${tokenBorder} ${tokenCardBg}`}>
      <span className={`flex h-[20px] items-center text-[13px] font-semibold ${tokenTextSub}`}>{label}</span>
      <span className="text-[30px] font-bold" style={{ ...groteskStyle, color }}>
        <span className={color ? "" : tokenText}>{value}</span>
      </span>
    </div>
  );
}

function StageBadge({ stage }: { stage: InventoryRunStage }) {
  const color = stageColor(stage);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: `${color}1a`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {stageLabel(stage)}
    </span>
  );
}

function TypeBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-lg px-2.5 py-[3px] text-[11.5px] font-bold" style={{ background: `${color}1a`, color }}>
      {label}
    </span>
  );
}

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b py-[9px] text-[13.5px] ${tokenBorder}`}>
      <span className={tokenTextSub}>{label}</span>
      <span className={`break-words text-right font-semibold ${tokenText} ${mono ? MONO : ""}`}>{value}</span>
    </div>
  );
}

// Produto(s) que a contagem cíclica/geral vai inventariar -- vista comum só
// pra exibição no drawer (dado real, buscado sob demanda quando o drawer
// abre; não faz parte do resumo leve de InventoryRun).
type DrawerItem = { id: string; sku: string; nome: string; endereco: string; esperado: number | null; contado: number | null };

function mapCycleDrawerItems(detail: CycleCountDetail): DrawerItem[] {
  return detail.items.map((item) => ({
    id: item.id,
    sku: item.sku,
    nome: item.productName,
    endereco: item.endereco,
    esperado: item.systemQuantityRaw,
    contado: item.countedQuantityRaw,
  }));
}

function mapGeneralDrawerItems(detail: GeneralInventoryDetail): DrawerItem[] {
  return detail.itens.map((item) => ({
    id: item.id,
    sku: item.sku,
    nome: item.nome,
    endereco: item.enderecos.join(", ") || "—",
    esperado: item.quantidadeSistema,
    contado: item.quantidadeContada,
  }));
}

function RunDrawer({
  run,
  busy,
  onClose,
  onStart,
  onContinue,
  onCancel,
  onReschedule,
}: {
  run: InventoryRun;
  busy: boolean;
  onClose: () => void;
  onStart: () => void;
  onContinue: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [items, setItems] = useState<DrawerItem[] | null>(null);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setItemsLoading(true);
    setItems(null);

    // Programado ainda não tem itens gravados de verdade -- a varredura de
    // produtos só acontece na hora de iniciar (pro Geral, snapshotGeneralInventoryItems;
    // pro Cíclico, insertCycleCountItems), pra não usar um retrato de estoque
    // desatualizado. Mostra uma prévia (produtos ativos do depositante) em vez de "—".
    if (run.stage === "PROGRAMADO") {
      fetch(`/api/estoque/inventarios/produtos?depositanteId=${run.depositanteId}&activeOnly=true`)
        .then((response) => response.json())
        .then((payload: { products?: { id: string; sku: string; nome: string; quantidadeAtual?: number }[] }) => {
          if (cancelled) return;
          // Cíclico escopado a um único produto (campo "Produto" do modal de
          // programar) só varre esse SKU quando iniciar -- a prévia respeita
          // o mesmo escopo em vez de listar todo o catálogo ativo.
          const scoped = run.produtoId ? (payload.products ?? []).filter((p) => p.id === run.produtoId) : (payload.products ?? []);
          // "esperado" ainda não existe de verdade (só é gravado ao iniciar) --
          // usa o estoque atual como aproximação, é a mesma soma que vira
          // quantidade_sistema quando o inventário começa de fato.
          setItems(scoped.map((p) => ({ id: p.id, sku: p.sku, nome: p.nome, endereco: "—", esperado: p.quantidadeAtual ?? 0, contado: null })));
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setItemsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const isGeneral = run.type === "GERAL";
    const url = isGeneral ? `/api/estoque/inventarios-gerais/${run.id}` : `/api/estoque/inventarios/${run.id}`;
    fetch(url, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { result?: unknown }) => {
        if (cancelled || !payload.result) return;
        setItems(isGeneral ? mapGeneralDrawerItems(payload.result as GeneralInventoryDetail) : mapCycleDrawerItems(payload.result as CycleCountDetail));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [run.id, run.type, run.stage, run.depositanteId, run.produtoId]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar detalhe do inventário" onClick={onClose} className="absolute inset-0" style={{ background: "rgba(3,7,20,.4)" }} />
      <aside
        className={`relative flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l ${tokenBorder} ${tokenCardBg}`}
        style={{ boxShadow: "-24px 0 60px rgba(3,7,18,0.35)", animation: "drawerIn .22s ease-out" }}
      >
        <div className="px-6 pb-4 pt-[22px]" style={manropeStyle}>
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <StageBadge stage={run.stage} />
            <TypeBadge color={typeColor(run.type)} label={typeLabel(run.type)} />
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border transition hover:border-[#EF4444] hover:text-[#EF4444] ${tokenBorder} ${tokenTextSub}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className={`mb-1 text-[16px] font-bold ${tokenTextSub} ${MONO}`}>{shortCode(run.id)}</p>
          <h3 className={`text-[17px] font-bold leading-tight ${tokenText}`}>{run.titulo}</h3>
          <p className={`mt-0.5 text-xs ${tokenTextSub}`}>
            {run.depositante} · {run.area}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            {run.stage === "PROGRAMADO" ? <FieldRow label="Data programada" value={formatDateTimeLabel(run.programadoPara)} mono /> : null}
            <FieldRow label="Responsável" value={run.responsavelNome ?? "Não atribuído"} />
            <FieldRow label="Registro" value={run.createdAt} mono />
            {run.stage !== "PROGRAMADO" ? <FieldRow label="Itens" value={`${run.countedItems} / ${run.totalItems} contados`} mono /> : null}
            {run.divergentItems > 0 ? <FieldRow label="Divergências" value={String(run.divergentItems)} mono /> : null}
          </div>

          {run.stage === "CONCLUIDO" ? (
            <section className={`rounded-2xl border p-4 ${tokenBorder} ${tokenInputBg}`}>
              <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8B5CF6" }}>
                Resultado da contagem
              </p>
              <p className="text-[22px] font-bold" style={{ ...groteskStyle, color: run.accuracy === null ? undefined : run.accuracy < 1 ? "#F59E0B" : "#10B981" }}>
                <span className={run.accuracy === null ? tokenTextSub : ""}>{formatPercent(run.accuracy)}</span>
              </p>
              <p className={`mt-1 text-xs ${tokenTextSub}`}>
                {run.countedItems} itens contados · {run.divergentItems} com divergência.
              </p>
            </section>
          ) : null}

          <div>
            <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8B5CF6" }}>
              {run.stage === "PROGRAMADO" ? "Produtos a inventariar (prévia)" : "Itens"}
              {items ? ` (${items.length} SKU${items.length === 1 ? "" : "s"})` : ""}
            </p>
            {itemsLoading ? (
              <p className={`text-[12.5px] italic ${tokenTextSub}`}>Carregando produtos...</p>
            ) : items && items.length ? (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div key={item.id} className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 ${tokenBorder} ${tokenInputBg}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13px] font-semibold ${tokenText}`}>{item.nome}</p>
                      <p className={`mt-px text-[11px] ${tokenTextSub} ${MONO}`}>
                        {item.endereco === "—" ? item.sku : `${item.sku} · ${item.endereco}`}
                      </p>
                    </div>
                    {(() => {
                      const complete =
                        run.stage !== "PROGRAMADO" && item.contado !== null && item.esperado !== null && item.contado >= item.esperado;
                      return (
                        <span
                          className={`whitespace-nowrap text-[15px] font-extrabold ${MONO} ${complete ? "" : tokenText}`}
                          style={complete ? { color: "#10B981" } : undefined}
                        >
                          {run.stage === "PROGRAMADO" ? (item.esperado ?? "—") : `${item.contado ?? 0}/${item.esperado ?? "?"}`}
                        </span>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-[12.5px] italic ${tokenTextSub}`}>—</p>
            )}
          </div>
        </div>

        <div className={`sticky bottom-0 mt-auto grid grid-cols-2 gap-2 border-t px-6 py-4 ${tokenBorder} ${tokenCardBg}`}>
          {run.stage === "PROGRAMADO" ? (
            <div className="col-span-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onStart}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[13px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
              >
                {busy ? (
                  <MobileButtonSpinner size={16} />
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Iniciar
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onReschedule}
                className={`flex h-11 flex-1 items-center justify-center rounded-[10px] border text-[13px] font-bold transition hover:brightness-110 disabled:opacity-60 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Reagendar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancelOpen(true)}
                title="Cancelar inventário"
                aria-label="Cancelar inventário"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] border transition hover:brightness-110 disabled:opacity-60"
                style={{ background: "rgba(239,68,68,.14)", color: "#EF4444", borderColor: "rgba(239,68,68,.35)" }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : run.stage === "EM_ANDAMENTO" ? (
            <>
              <button
                type="button"
                onClick={onContinue}
                className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13px] font-extrabold text-white transition hover:brightness-110"
                style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
              >
                <Play className="h-4 w-4" />
                Continuar contagem
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancelOpen(true)}
                className="flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[13px] font-bold transition hover:brightness-110 disabled:opacity-60"
                style={{ background: "rgba(239,68,68,.14)", color: "#EF4444", borderColor: "rgba(239,68,68,.35)" }}
              >
                Cancelar inventário
              </button>
            </>
          ) : run.stage === "CONCLUIDO" ? (
            <button
              type="button"
              onClick={onContinue}
              className={`col-span-2 flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[13px] font-bold transition hover:brightness-110 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
            >
              <CircleCheck className="h-4 w-4" />
              Ver histórico completo
            </button>
          ) : null}
        </div>
      </aside>

      {confirmCancelOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" style={manropeStyle}>
          <div
            className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
            onClick={() => !busy && setConfirmCancelOpen(false)}
          />
          <div
            className={`relative flex w-[420px] max-w-[94vw] flex-col gap-4 rounded-[18px] border ${tokenBorder} ${tokenCardBg} p-[26px] shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(239,68,68,0.14)] text-[#EF4444]">
                <Trash2 className="h-[22px] w-[22px]" />
              </span>
              <div className="flex flex-col gap-[3px]">
                <span className={`text-[18px] font-bold ${tokenText}`} style={groteskStyle}>
                  Cancelar inventário?
                </span>
                <span className={`text-[13px] leading-[1.4] ${tokenTextSub}`}>Esta ação não pode ser desfeita.</span>
              </div>
            </div>
            <div className={`rounded-full border ${tokenBorder} bg-[rgba(148,163,184,0.06)] px-4 py-3.5 text-[13.5px] font-bold ${tokenText}`}>
              {shortCode(run.id)} · {run.depositante}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancelOpen(false)}
                className={`h-12 flex-1 rounded-full border text-sm font-bold transition-colors hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:opacity-50 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                style={{ background: "#EF4444", color: "#fff" }}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-extrabold shadow-[0_8px_22px_rgba(239,68,68,0.35)] transition-transform hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {busy ? <MobileButtonSpinner size={16} /> : "Cancelar inventário"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ScheduleModalMode = { kind: "create" } | { kind: "reschedule"; run: InventoryRun };

function ScheduleModal({
  mode,
  depositantes,
  responsaveis,
  defaultDepositanteId,
  canSelectDepositante,
  busy,
  onClose,
  onSubmit,
}: {
  mode: ScheduleModalMode;
  depositantes: Option[];
  responsaveis: Option[];
  defaultDepositanteId: string;
  canSelectDepositante: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    tipo: "CICLICO" | "GERAL";
    depositanteId: string;
    skuId?: string;
    titulo?: string;
    observacoes?: string;
    responsavelId?: string;
    programadoPara: string;
  }) => void;
}) {
  const isReschedule = mode.kind === "reschedule";
  const editingRun = isReschedule ? mode.run : null;

  const [tipo, setTipo] = useState<"CICLICO" | "GERAL">(editingRun?.type === "GERAL" ? "GERAL" : "CICLICO");
  const [depositanteId, setDepositanteId] = useState(editingRun?.depositanteId || defaultDepositanteId || depositantes[0]?.id || "");
  const [produtoId, setProdutoId] = useState("");
  const [produtos, setProdutos] = useState<{ id: string; sku: string; nome: string }[]>([]);
  const [produtosLoading, setProdutosLoading] = useState(false);
  const [produtosError, setProdutosError] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState(editingRun?.responsavelId ?? "");
  const [programadoPara, setProgramadoPara] = useState(() =>
    editingRun?.programadoPara ? toDateTimeLocalValue(new Date(editingRun.programadoPara)) : toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [observacoes, setObservacoes] = useState("");

  // Produto (contagem cíclica de um único SKU) é escopado ao depositante
  // selecionado -- recarrega sempre que ele muda.
  useEffect(() => {
    if (isReschedule || tipo !== "CICLICO" || !depositanteId) {
      setProdutos([]);
      setProdutosError(null);
      return;
    }
    let cancelled = false;
    setProdutosLoading(true);
    setProdutosError(null);
    fetch(`/api/estoque/inventarios/produtos?depositanteId=${depositanteId}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          products?: { id: string; sku: string; nome: string }[];
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setProdutos([]);
          setProdutosError(payload.error ?? "Não foi possível carregar os produtos.");
          return;
        }
        setProdutos(payload.products ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setProdutos([]);
          setProdutosError("Falha de comunicação ao carregar os produtos.");
        }
      })
      .finally(() => {
        if (!cancelled) setProdutosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isReschedule, tipo, depositanteId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: "rgba(3,7,20,.5)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
    >
      <style>{`@keyframes modalIn { from { transform:translateY(10px); opacity:0 } to { transform:none; opacity:1 } }`}</style>
      <div
        className={`w-[560px] max-w-[96vw] rounded-2xl border ${tokenBorder} ${tokenCardBg}`}
        style={{ boxShadow: "0 30px 60px rgba(3,7,18,.35)", animation: "modalIn .18s ease" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`border-b px-6 pb-3 pt-5 ${tokenBorder}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ ...groteskStyle, color: "#8B5CF6" }}>
            Inventário
          </p>
          <h3 className={`mt-1 text-[20px] font-bold ${tokenText}`} style={groteskStyle}>
            {isReschedule ? "Reagendar inventário" : "Programar inventário"}
          </h3>
        </div>

        <div className="flex flex-col gap-3 px-6 py-[18px]">
          {!isReschedule ? (
            <div>
              <p className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide ${tokenTextSub}`}>Tipo</p>
              <div className={`flex gap-2 rounded-xl border p-1 ${tokenBorder} ${tokenInputBg}`}>
                {(["CICLICO", "GERAL"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipo(value)}
                    className="flex-1 rounded-[9px] py-2 text-[13px] font-bold transition"
                    style={{ background: tipo === value ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent", color: tipo === value ? "#fff" : undefined }}
                  >
                    <span className={tipo === value ? "" : tokenTextSub}>{value === "CICLICO" ? "Cíclico" : "Geral"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <FieldRow label="Tipo" value={typeLabel(editingRun?.type)} />
          )}

          {!isReschedule ? (
            <div className="grid grid-cols-2 gap-3">
              {canSelectDepositante ? (
                <label className="block">
                  <span className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wide ${tokenTextSub}`}>Depositante</span>
                  <select
                    value={depositanteId}
                    onChange={(event) => {
                      setDepositanteId(event.target.value);
                      setProdutoId("");
                    }}
                    className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                  >
                    <option value="">Selecione...</option>
                    {depositantes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.nome}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block">
                <span className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wide ${tokenTextSub}`}>Responsável</span>
                <select
                  value={responsavelId}
                  onChange={(event) => setResponsavelId(event.target.value)}
                  className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                >
                  <option value="">Sem responsável definido</option>
                  {responsaveis.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label className="block">
              <span className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wide ${tokenTextSub}`}>Responsável</span>
              <select
                value={responsavelId}
                onChange={(event) => setResponsavelId(event.target.value)}
                className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                <option value="">Sem responsável definido</option>
                {responsaveis.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isReschedule && tipo === "CICLICO" ? (
            <label className="block">
              <span className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wide ${tokenTextSub}`}>Produto</span>
              <select
                value={produtoId}
                onChange={(event) => setProdutoId(event.target.value)}
                disabled={produtosLoading}
                className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] outline-none disabled:opacity-60 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                <option value="">
                  {produtosLoading ? "Carregando produtos..." : "Todos os produtos do depositante"}
                </option>
                {produtos.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.nome} — {option.sku}
                  </option>
                ))}
              </select>
              {produtosError ? <p className="mt-1 text-[11.5px] text-[#EF4444]">{produtosError}</p> : null}
            </label>
          ) : null}

          <label className="block">
            <span className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wide ${tokenTextSub}`}>Data/hora programada</span>
            <input
              type="datetime-local"
              value={programadoPara}
              onChange={(event) => setProgramadoPara(event.target.value)}
              className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText} ${MONO}`}
            />
          </label>

          {!isReschedule ? (
            <label className="block">
              <span className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wide ${tokenTextSub}`}>Observações</span>
              <textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={3}
                placeholder="Notas sobre o inventário..."
                className={`w-full resize-y rounded-[10px] border px-3 py-2 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              />
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2.5 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className={`flex h-10 items-center justify-center rounded-[9px] border px-4 text-[13px] font-bold transition hover:brightness-110 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !depositanteId || !programadoPara}
            onClick={() =>
              onSubmit({
                tipo,
                depositanteId,
                skuId: produtoId || undefined,
                observacoes: observacoes || undefined,
                responsavelId: responsavelId || undefined,
                programadoPara: new Date(programadoPara).toISOString(),
              })
            }
            className="flex h-10 items-center justify-center gap-2 rounded-[9px] px-5 text-[13px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
          >
            {busy ? <MobileButtonSpinner size={16} /> : isReschedule ? "Reagendar" : "Programar"}
          </button>
        </div>
      </div>
    </div>
  );
}
