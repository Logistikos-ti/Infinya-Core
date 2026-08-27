"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, Download, X, CircleDollarSign, Clock, CheckCircle2, Receipt, Plus, Building2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { LancamentoForm } from "@/components/financeiro/lancamento-form";
import { InsumoForm } from "@/components/financeiro/insumo-forms";
import { ContratoForm } from "@/components/financeiro/contrato-form";
import { ContaPagarForm } from "@/components/financeiro/conta-pagar-form";
import { marcarContaPagarPagaAction } from "@/app/(dashboard)/financeiro/contas-a-pagar/actions";
import { FIN_HEADING, FIN_MONO, FinBadge } from "@/components/financeiro/fin-ui";
import { formatCnpj } from "@/lib/transportadoras";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Depositante = { id: string; nome: string };

export type FaturaRow = {
  id: string;
  depId: string;
  depNome: string;
  mesAno: string;
  status: string;
  valor: number;
  vencimento: string;
};

export type ContratoRow = {
  id: string;
  depId: string;
  depNome: string;
  cnpj: string | null;
  logoUrl: string | null;
  tipoContrato: string;
  responsavel: string | null;
  emailsCobranca: string[] | null;
  marketplacesPontoColeta: string[] | null;
  ativo: boolean;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  taxaFulfillment: number;
  minimoFulfillment: number;
  valorPontoColeta: number;
  valorImpressaoNf: number;
  taxaFreteFixa: number;
  taxaFretePercentual: number;
  tarifaPosicao: number;
  tarifaRecebimento: number;
  valorLogisticaReversa: number;
  valorSoftware: number;
  qtdRefrigeradores: number;
  valorUnitarioRefrigerador: number;
  observacoes: string | null;
};

export type InsumoRow = {
  id: string;
  nome: string;
  sku: string | null;
  categoria: string | null;
  unidade: string;
  precoUnitario: number;
  estoqueInicial: number;
  estoqueMinimo: number;
  fornecedor: string | null;
  ordem: number;
  ativo: boolean;
};

export type ContaPagarRow = {
  id: string;
  fornecedor: string;
  descricao: string;
  categoria: string | null;
  valor: number;
  vencimento: string;
  status: "PENDENTE" | "PAGO" | "VENCIDO";
  observacoes: string | null;
};

export type FaturaDocRow = {
  id: string;
  depNome: string;
  mesAno: string;
  status: string;
  valor: number;
  docUrl: string;
  docNome: string | null;
};

export type ExtratoRow = {
  id: string;
  tipo: string;
  depNome: string;
  codigo: string;
  data: string;
  valor: number;
};

type Tab = "visao" | "faturamento" | "pagar" | "contratos" | "insumos" | "nfse" | "boletos";

