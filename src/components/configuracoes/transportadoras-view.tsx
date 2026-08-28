"use client";

import { useEffect, useMemo, useState, useActionState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Printer,
  ScrollText,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import {
  formatCnpj,
  formatTransportadoraTipo,
  transportadoraTipoColor,
  TRANSPORTADORA_TIPOS,
  type TransportadoraListItem,
  type TransportadoraTipo,
} from "@/lib/transportadoras";
import {
  deleteTransportadoraAction,
  saveTransportadoraAction,
  type TransportadoraActionState,
} from "@/app/(dashboard)/configuracoes/transportadoras/actions";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-space-grotesk)]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

type TransportadoraRow = TransportadoraListItem;

const typeChips: Array<{ key: string; label: string; color: string }> = [
  { key: "TODAS", label: "Todas", color: "" },
  { key: "RODOVIARIO", label: "Rodoviário", color: "#3B82F6" },
  { key: "AEREO", label: "Aéreo", color: "#8B5CF6" },
  { key: "MARITIMO", label: "Marítimo", color: "#06B6D4" },
];

function statusPill(ativo: boolean) {
  return ativo
    ? { bg: "rgba(16,185,129,0.1)", fg: "#10B981", label: "Ativa" }
    : { bg: "rgba(148,163,184,0.14)", fg: "#94A3B8", label: "Inativa" };
}

