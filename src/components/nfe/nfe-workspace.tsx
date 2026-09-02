"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Printer,
  Search,
  X,
} from "lucide-react";
import type { FiscalDocumentDetail } from "@/lib/fiscal-documents";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

type DepositanteOption = { id: string; nome: string };

type NfeWorkspaceProps = {
  documents: FiscalDocumentDetail[];
  depositanteOptions: DepositanteOption[];
  canFilterDepositante: boolean;
  availableMonths: string[];
  selectedMonth: string;
};

type FlowFilter = "TODAS" | "ENTRADA" | "SAIDA";
type StatusKey = "AUTORIZADA" | "PENDENTE" | "CANCELADA" | "DENEGADA";

const PER_PAGE = 10;

// ── Paleta Infinoos NF-e (adapta ao tema via tokens em globals.css `.nfe-theme`)
const C = {
  panel: "var(--nfe-panel)",
  panelSoft: "var(--nfe-panel-soft)",
  border: "var(--nfe-border)",
  borderSoft: "var(--nfe-border-soft)",
  text: "var(--nfe-text)",
  muted: "var(--nfe-muted)",
  faint: "var(--nfe-faint)",
  violet: "var(--nfe-violet)",
  violetSoft: "var(--nfe-violet-ink)",
  blue: "var(--nfe-blue)",
  emerald: "var(--nfe-emerald)",
  amber: "var(--nfe-amber)",
  rose: "var(--nfe-rose)",
  rowHover: "var(--nfe-row-hover)",
  active: "var(--nfe-active)",
  scrim: "var(--nfe-scrim)",
  drawer: "var(--nfe-drawer)",
  drawerHead: "var(--nfe-drawer-head)",
  drawerFoot: "var(--nfe-drawer-foot)",
};

// Fundo suave (alpha) de um badge a partir da sua cor de tinta.
function soft(color: string, pct = 14) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

// Fontes EXATAS do standalone: corpo/títulos em Manrope (fonte raiz), valores
// dos KPIs em Space Grotesk, e dados técnicos/tabulares (nº NF, valor, itens,
// CNPJ, chave) em JetBrains Mono.
const SPACE = "font-[family-name:var(--font-space-grotesk)]";
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

// Tokens da superfície NF-e — definidos aqui (e não em globals.css) para que a
// tela seja self-contained e siga o tema claro/escuro do app. Valores claros no
// modo claro; sobrescritos sob `.dark` para o modo escuro do mock Infinoos.
const NFE_THEME_CSS = `
.nfe-theme{--nfe-panel:#ffffff;--nfe-panel-soft:#f6f8fc;--nfe-border:rgba(15,23,42,.10);--nfe-border-soft:rgba(15,23,42,.06);--nfe-text:#0f172a;--nfe-muted:#64748b;--nfe-faint:#94a3b8;--nfe-violet:#8b5cf6;--nfe-violet-ink:#7c3aed;--nfe-blue:#2563eb;--nfe-emerald:#059669;--nfe-amber:#b45309;--nfe-rose:#e11d48;--nfe-row-hover:rgba(15,23,42,.035);--nfe-active:rgba(139,92,246,.10);--nfe-scrim:rgba(15,23,42,.45);--nfe-drawer:linear-gradient(180deg,#ffffff,#f6f8fc);--nfe-drawer-head:rgba(255,255,255,.92);--nfe-drawer-foot:rgba(246,248,252,.95);}
.dark .nfe-theme{--nfe-panel:#101b30;--nfe-panel-soft:#0d1526;--nfe-border:rgba(148,163,184,.14);--nfe-border-soft:rgba(148,163,184,.09);--nfe-text:#f1f5f9;--nfe-muted:#94a3b8;--nfe-faint:#64748b;--nfe-violet:#8b5cf6;--nfe-violet-ink:#c4b5fd;--nfe-blue:#3b82f6;--nfe-emerald:#10b981;--nfe-amber:#f59e0b;--nfe-rose:#f43f5e;--nfe-row-hover:rgba(148,163,184,.05);--nfe-active:rgba(139,92,246,.08);--nfe-scrim:rgba(4,8,18,.62);--nfe-drawer:linear-gradient(180deg,#101b30,#0b1226);--nfe-drawer-head:rgba(16,27,48,.9);--nfe-drawer-foot:rgba(11,18,38,.92);}
`;

