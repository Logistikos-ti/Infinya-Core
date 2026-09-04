"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlignJustify,
  Package,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  Lock,
  Pencil,
  Check,
  Printer,
  Search,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { PillSelect } from "@/components/ui/pill-select";
import { NovoEnderecoTrigger } from "./novo-endereco-trigger";
import { EnderecoForm, AddressBarcodePreview, addressBarcodeSvgMarkup } from "./endereco-form";
import {
  deleteEnderecoAction,
  getEnderecoMovimentacoesAction,
  toggleEnderecoStatusAction,
  type EnderecoMovimentacaoDto,
} from "@/app/(dashboard)/configuracoes/enderecos/actions";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-space-grotesk)]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

const areaAccent: Record<string, string> = {
  PICKING: "#8B5CF6",
  PULMAO: "#3B82F6",
  RECEBIMENTO: "#10B981",
  EXPEDICAO: "#F59E0B",
  QUARENTENA: "#EC4899",
  BLOQUEADO: "#EF4444",
};

const areaLabel: Record<string, string> = {
  PICKING: "Picking",
  PULMAO: "Pulmão",
  RECEBIMENTO: "Recebimento",
  EXPEDICAO: "Expedição",
  QUARENTENA: "Quarentena",
  BLOQUEADO: "Bloqueado",
};

const areaChips: Array<{ key: string; label: string; color: string }> = [
  { key: "TODAS", label: "Todas", color: "" },
  { key: "PICKING", label: "Picking", color: areaAccent.PICKING },
  { key: "PULMAO", label: "Pulmão", color: areaAccent.PULMAO },
  { key: "RECEBIMENTO", label: "Recebimento", color: areaAccent.RECEBIMENTO },
  { key: "EXPEDICAO", label: "Expedição", color: areaAccent.EXPEDICAO },
  { key: "QUARENTENA", label: "Quarentena", color: areaAccent.QUARENTENA },
];

type EnderecoRow = {
  id: string;
  codigo: string;
  area: string;
  descricao: string;
  rua: string;
  modulo: string;
  ocupacao: number | null;
  skus: number;
  ativo: boolean;
  quantidade: number;
  peso: number;
  capacidadeMaxima: number;
  capacidadePesoKg: number;
  volumeModo: string;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  unidadePadrao: string;
  unidadeSaldo: string;
  produtos: Array<{
    nome: string;
    sku: string;
    quantidade: number;
    unidade: string;
    imagemUrl: string | null;
    depositante: string;
  }>;
};

type EnderecoProduto = EnderecoRow["produtos"][number];

