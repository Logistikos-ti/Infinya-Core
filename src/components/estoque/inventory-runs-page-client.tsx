"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleCheck, LoaderCircle, Play, Search, X } from "lucide-react";
import { useTheme } from "next-themes";

import type { InventoryRun, InventoryRunStage } from "@/lib/inventory-runs";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

type Option = { id: string; nome: string };

type InventoryRunsPageClientProps = {
  depositantes: Option[];
  responsaveis: Option[];
  areas: { value: string; label: string }[];
  runs: InventoryRun[];
  initialDepositanteId: string;
  canSelectDepositante: boolean;
};

type Tokens = ReturnType<typeof buildTokens>;

const SPACE = "font-[family-name:var(--font-space-grotesk)]";
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

function buildTokens(isDark: boolean) {
  return {
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
    scrim: isDark ? "rgba(4,8,18,0.62)" : "rgba(15,23,42,0.45)",
  };
}

function stageLabel(stage: InventoryRunStage) {
  if (stage === "PROGRAMADO") return "Programado";
  if (stage === "EM_ANDAMENTO") return "Em contagem";
  if (stage === "CONCLUIDO") return "Concluído";
  return "Cancelado";
}

function stageColor(stage: InventoryRunStage, C: Tokens) {
  if (stage === "PROGRAMADO") return C.blue;
  if (stage === "EM_ANDAMENTO") return C.amber;
  if (stage === "CONCLUIDO") return C.emerald;
  return C.rose;
}

function typeLabel(type?: "CICLICO" | "GERAL") {
  return type === "GERAL" ? "Geral" : "Cíclico";
}