type Props = {
  depositantes: Depositante[];
  faturas: FaturaRow[];
  contratos: ContratoRow[];
  insumos: InsumoRow[];
  contasPagar: ContaPagarRow[];
  faturasNfse: FaturaDocRow[];
  faturasBoletos: FaturaDocRow[];
  extrato: ExtratoRow[];
  insumosCatalogoAtivo: { id: string; nome: string; unidade: string; preco_unitario: number }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number) {
  return "R$ " + (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMesAno(mesAno: string) {
  const [year, month] = mesAno.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[Number(month) - 1]} ${year}`;
}

function formatDateBr(iso: string) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("pt-BR");
}

// Não existe um código de contrato no schema real — gera um identificador de
// exibição estável (CT-ano-sequencial) a partir da vigência de início, no
// mesmo padrão do mockup (CT-2025-01).
function contratoDisplayId(contrato: ContratoRow, allContratos: ContratoRow[]): string {
  const year = contrato.vigenciaInicio ? contrato.vigenciaInicio.slice(0, 4) : String(new Date().getFullYear());
  const seq = allContratos.indexOf(contrato) + 1;
  return `CT-${year}-${String(seq).padStart(2, "0")}`;
}

// Abas visíveis na navegação — igual ao mockup original (4 abas). Contas a
// Pagar, NFS-e e Boletos continuam implementadas (buildRows, drawers, modal)
// mas ficam fora da navegação por enquanto; para reexibi-las, é só devolver
// suas chaves aqui.
const VISIBLE_TABS: Tab[] = ["visao", "faturamento", "contratos", "insumos"];

const CATEGORIA_COLORS: Record<string, string> = {
  Embalagem: "#3B82F6",
  Etiqueta: "#8B5CF6",
  Proteção: "#F59E0B",
  Higiene: "#10B981",
};
const CATEGORIA_COLOR_DEFAULT = "#94A3B8";

const TAB_LABELS: Record<Tab, string> = {
  visao: "Visão geral",
  faturamento: "Faturamento",
  pagar: "Contas a Pagar",
  contratos: "Contratos",
  insumos: "Insumos",
  nfse: "NFS-e",
  boletos: "Boletos",
};

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinanceiroApp(props: Props) {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("visao");
  const [search, setSearch] = useState("");
  const [depSel, setDepSel] = useState("all");
  const [statusSel, setStatusSel] = useState("all");
  const [monthSel, setMonthSel] = useState("all");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | null
    | "novoLanc"
    | "novoInsumo"
    | "novoPagar"
    | "novoContrato"
    | "editContrato"
    | "exportContrato"
    | "exportInsumos"
    | "exportFaturamento"
  >(null);
  const [exportDep, setExportDep] = useState("");
  const [exportFormato, setExportFormato] = useState<"pdf" | "docx">("pdf");
  const [exportInsumosEscopo, setExportInsumosEscopo] = useState<"todos" | "categoria" | "fornecedor">("todos");
  const [exportInsumosCategoria, setExportInsumosCategoria] = useState("Embalagem");
  const [exportInsumosFornecedor, setExportInsumosFornecedor] = useState("");
  const [exportInsumosFormato, setExportInsumosFormato] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [exportFatDep, setExportFatDep] = useState("");
  const [exportFatFormato, setExportFatFormato] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [editContratoId, setEditContratoId] = useState<string | null>(null);
  const [novoContratoDepId, setNovoContratoDepId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function selectTab(t: Tab) {
    setTab(t);
    setPage(1);
    setStatusSel("all");
    setSearch("");
    setActiveId(null);
  }

  function closeModal() {
    setModal(null);
    setEditContratoId(null);
    setNovoContratoDepId(null);
    setExportDep("");
    setExportFormato("pdf");
    setExportInsumosEscopo("todos");
    setExportInsumosCategoria("Embalagem");
    setExportInsumosFornecedor("");
    setExportInsumosFormato("csv");
    setExportFatDep("");
    setExportFatFormato("csv");
  }

  function onFormSuccess(msg: string) {
    closeModal();
    showToast(msg);
    router.refresh();
  }

  function exportContratosCsv(onlyDepId?: string) {
    const header = ["ID", "Depositante", "Tipo de contrato", "CNPJ", "Responsável", "E-mails", "Vigência início", "Vigência fim", "Status"];
    const deps = onlyDepId ? props.depositantes.filter((d) => d.id === onlyDepId) : props.depositantes;
    const lines = deps.map((dep) => {
      const c = props.contratos.find((ct) => ct.depId === dep.id);
      if (!c) return ["—", dep.nome, "—", "—", "—", "—", "—", "—", "Inativo"];
      return [
        contratoDisplayId(c, props.contratos),
        c.depNome,
        c.tipoContrato === "consignado" ? "Consignado" : "Padrão",
        c.cnpj ? formatCnpj(c.cnpj) : "—",
        c.responsavel ?? "—",
        c.emailsCobranca?.length ? c.emailsCobranca.join(", ") : "—",
        formatDateBr(c.vigenciaInicio ?? ""),
        formatDateBr(c.vigenciaFim ?? ""),
        c.ativo ? "Ativo" : "Inativo",
      ];
    });
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const depSuffix = onlyDepId ? props.depositantes.find((d) => d.id === onlyDepId)?.nome.toLowerCase().replace(/\s+/g, "-") : "todos";
    a.download = `contrato-${depSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportInsumosCsv(filter?: { categoria?: string; fornecedor?: string }) {
    const header = ["SKU", "Insumo", "Categoria", "Unidade", "Custo", "Estoque", "Estoque mínimo", "Fornecedor", "Status"];
    const items = props.insumos.filter((i) => {
      if (filter?.categoria && i.categoria !== filter.categoria) return false;
      if (filter?.fornecedor && i.fornecedor !== filter.fornecedor) return false;
      return true;
    });
    const lines = items.map((i) => [
      i.sku ?? "—",
      i.nome,
      i.categoria ?? "—",
      i.unidade,
      fmt(i.precoUnitario),
      i.estoqueInicial,
      i.estoqueMinimo,
      i.fornecedor ?? "—",
      i.ativo ? "Ativo" : "Inativo",
    ]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = filter?.categoria
      ? filter.categoria.toLowerCase()
      : filter?.fornecedor
        ? filter.fornecedor.toLowerCase().replace(/\s+/g, "-")
        : "todos";
    a.download = `insumos-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return items.length;
  }

  function handleExportContratoSubmit() {
    if (!exportDep) {
      showToast("Selecione um depositante.");
      return;
    }
    exportContratosCsv(exportDep);
    const depNome = props.depositantes.find((d) => d.id === exportDep)?.nome ?? "";
    closeModal();
    showToast(`Contrato de ${depNome} exportado.`);
  }

  function handleExportInsumosSubmit() {
    if (exportInsumosEscopo === "fornecedor" && !exportInsumosFornecedor) {
      showToast("Selecione um fornecedor.");
      return;
    }
    const count = exportInsumosCsv({
      categoria: exportInsumosEscopo === "categoria" ? exportInsumosCategoria : undefined,
      fornecedor: exportInsumosEscopo === "fornecedor" ? exportInsumosFornecedor : undefined,
    });
    closeModal();
    showToast(`${count} insumo${count === 1 ? "" : "s"} exportado${count === 1 ? "" : "s"}.`);
  }

  function exportFaturamentoCsv(depId: string) {
    const header = ["Depositante", "Competência", "Vencimento", "Valor", "Status"];
    const items = props.faturas.filter((f) => f.depId === depId);
    const lines = items.map((f) => [f.depNome, formatMesAno(f.mesAno), formatDateBr(f.vencimento), fmt(f.valor), f.status]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const depNome = depNomeById[depId] ?? "depositante";
    a.download = `faturamento-${depNome.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return items.length;
  }

  function handleExportFaturamentoSubmit() {
    if (!exportFatDep) {
      showToast("Selecione um depositante.");
      return;
    }
    const count = exportFaturamentoCsv(exportFatDep);
    const depNome = depNomeById[exportFatDep] ?? "";
    closeModal();
    showToast(`${count} fatura${count === 1 ? "" : "s"} de ${depNome} exportada${count === 1 ? "" : "s"}.`);
  }

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    props.faturas.forEach((f) => set.add(f.mesAno));
    props.extrato.forEach((e) => set.add(e.data.slice(6, 10) + "-" + e.data.slice(3, 5)));
    return Array.from(set).sort().reverse();
  }, [props.faturas, props.extrato]);

  // -------------------------------------------------------------------------
  // Per-tab normalized rows for search/filter/pagination/table rendering
  // -------------------------------------------------------------------------

  type DisplayRow = {
    id: string;
    cols: React.ReactNode[];
    status?: string;
    searchHay: string;
    depId?: string;
  };

  const depNomeById = useMemo(() => {
    const m: Record<string, string> = {};
    props.depositantes.forEach((d) => (m[d.id] = d.nome));
    return m;
  }, [props.depositantes]);

  // Tamanhos e fontes por papel de coluna — valores exatos do mockup original.
  // Manrope: texto geral. JetBrains Mono (FIN_MONO): campos técnicos (ID,
  // CNPJ, valores em R$, vencimentos/datas e demais números).
  const COL_PRIMARY = "text-[13.5px] font-semibold text-slate-700 dark:text-zinc-300";
  const COL_SECONDARY = "text-[13px] text-slate-500 dark:text-zinc-400";
  const COL_MUTED = "text-[12.5px] text-slate-500 dark:text-zinc-400";
  const COL_MUTED_EMPTY = "text-[12.5px] text-slate-400 dark:text-zinc-600";
  const COL_MUTED_MONO = `${FIN_MONO} text-[12.5px] text-slate-500 dark:text-zinc-400`;
  const COL_MONO_MUTED = `${FIN_MONO} text-xs text-slate-500 dark:text-zinc-400`;
  const COL_ID = `${FIN_MONO} text-[12.5px] font-bold text-slate-900 dark:text-zinc-100`;
  const COL_VALUE = `${FIN_MONO} text-[13px] font-bold text-slate-900 dark:text-zinc-100`;
  const COL_ARROW = "text-[13px] text-slate-300 dark:text-zinc-600";
  const PILL = "rounded-full px-2.5 py-[3px] text-[11.5px] font-bold";

  function buildRows(): { head: string[]; rows: DisplayRow[]; showDepFilter: boolean; rightAlign?: number[] } {
    if (tab === "faturamento") {
      return {
        head: ["Depositante", "Competência", "Vencimento", "Valor", "Status", ""],
        showDepFilter: true,
        rows: props.faturas.map((f) => ({
          id: f.id,
          depId: f.depId,
          status: f.status,
          searchHay: `${f.depNome} ${f.mesAno}`.toLowerCase(),
          cols: [
            <span key="d" className={COL_PRIMARY}>{f.depNome}</span>,
            <span key="m" className={COL_MUTED}>{formatMesAno(f.mesAno)}</span>,
            <span key="v" className={COL_MUTED_MONO}>{formatDateBr(f.vencimento)}</span>,
            <span key="val" className={COL_VALUE}>{fmt(f.valor)}</span>,
            <FinBadge key="s" status={f.status} />,
            <span key="arrow" className={COL_ARROW}>›</span>,
          ],
        })),
      };
    }
    if (tab === "pagar") {
      return {
        head: ["Fornecedor", "Descrição", "Vencimento", "Valor", "Status", ""],
        showDepFilter: false,
        rows: props.contasPagar.map((c) => {
          const today = new Date(new Date().toDateString());
          const st = c.status === "PAGO" ? "Pago" : new Date(`${c.vencimento}T00:00:00`) < today ? "Vencido" : "Pendente";
          return {
            id: c.id,
            status: st,
            searchHay: `${c.fornecedor} ${c.descricao}`.toLowerCase(),
            cols: [
              <span key="f" className={COL_PRIMARY}>{c.fornecedor}</span>,
              <span key="d" className={`max-w-[220px] truncate ${COL_SECONDARY}`}>{c.descricao}</span>,
              <span key="v" className={COL_MUTED_MONO}>{formatDateBr(c.vencimento)}</span>,
              <span key="val" className={COL_VALUE}>{fmt(c.valor)}</span>,
              <FinBadge key="s" status={st} />,
              <span key="arrow" className={COL_ARROW}>›</span>,
            ],
          };
        }),
      };
    }
    if (tab === "contratos") {
      return {
        head: ["ID", "Depositante", "Tipo de contrato", "CNPJ", "Responsável", "Vigência", "Status", ""],
        showDepFilter: false,
        rows: props.depositantes.map((dep) => {
          const c = props.contratos.find((ct) => ct.depId === dep.id);
          if (!c) {
            return {
              id: `nocontract:${dep.id}`,
              depId: dep.id,
              status: "Inativo",
              searchHay: dep.nome.toLowerCase(),
              cols: [
                <span key="id" className={COL_MUTED_EMPTY}>—</span>,
                <span key="d" className={COL_PRIMARY}>{dep.nome}</span>,
                <span key="t" className={COL_MUTED_EMPTY}>—</span>,
                <span key="c" className={COL_MUTED_EMPTY}>—</span>,
                <span key="r" className={COL_MUTED_EMPTY}>—</span>,
                <span key="v" className={COL_MUTED_EMPTY}>—</span>,
                <FinBadge key="s" status="Inativo" />,
                <span
                  key="arrow"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                </span>,
              ],
            };
          }
          return {
            id: c.id,
            depId: c.depId,
            status: c.ativo ? "Ativo" : "Inativo",
            searchHay: `${c.depNome} ${c.cnpj ?? ""} ${c.responsavel ?? ""}`.toLowerCase(),
            cols: [
              <span key="id" className={COL_ID}>{contratoDisplayId(c, props.contratos)}</span>,
              <span key="d" className={COL_PRIMARY}>{c.depNome}</span>,
              <span key="t" className={`${PILL} ${c.tipoContrato === "consignado" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                {c.tipoContrato === "consignado" ? "Consignado" : "Padrão"}
              </span>,
              <span key="c" className={COL_MONO_MUTED}>{c.cnpj ? formatCnpj(c.cnpj) : "—"}</span>,
              <span key="r" className={COL_SECONDARY}>{c.responsavel ?? "—"}</span>,
              <span key="v" className={COL_MUTED_MONO}>
                {formatDateBr(c.vigenciaInicio ?? "")} → {formatDateBr(c.vigenciaFim ?? "")}
              </span>,
              <FinBadge key="s" status={c.ativo ? "Ativo" : "Inativo"} />,
              <span key="arrow" className={COL_ARROW}>›</span>,
            ],
          };
        }),
      };
    }
    if (tab === "insumos") {
      return {
        head: ["SKU", "Insumo", "Categoria", "Un.", "Custo", "Estoque", "Fornecedor", "Status", ""],
        showDepFilter: false,
        rightAlign: [4, 5],
        rows: props.insumos.map((i) => {
          const catColor = CATEGORIA_COLORS[i.categoria ?? ""] ?? CATEGORIA_COLOR_DEFAULT;
          const lowStock = i.estoqueInicial < i.estoqueMinimo;
          return {
            id: i.id,
            status: i.ativo ? "Ativo" : "Inativo",
            searchHay: `${i.nome} ${i.sku ?? ""} ${i.categoria ?? ""} ${i.fornecedor ?? ""}`.toLowerCase(),
            cols: [
              <span key="sku" className={COL_MONO_MUTED}>{i.sku ?? "—"}</span>,
              <span key="n" className={COL_PRIMARY}>{i.nome}</span>,
              <span
                key="cat"
                className={`${PILL} whitespace-nowrap`}
                style={{ color: catColor, backgroundColor: `${catColor}1a` }}
              >
                {i.categoria ?? "—"}
              </span>,
              <span key="u" className={COL_MUTED}>{i.unidade}</span>,
              <span key="p" className={COL_VALUE}>{fmt(i.precoUnitario)}</span>,
              <div key="est" className="leading-tight">
                <div className={`${FIN_MONO} text-[13px] font-bold ${lowStock ? "text-red-500" : "text-slate-900 dark:text-zinc-100"}`}>
                  {i.estoqueInicial}
                </div>
                <div className="mt-px text-[10.5px] text-slate-400 dark:text-zinc-500">min {i.estoqueMinimo}</div>
              </div>,
              <span key="f" className={COL_MUTED}>{i.fornecedor ?? "—"}</span>,
              <FinBadge key="s" status={i.ativo ? "Ativo" : "Inativo"} />,
              <span key="arrow" className={COL_ARROW}>›</span>,
            ],
          };
        }),
      };
    }
    if (tab === "nfse" || tab === "boletos") {
      const src = tab === "nfse" ? props.faturasNfse : props.faturasBoletos;
      return {
        head: ["Depositante", "Competência", "Valor", "Status", ""],
        showDepFilter: true,
        rows: src.map((f) => ({
          id: f.id,
          status: f.status,
          searchHay: f.depNome.toLowerCase(),
          cols: [
            <span key="d" className={COL_PRIMARY}>{f.depNome}</span>,
            <span key="m" className={COL_MUTED}>{formatMesAno(f.mesAno)}</span>,
            <span key="val" className={COL_VALUE}>{fmt(f.valor)}</span>,
            <FinBadge key="s" status={f.status} />,
            <span key="arrow" className={COL_ARROW}>›</span>,
          ],
        })),
      };
    }
    return { head: [], rows: [], showDepFilter: false };
  }

  const { head, rows, showDepFilter, rightAlign } = buildRows();
  const rightAlignSet = new Set(rightAlign ?? []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (depSel !== "all" && r.depId !== depSel) return false;
      if (statusSel !== "all" && r.status !== statusSel) return false;
      if (q && !r.searchHay.includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, depSel, statusSel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const STATUS_OPTIONS_BY_TAB: Partial<Record<Tab, string[]>> = {
    faturamento: ["ABERTA", "FECHADA", "ENVIADA", "PAGO"],
    pagar: ["Pendente", "Pago", "Vencido"],
    contratos: ["Ativo", "Inativo"],
    insumos: ["Ativo", "Inativo"],
    nfse: ["ABERTA", "FECHADA", "ENVIADA", "PAGO"],
    boletos: ["ABERTA", "FECHADA", "ENVIADA", "PAGO"],
  };
  const statusOptions = STATUS_OPTIONS_BY_TAB[tab] ?? [];

  // -------------------------------------------------------------------------
  // Drawer content per tab
  // -------------------------------------------------------------------------

  const activeFatura = tab === "faturamento" ? props.faturas.find((f) => f.id === activeId) : null;
  const activePagar = tab === "pagar" ? props.contasPagar.find((c) => c.id === activeId) : null;
  const activeContrato = tab === "contratos" ? props.contratos.find((c) => c.id === activeId) : null;
  const activeInsumo = tab === "insumos" ? props.insumos.find((i) => i.id === activeId) : null;
  const activeDoc =
    tab === "nfse" || tab === "boletos"
      ? (tab === "nfse" ? props.faturasNfse : props.faturasBoletos).find((f) => f.id === activeId)
      : null;

  const contratoBeingEdited = editContratoId ? props.contratos.find((c) => c.id === editContratoId) : null;

  const depositantesSemContrato = useMemo(
    () => props.depositantes.filter((d) => !props.contratos.some((c) => c.depId === d.id)),
    [props.depositantes, props.contratos],
  );

  const insumosFornecedores = useMemo(
    () => Array.from(new Set(props.insumos.map((i) => i.fornecedor).filter((f): f is string => Boolean(f)))),
    [props.insumos],
  );

  const faturamentoDepositantes = useMemo(
    () => props.contratos.map((c) => ({ depId: c.depId, depNome: c.depNome })),
    [props.contratos],
  );

  const showNovoBtn = tab === "faturamento" || tab === "insumos" || tab === "pagar";
  const novoLabel = tab === "insumos" ? "+ Novo insumo" : tab === "pagar" ? "+ Nova conta" : "+ Novo lançamento";
  const showExportBtn = tab === "contratos" || tab === "insumos" || tab === "faturamento";

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      {/* Header */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span className={`${FIN_HEADING} rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100`}>
          Financeiro
        </span>
        <div className="flex-1" />
        <select
          value={monthSel}
          onChange={(e) => {
            setMonthSel(e.target.value);
            setPage(1);
          }}
          className="h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-200"
        >
          <option value="all">Todos os meses</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMesAno(m)}
            </option>
          ))}
        </select>
        <NotificationBell />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col overflow-hidden px-4 pt-5 sm:px-8">
        {/* Title row */}
        <div className="mb-3.5 flex flex-shrink-0 flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Faturamento, contas, notas de serviço e contratos.
          </p>
          <div className="flex gap-2.5">
            {showExportBtn && (
              <button
                onClick={() =>
                  setModal(tab === "insumos" ? "exportInsumos" : tab === "faturamento" ? "exportFaturamento" : "exportContrato")
                }
                className="flex h-[42px] items-center rounded-[11px] border border-slate-200 bg-white px-[18px] text-[13.5px] font-bold text-slate-900 transition hover:brightness-[1.06] dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-100"
              >
                Exportar
              </button>
            )}
            {showNovoBtn && (
              <button
                onClick={() => setModal(tab === "insumos" ? "novoInsumo" : tab === "pagar" ? "novoPagar" : "novoLanc")}
                className="flex h-[42px] items-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition hover:brightness-105"
              >
                {novoLabel}
              </button>
            )}
          </div>
        </div>

        {/* KPI cards */}
        <div className="mb-6 grid flex-shrink-0 grid-cols-2 gap-4 xl:grid-cols-4">
          {kpiCards(props, monthSel).map((k) => (
            <div
              key={k.label}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101B30]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">{k.label}</span>
                <span
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
                  style={{ background: k.iconBg, color: k.iconColor }}
                >
                  <k.icon size={20} />
                </span>
              </div>
              <div className={`${FIN_HEADING} text-[30px] font-bold text-slate-900 dark:text-zinc-100`}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Tab pills */}
        <div className="mb-3 flex flex-shrink-0 justify-center">
          <div className="flex flex-wrap gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#101B30]">
            {VISIBLE_TABS.map((t) => (
              <button
                key={t}
                onClick={() => selectTab(t)}
                className={`whitespace-nowrap rounded-lg px-4 py-[9px] text-[13px] font-bold transition-all ${
                  tab === t
                    ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                    : "text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-white/5"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Search + filters (hidden on visão geral) */}
        {tab !== "visao" && (
          <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-2.5">
            <div className="flex h-[42px] flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 dark:border-white/10 dark:bg-[#101B30]">
              <SearchIcon className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar depositante, descrição..."
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none dark:text-zinc-200"
              />
            </div>
            {showDepFilter && (
              <select
                value={depSel}
                onChange={(e) => {
                  setDepSel(e.target.value);
                  setPage(1);
                }}
                className="h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-200"
              >
                <option value="all">Todos depositantes</option>
                {props.depositantes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            )}
            {statusOptions.length > 0 && (
              <select
                value={statusSel}
                onChange={(e) => {
                  setStatusSel(e.target.value);
                  setPage(1);
                }}
                className="h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-200"
              >
                <option value="all">Todos os status</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200 bg-white dark:border-white/10 dark:bg-[#101B30]">
          {tab === "visao" ? (
            <VisaoGeral props={props} monthSel={monthSel} />
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
                <table
                  className="w-full text-left text-xs"
                  style={{ minWidth: tab === "insumos" ? 1040 : tab === "contratos" ? 1020 : 880 }}
                >
                  <thead className="sticky top-0 z-[1] bg-slate-50 dark:bg-[#0E1728]">
                    <tr className="text-[10.5px] font-bold uppercase tracking-[.1em] text-slate-400 dark:text-zinc-500">
                      {head.map((h, i) => (
                        <th
                          key={h || Math.random()}
                          className={`whitespace-nowrap px-4 py-2.5 ${rightAlignSet.has(i) ? "text-right" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={head.length} className="px-4 py-12 text-center text-slate-400 dark:text-zinc-500">
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => {
                            if (r.id.startsWith("nocontract:")) {
                              setNovoContratoDepId(r.id.slice("nocontract:".length));
                              setModal("novoContrato");
                            } else {
                              setActiveId(r.id);
                            }
                          }}
                          className={`cursor-pointer border-t border-slate-500/[0.16] transition hover:bg-slate-50 dark:border-slate-400/[0.14] dark:hover:bg-white/5 ${
                            activeId === r.id ? "bg-violet-50/60 dark:bg-violet-500/10" : ""
                          }`}
                        >
                          {r.cols.map((c, i) => (
                            <td
                              key={i}
                              className={`px-4 py-3 ${i === r.cols.length - 1 || rightAlignSet.has(i) ? "text-right" : ""}`}
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-3.5 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400 dark:border-white/10 dark:text-zinc-500">
                <span>
                  {filtered.length === 0
                    ? "0"
                    : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)}`}{" "}
                  de {filtered.length}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-[30px] w-[30px] rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40 dark:border-white/10"
                >
                  ‹
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-[30px] w-[30px] rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40 dark:border-white/10"
                >
                  ›
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Drawer: Faturamento */}
      {activeFatura && (
        <Drawer onClose={() => setActiveId(null)} eyebrow="Faturamento" title={activeFatura.depNome} badge={<FinBadge status={activeFatura.status} />}>
          <Kv label="Competência" value={formatMesAno(activeFatura.mesAno)} />
          <Kv label="Vencimento" value={formatDateBr(activeFatura.vencimento)} />
          <Kv label="Valor" value={fmt(activeFatura.valor)} mono />
          <Link
            href={`/financeiro/faturas/${activeFatura.id}`}
            className={`${FIN_HEADING} mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-bold text-white`}
          >
            Ver fatura completa
          </Link>
        </Drawer>
      )}

      {/* Drawer: Contas a Pagar */}
      {activePagar && (
        <Drawer
          onClose={() => setActiveId(null)}
          eyebrow="Contas a Pagar"
          title={activePagar.fornecedor}
          subtitle={activePagar.categoria ?? undefined}
          badge={<FinBadge status={activePagar.status === "PAGO" ? "Pago" : "Pendente"} />}
        >
          <Kv label="Vencimento" value={formatDateBr(activePagar.vencimento)} />
          <Kv label="Valor" value={fmt(activePagar.valor)} mono />
          {activePagar.observacoes && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              {activePagar.observacoes}
            </div>
          )}
          {activePagar.status !== "PAGO" && (
            <button
              onClick={async () => {
                await marcarContaPagarPagaAction(activePagar.id);
                setActiveId(null);
                showToast("Marcado como pago");
                router.refresh();
              }}
              className="mt-4 h-10 w-full rounded-xl bg-emerald-500 text-sm font-bold text-white"
            >
              Marcar como pago
            </button>
          )}
        </Drawer>
      )}

      {/* Drawer: Contratos */}
      {activeContrato && (
        <Drawer
          onClose={() => setActiveId(null)}
          eyebrow="Contrato"
          title={activeContrato.depNome}
          subtitle={<span className={FIN_MONO}>{contratoDisplayId(activeContrato, props.contratos)}</span>}
          badge={<FinBadge status={activeContrato.ativo ? "Ativo" : "Inativo"} />}
          icon={
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              {activeContrato.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeContrato.logoUrl} alt={`Logo ${activeContrato.depNome}`} className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-6 w-6 text-slate-400 dark:text-zinc-500" />
              )}
            </div>
          }
          footer={
            <button
              onClick={() => {
                setEditContratoId(activeContrato.id);
                setModal("editContrato");
                setActiveId(null);
              }}
              className={`${FIN_HEADING} h-10 w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-bold text-white transition hover:brightness-105`}
            >
              Editar
            </button>
          }
        >
          <Kv label="CNPJ" value={activeContrato.cnpj ? formatCnpj(activeContrato.cnpj) : "—"} mono />
          <Kv label="Tipo" value={activeContrato.tipoContrato === "consignado" ? "Consignado" : "Padrão"} />
          <Kv label="Responsável" value={activeContrato.responsavel ?? "—"} />
          <Kv label="E-mails" value={activeContrato.emailsCobranca?.length ? activeContrato.emailsCobranca.join(", ") : "—"} />
          <Kv label="Vigência" value={`${formatDateBr(activeContrato.vigenciaInicio ?? "")} → ${formatDateBr(activeContrato.vigenciaFim ?? "")}`} mono />
          <DrawerSection title="Expedição">
            <MiniKv label="Taxa fulfillment" value={`${(activeContrato.taxaFulfillment * 100).toFixed(1)}%`} />
            <MiniKv label="Mínimo fulfillment" value={fmt(activeContrato.minimoFulfillment)} />
            <MiniKv label="Ponto de coleta" value={fmt(activeContrato.valorPontoColeta)} />
            <MiniKv label="Impressão NF" value={fmt(activeContrato.valorImpressaoNf)} />
          </DrawerSection>
          <DrawerSection title="Armazenamento">
            <MiniKv label="Tarifa posição/mês" value={fmt(activeContrato.tarifaPosicao)} />
            <MiniKv label="Tarifa recebimento" value={fmt(activeContrato.tarifaRecebimento)} />
            <MiniKv label="Logística reversa" value={fmt(activeContrato.valorLogisticaReversa)} />
          </DrawerSection>
          {activeContrato.observacoes && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              {activeContrato.observacoes}
            </div>
          )}
        </Drawer>
      )}

      {/* Drawer: Insumos */}
      {activeInsumo && (
        <Drawer onClose={() => setActiveId(null)} eyebrow="Catálogo" title={activeInsumo.nome} badge={<FinBadge status={activeInsumo.ativo ? "Ativo" : "Inativo"} />}>
          <Kv label="Unidade" value={activeInsumo.unidade} />
          <Kv label="Preço unitário" value={fmt(activeInsumo.precoUnitario)} mono />
        </Drawer>
      )}

      {/* Drawer: NFS-e / Boletos */}
      {activeDoc && (
        <Drawer
          onClose={() => setActiveId(null)}
          eyebrow={tab === "nfse" ? "NFS-e" : "Boleto"}
          title={activeDoc.depNome}
          subtitle={formatMesAno(activeDoc.mesAno)}
          badge={<FinBadge status={activeDoc.status} />}
        >
          <Kv label="Competência" value={formatMesAno(activeDoc.mesAno)} />
          <Kv label="Valor" value={fmt(activeDoc.valor)} mono />
          <Kv label="Arquivo" value={activeDoc.docNome ?? "—"} />
          <Link
            href={activeDoc.docUrl}
            target="_blank"
            className={`${FIN_HEADING} mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-bold text-white`}
          >
            <Download className="h-4 w-4" /> Baixar {tab === "nfse" ? "NFS-e" : "boleto"}
          </Link>
        </Drawer>
      )}

      {/* Modal: novo lançamento */}
      {modal === "novoLanc" && (
        <Modal title="Novo lançamento" eyebrow="Faturamento" onClose={closeModal} wide>
          <LancamentoForm depositantes={props.depositantes} onSuccess={() => onFormSuccess("Lançamento criado com sucesso.")} onCancel={closeModal} />
        </Modal>
      )}

      {/* Modal: novo insumo */}
      {modal === "novoInsumo" && (
        <Modal title="Novo insumo" eyebrow="Catálogo" onClose={closeModal}>
          <InsumoForm currentEditItem={null} onSuccess={() => onFormSuccess("Insumo cadastrado com sucesso.")} onCancel={closeModal} />
        </Modal>
      )}

      {/* Modal: nova conta a pagar */}
      {modal === "novoPagar" && (
        <Modal title="Nova conta a pagar" eyebrow="Contas a Pagar" onClose={closeModal}>
          <ContaPagarForm onSuccess={() => onFormSuccess("Conta a pagar cadastrada com sucesso.")} />
        </Modal>
      )}

      {/* Modal: editar contrato */}
      {modal === "editContrato" && contratoBeingEdited && (
        <ContratoForm
          depositantes={props.depositantes}
          currentEditItem={{
            id: contratoBeingEdited.id,
            depositante_id: contratoBeingEdited.depId,
            taxa_fulfillment: contratoBeingEdited.taxaFulfillment,
            minimo_fulfillment: contratoBeingEdited.minimoFulfillment,
            tarifa_posicao: contratoBeingEdited.tarifaPosicao,
            valor_ponto_coleta: contratoBeingEdited.valorPontoColeta,
            valor_impressao_nf: contratoBeingEdited.valorImpressaoNf,
            taxa_frete_fixa: contratoBeingEdited.taxaFreteFixa,
            taxa_frete_percentual: contratoBeingEdited.taxaFretePercentual,
            tarifa_recebimento: contratoBeingEdited.tarifaRecebimento,
            valor_logistica_reversa: contratoBeingEdited.valorLogisticaReversa,
            valor_software: contratoBeingEdited.valorSoftware,
            qtd_refrigeradores: contratoBeingEdited.qtdRefrigeradores,
            valor_unitario_refrigerador: contratoBeingEdited.valorUnitarioRefrigerador,
            tipo_contrato: contratoBeingEdited.tipoContrato,
            responsavel: contratoBeingEdited.responsavel,
            emails_cobranca: contratoBeingEdited.emailsCobranca,
            marketplaces_ponto_coleta: contratoBeingEdited.marketplacesPontoColeta,
            vigencia_inicio: contratoBeingEdited.vigenciaInicio,
            vigencia_fim: contratoBeingEdited.vigenciaFim,
            observacoes: contratoBeingEdited.observacoes,
            ativo: contratoBeingEdited.ativo,
          }}
          onSuccess={() => onFormSuccess("Contrato atualizado com sucesso.")}
          onClose={closeModal}
        />
      )}

      {/* Modal: novo contrato — sem contrato o depositante nunca é cobrado, então
          esse fluxo de criação existe mesmo não estando no mockup original */}
      {modal === "novoContrato" && (
        <ContratoForm
          depositantes={depositantesSemContrato}
          currentEditItem={null}
          defaultDepositanteId={novoContratoDepId}
          onSuccess={() => onFormSuccess("Contrato criado com sucesso.")}
          onClose={closeModal}
        />
      )}

      {/* Modal: exportar contrato — igual ao mockup (seleção de depositante + formato) */}
      {modal === "exportContrato" && (
        <Modal title="Exportar contrato" eyebrow="Exportar" onClose={closeModal}>
          <p className="-mt-2 mb-4 text-[13px] text-slate-500 dark:text-zinc-400">
            Selecione o depositante para exportar o contrato completo.
          </p>
          <div className="flex flex-col gap-3.5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.05em] text-slate-500 dark:text-zinc-400">
                Depositante
              </span>
              <select
                value={exportDep}
                onChange={(e) => setExportDep(e.target.value)}
                className="h-11 w-full rounded-[9px] border border-slate-200 bg-white px-3 text-[13.5px] font-medium text-slate-700 outline-none dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200"
              >
                <option value="">Selecione…</option>
                {props.contratos.map((c) => (
                  <option key={c.depId} value={c.depId}>
                    {c.depNome}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-zinc-400">
                Formato
              </div>
              <div className="flex gap-2">
                {(["pdf", "docx"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setExportFormato(f)}
                    className={`h-10 flex-1 rounded-[10px] border-2 text-[13.5px] font-bold uppercase transition ${
                      exportFormato === f
                        ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-500/5 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200 dark:hover:border-violet-500/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <button
              onClick={handleExportContratoSubmit}
              className="h-10 w-full rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-[13px] font-extrabold text-white transition hover:brightness-[1.06]"
            >
              Exportar
            </button>
          </div>
        </Modal>
      )}

      {modal === "exportInsumos" &&
        (() => {
          const scopeRadio = (value: typeof exportInsumosEscopo, label: string, desc: string) => {
            const selected = exportInsumosEscopo === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setExportInsumosEscopo(value)}
                className={`flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition ${
                  selected
                    ? "border-violet-500 bg-violet-500/[0.08]"
                    : "border-slate-200 bg-slate-50 hover:border-violet-300 dark:border-white/10 dark:bg-[#0E1728] dark:hover:border-violet-500/40"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? "border-violet-500" : "border-slate-300 dark:border-white/20"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-violet-500" />}
                </span>
                <span>
                  <span className="block text-[13.5px] font-bold text-slate-900 dark:text-zinc-100">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">{desc}</span>
                </span>
              </button>
            );
          };
          return (
            <Modal title="Exportar insumos" eyebrow="Exportar" onClose={closeModal}>
              <p className="-mt-2 mb-4 text-[13px] text-slate-500 dark:text-zinc-400">Escolha o escopo e o formato.</p>
              <div className="flex flex-col gap-2.5">
                {scopeRadio("todos", "Todos os insumos", "Exporta o catálogo completo.")}
                {scopeRadio("categoria", "Filtrar por categoria", "Escolha uma categoria específica.")}
                {exportInsumosEscopo === "categoria" && (
                  <select
                    value={exportInsumosCategoria}
                    onChange={(e) => setExportInsumosCategoria(e.target.value)}
                    className="ml-8 h-11 w-[calc(100%-2rem)] rounded-[9px] border border-slate-200 bg-white px-3 text-[13.5px] font-medium text-slate-700 outline-none dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200"
                  >
                    {["Embalagem", "Etiqueta", "Proteção", "Higiene", "Outros"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
                {scopeRadio("fornecedor", "Filtrar por fornecedor", "Escolha um fornecedor específico.")}
                {exportInsumosEscopo === "fornecedor" && (
                  <select
                    value={exportInsumosFornecedor}
                    onChange={(e) => setExportInsumosFornecedor(e.target.value)}
                    className="ml-8 h-11 w-[calc(100%-2rem)] rounded-[9px] border border-slate-200 bg-white px-3 text-[13.5px] font-medium text-slate-700 outline-none dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200"
                  >
                    <option value="">Selecione…</option>
                    {insumosFornecedores.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                )}
                <div className="mt-1.5">
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-zinc-400">
                    Formato
                  </div>
                  <div className="flex gap-2">
                    {(["csv", "xlsx", "pdf"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setExportInsumosFormato(f)}
                        className={`h-10 flex-1 rounded-[10px] border-2 text-[13.5px] font-bold uppercase transition ${
                          exportInsumosFormato === f
                            ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                            : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-500/5 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200 dark:hover:border-violet-500/40"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <button
                  onClick={handleExportInsumosSubmit}
                  className="h-10 w-full rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-[13px] font-extrabold text-white transition hover:brightness-[1.06]"
                >
                  Exportar
                </button>
              </div>
            </Modal>
          );
        })()}

      {modal === "exportFaturamento" && (
        <Modal title="Exportar faturamento" eyebrow="Exportar" onClose={closeModal}>
          <p className="-mt-2 mb-4 text-[13px] text-slate-500 dark:text-zinc-400">
            Selecione o depositante para exportar o faturamento.
          </p>
          <div className="flex flex-col gap-3.5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.05em] text-slate-500 dark:text-zinc-400">
                Depositante
              </span>
              <select
                value={exportFatDep}
                onChange={(e) => setExportFatDep(e.target.value)}
                className="h-11 w-full rounded-[9px] border border-slate-200 bg-white px-3 text-[13.5px] font-medium text-slate-700 outline-none dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200"
              >
                <option value="">Selecione…</option>
                {faturamentoDepositantes.map((d) => (
                  <option key={d.depId} value={d.depId}>
                    {d.depNome}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-zinc-400">
                Formato
              </div>
              <div className="flex gap-2">
                {(["csv", "xlsx", "pdf"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setExportFatFormato(f)}
                    className={`h-10 flex-1 rounded-[10px] border-2 text-[13.5px] font-bold uppercase transition ${
                      exportFatFormato === f
                        ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-500/5 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200 dark:hover:border-violet-500/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <button
              onClick={handleExportFaturamentoSubmit}
              className="h-10 w-full rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-[13px] font-extrabold text-white transition hover:brightness-[1.06]"
            >
              Exportar
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 rounded-xl border border-violet-400/40 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-slate-900 shadow-2xl dark:bg-[#0C1526] dark:text-zinc-100">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function kpiCards(props: Props, monthSel: string) {
  const faturasNoMes = monthSel === "all" ? props.faturas : props.faturas.filter((f) => f.mesAno === monthSel);
  const totalFaturamento = faturasNoMes.reduce((a, f) => a + f.valor, 0);
  const aReceber = faturasNoMes.filter((f) => f.status !== "PAGO").reduce((a, f) => a + f.valor, 0);
  const recebido = faturasNoMes.filter((f) => f.status === "PAGO").reduce((a, f) => a + f.valor, 0);
  const fechadas = faturasNoMes.filter((f) => f.status === "FECHADA" || f.status === "ENVIADA" || f.status === "PAGO").length;

  return [
    {
      label: monthSel === "all" ? "Faturamento total" : "Faturamento no mês",
      value: fmt(totalFaturamento),
      icon: CircleDollarSign,
      iconBg: "rgba(59,130,246,0.15)",
      iconColor: "#3B82F6",
    },
    {
      label: "A receber",
      value: fmt(aReceber),
      icon: Clock,
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: "#F59E0B",
    },
    {
      label: "Recebido",
      value: fmt(recebido),
      icon: CheckCircle2,
      iconBg: "rgba(16,185,129,0.15)",
      iconColor: "#10B981",
    },
    {
      label: "Faturas fechadas",
      value: String(fechadas),
      icon: Receipt,
      iconBg: "rgba(139,92,246,0.15)",
      iconColor: "#8B5CF6",
    },
  ];
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

function VisaoGeral({ props, monthSel }: { props: Props; monthSel: string }) {
  const extrato = useMemo(() => {
    if (monthSel === "all") return props.extrato;
    return props.extrato.filter((e) => `${e.data.slice(6, 10)}-${e.data.slice(3, 5)}` === monthSel);
  }, [props.extrato, monthSel]);

  const faturasNoMes = monthSel === "all" ? props.faturas : props.faturas.filter((f) => f.mesAno === monthSel);

  const byDep = useMemo(() => {
    const m: Record<string, number> = {};
    faturasNoMes.forEach((f) => (m[f.depNome] = (m[f.depNome] ?? 0) + f.valor));
    return Object.entries(m)
      .map(([dep, val]) => ({ dep, val }))
      .sort((a, b) => b.val - a.val);
  }, [faturasNoMes]);
  const maxDep = byDep.reduce((m, d) => Math.max(m, d.val), 1);

  const pagas = faturasNoMes.filter((f) => f.status === "PAGO").length;
  const pendentes = faturasNoMes.filter((f) => f.status === "ABERTA" || f.status === "ENVIADA").length;
  const fechadas = faturasNoMes.filter((f) => f.status === "FECHADA").length;

  const tipoColor: Record<string, string> = {
    Fulfillment: "#3B82F6",
    "Ponto de coleta": "#8B5CF6",
    "Impressão NF": "#EF4444",
    "Gestão de frete": "#6366F1",
    "Logística reversa": "#F43F5E",
    Recebimento: "#0EA5E9",
    Armazenagem: "#10B981",
    Software: "#14B8A6",
    Refrigerador: "#F59E0B",
    Insumo: "#F97316",
    Desconto: "#EC4899",
    "Cobrança extra": "#64748B",
  };

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
            Extrato {monthSel === "all" ? "(todos)" : `(${formatMesAno(monthSel)})`}
          </div>
          {extrato.length === 0 ? (
            <p className="text-sm italic text-slate-400 dark:text-zinc-500">Sem lançamentos no período.</p>
          ) : (
            <div className="flex max-h-[420px] flex-col gap-1.5 overflow-auto pr-1">
              {extrato.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-[#101B30]"
                >
                  <span
                    className="min-w-[100px] rounded-full px-2 py-0.5 text-center text-[10.5px] font-bold"
                    style={{ color: tipoColor[r.tipo] ?? "#94A3B8", background: `${tipoColor[r.tipo] ?? "#94A3B8"}1a` }}
                  >
                    {r.tipo}
                  </span>
                  <span className="min-w-[100px] truncate font-bold text-slate-700 dark:text-zinc-300">{r.depNome}</span>
                  <div className="flex-1" />
                  <span className={`${FIN_MONO} whitespace-nowrap text-slate-400 dark:text-zinc-500`}>{r.codigo}</span>
                  <span className="mr-4 whitespace-nowrap text-slate-400 dark:text-zinc-500">{r.data}</span>
                  <span className={`${FIN_MONO} min-w-[90px] whitespace-nowrap text-right font-bold text-slate-900 dark:text-zinc-100`}>
                    {fmt(r.valor)}
                  </span>
                  <FinBadge status="Faturado" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <SmallCard title="Faturamento por depositante">
            {byDep.length === 0 ? (
              <p className="text-[12.5px] italic text-slate-400 dark:text-zinc-500">—</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {byDep.map((d) => (
                  <div key={d.dep}>
                    <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      <span>{d.dep}</span>
                      <span className={FIN_MONO}>{fmt(d.val)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${(d.val / maxDep) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SmallCard>

          <SmallCard title="Status das faturas">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold text-emerald-500">● Pagas</span>
                <span className={`${FIN_MONO} font-bold text-slate-900 dark:text-zinc-100`}>{pagas}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-amber-500">● Pendentes</span>
                <span className={`${FIN_MONO} font-bold text-slate-900 dark:text-zinc-100`}>{pendentes}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-red-500">● Fechadas sem pagamento</span>
                <span className={`${FIN_MONO} font-bold text-slate-900 dark:text-zinc-100`}>{fechadas}</span>
              </div>
            </div>
          </SmallCard>

          <SmallCard title="Insumos consumidos">
            <div className={`${FIN_HEADING} text-[22px] font-bold text-slate-900 dark:text-zinc-100`}>
              {fmt(extrato.filter((e) => e.tipo === "Insumos").reduce((a, e) => a + e.valor, 0))}
            </div>
          </SmallCard>
        </div>
      </div>
    </div>
  );
}

function SmallCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">{title}</div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer + Modal primitives
// ---------------------------------------------------------------------------

function Drawer({
  onClose,
  eyebrow,
  title,
  subtitle,
  badge,
  icon,
  children,
  footer,
}: {
  onClose: () => void;
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0C1526]">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div className="mb-2.5 flex items-center gap-2">
            {badge}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10 dark:text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`${FIN_HEADING} mb-1 text-[11px] font-bold uppercase tracking-widest text-violet-500`}>{eyebrow}</div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`${FIN_HEADING} text-lg font-bold text-slate-900 dark:text-zinc-100`}>{title}</div>
              {subtitle && <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{subtitle}</div>}
            </div>
            {icon}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="border-t border-slate-200 px-6 py-4 dark:border-white/10">{footer}</div>}
      </aside>
    </div>
  );
}

function Kv({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 text-sm dark:border-white/5">
      <span className="shrink-0 text-slate-500 dark:text-zinc-400">{label}</span>
      <span className={`min-w-0 flex-1 break-words text-right font-semibold text-slate-900 dark:text-zinc-100 ${mono ? `${FIN_MONO} text-xs` : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function MiniKv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12.5px]">
      <span className="text-slate-500 dark:text-zinc-400">{label}</span>
      <span className={`${FIN_MONO} font-semibold text-slate-900 dark:text-zinc-100`}>{value}</span>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-violet-500">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  wide,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0C1526] ${
          wide ? "max-w-[640px]" : "max-w-[500px]"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div>
            <div className={`${FIN_HEADING} mb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-violet-500`}>{eyebrow}</div>
            <h3 className={`${FIN_HEADING} text-xl font-bold text-slate-900 dark:text-zinc-100`}>{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10 dark:text-zinc-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