export function NfeWorkspace({
  documents,
  depositanteOptions,
  canFilterDepositante,
  availableMonths,
  selectedMonth,
}: NfeWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [flow, setFlow] = useState<FlowFilter>("TODAS");
  const [search, setSearch] = useState("");
  const [depositante, setDepositante] = useState("");
  const [status, setStatus] = useState<"" | StatusKey>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FiscalDocumentDetail | null>(null);
  const [danfeDoc, setDanfeDoc] = useState<FiscalDocumentDetail | null>(null);

  // Popup "Exportar NF-e" (igual ao standalone).
  const [exportOpen, setExportOpen] = useState(false);
  const [expTipo, setExpTipo] = useState<FlowFilter>("TODAS");
  const [expStatus, setExpStatus] = useState<"" | StatusKey>("");
  const [expDepositante, setExpDepositante] = useState("");
  const [expDataIni, setExpDataIni] = useState("");
  const [expDataFim, setExpDataFim] = useState("");
  const [expFormato, setExpFormato] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [expIncluirZip, setExpIncluirZip] = useState(false);

  // Ao trocar de mês (nova busca no servidor), volta para a 1ª página.
  useEffect(() => {
    setPage(1);
  }, [selectedMonth]);

  // Trocar o mês navega com ?mes=YYYY-MM — o servidor recarrega só as notas
  // daquele mês, então os totais do mês são sempre exatos.
  function handleMonthChange(month: string) {
    startTransition(() => {
      router.replace(`/nfe?mes=${month}`, { scroll: false });
    });
  }

  // ── Estatísticas do mês (os `documents` já vêm recortados pelo mês) ──
  const stats = useMemo(() => {
    let entrada = 0;
    let saida = 0;
    let valor = 0;
    for (const doc of documents) {
      if (doc.flow === "ENTRADA") entrada += 1;
      else saida += 1;
      valor += doc.totalValue;
    }
    return { total: documents.length, entrada, saida, valorMes: valor };
  }, [documents]);

  const statusPresent = useMemo(() => {
    const set = new Set<StatusKey>();
    for (const doc of documents) set.add(statusOf(doc.protocolStatusCode).key);
    return set;
  }, [documents]);

  // ── Filtragem ──
  const filtered = useMemo(() => {
    const needle = normalize(search);
    return documents.filter((doc) => {
      if (flow !== "TODAS" && doc.flow !== flow) return false;
      if (depositante && doc.depositanteId !== depositante) return false;
      if (status && statusOf(doc.protocolStatusCode).key !== status) return false;
      if (needle) {
        const counterparty = doc.flow === "ENTRADA" ? doc.issuerName : doc.recipientName;
        const counterpartyDoc =
          doc.flow === "ENTRADA" ? doc.issuerDocument : doc.recipientDocument;
        const haystack = normalize(
          [
            doc.noteNumber,
            doc.accessKey,
            counterparty,
            counterpartyDoc,
            doc.issuerName,
            doc.recipientName,
            doc.depositante,
          ]
            .filter(Boolean)
            .join(" "),
        );
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [documents, flow, depositante, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  function resetPage<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  // Abre o popup já refletindo os filtros do que está na tela.
  function openExportModal() {
    setExpTipo(flow);
    setExpStatus(status);
    setExpDepositante(depositante);
    setExpDataIni("");
    setExpDataFim("");
    setExpFormato("csv");
    setExpIncluirZip(false);
    setExportOpen(true);
  }

  // Baixa o arquivo pela rota /api/nfe/exportar (CSV/XLSX/PDF, + XMLs em ZIP),
  // aplicando no servidor os filtros escolhidos no popup.
  function runExport() {
    const params = new URLSearchParams();
    params.set("mes", selectedMonth);
    if (expTipo !== "TODAS") params.set("tipo", expTipo);
    if (expStatus) params.set("status", expStatus);
    if (canFilterDepositante && expDepositante) params.set("depositante", expDepositante);
    if (expDataIni) params.set("de", expDataIni);
    if (expDataFim) params.set("ate", expDataFim);
    params.set("formato", expFormato);
    if (expIncluirZip) params.set("zip", "1");

    const a = document.createElement("a");
    a.href = `/api/nfe/exportar?${params.toString()}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setExportOpen(false);
  }

  return (
    <div
      className="nfe-theme relative flex h-full flex-col"
      style={{ color: C.text, fontFamily: "var(--font-manrope), var(--font-sans), sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{ __html: NFE_THEME_CSS }} />

      {/* Overlay de carregamento ao trocar de mês (nova busca no servidor) */}
      {isPending ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center"
          style={{ background: C.scrim, backdropFilter: "blur(2px)" }}
        >
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-4"
            style={{ background: C.panel, border: `0.8px solid ${C.border}`, color: C.text }}
          >
            <span style={{ color: C.violet }}>
              <MobileButtonSpinner size={26} />
            </span>
            <span className="text-sm font-semibold">Carregando NF-e…</span>
          </div>
        </div>
      ) : null}

      {/* Cabeçalho (padrão rebranding: título + sino + tema) */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span
          className="rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100"
        >
          NF-e
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-24 pt-6 sm:px-8 lg:pb-12">
        {/* Subtítulo + ações */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm" style={{ color: C.muted }}>
            Notas fiscais eletrônicas de entrada e saída.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="h-11 rounded-[11px] px-3.5 text-[13.5px] font-bold outline-none"
              style={{ background: C.panel, color: C.text, border: `0.8px solid ${C.border}` }}
            >
              {(availableMonths.includes(selectedMonth)
                ? availableMonths
                : [selectedMonth, ...availableMonths]
              ).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openExportModal}
              disabled={!documents.length}
              className="inline-flex h-11 items-center gap-2 rounded-[11px] px-4 text-[13.5px] font-bold transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: C.panel, color: C.text, border: `0.8px solid ${C.border}` }}
            >
              Exportar lista
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Total de NF-e">
            <div className="flex items-baseline gap-2">
              <span className={`${SPACE} text-[30px] font-bold`} style={{ color: C.text }}>
                {stats.total}
              </span>
              <span className="text-xs" style={{ color: C.muted }}>
                {stats.entrada} entrada · {stats.saida} saída
              </span>
            </div>
          </StatCard>
          <StatCard label="Valor total no mês">
            <span className={`${SPACE} text-[30px] font-bold`} style={{ color: C.emerald }}>
              {formatBRL(stats.valorMes)}
            </span>
          </StatCard>
        </section>

        {/* Filter bar — linha flex transparente (sem painel externo), igual ao HTML */}
        <section className="flex flex-wrap items-center gap-2.5">
          <div
            className="flex items-center gap-0.5 rounded-xl p-1"
            style={{ background: C.panel, border: `0.8px solid ${C.border}` }}
          >
            <FlowTab active={flow === "TODAS"} onClick={() => resetPage(setFlow)("TODAS")}>
              Todas
            </FlowTab>
            <FlowTab active={flow === "ENTRADA"} dot={C.blue} onClick={() => resetPage(setFlow)("ENTRADA")}>
              Entrada
            </FlowTab>
            <FlowTab active={flow === "SAIDA"} dot={C.violet} onClick={() => resetPage(setFlow)("SAIDA")}>
              Saída
            </FlowTab>
          </div>

          <div
            className="flex h-[42px] min-w-[240px] flex-1 items-center gap-2.5 rounded-[11px] px-4"
            style={{ background: C.panel, border: `0.8px solid ${C.border}` }}
          >
            <Search className="h-4 w-4" style={{ color: C.faint }} />
            <input
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
              placeholder="Buscar número, CNPJ, emitente..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              style={{ color: C.text }}
            />
          </div>

          {canFilterDepositante ? (
            <SelectPill value={depositante} onChange={resetPage(setDepositante)}>
              <option value="">Todos depositantes</option>
              {depositanteOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </SelectPill>
          ) : null}
          <SelectPill value={status} onChange={(v) => resetPage(setStatus)(v as "" | StatusKey)}>
            <option value="">Todos os status</option>
            {(["AUTORIZADA", "PENDENTE", "CANCELADA", "DENEGADA"] as StatusKey[])
              .filter((k) => statusPresent.has(k) || k !== "DENEGADA")
              .map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABEL[k]}
                </option>
              ))}
          </SelectPill>
        </section>

        {/* Table */}
        <section
          className="overflow-hidden rounded-2xl"
          style={{ background: C.panel, border: `0.8px solid ${C.border}` }}
        >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr style={{ borderBottom: `0.8px solid ${C.border}` }}>
                {["Número", "Tipo", "Emitente / Destinatário", "Depositante", "Data", "Valor", "Itens", "Status", ""].map(
                  (h, i) => (
                    <th
                      key={h || `sp-${i}`}
                      className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: C.faint }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {pageItems.length ? (
                pageItems.map((doc) => {
                  const counterparty = doc.flow === "ENTRADA" ? doc.issuerName : doc.recipientName;
                  const counterpartyDoc =
                    doc.flow === "ENTRADA" ? doc.issuerDocument : doc.recipientDocument;
                  const isActive = selected?.id === doc.id;
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSelected(doc)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: `0.8px solid ${C.borderSoft}`,
                        background: isActive ? C.active : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = C.rowHover;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 font-bold`} style={{ color: C.text }}>
                        {doc.noteNumber}
                      </td>
                      <td className="px-4 py-3">
                        <FlowBadge flow={doc.flow} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: C.text }}>
                          {counterparty}
                        </div>
                        <div className={`${MONO} text-xs`} style={{ color: C.faint }}>
                          {formatDocument(counterpartyDoc)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: C.muted }}>
                        {doc.depositante}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: C.muted }}>
                        {formatDate(doc.issuedAt ?? doc.createdAt)}
                      </td>
                      <td className={`${MONO} whitespace-nowrap px-4 py-3 font-bold`} style={{ color: C.text }}>
                        {formatBRL(doc.totalValue)}
                      </td>
                      <td className={`${MONO} px-4 py-3`} style={{ color: C.muted }}>
                        {doc.itemCount}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge code={doc.protocolStatusCode} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="h-4 w-4" style={{ color: C.faint }} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: C.muted }}>
                    Nenhuma NF-e encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3 text-xs"
          style={{ color: C.muted, borderTop: `0.8px solid ${C.border}` }}
        >
          <span>
            {filtered.length
              ? `${(safePage - 1) * PER_PAGE + 1}–${Math.min(safePage * PER_PAGE, filtered.length)} de ${filtered.length}`
              : "0 de 0"}
          </span>
          <div className="flex items-center gap-2">
            <PagerButton disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </PagerButton>
            <span style={{ color: C.faint }}>
              {safePage} / {totalPages}
            </span>
            <PagerButton disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </PagerButton>
          </div>
        </div>
        </section>
      </div>

      {/* Detail drawer */}
      {selected ? (
        <DetailDrawer
          doc={selected}
          onClose={() => setSelected(null)}
          onDanfe={() => setDanfeDoc(selected)}
        />
      ) : null}

      {/* DANFE modal */}
      {danfeDoc ? <DanfeModal doc={danfeDoc} onClose={() => setDanfeDoc(null)} /> : null}

      {/* Exportar NF-e (popup igual ao standalone) */}
      {exportOpen ? (
        <div
          className="nfe-theme fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          style={{ background: C.scrim, backdropFilter: "blur(4px)" }}
          onClick={() => setExportOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: C.panel, border: `0.8px solid ${C.border}`, color: C.text }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.violetSoft }}>
                  Exportar
                </p>
                <h2 className="mt-1 text-xl font-bold" style={{ color: C.text }}>
                  Exportar NF-e
                </h2>
                <p className="text-sm" style={{ color: C.muted }}>
                  Escolha os filtros e o formato para exportar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: C.muted }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <ExportField label="Tipo">
                  <ExportSelect value={expTipo} onChange={(v) => setExpTipo(v as FlowFilter)}>
                    <option value="TODAS">Todas</option>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                  </ExportSelect>
                </ExportField>
                <ExportField label="Status">
                  <ExportSelect value={expStatus} onChange={(v) => setExpStatus(v as "" | StatusKey)}>
                    <option value="">Todos</option>
                    <option value="AUTORIZADA">Autorizada</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="CANCELADA">Cancelada</option>
                    <option value="DENEGADA">Denegada</option>
                  </ExportSelect>
                </ExportField>
              </div>

              {canFilterDepositante ? (
                <ExportField label="Depositante">
                  <ExportSelect value={expDepositante} onChange={setExpDepositante}>
                    <option value="">Todos depositantes</option>
                    {depositanteOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </ExportSelect>
                </ExportField>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <ExportField label="Data inicial">
                  <ExportInput type="date" value={expDataIni} onChange={setExpDataIni} />
                </ExportField>
                <ExportField label="Data final">
                  <ExportInput type="date" value={expDataFim} onChange={setExpDataFim} />
                </ExportField>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.faint }}>
                  Formato
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["csv", "xlsx", "pdf"] as const).map((f) => (
                    <FormatPill key={f} active={expFormato === f} onClick={() => setExpFormato(f)}>
                      {f.toUpperCase()}
                    </FormatPill>
                  ))}
                </div>
              </div>

              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: C.panelSoft, border: `0.8px solid ${C.borderSoft}` }}
              >
                <input
                  type="checkbox"
                  checked={expIncluirZip}
                  onChange={(e) => setExpIncluirZip(e.target.checked)}
                  className="mt-0.5 accent-violet-500"
                />
                <span>
                  <span className="text-sm font-semibold" style={{ color: C.text }}>
                    Incluir XMLs em ZIP
                  </span>
                  <span className="mt-0.5 block text-xs" style={{ color: C.muted }}>
                    Adiciona os arquivos XML de cada NF-e ao pacote.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="inline-flex h-11 items-center rounded-[11px] px-5 text-[13.5px] font-bold transition hover:brightness-125"
                style={{ background: C.panelSoft, color: C.text, border: `0.8px solid ${C.border}` }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runExport}
                className="inline-flex h-11 items-center rounded-[11px] px-5 text-[13.5px] font-extrabold transition hover:brightness-110"
                style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff" }}
              >
                Exportar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExportField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest" style={{ color: C.faint }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ExportSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-[11px] px-3 text-sm font-semibold outline-none"
      style={{ background: C.panelSoft, color: C.text, border: `0.8px solid ${C.borderSoft}` }}
    >
      {children}
    </select>
  );
}