export function TransportadorasView({
  rows,
  kpis,
  schemaMissing,
}: {
  rows: TransportadoraRow[];
  kpis: { total: number; ativas: number; romaneiosNoMes: number };
  schemaMissing: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("TODAS");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<TransportadoraRow | null>(null);
  const [formState, setFormState] = useState<
    | { mode: "novo" }
    | { mode: "editar"; row: TransportadoraRow }
    | null
  >(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<"todas" | "ativas" | "inativas">("todas");
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");
  const [confirmDelete, setConfirmDelete] = useState<TransportadoraRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const pageSize = 10;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter !== "TODAS" && row.tipo !== typeFilter) return false;
      if (statusFilter === "ATIVA" && !row.ativo) return false;
      if (statusFilter === "INATIVA" && row.ativo) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [row.nome, row.razaoSocial, row.cnpj, row.cidade ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginated = filteredRows.slice(startIndex, startIndex + pageSize);
  const visibleStart = filteredRows.length ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + pageSize, filteredRows.length);

  function handleFormClose() {
    setFormState(null);
    router.refresh();
  }

  function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleteError(null);
    const target = confirmDelete;
    startDelete(async () => {
      const formData = new FormData();
      formData.set("id", target.id);
      formData.set("isSpa", "true");
      const result = await deleteTransportadoraAction(formData);
      if (result && result.success === false) {
        setDeleteError(result.message);
        return;
      }
      setConfirmDelete(null);
      setDetailRow(null);
      router.refresh();
    });
  }

  function doExport() {
    const alvos = rows.filter((row) => {
      if (exportStatus === "ativas") return row.ativo;
      if (exportStatus === "inativas") return !row.ativo;
      return true;
    });
    const header = "nome,razao_social,cnpj,cidade,uf,tipo,romaneios_mes,veiculos,telefone,email,status";
    const csv = [header];
    alvos.forEach((row) => {
      csv.push(
        [
          row.nome.replace(/,/g, ";"),
          row.razaoSocial.replace(/,/g, ";"),
          formatCnpj(row.cnpj),
          (row.cidade ?? "").replace(/,/g, ";"),
          row.uf ?? "",
          formatTransportadoraTipo(row.tipo),
          row.romaneiosMes,
          row.veiculos,
          row.telefone ?? "",
          row.email ?? "",
          row.ativo ? "ativa" : "inativa",
        ].join(","),
      );
    });
    const prefix = exportFormat === "excel" ? "﻿" : "";
    const blob = new Blob([prefix + csv.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transportadoras-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
  }

  async function printRows(alvos: TransportadoraRow[]) {
    if (!alvos.length) return;

    let logoMarkup = "";
    try {
      const res = await fetch("/branding/infinoos-icon-wms.svg");
      if (res.ok) logoMarkup = `<span class="logo">${await res.text()}</span>`;
    } catch {
      logoMarkup = "";
    }

    const rowsHtml = alvos
      .map(
        (row) => `
          <tr>
            <td>
              <div class="nome">${escapeHtml(row.nome)}</div>
              <div class="razao">${escapeHtml(row.razaoSocial)}</div>
            </td>
            <td class="mono">${escapeHtml(formatCnpj(row.cnpj))}</td>
            <td>${escapeHtml(row.cidade ? `${row.cidade}/${row.uf ?? ""}` : "—")}</td>
            <td>${escapeHtml(formatTransportadoraTipo(row.tipo))}</td>
            <td class="center mono">${row.romaneiosMes}</td>
            <td class="center mono">${row.veiculos}</td>
            <td>${row.ativo ? "Ativa" : "Inativa"}</td>
          </tr>`,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1000,height=1200");
    if (!printWindow) return;
    const styles = `
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #0F172A; font-family: Arial, sans-serif; }
      .head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
      .logo { width: 30px; height: 30px; display: inline-flex; }
      .logo svg { width: 100%; height: 100%; object-fit: contain; }
      h1 { font-size: 18pt; margin: 0; }
      .sub { font-size: 9pt; color: #64748B; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; }
      th { text-align: left; text-transform: uppercase; letter-spacing: .06em; font-size: 7.5pt; color: #64748B; border-bottom: 1.2px solid #cbd5e1; padding: 7px 8px; }
      td { padding: 7px 8px; border-bottom: .6px solid #e2e8f0; vertical-align: top; }
      .nome { font-weight: 700; }
      .razao { font-size: 8pt; color: #64748B; }
      .mono { font-family: monospace; }
      .center { text-align: center; }
    `;
    printWindow.document.write(
      `<!doctype html><html><head><title>Transportadoras</title><style>${styles}</style></head><body>
        <div class="head">${logoMarkup}<div><h1>Transportadoras</h1><div class="sub">${alvos.length} registro(s) · Infinoos WMS</div></div></div>
        <table>
          <thead><tr>
            <th>Transportadora</th><th>CNPJ</th><th>Cidade/UF</th><th>Tipo</th>
            <th class="center">Romaneios/mês</th><th class="center">Veículos</th><th>Status</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body></html>`,
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  }

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <header
        className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b px-4 sm:px-8 ${tokenBorder}`}
      >
        <Link
          href="/configuracoes"
          title="Voltar para Configurações"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] ${tokenText}`} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <h1 className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>
            Transportadoras
          </h1>
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <Link href="/configuracoes" className="hover:underline">
              Configurações
            </Link>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>Transportadoras</span>
          </div>
        </div>
        <NotificationBell />
        <ThemeToggle />
      </header>

      <div className="flex-1 space-y-[18px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`text-sm ${tokenTextSub}`}>
            Cadastro mestre de transportadoras usado na expedição e nos romaneios.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="flex h-[42px] items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-[18px] text-[13.5px] font-bold text-slate-900 transition hover:brightness-[1.06] dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-100"
            >
              Exportar
            </button>
            <button
              type="button"
              onClick={() => setFormState({ mode: "novo" })}
              disabled={schemaMissing}
              className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-[11px] px-5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              style={{
                background: "linear-gradient(92deg, #3B82F6, #8B5CF6)",
                boxShadow: "0 8px 22px rgba(99,102,241,0.32)",
              }}
            >
              + Nova transportadora
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total"
            value={String(kpis.total)}
            secondary="transportadoras"
            icon={Truck}
            iconBg="rgba(59,130,246,0.15)"
            iconColor="#3B82F6"
          />
          <KpiCard
            label="Ativas"
            value={String(kpis.ativas)}
            secondary="operando"
            valueColor="#10B981"
            icon={CheckCircle2}
            iconBg="rgba(16,185,129,0.15)"
            iconColor="#10B981"
          />
          <KpiCard
            label="Romaneios no mês"
            value={kpis.romaneiosNoMes.toLocaleString("pt-BR")}
            secondary="entregas"
            icon={ScrollText}
            iconBg="rgba(139,92,246,0.15)"
            iconColor="#8B5CF6"
          />
        </div>

        {schemaMissing ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm ${tokenBorder}`}
            style={{ background: "rgba(245,158,11,0.08)", color: "#B45309" }}
          >
            A tela já está pronta, mas a tabela <code>public.transportadoras</code> ainda não existe no
            banco atual. Assim que ela for criada no Supabase, este cadastro passa a funcionar
            normalmente.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`flex h-[42px] flex-1 min-w-[220px] items-center gap-2 rounded-[11px] border px-3 ${tokenBorder} ${tokenCardBg}`}
          >
            <Search className={`h-4 w-4 ${tokenTextSub}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, CNPJ ou cidade..."
              className={`flex-1 bg-transparent text-sm outline-none placeholder:text-[#64748B] dark:placeholder:text-[#8695AD] ${tokenText}`}
            />
          </div>
          <div className={`flex flex-wrap items-center gap-1 rounded-[12px] border p-1 ${tokenBorder} ${tokenCardBg}`}>
            {typeChips.map((chip) => {
              const active = typeFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setTypeFilter(chip.key);
                    setPage(1);
                  }}
                  className={
                    active
                      ? "inline-flex items-center gap-[7px]"
                      : "inline-flex items-center gap-[7px] text-[#64748B] transition-all hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-white/5"
                  }
                  style={{
                    height: "34px",
                    padding: "0 14px",
                    borderRadius: "9px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                    transition: "0.18s",
                    ...(active
                      ? { background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#FFFFFF" }
                      : {}),
                  }}
                >
                  {chip.color ? (
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: chip.color,
                      }}
                    />
                  ) : null}
                  {chip.label}
                </button>
              );
            })}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={`h-[42px] cursor-pointer rounded-[11px] border px-3 text-[13.5px] font-semibold outline-none ${tokenBorder} ${tokenCardBg} ${tokenText}`}
          >
            <option value="ALL">Todos os status</option>
            <option value="ATIVA">Ativa</option>
            <option value="INATIVA">Inativa</option>
          </select>
        </div>

        <div className={`overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "900px" }}>
              <thead>
                <tr className={`border-b ${tokenBorder} ${tokenInputBg}`}>
                  <Th>Transportadora</Th>
                  <Th>CNPJ</Th>
                  <Th>Cidade/UF</Th>
                  <Th>Tipo</Th>
                  <Th align="center">Romaneios</Th>
                  <Th align="center">Veículos</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {paginated.length ? (
                  paginated.map((row) => (
                    <TransportadoraRowTr key={row.id} row={row} onClick={() => setDetailRow(row)} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className={`px-5 py-10 text-center text-sm ${tokenTextSub}`}>
                      {schemaMissing
                        ? "Cadastre a estrutura da tabela no Supabase para começar."
                        : "Nenhuma transportadora encontrada com os filtros atuais."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length ? (
            <div className={`flex items-center justify-between border-t px-5 py-3 ${tokenBorder}`}>
              <span className={`text-[12.5px] ${tokenTextSub}`}>
                {visibleStart}–{visibleEnd} de {filteredRows.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className={`flex h-8 w-8 items-center justify-center rounded-[9px] border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className={`text-[12.5px] font-semibold ${tokenText}`}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className={`flex h-8 w-8 items-center justify-center rounded-[9px] border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {detailRow ? (
        <TransportadoraDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onEdit={() => {
            const row = detailRow;
            setDetailRow(null);
            setFormState({ mode: "editar", row });
          }}
          onDelete={() => setConfirmDelete(detailRow)}
          onPrint={() => printRows([detailRow])}
        />
      ) : null}

      {formState ? (
        <TransportadoraFormModal
          mode={formState.mode}
          row={formState.mode === "editar" ? formState.row : null}
          onClose={handleFormClose}
        />
      ) : null}

      {exportModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" style={manropeStyle}>
          <div
            className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
            onClick={() => setExportModalOpen(false)}
          />
          <div
            className={`relative flex w-[440px] max-w-[94vw] flex-col rounded-[18px] border ${tokenBorder} ${tokenCardBg} shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
          >
            <div className={`flex items-start justify-between gap-3 border-b px-6 py-5 ${tokenBorder}`}>
              <div className="flex flex-col gap-1">
                <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tokenTextSub}`}>
                  Exportar
                </span>
                <span className={`${FIN_HEADING} text-[20px] font-bold ${tokenText}`}>
                  Exportar transportadoras
                </span>
                <span className={`text-[13px] ${tokenTextSub}`}>
                  Selecione o escopo e o formato da exportação.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6]`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex flex-col gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${tokenTextSub}`}>
                  Status
                </span>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      { key: "todas", label: "Todas as transportadoras", count: rows.length },
                      { key: "ativas", label: "Somente ativas", count: rows.filter((r) => r.ativo).length },
                      { key: "inativas", label: "Somente inativas", count: rows.filter((r) => !r.ativo).length },
                    ] as const
                  ).map((opt) => {
                    const selected = exportStatus === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setExportStatus(opt.key)}
                        className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition ${
                          selected
                            ? "border-[#8B5CF6] bg-[rgba(139,92,246,0.08)]"
                            : `${tokenBorder} ${tokenInputBg} hover:border-violet-300`
                        }`}
                      >
                        <span
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                            selected ? "border-[#8B5CF6]" : "border-slate-300 dark:border-white/20"
                          }`}
                        >
                          {selected ? <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" /> : null}
                        </span>
                        <span className={`flex-1 text-[13.5px] font-bold ${tokenText}`}>{opt.label}</span>
                        <span className={`text-[12.5px] font-semibold ${tokenTextSub}`}>{opt.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${tokenTextSub}`}>
                  Formato
                </span>
                <div className="flex gap-2">
                  {(["csv", "excel"] as const).map((f) => {
                    const selected = exportFormat === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setExportFormat(f)}
                        className={`h-10 flex-1 rounded-[10px] border-2 text-[13.5px] font-bold uppercase transition ${
                          selected
                            ? "border-[#8B5CF6] bg-[rgba(139,92,246,0.1)] text-[#8B5CF6]"
                            : `${tokenBorder} ${tokenInputBg} ${tokenTextSub} hover:border-violet-300`
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 border-t px-6 py-4 ${tokenBorder}`}>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className={`flex h-11 items-center rounded-[11px] border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doExport}
                className="flex h-11 items-center gap-2 rounded-[11px] px-[22px] text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition-transform hover:-translate-y-px"
                style={{ background: "linear-gradient(92deg, #3B82F6, #8B5CF6)" }}
              >
                Exportar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-6" style={manropeStyle}>
          <div
            className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
            onClick={() => !isDeleting && setConfirmDelete(null)}
          />
          <div
            className={`relative flex w-[420px] max-w-[94vw] flex-col gap-4 rounded-[18px] border ${tokenBorder} ${tokenCardBg} p-[26px] shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] bg-[rgba(239,68,68,0.14)] text-[#EF4444]">
                <Trash2 className="h-[22px] w-[22px]" />
              </span>
              <div className="flex flex-col gap-[3px]">
                <span className={`${FIN_HEADING} text-[18px] font-bold ${tokenText}`}>
                  Excluir transportadora?
                </span>
                <span className={`text-[13px] leading-[1.4] ${tokenTextSub}`}>
                  Esta ação não pode ser desfeita.
                </span>
              </div>
            </div>
            <div
              className={`rounded-xl border ${tokenBorder} bg-[rgba(148,163,184,0.06)] px-4 py-3.5 text-[13.5px] font-bold ${tokenText}`}
            >
              {confirmDelete.nome}
            </div>
            {deleteError ? <p className="text-[13px] text-[#EF4444]">{deleteError}</p> : null}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(null)}
                className={`h-12 flex-1 rounded-[11px] border text-sm font-bold transition-colors hover:border-[#8B5CF6] disabled:opacity-50 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{ background: "#EF4444", color: "#fff" }}
                className="h-12 flex-1 rounded-[11px] text-sm font-extrabold shadow-[0_8px_22px_rgba(239,68,68,0.35)] transition-transform hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TransportadoraDrawer({
  row,
  onClose,
  onEdit,
  onDelete,
  onPrint,
}: {
  row: TransportadoraRow;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrint: () => void;
}) {
  const tipoColor = transportadoraTipoColor(row.tipo);
  const status = statusPill(row.ativo);

  return (
    <div className="fixed inset-0 z-40" style={manropeStyle}>
      <div className="absolute inset-0 bg-[rgba(6,10,20,0.45)] backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[420px] max-w-[92vw] flex-col border-l bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        <div className={`border-b px-6 pb-4 pt-[22px] ${tokenBorder}`}>
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
              style={{ background: `${tipoColor}1f`, color: tipoColor }}
            >
              {formatTransportadoraTipo(row.tipo)}
            </span>
            <span
              className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
              style={{ background: status.bg, color: status.fg }}
            >
              {status.label}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              title="Imprimir ficha"
              onClick={onPrint}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] hover:text-[#8B5CF6]`}
            >
              <Printer className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              title="Excluir"
              onClick={onDelete}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[rgba(239,68,68,0.35)] text-[#EF4444] transition hover:bg-[rgba(239,68,68,0.08)]"
            >
              <Trash2 className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              title="Fechar"
              onClick={onClose}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6]`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`text-[22px] font-bold ${tokenText}`}>{row.nome}</div>
          <div className={`mt-0.5 text-[13px] ${tokenTextSub}`}>{row.razaoSocial}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-2.5">
          <KvRow label="CNPJ" value={formatCnpj(row.cnpj)} mono />
          <KvRow label="Cidade/UF" value={row.cidade ? `${row.cidade}/${row.uf ?? ""}` : "—"} />
          <KvRow label="Tipo" value={formatTransportadoraTipo(row.tipo)} />
          <KvRow label="Telefone" value={row.telefone || "—"} />
          <KvRow label="E-mail" value={row.email || "—"} />
          <KvRow label="Romaneios no mês" value={String(row.romaneiosMes)} />
          <KvRow label="Veículos cadastrados" value={String(row.veiculos)} />
          {row.observacoes ? (
            <div className="mt-3.5">
              <div className={`mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}>
                Observações
              </div>
              <p className={`text-[13.5px] leading-[1.5] ${tokenText}`}>{row.observacoes}</p>
            </div>
          ) : null}
        </div>

        <div className={`flex gap-2 border-t px-6 py-3.5 ${tokenBorder}`}>
          <button
            type="button"
            onClick={onEdit}
            className="flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[10px] text-[13px] font-extrabold text-white transition-all hover:-translate-y-px hover:brightness-[1.06]"
            style={{ background: "linear-gradient(92deg, #3B82F6, #8B5CF6)" }}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        </div>
      </aside>
    </div>
  );
}

function KvRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b py-[9px] text-[13.5px] ${tokenBorder}`}>
      <span className={tokenTextSub}>{label}</span>
      <span className={`text-right font-semibold ${mono ? monoFont : ""} ${tokenText}`}>{value}</span>
    </div>
  );
}

const initialFormState: TransportadoraActionState = { success: false, message: null };

function TransportadoraFormModal({
  mode,
  row,
  onClose,
}: {
  mode: "novo" | "editar";
  row: TransportadoraRow | null;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveTransportadoraAction, initialFormState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const errors = state.errors ?? {};

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-6" style={manropeStyle}>
      <div className="absolute inset-0 bg-[rgba(3,7,20,0.5)] backdrop-blur-[5px]" onClick={onClose} />
      <form
        action={formAction}
        className={`relative flex max-h-[92vh] w-[520px] max-w-[92vw] flex-col overflow-hidden rounded-[16px] border ${tokenBorder} ${tokenCardBg} shadow-[0_30px_60px_rgba(0,0,0,0.35)]`}
      >
        {row ? <input type="hidden" name="id" value={row.id} /> : null}

        <div className="px-6 pb-0 pt-5">
          <h3 className={`${FIN_HEADING} text-[19px] font-bold ${tokenText}`}>
            {mode === "editar" ? "Editar transportadora" : "Nova transportadora"}
          </h3>
          <p className={`mt-1 text-[13px] ${tokenTextSub}`}>
            Preencha os dados básicos; o restante pode ser editado depois.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 overflow-y-auto px-6 py-[18px] sm:grid-cols-2">
          <FormField label="Razão social" name="razaoSocial" defaultValue={row?.razaoSocial ?? ""} placeholder="Empresa Ltda" error={errors.razaoSocial} />
          <FormField label="Nome fantasia" name="nome" defaultValue={row?.nome ?? ""} placeholder="Nome curto" error={errors.nome} />
          <FormField label="CNPJ" name="cnpj" defaultValue={row ? formatCnpj(row.cnpj) : ""} placeholder="00.000.000/0001-00" error={errors.cnpj} />
          <FormSelect
            label="Tipo"
            name="tipo"
            defaultValue={row?.tipo ?? "RODOVIARIO"}
            options={TRANSPORTADORA_TIPOS.map((t) => ({ value: t, label: formatTransportadoraTipo(t as TransportadoraTipo) }))}
            error={errors.tipo}
          />
          <FormField label="Cidade" name="cidade" defaultValue={row?.cidade ?? ""} placeholder="São Paulo" error={errors.cidade} />
          <FormField label="UF" name="uf" defaultValue={row?.uf ?? ""} placeholder="SP" maxLength={2} uppercase error={errors.uf} />
          <FormField label="Telefone" name="telefone" defaultValue={row?.telefone ?? ""} placeholder="(11) 3456-7890" error={errors.telefone} />
          <FormField label="E-mail" name="email" type="email" defaultValue={row?.email ?? ""} placeholder="contato@empresa.com.br" error={errors.email} />

          {mode === "editar" ? (
            <label className="col-span-full mt-0.5 flex items-center gap-2.5">
              <input
                type="checkbox"
                name="ativo"
                value="true"
                defaultChecked={row?.ativo ?? true}
                className="h-4 w-4 accent-[#8B5CF6]"
              />
              <span className={`text-[13px] font-semibold ${tokenText}`}>Ativa para operação</span>
            </label>
          ) : (
            <input type="hidden" name="ativo" value="true" />
          )}
        </div>

        {state.message && !state.success ? (
          <p className="px-6 pb-1 text-[12.5px] font-semibold text-[#EF4444]">{state.message}</p>
        ) : null}

        <div className="flex items-center gap-2.5 px-6 pb-[22px] pt-1">
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className={`flex h-10 items-center rounded-[9px] border px-4 text-[13px] font-bold transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex h-10 min-w-[132px] items-center justify-center rounded-[9px] px-[18px] text-[13px] font-extrabold text-white transition-transform hover:-translate-y-px disabled:hover:translate-y-0"
            style={{ background: "linear-gradient(92deg, #3B82F6, #8B5CF6)" }}
          >
            {isPending ? (
              <MobileButtonSpinner size={20} />
            ) : mode === "editar" ? (
              "Salvar alterações"
            ) : (
              "Cadastrar"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  maxLength,
  uppercase,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  uppercase?: boolean;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-[11.5px] font-bold ${tokenTextSub}`}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`h-[42px] rounded-[9px] border px-3 text-[13.5px] font-medium outline-none transition focus:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText} ${uppercase ? "uppercase" : ""}`}
      />
      {error ? <span className="text-[11.5px] font-semibold text-[#EF4444]">{error}</span> : null}
    </label>
  );
}

function FormSelect({
  label,
  name,
  defaultValue,
  options,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-[11.5px] font-bold ${tokenTextSub}`}>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className={`h-[42px] cursor-pointer rounded-[9px] border px-3 text-[13.5px] font-medium outline-none transition focus:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[11.5px] font-semibold text-[#EF4444]">{error}</span> : null}
    </label>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "left" | "center" | "right" }) {
  return (
    <th
      className={tokenTextSub}
      style={{
        padding: "12px 20px",
        textAlign: align ?? "left",
        fontWeight: 700,
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function TransportadoraRowTr({ row, onClick }: { row: TransportadoraRow; onClick: () => void }) {
  const tipoColor = transportadoraTipoColor(row.tipo);
  const status = statusPill(row.ativo);

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-t transition ${tokenBorder} hover:bg-[rgba(139,92,246,0.08)]`}
    >
      <td style={{ padding: "14px 20px" }}>
        <div className={`text-[14px] font-bold ${tokenText}`}>{row.nome}</div>
        <div className={`mt-[1px] text-[12px] ${tokenTextSub}`}>{row.razaoSocial}</div>
      </td>
      <td
        className={`${monoFont} ${tokenText}`}
        style={{ padding: "14px 20px", fontSize: "12.5px", whiteSpace: "nowrap" }}
      >
        {formatCnpj(row.cnpj)}
      </td>
      <td className={tokenText} style={{ padding: "14px 20px", fontSize: "13px", whiteSpace: "nowrap" }}>
        {row.cidade ? `${row.cidade}/${row.uf ?? ""}` : "—"}
      </td>
      <td style={{ padding: "14px 20px" }}>
        <span
          className="inline-flex items-center"
          style={{
            gap: "6px",
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            background: `${tipoColor}1a`,
            color: tipoColor,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: tipoColor }} />
          {formatTransportadoraTipo(row.tipo)}
        </span>
      </td>
      <td className={`${monoFont} ${tokenText}`} style={{ padding: "14px 20px", textAlign: "center", fontSize: "14px", fontWeight: 700 }}>
        {row.romaneiosMes}
      </td>
      <td className={`${monoFont} ${tokenText}`} style={{ padding: "14px 20px", textAlign: "center", fontSize: "14px", fontWeight: 700 }}>
        {row.veiculos}
      </td>
      <td style={{ padding: "14px 20px" }}>
        <span
          className="inline-flex items-center"
          style={{
            gap: "6px",
            padding: "4px 11px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            background: status.bg,
            color: status.fg,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: status.fg }} />
          {status.label}
        </span>
      </td>
      <td style={{ padding: "14px 20px", textAlign: "right", fontSize: "13px" }} className={tokenTextSub}>
        ›
      </td>
    </tr>
  );
}

function KpiCard({
  label,
  value,
  secondary,
  valueColor,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  secondary?: string;
  valueColor?: string;
  icon: React.ComponentType<{ size?: number }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101B30]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
        <span
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon size={20} />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`${FIN_HEADING} text-[30px] font-bold`}
          style={valueColor ? { color: valueColor } : undefined}
        >
          <span className={valueColor ? "" : "text-slate-900 dark:text-zinc-100"}>{value}</span>
        </span>
        {secondary ? (
          <span className="text-[13px] font-medium text-slate-500 dark:text-zinc-400">
            {secondary}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