function typeColor(type: "CICLICO" | "GERAL" | undefined, C: Tokens) {
  return type === "GERAL" ? C.violetInk : C.blue;
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

function detailHref(run: InventoryRun) {
  return run.type === "GERAL" ? `/estoque/inventarios/geral/detalhe/${run.id}` : `/estoque/inventarios/${run.id}`;
}

export function InventoryRunsPageClient({
  depositantes,
  responsaveis,
  areas,
  runs,
  initialDepositanteId,
  canSelectDepositante,
}: InventoryRunsPageClientProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? theme === "dark" : true;
  const C = useMemo(() => buildTokens(isDark), [isDark]);

  const [depositanteId, setDepositanteId] = useState(initialDepositanteId);
  const [stage, setStage] = useState<InventoryRunStage>("PROGRAMADO");
  const [tipoFilter, setTipoFilter] = useState<"TODOS" | "CICLICO" | "GERAL">("TODOS");
  const [search, setSearch] = useState("");
  const [selectedRun, setSelectedRun] = useState<InventoryRun | null>(null);
  const [modalMode, setModalMode] = useState<{ kind: "create" } | { kind: "reschedule"; run: InventoryRun } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Só navega quando o filtro realmente muda por ação do usuário -- um
  // useEffect disparando no mount empurraria a navegação toda vez que este
  // componente é montado em qualquer lugar (não só na tela real).
  function handleDepositanteChange(value: string) {
    setDepositanteId(value);
    router.push(value ? `/estoque/inventarios?depositante=${value}` : "/estoque/inventarios");
  }

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
    const divergenciasAbertas = emAndamento.reduce((sum, run) => sum + run.divergentItems, 0);

    return { programados: programados.length, emAndamento: emAndamento.length, avgAccuracy, divergenciasAbertas };
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

  const depositanteOptions = useMemo(
    () => [{ id: "", nome: "Todos depositantes" }, ...depositantes],
    [depositantes],
  );

  async function callAction(url: string, body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({ type: "error", message: payload.error ?? "Não foi possível concluir a ação." });
        return false;
      }
      setFeedback({ type: "success", message: successMessage });
      router.refresh();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Falha de comunicação." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col" style={{ background: C.panel }}>
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span className="rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100">
          Inventário
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm" style={{ color: C.muted }}>
              Contagens cíclicas e inventários gerais — programe, execute e acompanhe.
            </p>
            <button
              type="button"
              onClick={() => setModalMode({ kind: "create" })}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[13px] font-extrabold text-white transition hover:brightness-110"
              style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
            >
              + Programar inventário
            </button>
          </div>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Programados" value={String(stats.programados)} color={C.blue} C={C} />
            <StatCard label="Em contagem" value={String(stats.emAndamento)} color={C.amber} C={C} />
            <StatCard label="Acurácia média (mês)" value={formatPercent(stats.avgAccuracy)} color={C.emerald} C={C} />
            <StatCard label="Divergências abertas" value={String(stats.divergenciasAbertas)} color={C.rose} C={C} />
          </section>

          <section className="flex flex-wrap items-center justify-center gap-2.5">
            <div className="flex flex-wrap items-center gap-1 rounded-xl p-1" style={{ background: C.panelSoft, border: `0.8px solid ${C.border}` }}>
              {(["PROGRAMADO", "EM_ANDAMENTO", "CONCLUIDO"] as InventoryRunStage[]).map((value) => (
                <FilterTab
                  key={value}
                  active={stage === value}
                  count={runs.filter((run) => run.stage === value).length}
                  onClick={() => setStage(value)}
                  C={C}
                >
                  {stageLabel(value)}
                </FilterTab>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.faint }} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ID, depositante, responsável..."
                className="h-[38px] w-[220px] rounded-[9px] pl-8 pr-3 text-[13px] outline-none"
                style={{ background: C.panelSoft, border: `0.8px solid ${C.border}`, color: C.text }}
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: C.panelSoft, border: `0.8px solid ${C.border}` }}>
              {(["TODOS", "CICLICO", "GERAL"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTipoFilter(value)}
                  className="rounded-[9px] px-3 py-[7px] text-[12.5px] font-bold transition"
                  style={{
                    background: tipoFilter === value ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent",
                    color: tipoFilter === value ? "#fff" : C.muted,
                  }}
                >
                  {value === "TODOS" ? "Todos" : value === "CICLICO" ? "Cíclico" : "Geral"}
                </button>
              ))}
            </div>

            {canSelectDepositante ? (
              <SelectPill value={depositanteId} onChange={handleDepositanteChange} C={C}>
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
              className="rounded-xl px-4 py-2.5 text-sm"
              style={{
                background: feedback.type === "success" ? `${C.emerald}14` : `${C.rose}14`,
                color: feedback.type === "success" ? C.emerald : C.rose,
              }}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl" style={{ border: `0.8px solid ${C.border}` }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr style={{ background: C.panelSoft }}>
                  {["ID", "Tipo", "Depositante / Zona", "Itens", "Responsável", "Data", "Acurácia", "Status", ""].map((label) => (
                    <th key={label} className="whitespace-nowrap px-4 py-3 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: C.muted }}>
                      Nenhum inventário {stageLabel(stage).toLowerCase()} encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((run) => (
                    <tr
                      key={`${run.type}-${run.id}`}
                      className="cursor-pointer transition"
                      style={{ borderTop: `0.8px solid ${C.borderSoft}` }}
                      onClick={() => setSelectedRun(run)}
                    >
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 text-xs`} style={{ color: C.muted }}>
                        {shortCode(run.id)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge color={typeColor(run.type, C)} label={typeLabel(run.type)} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13.5px] font-bold" style={{ color: C.text }}>
                          {run.depositante}
                        </p>
                        <p className={`${MONO} text-[11.5px]`} style={{ color: C.muted }}>
                          {run.area}
                        </p>
                      </td>
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 text-[13px] font-bold`} style={{ color: C.text }}>
                        {run.totalItems || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12.5px]" style={{ color: C.muted }}>
                        {run.responsavelNome ?? "—"}
                      </td>
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 text-xs`} style={{ color: C.muted }}>
                        {run.stage === "PROGRAMADO" ? formatDateTimeLabel(run.programadoPara) : run.createdAt}
                      </td>
                      <td
                        className={`${MONO} whitespace-nowrap px-4 py-3 text-[13px] font-bold`}
                        style={{ color: run.accuracy === null ? C.faint : run.accuracy < 1 ? C.amber : C.emerald }}
                      >
                        {formatPercent(run.accuracy)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge color={stageColor(run.stage, C)} label={stageLabel(run.stage)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span style={{ color: C.faint }}>›</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedRun ? (
        <RunDrawer
          run={selectedRun}
          C={C}
          busy={busy}
          onClose={() => setSelectedRun(null)}
          onStart={async () => {
            const ok = await callAction(`/api/estoque/inventarios/${selectedRun.id}/iniciar`, { tipo: selectedRun.type }, "Inventário iniciado.");
            if (ok) {
              setSelectedRun(null);
              router.push(detailHref(selectedRun));
            }
          }}
          onContinue={() => router.push(detailHref(selectedRun))}
          onCancel={async () => {
            const ok = await callAction(`/api/estoque/inventarios/${selectedRun.id}/cancelar`, { tipo: selectedRun.type }, "Inventário cancelado.");
            if (ok) setSelectedRun(null);
          }}
          onReschedule={() => setModalMode({ kind: "reschedule", run: selectedRun })}
        />
      ) : null}

      {modalMode ? (
        <ScheduleModal
          C={C}
          mode={modalMode}
          depositantes={depositantes}
          responsaveis={responsaveis}
          areas={areas}
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
    </div>
  );
}

function StatCard({ label, value, color, C }: { label: string; value: string; color: string; C: Tokens }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: C.panelSoft, border: `0.8px solid ${C.border}` }}>
      <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
        {label}
      </p>
      <p className={`${SPACE} mt-1.5 text-[22px] font-bold`} style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function FilterTab({ active, count, onClick, C, children }: { active: boolean; count: number; onClick: () => void; C: Tokens; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-[9px] px-3.5 py-[7px] text-[13px] font-bold transition"
      style={{ background: active ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent", color: active ? "#fff" : C.muted }}
    >
      {children}
      <span
        className={`${MONO} rounded-full px-1.5 py-px text-[11px] font-bold`}
        style={{ background: active ? "rgba(255,255,255,0.22)" : C.panel, color: active ? "#fff" : C.faint }}
      >
        {count.toLocaleString("pt-BR")}
      </span>
    </button>
  );
}

function SelectPill({ value, onChange, C, children }: { value: string; onChange: (value: string) => void; C: Tokens; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-[38px] rounded-[9px] px-3 text-[12.5px] font-semibold outline-none"
      style={{ background: C.panelSoft, border: `0.8px solid ${C.border}`, color: C.text }}
    >
      {children}
    </select>
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

function shortCode(id: string) {
  return `INV-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
}

function RunDrawer({
  run,
  C,
  busy,
  onClose,
  onStart,
  onContinue,
  onCancel,
  onReschedule,
}: {
  run: InventoryRun;
  C: Tokens;
  busy: boolean;
  onClose: () => void;
  onStart: () => void;
  onContinue: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ animation: "overlayFade .2s ease" }}>
      <button type="button" aria-label="Fechar detalhe do inventário" onClick={onClose} className="absolute inset-0" style={{ background: C.scrim }} />
      <aside
        className="relative flex h-full w-full max-w-[460px] flex-col overflow-y-auto"
        style={{ background: C.panel, borderLeft: `0.8px solid ${C.border}`, boxShadow: "-24px 0 60px rgba(3,7,18,0.35)", animation: "drawerIn .28s cubic-bezier(.22,1,.36,1)" }}
      >
        <div className="sticky top-0 z-10 px-6 pb-4 pt-[22px]" style={{ background: C.panel, backdropFilter: "blur(8px)", borderBottom: `0.8px solid ${C.borderSoft}` }}>
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <Badge color={stageColor(run.stage, C)} label={stageLabel(run.stage)} />
            <Badge color={typeColor(run.type, C)} label={typeLabel(run.type)} />
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="grid h-[30px] w-[30px] place-items-center rounded-lg transition hover:brightness-125" style={{ color: C.muted, border: `0.8px solid ${C.borderSoft}` }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className={`${MONO} mb-1 text-[16px] font-bold`} style={{ color: C.muted }}>
            {shortCode(run.id)}
          </p>
          <h3 className="text-[17px] font-bold leading-tight" style={{ color: C.text }}>
            {run.titulo}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
            {run.depositante} · {run.area}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            {run.stage === "PROGRAMADO" ? <FieldRow label="Data programada" value={formatDateTimeLabel(run.programadoPara)} C={C} mono /> : null}
            <FieldRow label="Responsável" value={run.responsavelNome ?? "Não atribuído"} C={C} />
            <FieldRow label="Registro" value={run.createdAt} C={C} mono />
            {run.stage !== "PROGRAMADO" ? <FieldRow label="Itens" value={`${run.countedItems} / ${run.totalItems} contados`} C={C} mono /> : null}
            {run.divergentItems > 0 ? <FieldRow label="Divergências" value={String(run.divergentItems)} C={C} mono /> : null}
          </div>

          {run.stage === "CONCLUIDO" ? (
            <section className="rounded-2xl p-4" style={{ background: C.panelSoft, border: `0.8px solid ${C.borderSoft}` }}>
              <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: C.violetInk }}>
                Resultado da contagem
              </p>
              <p className={`${SPACE} text-[22px] font-bold`} style={{ color: run.accuracy === null ? C.faint : run.accuracy < 1 ? C.amber : C.emerald }}>
                {formatPercent(run.accuracy)}
              </p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>
                {run.countedItems} itens contados · {run.divergentItems} com divergência.
              </p>
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-0 mt-auto grid grid-cols-2 gap-2 px-6 py-4" style={{ background: C.panel, backdropFilter: "blur(8px)", borderTop: `0.8px solid ${C.borderSoft}` }}>
          {run.stage === "PROGRAMADO" ? (
            <>
              <button type="button" disabled={busy} onClick={onStart} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60" style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Iniciar contagem
              </button>
              <button type="button" disabled={busy} onClick={onReschedule} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13px] font-bold transition hover:brightness-110 disabled:opacity-60" style={{ background: C.panelSoft, color: C.text, border: `0.8px solid ${C.border}` }}>
                <CalendarClock className="h-4 w-4" />
                Reagendar
              </button>
            </>
          ) : run.stage === "EM_ANDAMENTO" ? (
            <>
              <button type="button" onClick={onContinue} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13px] font-extrabold text-white transition hover:brightness-110" style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}>
                <Play className="h-4 w-4" />
                Continuar contagem
              </button>
              <button type="button" disabled={busy} onClick={onCancel} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13px] font-bold transition hover:brightness-110 disabled:opacity-60" style={{ background: `${C.rose}14`, color: C.rose, border: `0.8px solid ${C.rose}35` }}>
                Cancelar inventário
              </button>
            </>
          ) : run.stage === "CONCLUIDO" ? (
            <button type="button" onClick={onContinue} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13px] font-bold transition hover:brightness-110" style={{ background: C.panelSoft, color: C.text, border: `0.8px solid ${C.border}` }}>
              <CircleCheck className="h-4 w-4" />
              Ver histórico completo
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

type ScheduleModalMode = { kind: "create" } | { kind: "reschedule"; run: InventoryRun };

function ScheduleModal({
  C,
  mode,
  depositantes,
  responsaveis,
  areas,
  defaultDepositanteId,
  canSelectDepositante,
  busy,
  onClose,
  onSubmit,
}: {
  C: Tokens;
  mode: ScheduleModalMode;
  depositantes: Option[];
  responsaveis: Option[];
  areas: { value: string; label: string }[];
  defaultDepositanteId: string;
  canSelectDepositante: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    tipo: "CICLICO" | "GERAL";
    depositanteId: string;
    area?: string;
    titulo?: string;
    observacoes?: string;
    responsavelId?: string;
    programadoPara: string;
  }) => void;
}) {
  const isReschedule = mode.kind === "reschedule";
  const editingRun = isReschedule ? mode.run : null;

  const [tipo, setTipo] = useState<"CICLICO" | "GERAL">(editingRun?.type === "GERAL" ? "GERAL" : "CICLICO");
  const [depositanteId, setDepositanteId] = useState(editingRun?.depositanteId ?? defaultDepositanteId ?? depositantes[0]?.id ?? "");
  const [area, setArea] = useState("");
  const [responsavelId, setResponsavelId] = useState(editingRun?.responsavelId ?? "");
  const [programadoPara, setProgramadoPara] = useState(() =>
    editingRun?.programadoPara ? toDateTimeLocalValue(new Date(editingRun.programadoPara)) : toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [observacoes, setObservacoes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: C.scrim }}>
      <div className="w-full max-w-[420px] rounded-2xl p-6" style={{ background: C.panel, border: `0.8px solid ${C.border}`, boxShadow: "0 40px 80px rgba(3,7,18,0.5)" }}>
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: C.violetInk }}>
          Inventário
        </p>
        <h3 className="mt-1 text-[18px] font-bold" style={{ color: C.text }}>
          {isReschedule ? "Reagendar inventário" : "Programar inventário"}
        </h3>

        <div className="mt-5 space-y-4">
          {!isReschedule ? (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                Tipo
              </p>
              <div className="flex gap-1 rounded-xl p-1" style={{ background: C.panelSoft, border: `0.8px solid ${C.border}` }}>
                {(["CICLICO", "GERAL"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipo(value)}
                    className="flex-1 rounded-[9px] py-2 text-[13px] font-bold transition"
                    style={{ background: tipo === value ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent", color: tipo === value ? "#fff" : C.muted }}
                  >
                    {value === "CICLICO" ? "Cíclico" : "Geral"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <FieldRow label="Tipo" value={typeLabel(editingRun?.type)} C={C} />
          )}

          {!isReschedule ? (
            <div className={`grid gap-3 ${tipo === "CICLICO" ? "grid-cols-2" : "grid-cols-1"}`}>
              {canSelectDepositante ? (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                    Depositante
                  </span>
                  <select
                    value={depositanteId}
                    onChange={(event) => setDepositanteId(event.target.value)}
                    className="h-[42px] w-full rounded-[10px] px-3 text-[13px] outline-none"
                    style={{ background: C.panelSoft, border: `0.8px solid ${C.border}`, color: C.text }}
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

              {tipo === "CICLICO" ? (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                    Área
                  </span>
                  <select
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    className="h-[42px] w-full rounded-[10px] px-3 text-[13px] outline-none"
                    style={{ background: C.panelSoft, border: `0.8px solid ${C.border}`, color: C.text }}
                  >
                    <option value="">Todas as áreas</option>
                    {areas.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
              Responsável
            </span>
            <select
              value={responsavelId}
              onChange={(event) => setResponsavelId(event.target.value)}
              className="h-[42px] w-full rounded-[10px] px-3 text-[13px] outline-none"
              style={{ background: C.panelSoft, border: `0.8px solid ${C.border}`, color: C.text }}
            >
              <option value="">Sem responsável definido</option>
              {responsaveis.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
              Data/hora programada
            </span>
            <input
              type="datetime-local"
              value={programadoPara}
              onChange={(event) => setProgramadoPara(event.target.value)}
              className={`${MONO} h-[42px] w-full rounded-[10px] px-3 text-[13px] outline-none`}
              style={{ background: C.panelSoft, border: `0.8px solid ${C.border}`, color: C.text }}
            />
          </label>

          {!isReschedule ? (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                Observações
              </span>
              <textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={2}
                placeholder="Notas sobre o inventário..."
                className="w-full rounded-[10px] px-3 py-2 text-[13px] outline-none"
                style={{ background: C.panelSoft, border: `0.8px solid ${C.border}`, color: C.text }}
              />
            </label>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-[13px] font-bold transition hover:brightness-110" style={{ background: C.panelSoft, color: C.text, border: `0.8px solid ${C.border}` }}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !depositanteId || !programadoPara}
            onClick={() =>
              onSubmit({
                tipo,
                depositanteId,
                area: area || undefined,
                observacoes: observacoes || undefined,
                responsavelId: responsavelId || undefined,
                programadoPara: new Date(programadoPara).toISOString(),
              })
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-5 text-[13px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isReschedule ? "Reagendar" : "Programar"}
          </button>
        </div>
      </div>
    </div>
  );
}