function ExportInput({
  type,
  value,
  onChange,
}: {
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-[11px] px-3 text-sm outline-none"
      style={{ background: C.panelSoft, color: C.text, border: `0.8px solid ${C.borderSoft}` }}
    />
  );
}

function FormatPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center justify-center rounded-[11px] text-[13px] font-bold transition"
      style={{
        background: active ? soft(C.violet, 12) : C.panelSoft,
        color: active ? C.violetSoft : C.muted,
        border: `1px solid ${active ? C.violet : C.borderSoft}`,
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawer
// ─────────────────────────────────────────────────────────────────────────────
function DetailDrawer({
  doc,
  onClose,
  onDanfe,
}: {
  doc: FiscalDocumentDetail;
  onClose: () => void;
  onDanfe: () => void;
}) {
  const st = statusOf(doc.protocolStatusCode);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ animation: "overlayFade .2s ease" }}>
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: C.scrim }}
      />
      <aside
        className="relative flex h-full w-full max-w-[460px] flex-col overflow-y-auto"
        style={{
          background: C.drawer,
          borderLeft: `0.8px solid ${C.border}`,
          boxShadow: "-24px 0 60px rgba(3,7,18,0.35)",
          animation: "drawerIn .28s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* Drawer header */}
        <div className="sticky top-0 z-10 px-6 pb-4 pt-5" style={{ background: C.drawerHead, backdropFilter: "blur(8px)", borderBottom: `0.8px solid ${C.borderSoft}` }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FlowBadge flow={doc.flow} />
              <StatusBadge code={doc.protocolStatusCode} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: C.muted }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <h3 className="mt-3 text-xl font-bold" style={{ color: C.text }}>
            NF-e {doc.noteNumber}
          </h3>
          <p className="text-sm" style={{ color: C.muted }}>
            {doc.flow === "ENTRADA" ? doc.issuerName : doc.recipientName}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <FieldRow label="Emitente" value={doc.issuerName} />
          <FieldRow label="CNPJ / CPF emitente" value={formatDocument(doc.issuerDocument)} mono />
          <FieldRow label="Destinatário" value={doc.recipientName} />
          <FieldRow label="CNPJ / CPF destinatário" value={formatDocument(doc.recipientDocument)} mono />
          {doc.recipientAddress ? (
            <FieldRow label="Endereço destinatário" value={doc.recipientAddress} />
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Depositante" value={doc.depositante} />
            <FieldRow label="Data de emissão" value={formatDate(doc.issuedAt ?? doc.createdAt)} />
            <FieldRow label="Valor total" value={formatBRL(doc.totalValue)} accent={C.emerald} />
            <FieldRow label="Qtd. de itens" value={String(doc.itemCount)} />
            <FieldRow label="Volumes" value={String(doc.volumeCount)} />
            <FieldRow label="Status SEFAZ" value={st.label} />
          </div>
          {doc.protocolNumber ? (
            <FieldRow label="Protocolo SEFAZ" value={doc.protocolNumber} mono />
          ) : null}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.faint }}>
              Chave de acesso
            </p>
            <p className={`${MONO} mt-1 break-all text-xs`} style={{ color: C.text }}>
              {doc.accessKey ?? "—"}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="sticky bottom-0 mt-auto flex gap-3 px-6 py-4"
          style={{ background: C.drawerFoot, backdropFilter: "blur(8px)", borderTop: `0.8px solid ${C.borderSoft}` }}
        >
          <a
            href={doc.downloadHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[13px] font-bold transition hover:brightness-125"
            style={{ background: C.panel, color: C.text, border: `0.8px solid ${C.border}` }}
          >
            Download XML
          </a>
          <button
            type="button"
            onClick={onDanfe}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[13px] font-extrabold transition hover:brightness-110"
            style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff" }}
          >
            Visualizar DANFE
          </button>
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DANFE (iframe isolado + impressão)
// ─────────────────────────────────────────────────────────────────────────────
function DanfeModal({ doc, onClose }: { doc: FiscalDocumentDetail; onClose: () => void }) {
  const src = `/api/nfe/${doc.id}/danfe?disposition=inline`;

  return (
    <div
      className="nfe-theme fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-8"
      style={{ background: C.scrim, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl"
        style={{ background: C.panel, maxHeight: "92vh", border: `0.8px solid ${C.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ background: C.panel, borderBottom: `0.8px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: C.violetSoft }} />
            <span className="text-sm font-bold" style={{ color: C.text }}>DANFE — NF-e {doc.noteNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition hover:brightness-110"
              style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff" }}
            >
              <Printer className="h-4 w-4" />
              Abrir / Imprimir
            </a>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: C.muted }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <iframe title="DANFE" src={src} className="w-full flex-1" style={{ minHeight: "60vh", border: "0", background: "#525659" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes de UI
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-5"
      style={{ background: C.panel, border: `0.8px solid ${C.border}` }}
    >
      <span className="flex h-[34px] items-center text-[13px] font-semibold" style={{ color: C.muted }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function FlowTab({
  active,
  dot,
  onClick,
  children,
}: {
  active: boolean;
  dot?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-[7px] rounded-[9px] px-3.5 py-[7px] text-[13px] font-bold transition"
      style={{
        background: active ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent",
        color: active ? "#fff" : C.muted,
      }}
    >
      {dot ? <span className="h-2 w-2 rounded-full" style={{ background: active ? "#fff" : dot }} /> : null}
      {children}
    </button>
  );
}

function SelectPill({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[42px] rounded-[11px] px-3 text-[13.5px] font-semibold outline-none"
      style={{ background: C.panel, color: C.text, border: `0.8px solid ${C.border}` }}
    >
      {children}
    </select>
  );
}

function FlowBadge({ flow }: { flow: "ENTRADA" | "SAIDA" }) {
  const isEntrada = flow === "ENTRADA";
  const color = isEntrada ? C.blue : C.violetSoft;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
      style={{ background: soft(color, isEntrada ? 12 : 14), color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {isEntrada ? "Entrada" : "Saída"}
    </span>
  );
}

function StatusBadge({ code }: { code: string | null }) {
  const st = statusOf(code);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
      style={{ background: soft(st.color, 16), color: st.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
      {st.label}
    </span>
  );
}

function FieldRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.faint }}>
        {label}
      </p>
      <p
        className={`mt-1 break-words text-sm font-semibold ${mono ? `${MONO} text-xs` : ""}`}
        style={{ color: accent ?? C.text }}
      >
        {value}
      </p>
    </div>
  );
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-30"
      style={{ background: C.panelSoft, color: C.text, border: `0.8px solid ${C.borderSoft}` }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<StatusKey, string> = {
  AUTORIZADA: "Autorizada",
  PENDENTE: "Pendente",
  CANCELADA: "Cancelada",
  DENEGADA: "Denegada",
};

function statusOf(code: string | null): { key: StatusKey; label: string; color: string } {
  if (code === "100" || code === "150") {
    return { key: "AUTORIZADA", label: "Autorizada", color: C.emerald };
  }
  if (["101", "135", "151", "155"].includes(code ?? "")) {
    return { key: "CANCELADA", label: "Cancelada", color: C.rose };
  }
  if (["110", "301", "302", "303"].includes(code ?? "")) {
    return { key: "DENEGADA", label: "Denegada", color: C.rose };
  }
  return { key: "PENDENTE", label: "Pendente", color: C.amber };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(date);
}

// Rótulo "Set 2026" a partir de "YYYY-MM" (meses vêm prontos do servidor).
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function monthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  return `${MONTH_ABBR[Number(month) - 1] ?? "—"} ${year}`;
}

// O XML da NF-e traz CNPJ/CPF só com dígitos. Aplica a pontuação oficial:
// CNPJ -> 00.000.000/0000-00, CPF -> 000.000.000-00.
function formatDocument(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value; // tamanho inesperado: mostra como veio, sem mascarar errado
}