export function EnderecosView({
  rows,
  kpis,
  areasDisponiveis,
}: {
  rows: EnderecoRow[];
  kpis: { total: number; ocupacaoMedia: number; vazios: number; bloqueados: number };
  areasDisponiveis: string[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"table" | "map">("table");
  const [areaFilter, setAreaFilter] = useState<string>("TODAS");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<EnderecoRow | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"filtrados" | "todos">("filtrados");
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printSelection, setPrintSelection] = useState<Record<string, number>>({});
  const [editingRow, setEditingRow] = useState<EnderecoRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EnderecoRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isToggling, startToggle] = useTransition();
  const pageSize = 10;

  function handleEditClose() {
    setEditingRow(null);
    router.refresh();
  }

  function handleToggleBlock(row: EnderecoRow) {
    startToggle(async () => {
      const formData = new FormData();
      formData.set("id", row.id);
      formData.set("nextActive", row.ativo ? "false" : "true");
      await toggleEnderecoStatusAction(formData);
      setDetailRow(null);
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleteError(null);
    const target = confirmDelete;
    startDelete(async () => {
      const formData = new FormData();
      formData.set("id", target.id);
      formData.set("isSpa", "true");
      const result = await deleteEnderecoAction(formData);
      if (result && result.success === false) {
        setDeleteError(result.message);
        return;
      }
      setConfirmDelete(null);
      setDetailRow(null);
      router.refresh();
    });
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (areaFilter !== "TODAS" && row.area !== areaFilter) return false;
      const status = getRowStatus(row);
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!row.codigo.toLowerCase().includes(q) && !row.descricao.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, areaFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginated = filteredRows.slice(startIndex, startIndex + pageSize);
  const visibleStart = filteredRows.length ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + pageSize, filteredRows.length);

  function doExport() {
    const alvos = exportScope === "todos" ? rows : filteredRows;
    const csv = ["codigo,area,descricao,ocupacao,skus,ativo,quantidade,capacidade_peso_kg"];
    alvos.forEach((row) => {
      csv.push(
        [
          row.codigo,
          row.area,
          row.descricao.replace(/,/g, ";"),
          row.ocupacao ?? "",
          row.skus,
          row.ativo ? "ativo" : "inativo",
          row.quantidade,
          row.capacidadePesoKg,
        ].join(","),
      );
    });
    // Excel abre CSV com acentos corretos quando há BOM UTF-8.
    const prefix = exportFormat === "excel" ? "﻿" : "";
    const blob = new Blob([prefix + csv.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `enderecos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
  }

  function openPrintModal() {
    if (!filteredRows.length) return;
    const initial: Record<string, number> = {};
    filteredRows.forEach((row) => {
      initial[row.id] = 1;
    });
    setPrintSelection(initial);
    setPrintModalOpen(true);
  }

  async function printSelected(format: "thermal" | "a4") {
    const alvos = filteredRows.filter((row) => (printSelection[row.id] ?? 0) > 0);
    if (!alvos.length) return;

    let logoMarkup = "";
    try {
      const res = await fetch("/branding/infinoos-icon-wms.svg");
      if (res.ok) logoMarkup = `<div class="logo">${await res.text()}</div>`;
    } catch {
      logoMarkup = "";
    }

    const labels = alvos
      .flatMap((row) => {
        const qty = Math.max(1, Number(printSelection[row.id] ?? 1));
        const barcode = addressBarcodeSvgMarkup(row.codigo);
        return Array.from(
          { length: qty },
          () => `
            <section class="label">
              <div class="ticket">
                <div class="label-head">${logoMarkup}<div class="address">${row.codigo}</div></div>
                <div class="barcode">${barcode}</div>
              </div>
            </section>`,
        );
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) return;
    const styles =
      format === "a4"
        ? `
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
      body { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4mm; justify-content: space-between; }
      .label { position: relative; width: calc(50% - 2mm); height: 35mm; padding: 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: .35mm dashed #ccc; border-radius: 2mm; page-break-inside: avoid; margin-bottom: 2mm; }
      .ticket { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .label-head { position: relative; width: 100%; height: 6mm; display: flex; align-items: center; justify-content: center; margin-bottom: 2mm; }
      .logo { position: absolute; top: 0; left: 0; width: 5mm; height: 5mm; filter: grayscale(1); }
      .logo svg { width: 100%; height: 100%; object-fit: contain; }
      .address { font-family: monospace; font-size: 13pt; font-weight: 800; line-height: 1; letter-spacing: .04em; }
      .barcode { width: 100%; display: flex; justify-content: center; }
      .barcode svg { display: block; width: 70mm; height: 16mm; }
    `
        : `
      @page { size: 100mm 150mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
      .label { position: relative; width: 100mm; height: 150mm; page-break-after: always; padding: 8mm 6mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; }
      .ticket { width: 100%; padding: 3mm 3mm 2mm; border: .35mm solid #dbe3ef; border-radius: 4mm; background: #fff; }
      .label-head { position: relative; width: 100%; height: 10mm; display: flex; align-items: center; justify-content: center; }
      .logo { position: absolute; top: 0; left: 0; width: 7mm; height: 7mm; filter: grayscale(1); }
      .logo svg { width: 100%; height: 100%; object-fit: contain; }
      .address { font-family: monospace; font-size: 14pt; font-weight: 800; line-height: 1.1; letter-spacing: .04em; word-break: break-word; }
      .barcode { width: 86mm; margin-top: 1mm; }
      .barcode svg { display: block; width: 86mm; height: 30mm; }
    `;
    printWindow.document.write(
      `<!doctype html><html><head><title>Etiquetas de endereços</title><style>${styles}</style></head><body>${labels}</body></html>`,
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
    setPrintModalOpen(false);
  }

  const printSelectedCount = filteredRows.filter((row) => (printSelection[row.id] ?? 0) > 0).length;

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <header
        className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b px-4 sm:px-8 ${tokenBorder}`}
      >
        <Link
          href="/configuracoes"
          title="Voltar para Configurações"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <h1 className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>Endereços</h1>
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <Link href="/configuracoes" className="hover:underline">
              Configurações
            </Link>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>Endereços</span>
          </div>
        </div>
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="flex-1 space-y-[18px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`text-sm ${tokenTextSub}`}>
            Nomenclatura, tipos e ocupação das posições do armazém.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="flex h-[42px] items-center gap-2 rounded-full border border-slate-200 bg-white px-[18px] text-[13.5px] font-bold text-slate-900 transition hover:brightness-[1.06] dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-100"
            >
              Exportar
            </button>
            <button
              type="button"
              onClick={openPrintModal}
              className="flex h-[42px] items-center gap-2 rounded-full border border-slate-200 bg-white px-[18px] text-[13.5px] font-bold text-slate-900 transition hover:brightness-[1.06] dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-100"
            >
              <Printer className="h-[15px] w-[15px]" />
              Imprimir
            </button>
            <div className={`inline-flex items-center gap-1 rounded-full border p-1 ${tokenBorder} ${tokenCardBg}`}>
              <ViewToggleButton
                icon={<AlignJustify className="h-[15px] w-[15px]" />}
                label="Tabela"
                active={view === "table"}
                onClick={() => setView("table")}
              />
              <ViewToggleButton
                icon={<MapIcon className="h-4 w-4" />}
                label="Mapa"
                active={view === "map"}
                onClick={() => setView("map")}
              />
            </div>
            <NovoEnderecoTrigger areasDisponiveis={areasDisponiveis} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard label="Total" value={String(kpis.total)} secondary="posições" />
          <KpiCard
            label="Ocupação"
            value={`${kpis.ocupacaoMedia}%`}
            inlineBar={{ pct: kpis.ocupacaoMedia }}
          />
          <KpiCard
            label="Disponíveis"
            value={String(kpis.vazios)}
            secondary="vazias"
            valueColor="#10B981"
          />
          <KpiCard
            label="Bloqueados"
            value={String(kpis.bloqueados)}
            secondary="avaria / quarentena"
            valueColor={kpis.bloqueados > 0 ? "#EF4444" : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`flex h-[42px] flex-1 min-w-[220px] items-center gap-2 rounded-full border px-3 ${tokenBorder} ${tokenCardBg}`}>
            <Search className={`h-4 w-4 ${tokenTextSub}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar endereço ou zona..."
              className={`flex-1 bg-transparent text-sm outline-none placeholder:text-[#64748B] dark:placeholder:text-[#8695AD] ${tokenText}`}
            />
          </div>
          <div className={`flex flex-wrap items-center gap-1 rounded-full border p-1 ${tokenBorder} ${tokenCardBg}`}>
            {areaChips.map((chip) => {
              const active = areaFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setAreaFilter(chip.key);
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
                    borderRadius: "999px",
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
                        background: active ? "#FFFFFF" : chip.color,
                      }}
                    />
                  ) : null}
                  {chip.label}
                </button>
              );
            })}
          </div>
          <PillSelect
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[
              { value: "ALL", label: "Todos os status" },
              { value: "ATIVO", label: "Ativo" },
              { value: "VAZIO", label: "Vazio" },
              { value: "CHEIO", label: "Cheio" },
              { value: "BLOQUEADO", label: "Bloqueado" },
            ]}
          />
        </div>

        {view === "map" ? (
          <MapView rows={filteredRows} onSelect={(row) => setDetailRow(row)} />
        ) : (
        <div className={`overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "820px" }}>
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "27%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr className={`border-b ${tokenBorder} ${tokenInputBg}`}>
                  <Th>Endereço</Th>
                  <Th>Ocupação</Th>
                  <Th align="center">Qtd. SKUs</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {paginated.length ? (
                  paginated.map((row) => (
                    <EnderecoRowTr key={row.id} row={row} onClick={() => setDetailRow(row)} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={`px-5 py-10 text-center text-sm ${tokenTextSub}`}>
                      Nenhum endereço encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length ? (
            <div
              className={`flex items-center justify-between border-t px-5 py-3 ${tokenBorder}`}
            >
              <span className={`text-[12.5px] ${tokenTextSub}`}>
                {visibleStart}–{visibleEnd} de {filteredRows.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
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
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        )}
      </div>

      {detailRow ? (
        <EnderecoDrawer
          row={detailRow}
          isToggling={isToggling}
          onClose={() => setDetailRow(null)}
          onEdit={() => {
            const row = detailRow;
            setDetailRow(null);
            setEditingRow(row);
          }}
          onToggleBlock={() => handleToggleBlock(detailRow)}
          onDelete={() => setConfirmDelete(detailRow)}
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
                  Exportar endereços
                </span>
                <span className={`text-[13px] ${tokenTextSub}`}>
                  Selecione o escopo e o formato da exportação.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex flex-col gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${tokenTextSub}`}>
                  Escopo
                </span>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      { key: "filtrados", label: "Endereços filtrados", count: filteredRows.length },
                      { key: "todos", label: "Todos os endereços", count: rows.length },
                    ] as const
                  ).map((opt) => {
                    const selected = exportScope === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setExportScope(opt.key)}
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
                        <span className={`flex-1 text-[13.5px] font-bold ${tokenText}`}>
                          {opt.label}
                        </span>
                        <span className={`text-[12.5px] font-semibold ${tokenTextSub}`}>
                          {opt.count}
                        </span>
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
                        className={`h-10 flex-1 rounded-full border-2 text-[13.5px] font-bold uppercase transition ${
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
                className={`flex h-11 items-center rounded-full border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doExport}
                className="enderecos-export-btn flex h-11 items-center gap-2 rounded-full px-[22px] text-sm font-extrabold text-white"
              >
                Exportar
              </button>
              <style jsx>{`
                .enderecos-export-btn {
                  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
                  background-size: 220% 100%;
                  background-position: 0% 50%;
                  box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
                  transition:
                    background-position 0.6s ease,
                    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 0.3s ease;
                }
                .enderecos-export-btn:hover {
                  background-position: 100% 50%;
                  transform: translateY(-3px);
                  box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
                }
              `}</style>
            </div>
          </div>
        </div>
      ) : null}

      {printModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" style={manropeStyle}>
          <div
            className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
            onClick={() => setPrintModalOpen(false)}
          />
          <div
            className={`relative flex max-h-[86vh] w-[620px] max-w-[94vw] flex-col rounded-[18px] border ${tokenBorder} ${tokenCardBg} shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
          >
            <div className={`flex items-start justify-between gap-3 border-b px-6 py-5 ${tokenBorder}`}>
              <div className="flex flex-col gap-1">
                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tokenTextSub}`}
                >
                  Impressão térmica
                </span>
                <span className={`${FIN_HEADING} text-[22px] font-bold ${tokenText}`}>
                  Escolha as etiquetas
                </span>
                <span className={`text-[13px] ${tokenTextSub}`}>
                  Cada etiqueta será impressa em 100 mm x 150 mm.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-2">
              {filteredRows.map((row) => {
                const qty = printSelection[row.id] ?? 0;
                const selected = qty > 0;
                return (
                  <div
                    key={row.id}
                    className={`flex items-center gap-3 border-b py-3 last:border-b-0 ${tokenBorder}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setPrintSelection((prev) => ({ ...prev, [row.id]: selected ? 0 : 1 }))
                      }
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border transition"
                      style={{
                        borderColor: selected ? "#8B5CF6" : "rgba(100,116,139,0.4)",
                        background: selected ? "#8B5CF6" : "transparent",
                        color: "#fff",
                      }}
                    >
                      {selected ? <Check className="h-[15px] w-[15px]" strokeWidth={3} /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`${monoFont} truncate text-[14px] font-bold ${tokenText}`}>
                        {row.codigo}
                      </div>
                      <div className={`truncate text-[12.5px] ${tokenTextSub}`}>
                        {row.descricao || "Endereço operacional"}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[12.5px] ${tokenTextSub}`}>Quantidade</span>
                    <input
                      type="number"
                      min={1}
                      value={selected ? qty : ""}
                      onChange={(e) => {
                        const v = Math.max(1, Number(e.target.value) || 1);
                        setPrintSelection((prev) => ({ ...prev, [row.id]: v }));
                      }}
                      className={`h-9 w-[64px] shrink-0 rounded-full border px-2.5 text-center text-[13px] font-semibold outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className={`flex flex-wrap items-center justify-end gap-3 border-t px-6 py-4 ${tokenBorder}`}>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className={`flex h-11 items-center rounded-full border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => printSelected("thermal")}
                disabled={printSelectedCount === 0}
                className={`flex h-11 items-center gap-2 rounded-full border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-50 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                <Printer className="h-4 w-4" />
                Térmica (10x15)
              </button>
              <button
                type="button"
                onClick={() => printSelected("a4")}
                disabled={printSelectedCount === 0}
                className="enderecos-print-a4-btn flex h-11 items-center gap-2 rounded-full px-[20px] text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Printer className="h-4 w-4" />
                Folha A4
              </button>
              <style jsx>{`
                .enderecos-print-a4-btn {
                  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
                  background-size: 220% 100%;
                  background-position: 0% 50%;
                  box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
                  transition:
                    background-position 0.6s ease,
                    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 0.3s ease;
                }
                .enderecos-print-a4-btn:hover:not(:disabled) {
                  background-position: 100% 50%;
                  transform: translateY(-3px);
                  box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
                }
              `}</style>
            </div>
          </div>
        </div>
      ) : null}

      {editingRow ? (
        <EnderecoForm
          onClose={handleEditClose}
          onDelete={() => {
            const row = editingRow;
            setEditingRow(null);
            setConfirmDelete(row);
          }}
          defaultValues={{
            id: editingRow.id,
            codigo: editingRow.codigo,
            descricao: editingRow.descricao,
            area: editingRow.area,
            unidadePadrao: editingRow.unidadePadrao,
            rua: "",
            modulo: "",
            nivel: "",
            posicao: "",
            capacidadeMaxima: editingRow.capacidadeMaxima
              ? String(editingRow.capacidadeMaxima)
              : "",
            capacidadePesoKg: editingRow.capacidadePesoKg
              ? String(editingRow.capacidadePesoKg)
              : "",
            volumeModo: editingRow.volumeModo,
            alturaCm: editingRow.alturaCm ? String(editingRow.alturaCm) : "",
            larguraCm: editingRow.larguraCm ? String(editingRow.larguraCm) : "",
            comprimentoCm: editingRow.comprimentoCm ? String(editingRow.comprimentoCm) : "",
            ativo: editingRow.ativo,
          }}
        />
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" style={manropeStyle}>
          <div
            className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
            onClick={() => !isDeleting && setConfirmDelete(null)}
          />
          <div
            className={`relative flex w-[420px] max-w-[94vw] flex-col gap-4 rounded-[18px] border ${tokenBorder} ${tokenCardBg} p-[26px] shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(239,68,68,0.14)] text-[#EF4444]">
                <Trash2 className="h-[22px] w-[22px]" />
              </span>
              <div className="flex flex-col gap-[3px]">
                <span className={`${FIN_HEADING} text-[18px] font-bold ${tokenText}`}>Excluir endereço?</span>
                <span className={`text-[13px] leading-[1.4] ${tokenTextSub}`}>Esta ação não pode ser desfeita.</span>
              </div>
            </div>
            <div className={`rounded-full border ${tokenBorder} bg-[rgba(148,163,184,0.06)] px-4 py-3.5 text-[13.5px] font-bold ${tokenText}`}>
              {confirmDelete.codigo}
            </div>
            {deleteError ? <p className="text-[13px] text-[#EF4444]">{deleteError}</p> : null}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(null)}
                className={`h-12 flex-1 rounded-full border text-sm font-bold transition-colors hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:opacity-50 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{ background: "#EF4444", color: "#fff" }}
                className="h-12 flex-1 rounded-full text-sm font-extrabold shadow-[0_8px_22px_rgba(239,68,68,0.35)] transition-transform hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
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

function EnderecoDrawer({
  row,
  isToggling,
  onClose,
  onEdit,
  onToggleBlock,
  onDelete,
}: {
  row: EnderecoRow;
  isToggling: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleBlock: () => void;
  onDelete: () => void;
}) {
  const accent = areaAccent[row.area] ?? "#64748B";
  const status = getRowStatus(row);
  const statusColor = statusPillColor(status);
  const barColor = getBarColor(row.ocupacao);
  const unidade = row.unidadeSaldo;

  const [movimentacoes, setMovimentacoes] = useState<EnderecoMovimentacaoDto[]>([]);
  const [movLoading, setMovLoading] = useState(true);
  const [showAllMov, setShowAllMov] = useState(false);
  const [photoProduct, setPhotoProduct] = useState<EnderecoProduto | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMovLoading(true);
    getEnderecoMovimentacoesAction(row.id)
      .then((data) => {
        if (!cancelled) setMovimentacoes(data);
      })
      .catch(() => {
        if (!cancelled) setMovimentacoes([]);
      })
      .finally(() => {
        if (!cancelled) setMovLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  async function printEtiqueta() {
    const svg = document.getElementById(`barcode-label-${row.id}`)?.querySelector("svg");
    const barcode = svg ? new XMLSerializer().serializeToString(svg) : "";

    // Embute o SVG do logo direto no HTML (em vez de <img src>) para que o
    // ícone já esteja presente no momento da impressão, sem depender de load
    // assíncrono da imagem.
    let logoMarkup = "";
    try {
      const res = await fetch("/branding/infinoos-icon-wms.svg");
      if (res.ok) {
        const svgText = await res.text();
        logoMarkup = `<div class="logo">${svgText}</div>`;
      }
    } catch {
      logoMarkup = "";
    }

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;
    const styles = `
      @page { size: 100mm 150mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
      .label { position: relative; width: 100mm; height: 150mm; page-break-after: always; padding: 8mm 6mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; }
      .ticket { width: 100%; padding: 3mm 3mm 2mm; border: .35mm solid #dbe3ef; border-radius: 4mm; background: #fff; }
      .label-head { position: relative; width: 100%; height: 10mm; display: flex; align-items: center; justify-content: center; }
      .logo { position: absolute; top: 0; left: 0; width: 7mm; height: 7mm; filter: grayscale(1); }
      .logo svg { width: 100%; height: 100%; object-fit: contain; }
      .address { font-family: monospace; font-size: 14pt; font-weight: 800; line-height: 1.1; letter-spacing: .04em; word-break: break-word; }
      .barcode { width: 86mm; margin-top: 1mm; }
      .barcode svg { display: block; width: 86mm; height: 30mm; }
    `;
    const label = `
      <section class="label">
        <div class="ticket">
          <div class="label-head">${logoMarkup}<div class="address">${row.codigo}</div></div>
          <div class="barcode">${barcode}</div>
        </div>
      </section>
    `;
    printWindow.document.write(
      `<!doctype html><html><head><title>Etiqueta ${row.codigo}</title><style>${styles}</style></head><body>${label}</body></html>`,
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }
  const pesoLabel =
    row.capacidadePesoKg > 0
      ? `${formatNumber(row.peso)} / ${formatNumber(row.capacidadePesoKg)} kg`
      : row.peso > 0
        ? `${formatNumber(row.peso)} kg`
        : "—";

  return (
    <div className="fixed inset-0 z-40" style={manropeStyle}>
      <div
        className="absolute inset-0 bg-[rgba(6,10,20,0.45)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[400px] max-w-[92vw] flex-col border-l bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        <div className={`border-b px-6 pb-4 pt-[22px] ${tokenBorder}`}>
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
              style={{ background: hexAlpha(accent, 0.12), color: accent }}
            >
              Zona {zoneLetter(row.area)} · {areaLabel[row.area] ?? row.area}
            </span>
            <span
              className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
              style={{ background: statusColor.bg, color: statusColor.fg }}
            >
              {statusLabel(status)}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              title="Imprimir etiqueta"
              onClick={printEtiqueta}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] hover:text-[#8B5CF6] dark:hover:border-[#8B5CF6] dark:hover:text-[#8B5CF6]`}
            >
              <Printer className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              title="Excluir"
              onClick={onDelete}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[rgba(239,68,68,0.35)] text-[#EF4444] transition hover:bg-[rgba(239,68,68,0.08)]"
            >
              <Trash2 className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              title="Fechar"
              onClick={onClose}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`${monoFont} text-[22px] font-bold ${tokenText}`}>{row.codigo}</div>
          <div className="mt-3 flex items-center gap-2.5">
            <div
              style={{
                flex: "1 1 0%",
                height: "8px",
                background: "rgba(100,116,139,0.14)",
                borderRadius: "5px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${row.ocupacao ?? 0}%`,
                  height: "100%",
                  borderRadius: "5px",
                  background: barColor,
                }}
              />
            </div>
            <span className={`${FIN_HEADING} text-[17px] font-bold ${tokenText}`}>
              {row.ocupacao != null ? `${row.ocupacao}%` : "0%"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-2.5">
          <div className="my-3">
            <div className={`mb-2 text-[12px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}>
              Etiqueta do endereço
            </div>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/infinoos-icon-wms.svg"
                alt="Infinoos WMS"
                className="pointer-events-none absolute left-5 top-2 z-10 h-8 w-8 object-contain grayscale"
              />
              <AddressBarcodePreview value={row.codigo} containerId={`barcode-label-${row.id}`} />
            </div>
          </div>

          {row.produtos.length ? (
            <div className="flex flex-col gap-2">
              {row.produtos.map((p, i) => (
                <button
                  key={`${p.sku}-${i}`}
                  type="button"
                  onClick={() => setPhotoProduct(p)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
                >
                  <ProductThumb imagemUrl={p.imagemUrl} nome={p.nome} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[14px] font-bold ${tokenText}`}>{p.nome}</div>
                    {p.sku ? (
                      <div className={`${monoFont} mt-0.5 truncate text-[11.5px] ${tokenTextSub}`}>{p.sku}</div>
                    ) : null}
                  </div>
                  <span className={`${monoFont} shrink-0 text-[13px] font-semibold ${tokenText}`}>
                    {formatNumber(p.quantidade)} {p.unidade}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={`rounded-xl border px-4 py-3.5 text-[13px] ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`}>
              Nenhum produto armazenado nesta posição.
            </div>
          )}

          <div className={`mt-1 flex items-center justify-between gap-3 border-b py-[9px] text-[13.5px] ${tokenBorder}`}>
            <span className={tokenTextSub}>Saldo</span>
            <span className={`font-semibold ${tokenText}`}>
              {formatNumber(row.quantidade)} {unidade}
            </span>
          </div>
          <div className={`flex items-center justify-between gap-3 border-b py-[9px] text-[13.5px] ${tokenBorder}`}>
            <span className={tokenTextSub}>Peso</span>
            <span className={`font-semibold ${tokenText}`}>{pesoLabel}</span>
          </div>
          <div className={`flex items-center justify-between gap-3 border-b py-[9px] text-[13.5px] ${tokenBorder}`}>
            <span className={tokenTextSub}>SKUs distintos</span>
            <span className={`font-semibold ${tokenText}`}>{row.skus}</span>
          </div>

          <div className="mt-3.5">
            <div className={`mb-2.5 text-[12px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}>
              Últimas movimentações
            </div>
            {movLoading ? (
              <p className={`text-[13px] ${tokenTextSub}`}>Carregando movimentações...</p>
            ) : movimentacoes.length ? (
              <>
                <div className="flex flex-col">
                  {movimentacoes.slice(0, 3).map((m, i) => (
                    <MovimentacaoRow key={i} m={m} unidade={unidade} showBorder={i > 0} />
                  ))}
                </div>
                {movimentacoes.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMov(true)}
                    className={`mt-2.5 w-full rounded-full border py-2 text-[12.5px] font-bold transition hover:border-[#8B5CF6] hover:text-[#8B5CF6] dark:hover:border-[#8B5CF6] dark:hover:text-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`}
                  >
                    Ver mais ({movimentacoes.length})
                  </button>
                ) : null}
              </>
            ) : (
              <p className={`text-[13px] ${tokenTextSub}`}>Sem movimentações recentes.</p>
            )}
          </div>
        </div>

        <div className={`flex gap-2 border-t px-6 py-3.5 ${tokenBorder}`}>
          <button
            type="button"
            onClick={onToggleBlock}
            disabled={isToggling}
            className="flex h-10 flex-1 items-center justify-center gap-[7px] rounded-full text-[13px] font-bold transition-all hover:-translate-y-px hover:brightness-[1.06] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:brightness-100"
            style={
              row.ativo
                ? { background: "#F59E0B", color: "#422006" }
                : { background: "rgba(16,185,129,0.14)", color: "#10B981" }
            }
          >
            {row.ativo ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {row.ativo ? "Bloquear" : "Desbloquear"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="endereco-drawer-edit-btn flex h-10 flex-1 items-center justify-center gap-[7px] rounded-full text-[13px] font-extrabold text-white"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <style jsx>{`
            .endereco-drawer-edit-btn {
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
              background-size: 220% 100%;
              background-position: 0% 50%;
              transition:
                background-position 0.6s ease,
                transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .endereco-drawer-edit-btn:hover {
              background-position: 100% 50%;
              transform: translateY(-3px);
            }
          `}</style>
        </div>
      </aside>

      {showAllMov ? (
        <MovimentacoesModal
          enderecoId={row.id}
          codigo={row.codigo}
          unidade={unidade}
          onClose={() => setShowAllMov(false)}
        />
      ) : null}

      {photoProduct ? (
        <ProductPhotoModal produto={photoProduct} onClose={() => setPhotoProduct(null)} />
      ) : null}
    </div>
  );
}

type MovFilter = "atual" | "passado" | "periodo";

function monthBounds(filter: MovFilter, ano: number, mes: number, fromStr: string, toStr: string) {
  if (filter === "atual") {
    const from = new Date(ano, mes, 1, 0, 0, 0);
    const to = new Date(ano, mes + 1, 0, 23, 59, 59);
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }
  if (filter === "passado") {
    const from = new Date(ano, mes - 1, 1, 0, 0, 0);
    const to = new Date(ano, mes, 0, 23, 59, 59);
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }
  const fromIso = fromStr ? new Date(`${fromStr}T00:00:00`).toISOString() : null;
  const toIso = toStr ? new Date(`${toStr}T23:59:59`).toISOString() : null;
  return { fromIso, toIso };
}

function MovimentacoesModal({
  enderecoId,
  codigo,
  unidade,
  onClose,
}: {
  enderecoId: string;
  codigo: string;
  unidade: string;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<MovFilter>("atual");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [movs, setMovs] = useState<EnderecoMovimentacaoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (filter === "periodo" && (!fromStr || !toStr)) {
      setLoading(false);
      setMovs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const { fromIso, toIso } = monthBounds(filter, now.getFullYear(), now.getMonth(), fromStr, toStr);
    getEnderecoMovimentacoesAction(enderecoId, fromIso, toIso)
      .then((data) => {
        if (!cancelled) setMovs(data);
      })
      .catch(() => {
        if (!cancelled) setMovs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enderecoId, filter, fromStr, toStr, now]);

  const filterChips: Array<{ key: MovFilter; label: string }> = [
    { key: "atual", label: "Mês atual" },
    { key: "passado", label: "Mês passado" },
    { key: "periodo", label: "Período" },
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-6" style={manropeStyle}>
      <div
        className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[82vh] w-[480px] max-w-[94vw] flex-col rounded-[18px] border ${tokenBorder} ${tokenCardBg} shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
      >
        <div className={`flex items-center justify-between gap-3 border-b px-6 py-4 ${tokenBorder}`}>
          <div className="flex flex-col gap-[2px]">
            <span className={`${FIN_HEADING} text-[16px] font-bold ${tokenText}`}>
              Movimentações · {codigo}
            </span>
            <span className={`text-[12px] ${tokenTextSub}`}>
              {loading
                ? "Carregando..."
                : `${movs.length} movimentação${movs.length === 1 ? "" : "ões"} no período`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={`flex flex-col gap-2.5 border-b px-6 py-3 ${tokenBorder}`}>
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => {
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  className="inline-flex items-center transition"
                  style={{
                    height: "34px",
                    padding: "0 14px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: active ? "1.5px solid #8B5CF6" : "1.5px solid rgba(100,116,139,0.16)",
                    background: active ? "rgba(139,92,246,0.12)" : "transparent",
                    color: active ? "#8B5CF6" : "#64748B",
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          {filter === "periodo" ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={fromStr}
                max={toStr || undefined}
                onChange={(e) => setFromStr(e.target.value)}
                className={`h-[38px] rounded-full border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              />
              <span className={`text-[13px] ${tokenTextSub}`}>até</span>
              <input
                type="date"
                value={toStr}
                min={fromStr || undefined}
                onChange={(e) => setToStr(e.target.value)}
                className={`h-[38px] rounded-full border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              />
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <p className={`py-6 text-center text-[13px] ${tokenTextSub}`}>Carregando movimentações...</p>
          ) : filter === "periodo" && (!fromStr || !toStr) ? (
            <p className={`py-6 text-center text-[13px] ${tokenTextSub}`}>
              Selecione a data inicial e final.
            </p>
          ) : movs.length ? (
            <div className="flex flex-col">
              {movs.map((m, i) => (
                <MovimentacaoRow key={i} m={m} unidade={unidade} showBorder={i > 0} />
              ))}
            </div>
          ) : (
            <p className={`py-6 text-center text-[13px] ${tokenTextSub}`}>
              Nenhuma movimentação neste período.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductThumb({ imagemUrl, nome }: { imagemUrl: string | null; nome: string }) {
  if (imagemUrl) {
    return (
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full">
        <Image
          src={imagemUrl}
          alt={nome}
          width={44}
          height={44}
          unoptimized
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${tokenBorder} ${tokenCardBg} ${tokenTextSub}`}
    >
      <Package className="h-5 w-5" />
    </span>
  );
}

function ProductPhotoModal({
  produto,
  onClose,
}: {
  produto: EnderecoProduto;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-6" style={manropeStyle}>
      <div
        className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative flex w-[420px] max-w-[94vw] flex-col rounded-[18px] border ${tokenBorder} ${tokenCardBg} shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute right-3 top-3 z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border ${tokenBorder} ${tokenCardBg} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-t-[18px] border-b ${tokenBorder} ${tokenInputBg}`}
        >
          {produto.imagemUrl ? (
            <Image
              src={produto.imagemUrl}
              alt={produto.nome}
              width={420}
              height={420}
              unoptimized
              className="h-full w-full object-contain"
            />
          ) : (
            <Package className={`h-20 w-20 ${tokenTextSub}`} />
          )}
        </div>
        <div className="flex flex-col gap-2 p-6">
          <span className={`${FIN_HEADING} text-[18px] font-bold leading-tight ${tokenText}`}>
            {produto.nome}
          </span>
          <div className="flex flex-col gap-1.5">
            {produto.sku ? (
              <div className="flex items-center gap-2 text-[13px]">
                <span className={tokenTextSub}>SKU:</span>
                <span className={`${monoFont} font-semibold ${tokenText}`}>{produto.sku}</span>
              </div>
            ) : null}
            {produto.depositante ? (
              <div className="flex items-center gap-2 text-[13px]">
                <span className={tokenTextSub}>Depositante:</span>
                <span className={`font-semibold ${tokenText}`}>{produto.depositante}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MovimentacaoRow({
  m,
  unidade,
  showBorder,
}: {
  m: EnderecoMovimentacaoDto;
  unidade: string;
  showBorder: boolean;
}) {
  return (
    <div className={`flex gap-2.5 py-2 ${showBorder ? `border-t ${tokenBorder}` : ""}`}>
      <div
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ background: movementDot(m.sinal) }}
      />
      <div className="flex-1">
        <div className={`text-[13px] font-semibold ${tokenText}`}>
          {formatMovementTipo(m.tipo)}
          {m.sinal ? ` · ${m.sinal}${formatNumber(m.quantidade)} ${unidade}` : ""}
        </div>
        <div className={`${monoFont} mt-0.5 text-[11.5px] ${tokenTextSub}`}>
          {m.ref ? `${m.quando} · ${m.ref}` : m.quando}
        </div>
      </div>
    </div>
  );
}

function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatMovementTipo(tipo: string) {
  if (!tipo) return "Movimentação";
  return tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase().replace(/_/g, " ");
}

function movementDot(sinal: "+" | "-" | "") {
  if (sinal === "+") return "#3B82F6";
  if (sinal === "-") return "#8B5CF6";
  return "#10B981";
}

function ViewToggleButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 transition"
          : "inline-flex items-center gap-1.5 text-[#64748B] transition hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-white/5"
      }
      style={{
        height: "34px",
        padding: "0 16px",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        border: "none",
        ...(active ? { background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff" } : {}),
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function MapView({ rows, onSelect }: { rows: EnderecoRow[]; onSelect: (row: EnderecoRow) => void }) {
  const zones = useMemo(() => groupByZone(rows), [rows]);

  return (
    <div className="py-5">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={`${FIN_HEADING} text-[16px] font-bold ${tokenText}`}>Mapa do Armazém</span>
        <div className="flex-1" />
        <div className={`flex items-center gap-1.5 text-[11px] ${tokenTextSub}`}>
          <span>Ocupação:</span>
          <LegendPill color="148,163,184" label="0%" />
          <LegendPill color="59,130,246" label="<75%" />
          <LegendPill color="139,92,246" label="75%" />
          <LegendPill color="245,158,11" label="90%" />
          <LegendPill color="239,68,68" label="100%" />
        </div>
      </div>
      <div className="flex flex-col">
        {zones.length === 0 ? (
          <p className={`py-8 text-center text-sm ${tokenTextSub}`}>
            Sem endereços para exibir no mapa.
          </p>
        ) : (
          zones.map((zone) => (
            <ZoneGrid key={zone.area} zone={zone} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        style={{
          width: "12px",
          height: "12px",
          background: `rgba(${color},0.267)`,
          border: `1px solid rgba(${color},0.4)`,
          borderRadius: "3px",
        }}
      />
      <span style={{ fontSize: "10px" }}>{label}</span>
    </div>
  );
}

type ZoneData = {
  area: string;
  ruaGroups: Array<{ rua: string; positions: EnderecoRow[] }>;
  count: number;
};

function getRua(row: EnderecoRow): string {
  if (row.rua?.trim()) return row.rua.trim();
  const segs = row.codigo.split(/[-.]/);
  const rSeg = segs.find((s) => /^R\d+/i.test(s));
  return rSeg ?? segs[1] ?? segs[0] ?? "—";
}

function groupByZone(rows: EnderecoRow[]): ZoneData[] {
  const byArea = new Map<string, EnderecoRow[]>();
  for (const row of rows) {
    const list = byArea.get(row.area) ?? [];
    list.push(row);
    byArea.set(row.area, list);
  }
  const result: ZoneData[] = [];
  for (const [area, list] of byArea) {
    const byRua = new Map<string, EnderecoRow[]>();
    for (const row of list) {
      const rua = getRua(row);
      const g = byRua.get(rua) ?? [];
      g.push(row);
      byRua.set(rua, g);
    }
    const ruaGroups = Array.from(byRua.entries())
      .map(([rua, positions]) => ({
        rua,
        positions: positions.sort((a, b) => a.codigo.localeCompare(b.codigo)),
      }))
      .sort((a, b) => a.rua.localeCompare(b.rua, undefined, { numeric: true }));
    result.push({ area, ruaGroups, count: list.length });
  }
  return result.sort((a, b) => a.area.localeCompare(b.area));
}

function zoneLetter(area: string) {
  const areaLetters: Record<string, string> = {
    PICKING: "A",
    PULMAO: "B",
    RECEBIMENTO: "C",
    EXPEDICAO: "D",
    QUARENTENA: "Q",
    BLOQUEADO: "X",
  };
  return areaLetters[area] ?? "?";
}

function ZoneGrid({ zone, onSelect }: { zone: ZoneData; onSelect: (row: EnderecoRow) => void }) {
  const accent = areaAccent[zone.area] ?? "#64748B";
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "3px",
            background: accent,
          }}
        />
        <span className={`${FIN_HEADING} text-[15px] font-bold ${tokenText}`}>
          Zona {zoneLetter(zone.area)} — {areaLabel[zone.area] ?? zone.area}
        </span>
        <span className={`text-[12px] ${tokenTextSub}`}>{zone.count} posições</span>
      </div>
      <div className="flex flex-col">
        {zone.ruaGroups.map((group, idx) => (
          <div
            key={group.rua}
            className={`flex items-stretch gap-2 py-4 ${idx > 0 ? `border-t ${tokenBorder}` : ""}`}
          >
            <div
              className={`${monoFont} ${tokenTextSub} flex shrink-0 items-center justify-end`}
              style={{ width: "40px", fontSize: "10px", fontWeight: 600 }}
            >
              {group.rua}
            </div>
            <div className="flex flex-wrap gap-1">
              {group.positions.map((row) => (
                <MapCell key={row.id} row={row} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const emptyCellClass = `border-2 border-[rgba(100,116,139,0.16)] bg-slate-100/80 dark:border-[rgba(148,163,184,0.14)] dark:bg-white/[0.04]`;

// Hover idêntico ao mockup: um contorno violeta sutil (não um scale), com
// leve deslocamento e z-index elevado para o realce ficar por cima dos vizinhos.
const cellHoverHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.outline = "1.5px solid rgba(139,92,246,0.6)";
    e.currentTarget.style.outlineOffset = "1px";
    e.currentTarget.style.zIndex = "2";
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.outline = "none";
    e.currentTarget.style.zIndex = "0";
  },
};

function MapCell({ row, onSelect }: { row: EnderecoRow; onSelect: (row: EnderecoRow) => void }) {
  const baseStyle: React.CSSProperties = {
    position: "relative",
    width: "64px",
    height: "40px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-space-grotesk), monospace",
    fontSize: "11.5px",
    fontWeight: 600,
  };

  const pct = row.ocupacao ?? 0;
  const rgb = cellRgb(pct);
  const label = row.ocupacao != null ? `${row.ocupacao}%` : "—";

  if (!rgb) {
    return (
      <button
        type="button"
        onClick={() => onSelect(row)}
        {...cellHoverHandlers}
        title={`${row.codigo} — ${label}`}
        className={`${emptyCellClass} ${tokenTextSub}`}
        style={{ ...baseStyle, cursor: "pointer" }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      {...cellHoverHandlers}
      title={`${row.codigo} — ${label}`}
      className={tokenText}
      style={{
        ...baseStyle,
        background: `rgba(${rgb},0.2)`,
        border: `2px solid rgba(${rgb},0.4)`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function cellRgb(pct: number): string | null {
  if (pct >= 100) return "239,68,68";
  if (pct >= 90) return "245,158,11";
  if (pct >= 75) return "139,92,246";
  if (pct > 0) return "59,130,246";
  return null;
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

function EnderecoRowTr({ row, onClick }: { row: EnderecoRow; onClick: () => void }) {
  const accent = areaAccent[row.area] ?? "#64748B";
  const status = getRowStatus(row);
  const statusColor = statusPillColor(status);
  const barColor = getBarColor(row.ocupacao);

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-t transition ${tokenBorder} hover:bg-[rgba(139,92,246,0.08)]`}
    >
      <td style={{ padding: "14px 20px" }}>
        <div className="flex items-center gap-2.5">
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "2px",
              background: accent,
              flexShrink: 0,
            }}
          />
          <div>
            <div
              className={monoFont}
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <span className={tokenText}>{row.codigo}</span>
            </div>
            <div
              className={tokenTextSub}
              style={{ fontSize: "11.5px", marginTop: "1px", whiteSpace: "nowrap" }}
            >
              {row.descricao || `Zona · ${areaLabel[row.area] ?? row.area}`}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 20px", minWidth: "150px" }}>
        <div className="flex items-center gap-2.5">
          <div
            style={{
              flex: "1 1 0%",
              height: "6px",
              background: "rgba(100,116,139,0.14)",
              borderRadius: "4px",
              overflow: "hidden",
              minWidth: "64px",
            }}
          >
            <div
              style={{
                width: `${row.ocupacao ?? 0}%`,
                height: "100%",
                borderRadius: "4px",
                background: barColor,
              }}
            />
          </div>
          <span
            className={`${monoFont} ${tokenText}`}
            style={{ fontSize: "12.5px", minWidth: "38px", textAlign: "right" }}
          >
            {row.ocupacao != null ? `${row.ocupacao}%` : "0%"}
          </span>
        </div>
      </td>
      <td style={{ padding: "14px 20px", textAlign: "center" }}>
        <span
          className={`${monoFont} ${tokenText}`}
          style={{ fontSize: "14px", fontWeight: 700 }}
        >
          {row.skus > 0 ? row.skus : "—"}
        </span>
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
            background: statusColor.bg,
            color: statusColor.fg,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: statusColor.fg,
            }}
          />
          {statusLabel(status)}
        </span>
      </td>
      <td
        style={{ padding: "14px 20px", textAlign: "right", fontSize: "13px" }}
        className={tokenTextSub}
      >
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
  inlineBar,
}: {
  label: string;
  value: string;
  secondary?: string;
  valueColor?: string;
  inlineBar?: { pct: number };
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101B30]">
      <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
      <div className="flex items-center justify-between gap-3">
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
        {inlineBar ? (
          <div
            style={{
              width: "80px",
              height: "6px",
              background: "rgba(100,116,139,0.14)",
              borderRadius: "3px",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: `${inlineBar.pct}%`,
                height: "100%",
                background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
                borderRadius: "3px",
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getRowStatus(row: EnderecoRow): "ATIVO" | "VAZIO" | "CHEIO" | "BLOQUEADO" {
  if (!row.ativo || row.area === "BLOQUEADO" || row.area === "QUARENTENA") return "BLOQUEADO";
  if (row.ocupacao != null && row.ocupacao >= 100) return "CHEIO";
  if ((row.ocupacao ?? 0) <= 0) return "VAZIO";
  return "ATIVO";
}

function statusLabel(status: "ATIVO" | "VAZIO" | "CHEIO" | "BLOQUEADO") {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusPillColor(status: "ATIVO" | "VAZIO" | "CHEIO" | "BLOQUEADO") {
  switch (status) {
    case "ATIVO":
      return { bg: "rgba(16,185,129,0.1)", fg: "#10B981" };
    case "CHEIO":
      return { bg: "rgba(239,68,68,0.1)", fg: "#EF4444" };
    case "BLOQUEADO":
      return { bg: "rgba(148,163,184,0.14)", fg: "#64748B" };
    default:
      return { bg: "rgba(148,163,184,0.14)", fg: "#64748B" };
  }
}

function getBarColor(pct: number | null) {
  if (pct == null) return "rgba(100,116,139,0.14)";
  if (pct >= 90) return "#EF4444";
  if (pct >= 70) return "#F59E0B";
  if (pct >= 40) return "#3B82F6";
  return "#10B981";
}
